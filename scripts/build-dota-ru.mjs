// Builds src/data/dota-ru.json: the official Russian Dota 2 client text for
// every hero ability and talent the app shows (descriptions, attribute labels,
// talent texts, the ability's mechanics notes and what Aghanim's Scepter and
// Shard change in it), straight from Valve's own localization file - so the
// Russian UI quotes the game's real wording instead of a machine translation.
//
// Source: Valve's resource/localization/abilities_russian.txt, as mirrored from
// the game files by github.com/dotabuff/d2vpkr. Usage:
//   node scripts/build-dota-ru.mjs                 (downloads the file)
//   node scripts/build-dota-ru.mjs path/to/abilities_russian.txt
// Re-run after a Dota patch, together with a dotaconstants update.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dc = require("dotaconstants");

const SOURCE_URL =
  "https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/resource/localization/abilities_russian.txt";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..", "src", "data", "dota-ru.json");

async function loadSource() {
  const local = process.argv[2];
  if (local) return fs.readFileSync(local, "utf8");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${SOURCE_URL}`);
  return res.text();
}

// Valve KeyValues: one `"key"   "value"` pair per line inside "Tokens" { ... }.
function parseTokens(text) {
  const tokens = new Map();
  // Key and value aren't always separated by whitespace ("..._15""+{s:value}%").
  const line = /^\s*"([^"]+)"\s*"((?:[^"\\]|\\.)*)"/;
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = raw.match(line);
    // Looked up lower-cased: Valve spells some keys "DOTA_Tooltip_Ability_...".
    if (m) tokens.set(m[1].toLowerCase(), m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
  }
  return tokens;
}

const text = await loadSource();
const tokens = parseTokens(text);
if (tokens.size < 1000) throw new Error(`Only ${tokens.size} tokens parsed - wrong file?`);

const abilities = {};
const talents = {};
for (const hero of Object.values(dc.hero_abilities)) {
  for (const key of hero.abilities ?? []) {
    const ability = dc.abilities[key];
    if (!ability?.dname) continue;
    const entry = {};
    const desc = tokens.get(`dota_tooltip_ability_${key}_description`.toLowerCase());
    if (desc) entry.desc = desc;
    const headers = {};
    for (const a of ability.attrib ?? []) {
      if (!a.key) continue;
      const header = tokens.get(`dota_tooltip_ability_${key}_${a.key}`.toLowerCase());
      if (header) headers[a.key] = header;
    }
    if (Object.keys(headers).length > 0) entry.headers = headers;
    if (Object.keys(entry).length > 0) abilities[key] = entry;
  }
}
// Every talent the Russian client has text for, not just dotaconstants' list:
// that list lags behind patches (Tiny's +8 Strength is +10 in the game), and
// the talents shown come from real match/STRATZ data, so a live talent missing
// from it fell back to English.
for (const [key, value] of tokens) {
  const m = /^dota_tooltip_ability_(special_bonus_[a-z0-9_]+)$/.exec(key);
  if (m && !/_(?:description|note\d*|lore)$/i.test(m[1])) talents[m[1]] = value;
}

// ---- Talent numbers ----
// Talent text is a template ("+{s:bonus_mana_void_aoe_radius} к радиусу Mana
// Void") and dotaconstants doesn't carry hero-talent values, so 70% of talents
// showed "+?". Valve keeps each value inside the ability it changes:
//   "mana_void_aoe_radius" { "value" "400 450 500"
//     "special_bonus_unique_antimage_manavoid_aoe" "+200" }
// -> placeholder "bonus_" + value name. Generic talents ("+3 к регенерации")
// carry their own "value".
const NPC_URL = "https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc";

// Valve KeyValues: quoted keys/values, nested { } blocks, // comments.
function parseKeyValues(source) {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < source.length && /\s/.test(source[i])) i++;
      if (source.startsWith("//", i)) {
        while (i < source.length && source[i] !== "\n") i++;
      } else return;
    }
  };
  const read = () => {
    skip();
    if (source[i] === '"') {
      const end = source.indexOf('"', i + 1);
      const s = source.slice(i + 1, end);
      i = end + 1;
      return s;
    }
    const m = /^[^\s{}"]+/.exec(source.slice(i));
    if (!m) return null;
    i += m[0].length;
    return m[0];
  };
  const block = () => {
    const out = {};
    for (;;) {
      skip();
      if (i >= source.length || source[i] === "}") {
        i++;
        return out;
      }
      const key = read();
      if (key === null) return out;
      skip();
      if (source[i] === "[") while (i < source.length && source[i - 1] !== "]") i++; // platform conditional
      skip();
      let value;
      if (source[i] === "{") {
        i++;
        value = block();
      } else value = read();
      if (!(key in out)) out[key] = value;
    }
  };
  return block();
}

// Every ability's own values (lower-cased names), for the %value% placeholders
// in its notes and Aghanim's texts. Hero files come after npc_abilities.txt
// and win. A value only Aghanim's unlocks is 0 on its own and carries the real
// number as a modifier ("value" "0", "special_bonus_scepter" "+20"), so the
// Scepter and Shard texts get their own copy with the modifier applied.
const abilityValues = {};
const upgradedValues = { scepter: {}, shard: {} };

// "+20", "-1", "=3", "x2", per level: "0 0 0" with "+20" -> "20 20 20".
function applyModifier(base, modifier) {
  const m = /^([+\-=x])?\s*(-?[\d.]+)$/.exec(String(modifier).trim());
  if (!m) return base;
  const [, op = "+", raw] = m;
  const by = Number(raw);
  return String(base)
    .trim()
    .split(/\s+/)
    .map((v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return v;
      if (op === "=") return String(by);
      if (op === "x") return String(n * by);
      return String(op === "-" ? n - by : n + by);
    })
    .join(" ");
}

function collectTalentValues(node, out) {
  if (!node || typeof node !== "object") return;
  for (const [name, entry] of Object.entries(node)) {
    if (!entry || typeof entry !== "object") continue;
    const values = entry.AbilityValues;
    if (values && typeof values === "object") {
      for (const [valueName, value] of Object.entries(values)) {
        const own = typeof value === "object" ? value.value : value;
        if (name.startsWith("special_bonus_")) {
          if (own !== undefined) (out[name] ??= {})[valueName] = String(own);
        } else if (own !== undefined) {
          (abilityValues[name] ??= {})[valueName.toLowerCase()] = String(own);
          for (const upgrade of ["scepter", "shard"]) {
            const modifier = typeof value === "object" ? value[`special_bonus_${upgrade}`] : undefined;
            if (modifier !== undefined) {
              (upgradedValues[upgrade][name] ??= {})[valueName.toLowerCase()] = applyModifier(own, modifier);
            }
          }
        }
        if (value && typeof value === "object") {
          for (const [k, v] of Object.entries(value)) {
            if (k.startsWith("special_bonus_")) (out[k] ??= {})[`bonus_${valueName}`] = String(v);
          }
        }
      }
    }
    collectTalentValues(entry, out);
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  return res.text();
}

const talentValues = {};
collectTalentValues(parseKeyValues(await fetchText(`${NPC_URL}/npc_abilities.txt`)), talentValues);
for (const hero of Object.values(dc.heroes)) {
  const file = `${NPC_URL}/heroes/${hero.name}.txt`;
  try {
    collectTalentValues(parseKeyValues(await fetchText(file)), talentValues);
  } catch (err) {
    console.warn(`Skipped ${file}: ${err.message}`);
  }
}
// ---- Mechanics notes and Aghanim's upgrades ----
// The client's notes under an ability ("Meat Hook pulls allies", "Blink dodges
// projectiles") and the Scepter/Shard texts, filled with the ability's values.
// A text with a value the files don't have is left out rather than shown with
// a hole in it - and so is one where the value is 0: an upgrade value set
// somewhere this script doesn't read ("0 beams" for Invoker's Cataclysm).
function formatValue(raw) {
  return String(raw)
    .trim()
    .split(/\s+/)
    .map((v) => (Number.isFinite(Number(v)) ? String(Number(v)) : v))
    .join(" / ");
}

function fillTemplate(template, values) {
  let missing = false;
  const filled = template.replace(/%([a-z0-9_]+)%/gi, (_, key) => {
    const value = values?.[key.toLowerCase()];
    if (value === undefined || /^[\s0.]*$/.test(value)) {
      missing = true;
      return "";
    }
    return formatValue(value);
  });
  if (missing) return null;
  return filled
    .replace(/%{2,}/g, "%")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let noteCount = 0;
for (const hero of Object.values(dc.hero_abilities)) {
  for (const key of hero.abilities ?? []) {
    if (!dc.abilities[key]?.dname) continue;
    const text = (suffix, upgrade) => {
      const template = tokens.get(`dota_tooltip_ability_${key}_${suffix}`.toLowerCase());
      const values = { ...abilityValues[key], ...(upgrade ? upgradedValues[upgrade][key] : {}) };
      return template ? fillTemplate(template, values) : null;
    };
    const notes = [];
    for (let n = 0; n < 10; n++) {
      const note = text(`note${n}`);
      if (note) notes.push(note);
    }
    const scepter = text("scepter_description", "scepter");
    const shard = text("shard_description", "shard");
    if (notes.length === 0 && !scepter && !shard) continue;
    const entry = (abilities[key] ??= {});
    if (notes.length > 0) entry.notes = notes;
    if (scepter) entry.scepter = scepter;
    if (shard) entry.shard = shard;
    noteCount += notes.length;
  }
}

// Every talent's numbers - also for talents without Russian text, which the
// game shows in English, filled with the same values.
const usedTalentValues = Object.fromEntries(
  Object.entries(talentValues).filter(([name]) => name.startsWith("special_bonus_"))
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ source: SOURCE_URL, builtAt: new Date().toISOString(), abilities, talents, talentValues: usedTalentValues })
);
console.log(
  `Wrote ${OUT}: ${Object.keys(abilities).length} abilities (${noteCount} notes), ${Object.keys(talents).length} talents (${Object.keys(usedTalentValues).length} with values; ${tokens.size} tokens parsed).`
);
