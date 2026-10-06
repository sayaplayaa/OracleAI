import type {
  CoachReport,
  CrossMatchPatterns,
  DraftInsights,
  HeroAbility,
  HeroGuideReport,
  HeroRoleOverview,
  MatchAnalysis,
  MatchStory,
  PowerSpikeReport,
  ProHeroSpotlight,
  RoleComparisonEntry,
  SkillBuildEntry,
  TrendMetrics,
} from "../types";
import type { HeroPerformanceSummary } from "../metrics/signatureHero";
import { buildMatchCoachReportTool, coachReportTool, heroGuideTool, powerSpikeTool } from "./schema";
import {
  SYSTEM_PROMPT,
  buildHeroCoachPrompt,
  buildHeroGuidePrompt,
  buildMatchStoryCoachPrompt,
  buildProComparisonPrompt,
  buildTrendCoachPrompt,
  buildTrendData,
} from "./prompt";
import { keepGroundedFindings } from "./grounding";
import { trendPriorities, trendStrengths } from "./trendFindings";
import {
  assembleMatchReport,
  buildMatchCoachPrompt,
  buildMatchSystemPrompt,
  type RawMatchReport,
} from "./matchPrompt";
import {
  assemblePowerSpikeReport,
  buildPowerSpikeData,
  buildPowerSpikePrompt,
  type RawPowerSpikeReport,
} from "./powerSpikePrompt";

interface ResponseSchema {
  description?: string;
  input_schema: Record<string, unknown>;
}

interface SchemaNode {
  type?: string;
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  minItems?: number;
  maxItems?: number;
}

function itemCount(node: SchemaNode): string {
  const { minItems: min, maxItems: max } = node;
  if (min !== undefined && max !== undefined) return min === max ? `ровно ${min}` : `${min}-${max}`;
  if (max !== undefined) return `до ${max}`;
  if (min !== undefined) return `от ${min}`;
  return "";
}

function fieldLines(node: SchemaNode, indent: string): string[] {
  return Object.entries(node.properties ?? {}).flatMap(([name, child]) => {
    const count = child.type === "array" ? itemCount(child) : "";
    const label = child.type === "array" ? ` (список${count ? `, пунктов: ${count}` : ""})` : "";
    const nested = child.type === "array" ? child.items : child;
    return [
      `${indent}- "${name}"${label}: ${child.description ?? ""}`.trimEnd(),
      ...(nested?.properties ? fieldLines(nested, `${indent}  `) : []),
    ];
  });
}

// Ollama's `format` only constrains the JSON's shape - the field descriptions
// in the schema never reach the model, which then guesses from the names
// alone (it put ability names in "point" and the advice in "metric"). So the
// same descriptions are spelled out in the prompt.
function responseFormatGuide(tool: ResponseSchema): string {
  return [
    "ФОРМАТ ОТВЕТА: верни JSON с этими полями и пиши в каждое поле именно то, что описано.",
    ...(tool.description ? [tool.description] : []),
    ...fieldLines(tool.input_schema as SchemaNode, ""),
  ].join("\n");
}

interface OllamaChatChunk {
  message?: { content?: string };
  error?: string;
  done?: boolean;
  done_reason?: string;
}

// Ollama's default context window is 4096 tokens and it silently drops the
// start of any longer prompt - the system rules first. The window is picked
// per request from the prompt's size: the small step when the prompt and the
// answer fit in it (less GPU memory, faster load), the next one otherwise.
// OLLAMA_NUM_CTX caps it.
const CONTEXT_STEPS = [4096, 8192, 12288, 16384];
const DEFAULT_MAX_CTX = 8192;
// Room for the answer; reports run ~600-1500 tokens.
const RESPONSE_TOKENS = 1536;
// qwen3's tokenizer averages 2.7-2.8 characters per token on these prompts
// (Russian text with embedded JSON, measured); 2.6 keeps a margin.
const CHARS_PER_TOKEN = 2.6;

