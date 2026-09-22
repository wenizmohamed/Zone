# ZONE — ART & STYLE BIBLE

**Version 1.0 · locked 2026-09-22 · owner: ZONE Character & Art Designer**

ZONE is a bilingual (Arabic RTL + English) Torn-style browser crime MMORPG. This
bible is the single source of truth for every original visual asset: characters,
avatars, item/weapon art, icons, key art, and map/UI decoration. It is grounded
in ZONE's **real, shipped** UI palette (extracted live from `index.html`, not
invented). Extend this system per asset; never reinvent per asset.

> ART LAW (non-negotiable): cyber-noir, single cyan accent on deep dark; keep
> Torn's dense/utilitarian UI but push the ART to AAA; **originals only** (no
> copyrighted characters, logos, or trade dress); nothing may read as AI-built;
> every asset must survive icon size AND in-context; every layout must survive
> RTL mirroring. Art is presentation only — it never invents game state.

---

## 1. IDENTITY IN ONE LINE

A rain-slick crime metropolis at 3 a.m., lit almost entirely by a single cold
cyan signal cutting through near-black blue shadow. Grounded, gritty, cinematic
noir — not neon-vaporwave, not glossy sci-fi. Think *wet asphalt and one working
streetlight*, not *Times Square*.

---

## 2. CORE PALETTE (exact hex — verified from the shipped app)

These are the app's real CSS variables. Every asset is graded to sit inside this
UI without clashing.

### Noir base (backgrounds, deepest to lightest)
| Token | Hex | Use |
|---|---|---|
| `--edge` | `#03040a` | Absolute black-blue, outermost frame / vignette |
| `--deep` | `#05070c` | Deep well behind panels |
| `--bg` | `#080b12` | **Primary canvas** — the ZONE noir base |
| `--panel2` | `#0d1220` | Panel base |
| `--panel` | `#111623` | Panel surface |
| `--z1` | `#131a29` | Raised zone |
| `--panelhi`/`--z2` | `#1a2233` / `#182135` | Hover / elevated surface |

### Structure (lines & borders — cool blue-grey, never pure grey)
| Token | Hex |
|---|---|
| `--line` | `#151a24` |
| `--border` | `#233049` |
| `--border2` | `#2c3a58` |
| `--border3` | `#3a4c72` |

### Text (cool off-whites → blue-greys)
| Token | Hex | Use |
|---|---|---|
| `--t1` | `#f4f7ff` | Primary / headline |
| `--t2` | `#dde6f5` | Body |
| `--t3` | `#b7c4de` | Secondary |
| `--t4` | `#8493b3` | Tertiary |
| `--mu` | `#6f7d9c` | Muted |
| `--mu2` | `#4a566f` | Faintest label |
| `--ico` | `#aab8d6` | Default icon fill (inactive) |

### THE ACCENT — one cyan, used sparingly
| Token | Hex | Use |
|---|---|---|
| `--acc` | **`#31e0ff`** | **The ZONE cyan.** Primary signal: active state, key light, focus, brand. |
| `--acc2` | `#00b4dc` | Deeper cyan — gradients, pressed, secondary emphasis |
| `--activefg` | `#7defff` | Bright cyan-white — the hottest highlight only |
| `--activebg` | `#0f2b3a` | Cyan-tinted active background wash |

### Functional / semantic (use only for their meaning, never decoration)
| Token | Hex | Meaning |
|---|---|---|
| `--money` | `#41e08a` | Cash / gain |
| `--good` | `#54d98c` | Success / positive |
| `--bad` | `#ff5d6c` | Damage / negative |
| `--bad2` | `#ff3b52` | Critical / danger |
| `--gold` | `#f2c14e` | Reward / rank / premium |
| `--link` | `#5cc2ff` | Link |

**60-30-10 discipline:** ~60% noir base (`#080b12`–`#111623`), ~30% cool
neutrals (borders + `--t3/--t4/--ico`), **~10% cyan accent max**. If cyan covers
more than a tenth of the frame, it stops being a signal and becomes wallpaper —
pull it back.

---

## 3. CATEGORY HUES (secondary, muted, subordinate to cyan)

