# ZONE Retention Spec v1.0

Owner: Game Design Director. Status: proposed. Feeds: Systems agent (server rules) and Frontend agent (UI).
Scope: meta loop + retention loop respec. Read against the live engine at `engine/src/Application/GameEngine.php`, `engine/src/Core/Game/ResourceService.php`, and the seed in `engine/src/Core/Persistence/Database.php`.

One-sentence goal: turn ZONE from a 2-minute-a-day resource dump with no memory into a game that gives a reason to return tomorrow (D1), a ladder to climb next week (D7), and a rivalry to defend next month (D30). This serves primarily the meta loop and the social loop; the core loop is mechanically sound and mostly kept.

---

## 1. Current loop map (verified from code, not summary)

### Core loop (moment to moment) - WORKS
The player spends nerve on crimes and energy on gym/jobs/attack, then waits for regen. Regen is Torn-faithful (`ResourceService::regenerate`):

| Resource | New-player max | Regen | Time to refill from empty |
|---|---|---|---|
| Energy | 100 | +1 / 3 min | 5 h 00 m |
| Nerve | 45 | +1 / 5 min | 3 h 45 m |
| Life | 250 | +1 / 1 min | 4 h 10 m |
| Happy | 1000 | +1 / 3 min | 50 h 00 m |

(Founder seed is inflated: level 12, 150 energy, 50 nerve, 3000 life, 500 happy, 48,500 cash, 120,000 bank. A real new player starts from the schema defaults above.)

Actions actually reachable by the player (front-end `index.html` calls exactly these 7 endpoints; `/api/v1/attack` exists in `router.php` but is NOT wired to the UI):

| Action | Cost | Reward | Server rule |
|---|---|---|---|
| Crime | 2-10 nerve | cash + xp, roll vs `success_basis_points` | `attemptCrime` |
| Gym train | 10 energy / session (1-10) | stat + equal xp; `gain = max(1, floor(5 + happy/250)) + rand(0,3)` per session | `trainGym` |
| Job shift | 20 energy | `wage = 200 + level*60 + rand(0, 40+level*10)`, xp `5+level` | `workShift` |
| Bank | none | moves cash <-> bank, NO interest | `bankMove` |
| Hospital | `missing_life * 3` cash | full life | `hospitalHeal` |
| Travel | 2500 cash flat | changes `city` string, nothing else | `travel` |
| Blackjack | bet | +bet / 0 / -bet | `playBlackjack` |

### Meta loop (progression over hours-days) - BROKEN
Intended currencies: xp -> level -> bigger bars -> more content. In the actual build the chain is severed at every link (see Section 2).

### Social loop (weeks) - ABSENT
The engine schema has 14 tables (`players`, `crimes`, `economy_ledger`, `event_log`, `achievements`, plus platform tables). There is NO table for gangs, items, inventory, properties, bounties, or player-vs-player. The `engine/modules/*` packages for Gangs, Bounties, Theft, Garage, Detectives, Mail, Properties, Cars, BlackMarket reference a legacy Torn-clone schema (`users`, `userStats`, `gangs`, `gangInvites`, `garage`, `items`, `userInventory`, `locations`, `userTimers`) that does not exist in `schema.sqlite.sql` / `schema.postgresql.sql`. They are imported dead code, not wired to the live economy. The only wired reactive module is Achievements, which contains exactly ONE achievement: `first-score` (first successful crime).

---

## 2. Diagnosis: where the meta loop stops giving reasons to return (the D7 gap)

Ranked by retention damage. Each is a code-level fact, not a vibe.

**D-1. XP is a dead stat; level never rises.** No code path anywhere writes `players.level` for a real player (grep confirms: `level` is only READ in `workShift` and `attackNpc`, and hand-seeded for the founder). XP accumulates forever and buys nothing. This is the single largest failure: the primary progression currency has no payoff. Every crime, gym rep, and job "grants xp" into a black hole.

**D-2. Resource ceilings are frozen forever.** `max_energy`, `max_nerve`, `max_life`, `max_happy` are never increased by any code. A new player is capped at 100 energy / 45 nerve on day 1 and on day 300. There is no "my sessions get bigger" sensation, which is the backbone of Torn-style progression.

**D-3. The daily action budget is spent in under 2 minutes and nothing schedules a return.** 45 nerve = about 5-7 crime clicks; 100 energy = 10 gym clicks or 5 jobs. Total active session is roughly 60-120 seconds, then a 4-5 hour wait. There is no login streak, no daily reward, no daily objective, no "your bars are full and wasting" notification, no timed event. Nothing in the game tells the player when or why to come back. Bars silently cap and the accumulated regen is lost with zero feedback.

