# Coach knowledge base

The local model doesn't learn from the internet at run time. What a strong
coach would say is written down here once, from public coaching material,
and the app attaches the matching rule to each problem it finds in a game
(`src/lib/coach/principles.ts`, `src/lib/coach/roles.ts`). The model only
phrases it; the diagnosis and the numbers come from the replay.

Every rule below is tied to something the analysis can actually detect. A
rule with no detector would be generic advice, which is exactly what the
report is meant to avoid.

## Sources

| Topic | Source |
| --- | --- |
| High ground sieges, closing games | [esports.net - How to siege high ground](https://www.esports.net/wiki/guides/dota-2-high-ground/) |
| Buyback cost, cooldown, when to keep and use it | [teamsmurf - Buyback math](https://teamsmurf.com/buyback-math-when-2-500-gold-saves-the-game/) |
| Teamfight positioning by role, engagement order, disengage triggers | [teamsmurf - Teamfight guide](https://teamsmurf.com/teamfight-guide/) |
| Typical mistakes by position | [profilerr - Typical mistakes of every role](https://profilerr.net/typical-mistakes-of-every-role-in-dota-2/) |
| Roshan, Aegis, using a lead | [dotacoach.gg - Roshan](https://dotacoach.gg/articles/roshan) |
| Comeback gold (kill gold scales with the dying hero's net worth, losing team only) | [Liquipedia - Gold](https://liquipedia.net/dota2/Gold) |
| Uphill miss chance (25%, ranged attacks only) | [Liquipedia - Evasion](https://liquipedia.net/dota2/Evasion) |
| Laning, role jobs, map zones | Ueio, BalloonDota, PainDota, Support Heaven coaching videos (the original basis of `roles.ts`) |
| Ability and talent text and numbers | Valve's own game files, mirrored at [dotabuff/d2vpkr](https://github.com/dotabuff/d2vpkr) (`scripts/build-dota-ru.mjs`) |
| Hero guide tricks: ability mechanics notes, what Aghanim's Scepter/Shard change per hero | The same game files (`DOTA_Tooltip_ability_*_Note*`, `*_scepter_description`, `*_shard_description`), filled with the ability's real values |
| What pros build on a hero | [OpenDota](https://docs.opendota.com/) `/heroes/{id}/itemPopularity` (recent professional games) |
| Item timing benchmarks, skill order, win rate by game length | [STRATZ](https://stratz.com/api) per-minute purchase, ability max level and game-minute stats, Legend+ |
| Skill builds, item orders, situational picks | Parsed replays of the current patch: pro games via the [OpenDota explorer](https://docs.opendota.com/) (purchase logs, ability orders) and Divine/Immortal games via STRATZ guides (item purchases, ability orders) |
| Item phases (start, lane, first farming item, power spikes, situational 4th+) | [prosettings.net - Dota 2 itemization for cores](https://prosettings.net/blog/dota-2-itemization/); D2PT's approach of reading builds from 7000+ MMR and pro games |
| Counter items by threat (BKB vs control/magic, MKB vs evasion, Spirit Vessel/Shiva's/Skadi vs healing, Mjollnir/Radiance vs illusions, Linken's/Lotus vs targeted disables, Hex/Orchid/Nullifier vs blinks, Halberd/AC/Ghost vs physical) | [ludo.guide - Situational items and counter-building](https://www.ludo.guide/guide/dota-2/strategy-tactics/itemization-strategies/situational-items-counter-building), [prosettings.net](https://prosettings.net/blog/dota-2-itemization/); applied only where replays show the pick follows the threat (`src/lib/heroTraits.ts`) |

## Mechanics the advice relies on (checked)

- **Buyback** costs 200 + net worth / 13 gold and has an 8-minute cooldown.
  After buying back, unreliable gold income stops until the normal respawn
  would have ended.
- **Uphill miss chance** is 25% and applies to *ranged* attacks from lower
  ground only. Melee attacks never miss uphill. (The mid-lane rule used to
  promise misses for any attack.)
- **Comeback gold**: when a hero of the leading team dies, the trailing team
  gets bonus gold that grows with that hero's net worth. A rich core dying
  while ahead is how leads evaporate.
- **Aegis** lasts 5 minutes and is spent when its holder dies.
- **High ground**: defenders see attackers on the ramp; attackers don't see
  up. Tier 3/4 towers give defenders armour and regen.

## Rules by detected problem

| Cause code | Detected from | Rule (short) |
| --- | --- | --- |
| `LEAD_NOT_CONVERTED` | team lead >= 5k (Turbo 9k) at its peak, <= 1 enemy building in the next 8 min (Turbo 5), game lost | A lead wins nothing by itself, buildings do: push after every won fight, shove 2-3 lanes before high ground, take Roshan first, deward the base, go up when enemy heroes are visible and their buybacks are known. |
| `LOST_FIGHT_ENEMY_SIDE` | a fight lost after the peak, its deaths on the enemy half, while the lead was >= half the big-lead mark | When ahead, fight where your wards are and where the enemy must come to you. Enter enemy jungle only as five, with vision, after dewarding. Every death of a rich hero hands the enemy comeback gold. |
| `AEGIS_WASTED` | a fight lost while the team held a fresh Aegis | Aegis is 5 minutes for buildings, not for chasing: go to the nearest tower or the high ground with a creep wave, and give it to whoever hits buildings. |
| `DIED_BEFORE_FIGHT` | the player's death outside any fight, <= 45 s before a fight the team lost | Dying just before a fight makes it 4v5. When a fight is coming (Roshan, your push, enemies missing), group up early through your own half and keep a TP Scroll. Role-specific versions exist. |
| `DIED_FIRST` | the player's death was the team's first in a lost fight (twice, or once in a thrown game) | Carry: stand behind the initiator at the edge of attack range and BKB early. Mid: stay out of initiation range, come in second. Offlane: jump only with follow-up. Support: edge of cast range, in fog or trees. |
| `NO_BUYBACK` | a core died after 30:00 (Turbo 18:00), barracks or the throne fell within 2 min, no buyback within 30 s | Keep 200 + net worth / 13 gold late. Don't buy an item that drops you below buyback. Buy back when it saves a building or wins the fight. |
| `FRONT_POSITIONING` | STRATZ positions: at the start of a fight the player (not pos 3) was the closest of the team to the enemy, then died there, twice | The initiator stands in front. Carry, mid and supports wait for the enemy to spend control on the front line. |
| `PICKED_OFF`, `DEEP_ENEMY_DEATH`, `SEEN_BY_WARD` | death outside fights, deep on the enemy side, or in an enemy Observer Ward's radius (with the nearest ally's distance from STRATZ positions) | Check the minimap for missing heroes, farm the side of the map where the enemy isn't, and walk around known enemy wards. |
| `EARLY_DEATHS`, `CS_DEFICIT`, `XP_DEFICIT`, `REPEAT_KILLER` | lane deaths, last hits and XP against the same-position enemy, level 6 timing | Role-specific laning rules (wave control, trading only with your support, uphill for a ranged mid). |
| `WARDS_DEWARDED`, `NO_VISION` | the support's Observer Wards removed by enemy heroes; too few wards per 5 minutes | Ward off the obvious spots, away from enemy eyes, and don't stand on the spot after placing it. |

| `ULT_LATE` | the hero's ultimate (sixth slot of a standard kit) first learned after level 6 | Take the ultimate at 6, 12 and 18 every time. |
| `RUNE_CONTROL` | mid only: the enemy mid took 3+ more power runes before 15:00 (Turbo 12:00) | Push the wave and be at the rune 10-15 s before each even minute from 6:00; don't contest it at lower HP. |
| `IDLE_FARM` | pos 1-2, after the lane: 2+ minutes in a row alive, out of fights, under 3 last hits a minute (4+ minutes in total) | Between fights always farm the nearest wave or camp. |
| `FEW_TP` | a core used TP Scroll less than half as often as the counterpart (and 3+ fewer) and missed 2+ fights while alive | Always carry a TP; teleport to the fight or the tower under attack as soon as it shows on the minimap. |
| `NO_BKB` | a core whose hero builds Black King Bar on this position (STRATZ) never bought it, the game went 10+ minutes past the usual timing, and they died in 2+ fights after it | Survival before the next damage item. |

## How a single death is judged

Each death in the full breakdown gets one of three verdicts:

- **Avoidable** - outside any teamfight with no enemy dying nearby within
  10 seconds, or killed by creeps/a tower. The explanation picks what the
  replay shows: a gank (killers 2 500+ units away 25 s earlier), an enemy
  Observer Ward covering the spot, deep on the enemy half, 3+ enemies, farming
  with the nearest ally 2 000+ units away, an unused heal, a failed TP out.
  In the lane, the killer's disable and its cast range give the distance to
  keep.
- **In a fight** - the fight was lost or even. Dying first, or dying after
  two allies were already dead (should have backed off), gets its own advice.
  Otherwise the advice covers the killer's reach and missing vision.
- **Trade** - the fight was won, or an enemy died within 10 seconds nearby.

When the whole game was thrown, the game-level causes get +40 severity, so
the report leads with how the lead was lost rather than with the lane.