// When Ollama's own placement doesn't fit (on Windows it can count on more
// free VRAM than the driver actually hands out), the model is loaded again
// with only this many layers on the GPU and the rest on the CPU: slower, but
// the whole prompt stays in context. OLLAMA_NUM_GPU pins it instead.
const GPU_LAYER_FALLBACKS = [24, 16, 8];
// The placement that worked per context size, so later requests skip the
// failed loads (each costs 20-40 s). Forgotten after a while, since memory
// may have been freed in the meantime.
const PLACEMENT_TTL_MS = 30 * 60 * 1000;
const placements = new Map<number, { numGpu: number | undefined; at: number }>();

const LOAD_FAILURE = /out of memory|cudaMalloc|failed to allocate|process has terminated|CUDA error|mem_buffer/i;

class OllamaLoadError extends Error {}

const CYRILLIC = /\p{Script=Cyrillic}/u;
// Below this share of Russian sentences the model ignored the language rule
// (it occasionally slips back into English) and the report is regenerated once.
const MIN_RUSSIAN_SHARE = 0.7;
const RUSSIAN_REMINDER =
  "\n\nВАЖНО: предыдущий ответ был не на русском языке. Весь текст ответа пиши только на русском; имена героев, способностей и предметов оставляй как в данных.";

// Share of the report's prose fields (strings with a space, i.e. sentences -
// not ids like "laning") that contain Cyrillic.
function russianShare(value: unknown): number {
  const sentences: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim().length >= 15 && /\s/.test(v.trim())) sentences.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
  if (sentences.length === 0) return 1;
  return sentences.filter((s) => CYRILLIC.test(s)).length / sentences.length;
}

function ollamaConfig() {
  const forcedGpu = Number(process.env.OLLAMA_NUM_GPU);
  return {
    baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen3:8b",
    maxCtx: Number(process.env.OLLAMA_NUM_CTX) || DEFAULT_MAX_CTX,
    forcedGpu: process.env.OLLAMA_NUM_GPU && Number.isInteger(forcedGpu) && forcedGpu >= 0 ? forcedGpu : undefined,
  };
}

type OllamaConfig = ReturnType<typeof ollamaConfig>;

function pickContext(promptChars: number, maxCtx: number): number {
  const needed = Math.ceil(promptChars / CHARS_PER_TOKEN) + RESPONSE_TOKENS;
  const numCtx = CONTEXT_STEPS.find((step) => step >= needed && step <= maxCtx) ?? maxCtx;
  if (needed > numCtx) {
    console.warn(
      `[coach] prompt needs ~${needed} tokens with the answer but the context is capped at ${numCtx} - Ollama will cut its start; raise OLLAMA_NUM_CTX.`
    );
  }
  return numCtx;
}

function ollamaErrorText(raw: string): string {
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? raw;
  } catch {
    return raw;
  }
}

function firstLine(text: string): string {
  return text.split("\n")[0];
}