**D-4. Crimes have no progression axis and no gate.** `attemptCrime` checks nerve only, never level or skill. `success_basis_points` is static, so a crime never improves and there is no crime-skill mastery. The entire roster is available from minute one, so the "content" of the crime system is fully consumed in the first session. There is no staggered unlock to pull the player across days 2-14.

**D-5. No-brainer and trap choices.** With no gate, the dominant strategy is "always run the highest-nerve crime" because cash-per-nerve rises with tier - except Graffiti, a pure trap (55 cash/nerve, worse than crimes half its cost). Blackjack has a true house edge of 0% (player and dealer both roll uniform 16-21, so P(win)=P(lose)=41.7%, EV=0), so it is neither a sink nor worth playing. Travel is 2500 cash for a string change with zero payoff, so the correct play is never travel.

**D-6. Cash is a second dead currency.** Faucets (crime, job) are strong; sinks are almost nonexistent. Hospital is a trivial sink (life regens free at 1/min, so you rarely pay). Travel is a sink nobody uses. Bank pays no interest and there is no PvP mugging, so banking cash accomplishes nothing. There is nothing meaningful to BUY (no items, properties, or upgrades wired). Cash inflates unbounded into another black hole.

**D-7. Defense and happy are near-dead stats.** `attackNpc` uses only offense (`strength + speed + dexterity`); `defense` is used by nothing. Happy only feeds a small gym bonus (`+happy/250` per session, about +4 at cap) and otherwise does nothing.

Net effect on cohorts: D1 is weak because nothing pulls you back tomorrow; D7 collapses because there is no ladder to climb, no staggered content, and no savings goal; D30 is near-zero because there are no other players, no rivalry, and no long-horizon sink.

---

## 3. Respec: the numbers

Design principle: keep the core loop and every tested contract intact (7 crimes; gym exactly 10 energy/session; job exactly 20 energy; attack exactly 25 energy; blackjack settles by server delta). Fix the meta loop by making xp/level/skill DO something, and add the return hooks and sinks the build is missing. Ship in three phases; P0 is the retention floor.

### 3.1 Level curve (P0 - resurrect xp)

`level` becomes a pure function of `xp`, recomputed server-side after every xp gain. Total xp required to BE level L:

    totalXp(L) = 50 * L * (L - 1)

| Level | Total xp | +max_nerve (cumulative) | +max_energy (cumulative) | Unlocks |
|---|---|---|---|---|
| 1 | 0 | 45 | 100 | Search, Bootlegging |
| 3 | 300 | 47 | 106 | Graffiti |
| 5 | 1,000 | 49 | 112 | Shoplifting; Rented Room property |
| 8 | 2,800 | 52 | 121 | Pickpocketing; Travel payoff |
| 12 | 6,600 | 56 | 133 | Card Skimming; Apartment property |
| 16 | 12,000 | 60 | 145 | Burglary |
| 20 | 19,000 | 64 | 157 | Gang creation |
| 30 | 43,500 | 74 | 187 | Townhouse property |

Per level-up grant: `+1 max_nerve`, `+3 max_energy`, refill nerve and energy to the NEW max (the juicy moment), and a cash bonus of `level * 250`.

Estimated pace (casual burning about 90 nerve + 200 energy/day = roughly 300-450 xp/day): D1 reaches L4-5, D7 reaches L9-11, D30 reaches L19-23. Grinders roughly double this. Fast-early, meaningful-mid: exactly the shape retention needs.

### 3.2 Crime respec (P0 gate + P1 skill)

Add `level_required` to the `crimes` table and rebalance cash to make cash/nerve monotonic (kills the Graffiti trap and the day-1 no-brainer). Nerve costs and base success unchanged so existing balance intuition holds.

| Crime | Lvl req | Nerve | Base success | cash_min | cash_max | xp | cash/nerve (EV) |
|---|---|---|---|---|---|---|---|
| Search for Cash | 1 | 2 | 90.0% | 80 | 240 | 6 | 72 |
| Bootlegging | 1 | 3 | 85.0% | 200 | 520 | 10 | 102 |
| Graffiti | 3 | 4 | 80.0% | 300 | 800 | 12 | 110 |
| Shoplifting | 5 | 5 | 75.0% | 450 | 1,150 | 16 | 120 |
| Pickpocketing | 8 | 6 | 70.0% | 650 | 1,600 | 20 | 131 |
| Card Skimming | 12 | 8 | 62.0% | 1,100 | 2,800 | 30 | 151 |
| Burglary | 16 | 10 | 54.0% | 1,900 | 4,600 | 44 | 175 |

