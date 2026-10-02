// Builds src/data/dota-ru.json: the official Russian Dota 2 client text for
// every hero ability and talent the app shows (descriptions, attribute labels,
// talent texts), straight from Valve's own localization file - so the Russian
// UI quotes the game's real wording instead of a machine translation.
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
  const line = /^\s*"([^"]+)"\s+"((?:[^"\\]|\\.)*)"/;
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = raw.match(line);
    if (m) tokens.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
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
    const desc = tokens.get(`DOTA_Tooltip_ability_${key}_Description`);
    if (desc) entry.desc = desc;
    const headers = {};
    for (const a of ability.attrib ?? []) {
      if (!a.key) continue;
      const header = tokens.get(`DOTA_Tooltip_ability_${key}_${a.key}`);
      if (header) headers[a.key] = header;
    }
    if (Object.keys(headers).length > 0) entry.headers = headers;
    if (Object.keys(entry).length > 0) abilities[key] = entry;
  }
  for (const t of hero.talents ?? []) {
    const value = tokens.get(`DOTA_Tooltip_ability_${t.name}`);
    if (value) talents[t.name] = value;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ source: SOURCE_URL, builtAt: new Date().toISOString(), abilities, talents })
);
console.log(
  `Wrote ${OUT}: ${Object.keys(abilities).length} abilities, ${Object.keys(talents).length} talents (${tokens.size} tokens parsed).`
);