Each nav/district category owns a **desaturated** identity hue (verified from the
app's icon color arrays). These are muted on purpose — they whisper category
under the cyan accent, they never compete with it. Use as a low-saturation tint,
a rim, or a small emissive, never as a full fill.

| Category | Hex | Category | Hex |
|---|---|---|---|
| Home | `#5a8a2a` | Missions | `#c08a20` |
| Items | `#8a6a2a` | Newspaper | `#5a5a5a` |
| City | `#3a6a9a` | Jail | `#4a4a5a` |
| Jobs | `#7a5a3a` | Hospital | `#c03030` |
| Gym | `#a04a2a` | Casino | `#2a7a6a` |
| Properties | `#4a7a5a` | Hall of Fame | `#b0902a` |
| Education | `#5a4a9a` | Faction | `#3a7a4a` |
| Crimes | `#8a2a2a` | Elimination | `#6a3a8a` |
| Bank/Market | `#2a6a8a` | Attack | `#a02a3a` |

Rule: a category asset is **noir + its muted hue + a touch of cyan** — three
values, no rainbow. Crimes art leans blood-red `#8a2a2a`; Casino leans teal
`#2a7a6a`; but both still read cyber-noir because cyan owns the key light.

---

## 4. TYPOGRAPHY DIRECTION

- **UI stays as shipped** — this bible governs *art*, not the CSS type stack.
- For **type baked into art** (posters, signage, item labels, key-art wordmarks):
  - Headline / signage: a condensed, industrial grotesque (stencil or
    engineered sans) — tight, mechanical, slightly worn. Feel: municipal
    signage, shipping stencils, precinct doors.
  - Data / stat overlays: a monospaced or tabular numeric face, thin weight,
    in `--ico`/`--t4`, evoking a terminal HUD.
  - **Arabic is a first-class citizen, never an afterthought.** Any baked
    Arabic uses a modern geometric/Kufi-leaning face with weight matched to the
    Latin; both scripts sit on the same optical baseline and carry the same cyan
    treatment. Never stretch, fake-bold, or mirror glyphs to "fit".
- Keep baked text minimal — noir is about what's *unlit*. Prefer one small
  glowing sign over a wall of legible copy.

---

## 5. SHAPE & LINE MOTIF

- **Silhouette first.** Every character/item/icon must read as a solid black
  shape on white before any rendering. If the silhouette is generic, restart.
- **Motif: the cut corner + thin bracket.** ZONE's UI language is rectangular
  panels with hairline cool borders. Assets echo it: subtly chamfered corners,
  L-shaped HUD brackets, and a thin 1–2px cyan rule as the recurring "tech"
  signature. No rounded-blob friendliness; noir is angular and deliberate.
- **Icon grid:** consistent bounding box, consistent optical weight, single
  stroke logic (the app's icons use a ~2px stroke language — new icons match it).
  A pistol icon and a briefcase icon must look like the same hand drew them.
- **Emissive discipline:** light comes *from* the object (a screen, a sign, a
  muzzle flash, an eye) — one source, cyan or the category hue. No ambient glow
  bath.

---

## 6. LIGHTING & MOOD

- **Single cold key + deep fill.** One dominant cyan-white source, everything
  else falling into blue-black. High contrast, crushed-but-not-dead shadows
  (shadows keep a faint `#0d1220` blue, never pure `#000`).
- **Wet everything.** Rain, sheen on asphalt, condensation, reflective puddles
  that carry the cyan back up. Reflection is the noir workhorse — it's how one
  light fills a whole frame.
- **Atmosphere:** volumetric haze, drifting rain, distant window lights bokeh'd
  into small warm/cool points. Depth via fog, not detail.
- **Time is always night.** Overcast, pre-dawn, or interior-dark. Never daylight,
  never golden hour.
- **Restraint over spectacle.** Menace and stillness beat explosions. A lone
  figure under one light > a crowd in neon.

---

## 7. TEXTURE & MATERIAL

- Real materials: brushed gunmetal, worn leather, scuffed concrete, cracked
  asphalt, chrome with fingerprints, matte plastic, cold glass. Everything has
  wear and grime — this is a *crime* city, nothing is showroom-fresh.
- Fine film grain over the whole image (subtle, filmic — not digital noise).
- Micro-detail sells realism: dust, scratches, oil, rust streaks, chipped paint.
- **Matte skin, never plastic.** Visible pores, subsurface warmth, real skin
  micro-texture. Skin is the #1 AI-tell — treat it with the most care.

---

## 8. ANTI-AI-TELL RULES (reject-and-regen checklist)

An asset ships only after passing every line. These are concrete failure modes to
hunt for and kill:

1. **Hands & fingers** — count them. Five per hand, correct knuckles, no fused or
   melted digits, no extra thumb. Weapons held with a plausible grip.
2. **Eyes** — symmetric, matched gaze direction, no dead/wall-eyed stare, no
   mismatched pupils or catch-lights.
3. **Symmetry that's too perfect** — faces, gear, and architecture must have
   organic asymmetry. Perfect bilateral symmetry reads synthetic.
4. **No plastic/wax skin** — kill the airbrushed CGI sheen; demand pores, grain,
   real specular breakup.
5. **No gradient mush** — noir needs crisp edges and real light logic. Reject
   soft foggy blobs where geometry should be.
6. **No generic "digital-art / trending-on-artstation" sheen** — no rainbow
   bloom, no over-saturated teal-and-orange, no lens-flare vomit.
7. **No garbled text** — any signage/label must be real, legible, correctly
   spelled in the right script (or deliberately, cleanly abstracted). Nonsense
   glyphs = reject. Watch Arabic especially (no reversed/disconnected letters).
8. **No off-palette drift** — if the render trends warm/purple/green-neon and
   away from `#080b12` + `#31e0ff`, colour-grade it back or regenerate. Cyan is
   THE accent; stray magenta/purple neon is banned.
9. **No floating / impossible geometry** — objects obey gravity and contact
   shadows; reflections match their source.
10. **No stock-photo composition** — centered subject, blurred bokeh backdrop,
    smiling model energy. Frame it like a film still: off-center, motivated
    light, story in the shadows.
11. **Consistent scale & repetition** — no infinitely repeating identical
    windows/bricks; introduce variation like a real building.
12. **Legibility at size** — squint / shrink to icon scale; if silhouette and
    read collapse, it fails.

**Global negatives to carry in every prompt:**
`plastic skin, waxy, airbrushed, cgi sheen, extra fingers, deformed hands,
mangled hands, fused fingers, asymmetric eyes, garbled text, gibberish letters,
watermark, signature, logo, oversaturated, neon vaporwave, teal-and-orange,
purple neon, lens flare, bloom, blurry, low detail, cartoon, anime, 3d render
look, stock photo, centered portrait, daylight, sunny.`

---

## 9. WHAT ZONE IS / IS NOT

| ZONE IS | ZONE IS NOT |
|---|---|
| Cinematic film-noir realism | Cartoon / anime / cel |
| One cold cyan signal on near-black | Neon rainbow / vaporwave |
| Wet, grimy, lived-in | Clean showroom sci-fi |
| Angular, bracketed, utilitarian | Rounded, soft, friendly |
| Restrained, menacing stillness | Explosive spectacle |
| Original crime-city characters | Any recognizable IP / real logo |
| Dense Torn-style UI, AAA art | Bloated UI or cheap clip-art art |

---

## 10. PRODUCTION PIPELINE (how assets are made)

- **Engine:** local ComfyUI + Flux (`flux1-dev-fp8`), free, at
  `http://127.0.0.1:8188`. Confirm `server_info` is up before generating.
- **Loop:** brief & reference → silhouette thumbnails → style-lock against this
  bible → produce → critique pass (Section 8) → verify live in the browser at
  real size on dark, RTL + LTR intact.
- **Never ship first output.** Always run the anti-AI-tell pass and regenerate
  failures.
- **Every delivery** reports the exact absolute path, confirms the file is
  non-empty and renders, and states VERIFIED / INFERRED / UNKNOWN on claims.

---

*Proof render for v1.0: `art/zone_keyart_00001_.png` (see report). Judge every
future asset against Sections 2, 3, 6, and 8.*