Crime skill (P1): new table `player_crime_skill(player_id, crime_id, attempts, skill_bp)`. Every attempt (success or fail) adds skill. Effective success = `min(success_cap, base_success_bp + skill_bp)`.

    skill_bp gained per attempt = 20, capped at +1500 bp (a crime run about 75 times reaches +15% success)
    success_cap = 9500 bp (never a guaranteed 100%)

Skill tiers shown to the player: Novice (0-499 bp) / Skilled (500-999) / Expert (1000-1499) / Master (1500). This gives each crime a mastery axis (a reason to keep running it) and, combined with level gates, staggers the roster across roughly two weeks.

### 3.3 Daily return hooks (P0 - the actual D1/D7 fix)

**Login streak.** On the first authenticated action of a new UTC day, grant a streak reward and advance the streak counter. Missing a UTC day resets to Day 1 (grace window is an open question, Section 7).

| Streak day | Cash | Bonus |
|---|---|---|
| 1 | 1,000 | - |
| 2 | 1,500 | - |
| 3 | 2,500 | full nerve refill |
| 4 | 3,500 | - |
| 5 | 5,000 | full energy refill |
| 6 | 7,000 | - |
| 7 | 12,000 | full nerve + energy refill, then loops back to Day 1 |

**Cap-waste nudge.** When a bar hits max, write a `notifications` row and surface a badge: "Your nerve is full. You are wasting regen." This manufactures the Torn FOMO pull that currently does not exist.

**Daily contract.** One rotating objective per UTC day drawn from a pool, e.g. "commit 15 crimes", "train 40 stat points", "earn 6,000 from jobs", "win 3 attacks". Reward: 3,000-6,000 cash + 200 xp. Forces cross-system play and gives the session a concrete finish line.

### 3.4 Economy sinks and stat purpose (P1)

**Property (the primary cash sink and the D7-D30 savings goal).** New `player_property` state. Buying grants a permanent passive bonus; a daily upkeep is the recurring sink. Miss upkeep and the bonus is suspended until paid (not repossessed - see Section 7).

| Property | Buy cost | Passive bonus | Daily upkeep |
|---|---|---|---|
| Rented Room | 50,000 | +5 max_energy | 500 |
| Apartment | 250,000 | +10 max_energy, +50 max_happy | 2,000 |
| Townhouse | 1,000,000 | +20 max_energy, +150 max_happy, +2 max_nerve | 8,000 |

**Bank interest (return hook + reason to bank).** `+0.5% of banked balance per UTC day, capped at 5,000 cash/day`, credited to bank on first login of the day. The cap prevents a runaway faucet for whales while still rewarding the habit.

**Wire attack + make defense and bank matter.** Surface the already-coded `attackNpc` now (P1, near-zero cost - it exists and is tested) as an NPC mug ladder that consumes 25 energy and pays cash scaling with level. Then spec player-vs-player mugging for P2 (Section 3.5) that steals a percentage of the target's cash-on-hand (never bank), hospitalizes the loser, and reads BOTH offense and the defender's `defense`. This is what finally gives `defense` a job and makes banking cash a real decision.

**Blackjack house edge.** Give the dealer a small structural edge so the casino becomes a light sink instead of EV-neutral noise. Target house edge 3% (dial in Section 6); simplest implementation is skewing the dealer's roll distribution or paying wins at slightly under even money. Keep server-decided delta (tested contract).

**Travel payoff.** Each city (beyond Zone City) exposes one city-exclusive high-value crime and/or a daily city bonus, so the 2,500 fare has ROI. Gate the payoff at L8 so it is a mid-game reason to travel, not a day-1 tax.

### 3.5 Social loop MVP (P2)