// Streamed, so tokens arrive as they're generated: on a slow machine a long
// report takes several minutes, and fetch gives up after 5 minutes of waiting
// for the first byte of a response.
async function chatOnce(
  config: OllamaConfig,
  body: Record<string, unknown>
): Promise<{ content: string; doneReason: string | undefined }> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true }),
    });
  } catch {
    throw new Error(
      `Не удалось подключиться к Ollama по адресу ${config.baseUrl}. Запусти Ollama (приложение или команда «ollama serve») и повтори.`
    );
  }

  if (!response.ok || !response.body) {
    const message = ollamaErrorText(await response.text());
    if (response.status === 404 && /not found/i.test(message)) {
      throw new Error(`В Ollama нет модели ${config.model}. Скачай её командой «ollama pull ${config.model}» и повтори.`);
    }
    if (LOAD_FAILURE.test(message)) throw new OllamaLoadError(message);
    throw new Error(`Ollama вернула ошибку (${response.status}): ${message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let content = "";
  let doneReason: string | undefined;
  let streamError: Error | null = null;
  const take = (line: string) => {
    if (!line.trim() || streamError) return;
    const chunk = JSON.parse(line) as OllamaChatChunk;
    if (chunk.error) {
      streamError = LOAD_FAILURE.test(chunk.error)
        ? new OllamaLoadError(chunk.error)
        : new Error(`Ollama вернула ошибку: ${chunk.error}`);
      return;
    }
    content += chunk.message?.content ?? "";
    if (chunk.done) doneReason = chunk.done_reason;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      lines.forEach(take);
    }
    take(buffered);
  } catch {
    throw new Error("Ollama оборвала ответ на середине - возможно, процесс модели упал. Попробуй ещё раз.");
  }
  if (streamError) throw streamError;
  return { content, doneReason };
}

async function callOllama<T>(task: string, tool: ResponseSchema, systemPrompt: string): Promise<T> {
  const config = ollamaConfig();
  const userPrompt = `${task}\n\n${responseFormatGuide(tool)}`;
  const numCtx = pickContext(systemPrompt.length + userPrompt.length, config.maxCtx);
  const remembered = placements.get(numCtx);
  const knownGpu =
    remembered && Date.now() - remembered.at < PLACEMENT_TTL_MS ? remembered.numGpu : undefined;

  // undefined = let Ollama place the layers itself.
  const attempts: (number | undefined)[] =
    config.forcedGpu !== undefined
      ? [config.forcedGpu]
      : knownGpu !== undefined
        ? [knownGpu, ...GPU_LAYER_FALLBACKS.filter((n) => n < knownGpu)]
        : [undefined, ...GPU_LAYER_FALLBACKS];

  let lastLoadError = "";
  for (const numGpu of attempts) {
    let result: { content: string; doneReason: string | undefined };
    try {
      result = await chatOnce(config, {
        model: config.model,
        think: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: tool.input_schema,
        options: { temperature: 0.3, num_ctx: numCtx, ...(numGpu !== undefined ? { num_gpu: numGpu } : {}) },
      });
    } catch (err) {
      if (!(err instanceof OllamaLoadError)) throw err;
      lastLoadError = firstLine(err.message);
      console.warn(
        `[coach] ${config.model} didn't load with num_ctx=${numCtx}${numGpu !== undefined ? `, num_gpu=${numGpu}` : ""}: ${lastLoadError}`
      );
      continue;
    }

    placements.set(numCtx, { numGpu, at: Date.now() });
    if (!result.content) throw new Error("ИИ-тренер не вернул структурированный отчёт.");
    try {
      return JSON.parse(result.content) as T;
    } catch {
      throw new Error(
        result.doneReason === "length"
          ? "Ответ ИИ-тренера не уместился в контекст модели. Увеличь OLLAMA_NUM_CTX в .env.local."
          : "ИИ-тренер вернул некорректный JSON."
      );
    }
  }

  throw new Error(
    `Ollama не хватило памяти, чтобы загрузить ${config.model} с контекстом ${numCtx} токенов - даже с частью слоёв на процессоре. ` +
      "Закрой игры и программы, которые нагружают видеокарту и память (браузер с аппаратным ускорением, Discord), и повтори. " +
      `Если не помогает - поставь модель поменьше: «ollama pull qwen3:4b» и OLLAMA_MODEL=qwen3:4b в .env.local. (${lastLoadError})`
  );
}

// Every report is Russian-only; when the model slips into English it's asked
// once more with an explicit reminder (the validators downstream would
// otherwise just drop the English sentences, leaving a thin report).
async function runCoach<T>(
  userPrompt: string,
  tool: ResponseSchema,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<T> {
  const first = await callOllama<T>(userPrompt, tool, systemPrompt);
  if (russianShare(first) >= MIN_RUSSIAN_SHARE) return first;
  const second = await callOllama<T>(userPrompt + RUSSIAN_REMINDER, tool, systemPrompt);
  return russianShare(second) >= russianShare(first) ? second : first;
}

// The model often wraps names it treats as specific real things (an ability,
// an item) in markdown **bold**, but this app's UI renders these fields as
// plain text with no markdown parser, so left alone the literal asterisks
// leak straight into what the user reads.
function stripMarkdownEmphasis<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1") as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripMarkdownEmphasis(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) result[k] = stripMarkdownEmphasis(v);
    return result as T;
  }
  return value;
}

