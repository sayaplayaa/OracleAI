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
} from "./prompt";
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
  input_schema: Record<string, unknown>;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
  prompt_eval_count?: number;
}

// Ollama's default context window is 4096 tokens and it silently drops the
// start of any longer prompt - the system rules first. Coach prompts run to
// several thousand tokens, so ask for a window that actually fits them.
const DEFAULT_NUM_CTX = 8192;

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

async function callOllama<T>(userPrompt: string, tool: ResponseSchema, systemPrompt: string): Promise<T> {
  const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "qwen3:8b";
  const numCtx = Number(process.env.OLLAMA_NUM_CTX) || DEFAULT_NUM_CTX;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: tool.input_schema,
        options: { temperature: 0.3, num_ctx: numCtx },
      }),
    });
  } catch {
    throw new Error(
      `Не удалось подключиться к Ollama по адресу ${baseUrl}. Запусти «ollama serve» и проверь, что модель ${model} скачана (ollama pull ${model}).`
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama вернула ошибку (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  if (data.prompt_eval_count && data.prompt_eval_count >= numCtx * 0.95) {
    console.warn(
      `[coach] prompt used ${data.prompt_eval_count} of ${numCtx} context tokens - it may have been truncated; raise OLLAMA_NUM_CTX.`
    );
  }
  const content = data.message?.content;
  if (!content) {
    throw new Error("ИИ-тренер не вернул структурированный отчёт.");
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("ИИ-тренер вернул некорректный JSON.");
  }
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

export async function coachMatch(analysis: MatchAnalysis): Promise<CoachReport> {
  const tool = buildMatchCoachReportTool(analysis.phases.map((p) => p.id));
  const raw = await runCoach<RawMatchReport>(
    buildMatchCoachPrompt(analysis),
    tool,
    buildMatchSystemPrompt(analysis)
  );
  // Prompt rules alone don't reliably hold on this model - the output is
  // re-checked against the real analysis rather than trusted.
  return stripMarkdownEmphasis(assembleMatchReport(raw, analysis));
}

export async function coachTrends(
  metrics: TrendMetrics,
  patterns: CrossMatchPatterns
): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(
    buildTrendCoachPrompt(metrics, patterns),
    coachReportTool
  );
  return stripMarkdownEmphasis(report);
}

export async function coachMatchStory(
  roleComparisons: RoleComparisonEntry[],
  matchStory: MatchStory
): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(
    buildMatchStoryCoachPrompt(roleComparisons, matchStory),
    coachReportTool
  );
  return stripMarkdownEmphasis(report);
}

export async function coachHero(performance: HeroPerformanceSummary): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(buildHeroCoachPrompt(performance), coachReportTool);
  return stripMarkdownEmphasis(report);
}

export async function coachProComparison(
  userPerformance: HeroPerformanceSummary,
  proSpotlight: ProHeroSpotlight
): Promise<CoachReport> {
  const report = await runCoach<CoachReport>(
    buildProComparisonPrompt(userPerformance, proSpotlight),
    coachReportTool
  );
  return stripMarkdownEmphasis(report);
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
  return stripMarkdownEmphasis(report);
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
  return stripMarkdownEmphasis(assemblePowerSpikeReport(raw, data));
}