- **Leaderboards** (wire the existing module against `players`): rank by level, total cash earned (from `economy_ledger`), crimes committed, and total stats. Cheap, high-impact social comparison. No new tables needed beyond an aggregate query.
- **PvP mugging**: attack another player, steal a share of cash-on-hand, hospitalize the loser (drops life, forces heal/wait). Creates the attack -> hospital -> revenge loop and a reason to train defense and bank cash.
- **Gangs MVP**: `gangs` + `gang_members` tables (rebuilt on engine contracts, NOT the legacy module schema). A weekly gang objective (sum of members' crimes or cash) pays a gang reward. This is the D30 retainer.

### 3.6 Sinks vs faucets, before and after

| | Cash faucets | Cash sinks | Verdict |
|---|---|---|---|
| Current | crime, job (strong); attack (unwired); blackjack (net 0) | hospital (trivial), travel (unused), bank (none) | Runaway inflation into a dead currency |
| After P0-P1 | crime, job, streak, contract, bank interest (capped) | property buy + daily upkeep, blackjack edge, hospital, travel, level-up spend targets | Cash becomes a pursued resource with real drains |

---

## 4. Retention rationale (explicit per cohort)

**D1.** Level-ups fire every few minutes early (fast curve), each one refills bars and pays a cash bonus - immediate, visible progress instead of xp vanishing. The `first-score` achievement, the Day-1 streak reward, and a completable daily contract all land in the first session. The player leaves with a Day-2 streak dangling and bars that will cap overnight (nudged). Fixes D-1, D-3.

**D7.** Crime tiers unlock on a stagger (Graffiti about D1, Shoplifting about D2-3, Pickpocketing about D4-5, Card Skimming about D7), so there is always a new thing next login. Crime skill climbs Novice -> Skilled. The first property (Rented Room, 50k) is reachable around D2-3 and the Apartment (250k) becomes the week-one savings goal, giving cash a purpose and the player a target that spans sessions. Streak Day 7 jackpot plus multi-session-per-day cap pressure. Fixes D-2, D-4, D-6.

**D30.** Max nerve/energy are now meaningfully larger, so sessions feel bigger (the core Torn progression sensation). Crime skill approaches Master. Townhouse (1M) is a multi-week sink. Leaderboard rank, gang weekly objectives, and PvP rivalries provide the social pull that no amount of solo content replaces. Fixes D-2, D-5, D-7, and the absent social loop.

---

## 5. Feature spec for downstream agents

### 5.1 Player flow (per feature, happy path)
- **Level-up**: any xp-granting action -> server recomputes level -> if increased, bars refill to new max, cash bonus credited, `PlayerLeveledUp` event, client shows a level-up toast and any newly unlocked crimes.
- **Gated crime**: client lists crimes with lock badges below `level_required`; attempting a locked crime is rejected server-side (422).
- **Crime skill**: each attempt returns updated `skill_bp` and tier; client shows a per-crime mastery bar.
- **Streak**: first action of a UTC day returns `streak` block (day, reward granted); client shows a streak modal.
- **Daily contract**: `GET` today's contract + progress; completing it returns a claim; client shows progress and a claim button.
- **Property**: buy (cash debit, bonus applied); daily upkeep auto-debited on first login; if unpaid, bonus suspended and a notification written.
- **Attack (NPC now, PvP later)**: spend 25 energy, server rolls from stats, returns win/lose + rewards; PvP additionally moves cash-on-hand and life.

### 5.2 Data-model touchpoints (Systems agent owns migrations)
- `players`: keep columns; `level` and `max_*` become server-writable (they already exist). Add `login_streak INT`, `last_login_day TEXT` (UTC date), `bank_interest_day TEXT`.
- `crimes`: add `level_required INT NOT NULL DEFAULT 1`.
- New `player_crime_skill(player_id, crime_id, attempts INT, skill_bp INT, PRIMARY KEY(player_id, crime_id))`.
- New `player_property(player_id, property_id, purchased_at, upkeep_paid_day TEXT, active INT)`.
- New `daily_contracts(id, day TEXT, spec_json)` + `player_contract_progress(player_id, day, progress INT, claimed INT)`.
- P2: `gangs`, `gang_members`, `pvp_attacks` (all on engine contracts; do NOT resurrect the legacy `userStats`/`gangs` schema in `engine/modules/*` - it is orphaned).
- All cash/bank/xp movements continue to write `economy_ledger` and emit domain events (existing pattern in `GameEngine`).

### 5.3 Server-authoritative rules (non-negotiable)
- Level, xp, skill_bp, streak, contract progress, upkeep, interest, and every reward are computed and written server-side only. The client sends intent (`{stat}`, `{crimeId}`, `{bet}`, `{propertyId}`), never outcomes or amounts of progression.
- Level is derived from xp on write; never trust a client `level`.
- Crime gate, nerve/energy sufficiency, and property affordability are validated inside the existing `Database::transaction` blocks.
- Streak, interest, and upkeep are idempotent per UTC day (guarded by `last_login_day` / `*_day` columns) so a double request cannot double-pay.
- Preserve all tested energy costs and the `serverProof` block on every action response.

### 5.4 AR / EN copy notes (bilingual by construction)
- Every new string ships EN + AR (RTL). Number formatting must respect locale; cash uses grouped thousands in both.
- Level-up: EN "Level Up! You reached level {n}." / AR "ترقية المستوى! وصلت إلى المستوى {n}."
- Streak: EN "Day {n} streak reward" / AR "مكافأة السلسلة اليوم {n}".
- Crime locked: EN "Unlocks at level {n}" / AR "يفتح عند المستوى {n}".
- Crime mastery tiers: Novice/Skilled/Expert/Master -> مبتدئ / ماهر / خبير / محترف.
- Cap-waste nudge: EN "Your {bar} is full and wasting." / AR "شريط {bar} ممتلئ ويُهدر."
- Property upkeep unpaid: EN "Upkeep unpaid. Bonus suspended." / AR "لم تُدفع الصيانة. المكافأة موقوفة."
- Keep numerals consistent: pick Western Arabic numerals (0-9) across both locales unless Omar requests Eastern Arabic numerals; flag as an open question.

### 5.5 Acceptance criteria
- Gaining xp that crosses `totalXp(L)` raises `level` by exactly the number of thresholds crossed, refills nerve+energy to the new max, credits `level*250` per level, and emits `PlayerLeveledUp`.
- `max_nerve`/`max_energy` after reaching level L equal the Section 3.1 table values.
- Attempting a crime below `level_required` returns 422 and mutates nothing.
- Each crime attempt increments `attempts`, adds 20 `skill_bp` (capped 1500), and effective success equals `min(9500, base + skill_bp)`.
- First action of a new UTC day grants exactly one streak reward; a second action the same day grants none; missing a day resets streak to 1.
- Buying a property debits cash once, applies the max bonus, and daily upkeep debits exactly once per UTC day; unpaid upkeep suspends (not removes) the bonus.
- Bank interest credits at most the daily cap, once per UTC day.
- Blackjack measured house edge over 100k simulated hands is within +/-1% of the configured target.
- Existing engine test suite (49 checks) still passes; the 7-crime count and all energy-cost contracts are unchanged.

---

## 6. Post-launch balance dials

1. **XP curve coefficient** (the `50` in `totalXp = k*L*(L-1)`): raise to slow leveling, lower to speed it. Primary pace lever.
2. **Per-level bar grant** (`+1 nerve / +3 energy`): controls how fast sessions grow, i.e. the long-term power curve.
3. **Crime-skill rate and cap** (`+20 bp/attempt`, `1500` cap, `9500` success cap): controls mastery grind length and ceiling.
4. **Streak schedule + grace window**: reward magnitudes and whether a missed day hard-resets, soft-resets, or is forgiven once.
5. **Bank interest rate and daily cap** (`0.5%`, `5,000`): the main inflation-vs-habit knob.
6. **Property upkeep-to-benefit ratio** (buy cost, bonus size, daily upkeep): the strength of the primary cash sink and the size of the mid/late goal.

---

## 7. Open balance questions

1. **Target session profile.** What is the intended session length and sessions/day for the primary cohort (casual vs hardcore)? This sets the nerve/energy max tuning and the streak cadence. Assumed here: casual, 2-3 short sessions/day.
2. **PvP at launch or NPC-first.** PvP mugging is the strongest D30 retainer but needs protection rules (level-range matchmaking, attack cooldowns, new-player shield). Ship NPC attack first (already coded) and PvP in P2, or bring PvP forward?
3. **Sink harshness.** Should property upkeep be able to bankrupt a player (hard sink) or only suspend the bonus (soft sink, assumed here)? Hard sinks control inflation better but punish lapsed players and hurt return rate.
4. **Streak reset policy.** Hard reset on any missed UTC day, a one-day grace, or a purchasable/earnable streak-freeze token? Directly trades D2 forgiveness against streak value.
5. **Energy governance.** Energy currently funds gym (progression) AND jobs/attacks (cash/combat), forcing a real opportunity cost. Keep one pool, or split off a dedicated training resource? One pool is recommended (meaningful choice) but confirm.
6. **Defense before PvP.** Should `defense` get an interim job (e.g., reduces NPC counter-damage / hospitalization chance) before PvP ships, or stay dormant until then?
7. **Numeral locale.** Western Arabic numerals (0-9) across both locales, or Eastern Arabic numerals in the AR build?

---

## 8. Note to the Systems agent on existing code

The `engine/modules/*` packages for Gangs, Bounties, Theft, Garage, Detectives, Mail, Properties, Cars, and BlackMarket are orphaned legacy Torn-clone code. They query tables (`users`, `userStats`, `gangs`, `gangInvites`, `garage`, `items`, `userInventory`, `locations`, `userTimers`) that do not exist in the engine schema and are not wired to the live `players` economy. Do not assume they work or build on them. Every new system in this spec must be built on the engine contracts (`Database`, `EventBus`, `Ledger`, `ResourceService`) and the real `schema.sqlite.sql` / `schema.postgresql.sql`, following the `Crime` + `Achievements` reference pair.