// The model sometimes fills a list by repeating a finding word for word.
function dropRepeatedFindings<T>(value: T): T {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    return value
      .filter((item) => {
        const point = (item as { point?: unknown } | null)?.point;
        if (typeof point !== "string") return true;
        const key = point.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => dropRepeatedFindings(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) result[k] = dropRepeatedFindings(v);
    return result as T;
  }
  return value;
}

// The model declines English game names by gluing Russian case endings onto
// them ("Huskarу", "Lionа", "Blinkом") - the game never declines them - and
// sometimes measures gold in "points" ("1404 очков нетворса").
const GLUED_ENDING = /([A-Za-z][A-Za-z'’]*)[а-яё]{1,3}(?![\p{L}])/gu;
const POINTS_OF_GOLD = /(\d[\d\s]*?)\s*очк\p{L}*\s+(нетворса|золота)/giu;

function fixLanguage<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(GLUED_ENDING, "$1").replace(POINTS_OF_GOLD, "$1 золота") as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => fixLanguage(v)) as unknown as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) result[k] = fixLanguage(v);
    return result as T;
  }
  return value;
}

function tidy<T>(report: T): T {
  return dropRepeatedFindings(fixLanguage(stripMarkdownEmphasis(report)));
}

export async function coachMatch(analysis: MatchAnalysis): Promise<CoachReport> {
  const tool = buildMatchCoachReportTool(analysis.phases.map((p) => p.id));
  const raw = await runCoach<RawMatchReport>(
    buildMatchCoachPrompt(analysis),
    tool,
    buildMatchSystemPrompt(analysis)
  );
  // Prompt rules alone don't reliably hold on this model - the output is
  // re-checked against the real analysis rather than trusted.
  return tidy(assembleMatchReport(raw, analysis));
}

export async function coachTrends(
  metrics: TrendMetrics,
  patterns: CrossMatchPatterns
): Promise<CoachReport> {
  const data = buildTrendData(metrics, patterns);
  const priorities = trendPriorities(metrics, patterns);
  const report = await runCoach<CoachReport>(buildTrendCoachPrompt(data, priorities), coachReportTool);
  // Prompt rules alone don't reliably hold on this model - a finding whose
  // numbers aren't in the data is dropped rather than shown. What to work on
  // comes from the verified patterns when there are any: the model's own tips
  // were generic ("улучшите умение управлять ситуацией в боях").
  const grounded = keepGroundedFindings(tidy(report), data);
  const verified = trendStrengths(metrics, patterns);
  // A wins-vs-losses gap is the difference between good and bad games, not
  // a strength - the model kept filing it there anyway.
  const modelStrengths = grounded.strengths.filter((f) => !/в победах|в поражениях/i.test(f.metric));
  return {
    ...grounded,
    strengths: [...verified, ...modelStrengths].slice(0, 4),
    tips: priorities.length > 0 ? priorities : grounded.tips,
  };
}

export async function coachMatchStory(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(
    buildMatchStoryCoachPrompt(roleComparisons, matchStory),
    coachReportTool
  );
  return tidy(report);
}

export async function coachHero(performance: HeroPerformanceSummary): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(buildHeroCoachPrompt(performance), coachReportTool);
  return tidy(report);
}

export async function coachProComparison(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(
    buildProComparisonPrompt(userPerformance, proSpotlight),
    coachReportTool
  );
  return tidy(report);
}

export async function coachHeroGuide(
  heroName: string,
  abilities: HeroAbility[],
  roleOverview: HeroRoleOverview,
  matchups: DraftInsights
): Promise<HeroGuideReport> {
  const report = await runCoach<HeroGuideReport>(
    buildHeroGuidePrompt(heroName, abilities, roleOverview, matchups),
    heroGuideTool
  );
  return tidy(report);
}

export async function coachPowerSpike(
  heroName: string,
  abilities: HeroAbility[],
  itemTimeline: { time: number; itemName: string; itemKey: string }[],
  skillBuild: SkillBuildEntry[]
): Promise<PowerSpikeReport> {
  const data = buildPowerSpikeData(heroName, abilities, itemTimeline, skillBuild);
  const raw = await runCoach<RawPowerSpikeReport>(buildPowerSpikePrompt(data), powerSpikeTool);
  // Prompt rules alone don't reliably hold on this model - the output is
  // re-checked against the real data rather than trusted.
  return tidy(assemblePowerSpikeReport(raw, data));
}
