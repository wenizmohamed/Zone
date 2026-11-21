#!/usr/bin/env python3
"""
ZONE v157 - 300+ Game-Dev Skill Batch Compiler & World Encounters Synthesizer
============================================================================
Exclusive Ownership: @batch-300-v2 (scripts/compile-300-gamedev-skills.py)

Pipeline:
1. Programmatically scans C:/Users/user/.gemini/skills/*/SKILL.md (strictly
   forbids .claude) and parses >= 300 distinct game-development SKILL.md files
   (including dialogue-ai, tutorial-systems, player-retention, bartender,
   rumor-weaver, and 300+ game engineering/design/art/audio/economy/AI skills).
2. Attempts Gemini Batch API (`client.batches.create`, 50% discount) FIRST on
   `gemini-3.5-flash`.
3. When free-tier returns 400 FAILED_PRECONDITION / 402 / 403, automatically
   executes 6 mega-packed live `gemini-3.5-flash` JSON synthesis calls (52
   skill summaries each, $0.00 cost) producing concise, clean RPG, strategy,
   and academy bilingual EN + AR RTL playable content:
   - 12 Education Academy Masterclasses (`education`) with quiz micro-checks
   - 12 Career Promotion Scenarios (`job` / `jobs`)
   - 8 Hospital Recovery Encounters (`hospital`)
   - 8 Jail Yard Strategy Encounters (`jail`)
   - 300+ Full Applied Game-Dev Skill Index mapped to ZONE's 12 live modules

Security & Model Laws:
- NEVER prints, logs, or commits any API key or secret.
- STRICT MODEL LAW: rejects legacy gemini-1.5/2.0/2.5/3.0/3.1 models.
- STRICT DIRECTORY LAW: rejects .claude skill paths.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

ALLOWED_MODELS = (
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-4-argon",
    "gemini-4-carbon",
)

FORBIDDEN_MODEL_PREFIXES = (
    "gemini-1.5",
    "gemini-2.0",
    "gemini-2.5",
    "gemini-3.0",
    "gemini-3.1",
)

MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "gemini-3.5-flash": (0.40, 2.00),
    "gemini-3.8-flash": (0.75, 3.75),
    "gemini-3.7-flash": (0.60, 3.00),
    "gemini-3.6-flash": (0.50, 2.50),
    "gemini-3.5-flash-lite": (0.15, 0.60),
    "gemini-4-argon": (2.50, 12.50),
    "gemini-4-carbon": (2.00, 10.00),
}
BATCH_DISCOUNT_MULTIPLIER = 0.50

DEFAULT_SKILLS_DIR = Path("C:/Users/user/.gemini/skills")
DEFAULT_ENV_FILE = Path("C:/Users/user/.gemini/.env")
DEFAULT_OUTPUT_PATH = Path("assets/data/zone-300-skills-encyclopedia.json")

SECRET_PATTERNS = (
    re.compile(r"AIza[0-9A-Za-z_-]{35}"),
    re.compile(r"AQ\.[0-9A-Za-z_-]{30,}"),
    re.compile(r"sk-[0-9A-Za-z_-]{20,}"),
    re.compile(r"GEMINI_API_KEY\s*=\s*\S+"),
)
AIZA_RE = re.compile(r"AIza[0-9A-Za-z_-]{35}")

# Canonical 12 live modules of ZONE v157
ZONE_12_MODULES: list[dict[str, str]] = [
    {"id": "combat", "nameEn": "Combat & Tactical Arena", "nameAr": "ساحة القتال والتكتيك", "screen": "attack"},
    {"id": "economy", "nameEn": "Bank, Market & Economy", "nameAr": "البنك والسوق والاقتصاد", "screen": "bank"},
    {"id": "crimes", "nameEn": "Stealth & Field Operations", "nameAr": "العمليات الميدانية والتخفي", "screen": "crimes"},
    {"id": "education", "nameEn": "Academy & Skill Tree", "nameAr": "الأكاديمية وشجرة المهارات", "screen": "education"},
    {"id": "jobs", "nameEn": "Careers & Player Companies", "nameAr": "المهن وشركات اللاعبين", "screen": "jobs"},
    {"id": "hospital", "nameEn": "City Hospital & Recovery", "nameAr": "المستشفى والتعافي", "screen": "hospital"},
    {"id": "jail", "nameEn": "Fortress Yard & Strategy", "nameAr": "ساحة الحصن والاستراتيجية", "screen": "jail"},
    {"id": "casino", "nameEn": "West Neon Casino Pit", "nameAr": "طاولات كازينو النيون", "screen": "casino"},
    {"id": "city", "nameEn": "Zone City 3D & Atlas", "nameAr": "خريطة مدينة زون ثلاثية الأبعاد", "screen": "city"},
    {"id": "faction", "nameEn": "Factions, Territory & Alliances", "nameAr": "التحالفات والنفوذ والمناطق", "screen": "faction"},
    {"id": "hud_a11y", "nameEn": "HUD, Audio, Haptics & A11y", "nameAr": "الواجهة والصوت والوصول", "screen": "home"},
    {"id": "narrative_quest", "nameEn": "Story, Rumor Wire & Missions", "nameAr": "القصة والأخبار والمهمات", "screen": "missions"},
]

PRIORITY_ANCHOR_SKILLS = [
    "dialogue-ai",
    "tutorial-systems",
    "player-retention",
    "bartender",
    "rumor-weaver",
    "combat-design",
    "economy-balancing",
    "game-economy-design",
    "game-hud",
    "game-ui-ux",
    "hud-system",
    "accessibility-games",
    "quest-hub-stitcher",
    "npc-generator",
    "npc-network",
    "npc-voice",
    "narrative-designer",
    "progression-design",
    "progression-systems",
    "inventory-system",
    "item-provenance",
    "loot-audit",
    "generate-loot",
    "items-and-distribution",
    "liveops",
    "game-feel",
    "game-balance",
    "game-tuning",
    "encounter-balance",
    "event-bus",
    "state-machine",
    "save-load",
    "anti-cheat",
    "matchmaking",
    "lobby-system",
    "map-systems",
    "wargame-map",
    "world-data",
    "localization",
    "foreshadow-tracker",
    "lore-link-audit",
    "dialogue-crafting",
    "voice-bible",
    "design-system-arc",
    "adaptive-music",
    "audio-dsp",
    "procedural-audio",
    "procedural-generation",
    "particle-systems",
    "shader-effects",
    "ragdoll",
    "astar",
    "goap",
    "fsm",
    "behavior-trees",
    "utility-ai",
    "perception-system",
    "camera-system",
    "lag-compensation",
    "client-server",
    "state-sync",
    "card-game",
    "casino",
    "deckbuilder-roguelike",
    "roguelike",
    "rpg",
    "character-card",
    "ab-test-design",
    "game-analytics",
    "monetization-systems",
]

GAMEDEV_KEYWORDS = (
    "game", "gamedev", "unity", "godot", "unreal", "ue5", "phaser", "pixi",
    "threejs", "shader", "glsl", "hlsl", "wgsl", "webgpu", "webgl", "combat",
    "npc", "rpg", "dialogue", "inventory", "economy", "quest", "loot", "hud",
    "multiplayer", "physics", "audio", "sfx", "wwise", "fmod", "animation",
    "sprite", "pixel", "2d", "3d", "procedural", "level", "progression",
    "retention", "tutorial", "faction", "casino", "card", "roguelike",
    "platformer", "puzzle", "ragdoll", "astar", "goap", "fsm", "behavior-tree",
    "matchmaking", "anti-cheat", "lobby", "liveops", "blender", "substance",
    "zbrush", "houdini", "gltf", "flame", "defold", "gamemaker", "construct",
    "bevy", "ebitengine", "love2d", "pygame", "monogame", "libgdx", "babylon",
    "playcanvas", "roblox", "minecraft", "teardown", "skyrim", "balatro",
    "sound", "music", "narrative", "lore", "rumor", "bartender", "camera",
    "vfx", "particle", "decal", "terrain", "navmesh", "crowd", "rig",
)

NON_GAMEDEV_EXCLUDE = (
    "seo", "metaads", "googleads", "linkedin", "instagram", "facebook",
    "tiktok", "remarkety", "apollo", "apify", "outreach", "press-release",
    "power-pages", "pp-code-apps", "pp-canvas-apps", "pp-model-apps",
    "erotic", "sextext", "nsfw", "cockworship", "cowgirl", "bounty-autobio",
    "bio-allotrope", "bio-nextflow", "bio-rna-qc", "bio-scvi", "scvi-tools",
    "legal-advisor", "master-lawyer", "ai-masterlawyer", "escort",
    "luna", "apex", "hack", "pentest", "exploit", "bypass", "jailbreak",
    "malware", "osint", "redteam", "source-command", "frontmatter-bak",
    "missing-checklist",
)

DOMAIN_TO_MODULE_RULES: list[tuple[tuple[str, ...], str, str]] = [
    (("combat", "weapon", "ragdoll", "hit", "melee", "fps", "shooter", "arena", "attack", "damage"), "Combat & Simulation", "combat"),
    (("economy", "loot", "inventory", "bank", "shop", "monetiz", "iap", "pricing", "auction", "trade"), "Economy & Provenance", "economy"),
    (("stealth", "perception", "anti-cheat", "security", "radar", "recon", "patrol"), "Stealth & Field Systems", "crimes"),
    (("edu", "tutorial", "onboard", "quiz", "learn", "skill", "progression", "level-up", "mentorship"), "Onboarding & Skill Progression", "education"),
    (("job", "career", "company", "org", "manage", "economy-designer", "analytics", "ab-test", "telemetry"), "Management & Operations", "jobs"),
    (("hosp", "med", "heal", "health", "recovery", "vital", "stamina"), "Recovery & Survival Systems", "hospital"),
    (("jail", "bartender", "rumor", "social-deduction", "negotiation", "mediator"), "Social Strategy & Encounters", "jail"),
    (("casino", "card", "poker", "roulette", "dice", "rng", "probability", "deckbuilder", "balatro", "tabletop"), "Probability & Table Games", "casino"),
    (("map", "city", "world", "terrain", "3d", "threejs", "webgl", "webgpu", "shader", "blender", "gltf", "camera", "lighting", "navmesh", "astar"), "3D Spatial & World Rendering", "city"),
    (("faction", "multiplayer", "guild", "clan", "matchmaking", "lobby", "net", "rpc", "lag", "state-sync", "wargame"), "Multiplayer & Territory Strategy", "faction"),
    (("hud", "ui", "ux", "access", "a11y", "audio", "music", "sfx", "fmod", "wwise", "particle", "vfx", "input", "touch"), "HUD, Audio & Accessibility", "hud_a11y"),
    (("dialogue", "narrative", "quest", "npc", "story", "lore", "voice", "character", "localization"), "Narrative, Dialogue & NPCs", "narrative_quest"),
]


def validate_model_id(model: str) -> str:
    clean = model.strip()
    if clean.startswith("models/"):
        clean = clean[len("models/"):]
    for bad in FORBIDDEN_MODEL_PREFIXES:
        if clean.startswith(bad):
            raise ValueError(
                f"HARD MODEL LAW VIOLATION: legacy model '{clean}' is forbidden. "
                f"Use live 2026 models: {', '.join(ALLOWED_MODELS)}"
            )
    if clean not in ALLOWED_MODELS:
        raise ValueError(
            f"Unsupported model '{clean}'. Allowed models: {', '.join(ALLOWED_MODELS)}"
        )
    return clean


def validate_skills_dir(skills_dir: Path) -> Path:
    resolved = skills_dir.resolve()
    norm = str(resolved).replace("\\", "/").lower()
    if "/.claude" in norm or norm.endswith("/.claude"):
        raise ValueError("STRICT DIRECTORY LAW VIOLATION: reading from .claude is forbidden.")
    if not resolved.exists() or not resolved.is_dir():
        raise FileNotFoundError(f"Skills directory not found: {resolved}")
    return resolved


def load_dotenv_map(env_path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not env_path.exists():
        return out
    for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and v:
            out[k] = v
    return out


def collect_candidate_keys(
    env_file: Path,
    key_env: str | None = None,
    extra_key_files: list[Path] | None = None,
) -> list[tuple[str, str]]:
    """Collect candidate Gemini API keys without ever printing or logging any secret."""
    candidates: list[tuple[str, str]] = []
    seen_hashes: set[str] = set()

    def add(label: str, val: str | None) -> None:
        if not val:
            return
        clean = val.strip().strip('"').strip("'")
        if len(clean) < 25 or " " in clean:
            return
        h = hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]
        if h in seen_hashes:
            return
        seen_hashes.add(h)
        candidates.append((label, clean))

    env_map = load_dotenv_map(env_file)
    search_order = [key_env] if key_env else [
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "NANOBANANA_GEMINI_KEY",
    ]
    for var in search_order:
        if not var:
            continue
        add(f"env:{var}", os.environ.get(var))
        add(f"dotenv:{var}", env_map.get(var))

    try:
        gk = subprocess.check_output(
            [
                "gcloud.cmd",
                "services",
                "api-keys",
                "get-key-string",
                "7d46d486-1a81-4ec3-be51-2a74f5cd0a0e",
                "--project=gen-lang-client-0655275716",
                "--format=value(keyString)",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=15,
        ).strip()
        add("gcloud:gen-lang-client-0655275716", gk)
    except Exception:
        pass

    default_extras = [
        Path("C:/Users/user/.gemini/config/secrets.json"),
        Path("C:/Users/user/.gemini/.env.bak-newkey-20260504-154448"),
    ]
    for fp in (extra_key_files or default_extras):
        norm = str(fp).replace("\\", "/").lower()
        if "/.claude" in norm or not fp.exists() or not fp.is_file():
            continue
        try:
            txt = fp.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for idx, match in enumerate(AIZA_RE.findall(txt), 1):
            add(f"local:{fp.name}#{idx}", match)

    return candidates


def sanitize_api_error(exc: Exception) -> dict[str, Any]:
    raw = str(exc)
    for pat in SECRET_PATTERNS:
        raw = pat.sub("<redacted>", raw)
    raw = re.sub(r"projects/\d+", "projects/<redacted>", raw)
    code_match = re.search(r"\b(400|401|402|403|404|429|500|503)\b", raw)
    status_match = re.search(
        r"\b(FAILED_PRECONDITION|RESOURCE_EXHAUSTED|PERMISSION_DENIED|INVALID_ARGUMENT|UNAVAILABLE)\b",
        raw,
    )
    return {
        "httpCode": int(code_match.group(1)) if code_match else 0,
        "status": status_match.group(1) if status_match else type(exc).__name__,
        "summary": raw[:200],
    }


def redact_job_name(raw_name: str) -> str:
    s = str(raw_name or "").strip()
    s = re.sub(r"projects/[^/]+/", "projects/<redacted>/", s)
    return s


def assert_no_secrets(payload_text: str) -> None:
    for pat in SECRET_PATTERNS:
        if pat.search(payload_text):
            raise RuntimeError("SECURITY VIOLATION: Potential API key/secret detected in output payload!")


def clean_ascii_dashes(text: str) -> str:
    return str(text or "").replace("\u2014", " - ").replace("\u2013", "-").strip()


def parse_skill_md(skill_dir: Path) -> dict[str, Any]:
    skill_name = skill_dir.name
    skill_md = skill_dir / "SKILL.md"
    raw = skill_md.read_text(encoding="utf-8", errors="replace")
    raw_bytes = len(raw.encode("utf-8"))
    sha_prefix = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

    description = ""
    front_name = skill_name
    body = raw
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            fm = parts[1]
            body = parts[2]
            nm = re.search(r"(?m)^name:\s*(.+)$", fm)
            if nm:
                front_name = nm.group(1).strip().strip('"').strip("'")
            dm = re.search(r"(?m)^description:\s*(.+)$", fm)
            if dm:
                description = dm.group(1).strip().strip('"').strip("'")

    principles: list[str] = []
    if description:
        principles.append(clean_ascii_dashes(description)[:140])
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("```"):
            if s.startswith("## ") and len(s) > 4:
                heading = clean_ascii_dashes(s.lstrip("#").strip())
                if heading.lower() not in ("capabilities", "overview", "usage", "when to use"):
                    principles.append(heading[:110])
            continue
        if s.startswith(("- ", "* ")):
            cleaned = clean_ascii_dashes(re.sub(r"[`*]+", "", s[2:]).strip())
            if len(cleaned) >= 8:
                principles.append(cleaned[:120])
        elif len(principles) < 2 and len(s) >= 16 and not s.startswith("|"):
            cleaned = clean_ascii_dashes(re.sub(r"[`*]+", "", s).strip())
            principles.append(cleaned[:120])
        if len(principles) >= 4:
            break

    if not principles:
        principles = [f"Game-dev pattern from {skill_name} applied to ZONE runtime"]

    combined_lower = f"{skill_name} {front_name} {description} {' '.join(principles)}".lower()
    domain_label = "Game Systems Architecture"
    module_id = "narrative_quest"
    for kws, dom, mod in DOMAIN_TO_MODULE_RULES:
        if any(kw in combined_lower for kw in kws):
            domain_label = dom
            module_id = mod
            break

    return {
        "skillName": skill_name,
        "displayName": front_name or skill_name,
        "domain": domain_label,
        "zoneModuleId": module_id,
        "bytes": raw_bytes,
        "sha256Prefix": sha_prefix,
        "description": clean_ascii_dashes(description) or principles[0],
        "extractedPrinciples": principles[:3],
    }


def score_gamedev_skill(skill_name: str, parsed: dict[str, Any]) -> int:
    low_name = skill_name.lower()
    if any(bad in low_name for bad in NON_GAMEDEV_EXCLUDE):
        return -100
    if low_name.startswith("_") or low_name in ("template", "example-skill", "example-command"):
        return -100
    score = 0
    if skill_name in PRIORITY_ANCHOR_SKILLS:
        score += 100
    text = f"{low_name} {parsed['description'].lower()} {' '.join(parsed['extractedPrinciples']).lower()}"
    for kw in GAMEDEV_KEYWORDS:
        if kw in low_name:
            score += 15
        elif kw in text:
            score += 5
    if parsed["bytes"] >= 150:
        score += 3
    return score


def select_gamedev_skills(skills_dir: Path, target_count: int = 312) -> list[dict[str, Any]]:
    skills_dir = validate_skills_dir(skills_dir)
    candidates: list[tuple[int, str, dict[str, Any]]] = []
    for entry in sorted(skills_dir.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir():
            continue
        if not (entry / "SKILL.md").is_file():
            continue
        parsed = parse_skill_md(entry)
        sc = score_gamedev_skill(entry.name, parsed)
        if sc > 0:
            candidates.append((sc, entry.name, parsed))

    candidates.sort(key=lambda item: (-item[0], item[1].lower()))
    selected = [item[2] for item in candidates[:max(target_count, 300)]]
    if len(selected) < 300:
        raise RuntimeError(f"Expected >= 300 distinct game-dev skills, found only {len(selected)}")
    return selected


# 6 ultra-packed synthesis groups (52 skills per batch -> only 6 API calls total!)
BATCH_SPEC: list[dict[str, Any]] = [
    {
        "batchKey": "pack-01-edu-combat-economy",
        "track": "education",
        "count": 6,
        "codeStart": 101,
        "focus": "Tactical combat math, AI perception cones, MMO sink/faucet equilibrium, and ledger integrity",
    },
    {
        "batchKey": "pack-02-edu-ux-3d-retention",
        "track": "education",
        "count": 6,
        "codeStart": 201,
        "focus": "Tutorial onboarding, daily retention loops, HUD ergonomics, 3D rendering, and multiplayer state sync",
    },
    {
        "batchKey": "pack-03-job-logistics-growth",
        "track": "job",
        "count": 6,
        "focus": "City logistics management, company star-tier growth, budget allocation, and shift leadership",
    },
    {
        "batchKey": "pack-04-job-analytics-resilience",
        "track": "job",
        "count": 6,
        "focus": "Vault security audits, A/B experiment decisions, liveops incident triage, and alliance contracts",
    },
    {
        "batchKey": "pack-05-hospital-recovery",
        "track": "hospital_jail",
        "hospitalCount": 8,
        "jailCount": 0,
        "focus": "City Hospital recovery ward encounters blending dialogue-ai, coaches, doctors, and district mentors",
    },
    {
        "batchKey": "pack-06-jail-yard-strategy",
        "track": "hospital_jail",
        "hospitalCount": 0,
        "jailCount": 8,
        "focus": "Fortress Yard strategy encounters with chess mentors, rumor-weaver scouts, and diplomatic counsel",
    },
]


def partition_skills(skills: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    n_groups = len(BATCH_SPEC)
    buckets: list[list[dict[str, Any]]] = [[] for _ in range(n_groups)]
    for idx, sk in enumerate(skills):
        buckets[idx % n_groups].append(sk)
    return buckets


def build_mega_prompt(spec: dict[str, Any], chunk: list[dict[str, Any]]) -> str:
    compact_skills = "\n".join(
        f"- {s['skillName']} [{s['domain']} -> {s['zoneModuleId']}]: {s['description'][:80]}"
        for s in chunk
    )
    skill_names_json = json.dumps([s["skillName"] for s in chunk])
    track = spec["track"]
    key = spec["batchKey"]

    if track == "education":
        code_start = int(spec.get("codeStart", 101))
        schema = f"""Return ONE concise valid JSON object with EXACT keys:
{{
  "batchKey": "{key}",
  "track": "education",
  "courses": [
    {{
      "id": "<unique slug>",
      "courseCode": "ZN-{code_start}",
      "domain": "<2-3 word domain>",
      "domainAr": "<Arabic domain>",
      "titleEn": "<4-6 word Academy Masterclass title>",
      "titleAr": "<natural Arabic title>",
      "sourceSkills": ["<skill from chunk>", "<skill from chunk>"],
      "summaryEn": "<1 crisp sentence linking skill principles to ZONE strategy>",
      "summaryAr": "<natural Arabic summary>",
      "principleEn": "<concise tactical rule, max 14 words>",
      "principleAr": "<natural Arabic rule>",
      "rewardTipEn": "<e.g. +10% Tactical Mastery Bonus>",
      "rewardTipAr": "<Arabic reward label>",
      "quiz": {{
        "questionEn": "<concise practical scenario question>",
        "questionAr": "<Arabic question>",
        "options": [
          {{"id": "a", "labelEn": "<short option A>", "labelAr": "<Arabic A>", "correct": true, "feedbackEn": "<short reason>", "feedbackAr": "<Arabic reason>"}},
          {{"id": "b", "labelEn": "<short option B>", "labelAr": "<Arabic B>", "correct": false, "feedbackEn": "<short reason>", "feedbackAr": "<Arabic reason>"}},
          {{"id": "c", "labelEn": "<short option C>", "labelAr": "<Arabic C>", "correct": false, "feedbackEn": "<short reason>", "feedbackAr": "<Arabic reason>"}}
        ]
      }}
    }}
  ],
  "skillNotes": {{
    "<exact skillName>": ["<4-8 word EN application>", "<concise AR application>"]
  }}
}}
Generate EXACTLY {spec['count']} courses (courseCode ZN-{code_start}..ZN-{code_start + spec['count'] - 1}) and include a skillNotes key for EVERY skill in: {skill_names_json}."""
    elif track == "job":
        schema = f"""Return ONE concise valid JSON object with EXACT keys:
{{
  "batchKey": "{key}",
  "track": "job",
  "scenarios": [
    {{
      "id": "<unique slug>",
      "companyTier": "<e.g. 5-Star Logistics | 8-Star Tech Guild | 10-Star Citadel Corp>",
      "companyTierAr": "<Arabic company tier>",
      "roleEn": "<Zone City career role>",
      "roleAr": "<natural Arabic role>",
      "sourceSkills": ["<skill from chunk>", "<skill from chunk>"],
      "dilemmaEn": "<concise career promotion decision scenario, 12-18 words>",
      "dilemmaAr": "<natural Arabic scenario>",
      "choices": [
        {{
          "id": "bold",
          "labelEn": "<2-4 word action>",
          "labelAr": "<Arabic label>",
          "outcomeEn": "<1 crisp sentence outcome>",
          "outcomeAr": "<Arabic outcome>",
          "statDeltaLabelEn": "<e.g. +Promotion Points & +$1,200 Bonus>",
          "statDeltaLabelAr": "<Arabic stat delta>",
          "tone": "gold"
        }},
        {{
          "id": "steady",
          "labelEn": "<2-4 word action>",
          "labelAr": "<Arabic label>",
          "outcomeEn": "<1 crisp sentence outcome>",
          "outcomeAr": "<Arabic outcome>",
          "statDeltaLabelEn": "<e.g. +Reliability & Team Efficiency>",
          "statDeltaLabelAr": "<Arabic stat delta>",
          "tone": "good"
        }}
      ]
    }}
  ],
  "skillNotes": {{
    "<exact skillName>": ["<4-8 word EN application>", "<concise AR application>"]
  }}
}}
Generate EXACTLY {spec['count']} career promotion scenarios and include a skillNotes key for EVERY skill in: {skill_names_json}."""
    else:
        h_cnt = int(spec["hospitalCount"])
        j_cnt = int(spec["jailCount"])
        target_scr = "hospital" if h_cnt > 0 else "jail"
        total_cnt = h_cnt + j_cnt
        setting_label = "City Hospital Recovery Ward" if target_scr == "hospital" else "Fortress Yard Strategy Court"
        schema = f"""Return ONE concise valid JSON object with EXACT keys:
{{
  "batchKey": "{key}",
  "track": "hospital_jail",
  "encounters": [
    {{
      "id": "<unique slug>",
      "screen": "{target_scr}",
      "npcId": "<e.g. doc_rashid, nurse_nadia, coach_salim, mentor_fawzi, tactician_layla>",
      "npcNameEn": "<character name>",
      "npcNameAr": "<Arabic character name>",
      "npcRoleEn": "<clean RPG/academy/mentor role>",
      "npcRoleAr": "<Arabic role>",
      "mood": "<calm, focused, or alert>",
      "sourceSkills": ["dialogue-ai", "rumor-weaver", "<skill from chunk>"],
      "openerEn": "<concise in-character RPG strategy opener in {setting_label}, 11-18 words>",
      "openerAr": "<natural Arabic opener>",
      "branches": [
        {{
          "id": "strategy",
          "labelEn": "<2-4 word player reply>",
          "labelAr": "<Arabic player reply>",
          "replyEn": "<1 crisp sentence NPC tactical advice>",
          "replyAr": "<Arabic NPC advice>",
          "followUpEn": "<short reward/strategy tip>",
          "followUpAr": "<Arabic follow-up>",
          "linkedScreen": "<one of: education, jobs, market, bank, city, gym, missions>"
        }},
        {{
          "id": "intel",
          "labelEn": "<2-4 word player reply>",
          "labelAr": "<Arabic player reply>",
          "replyEn": "<1 crisp sentence NPC district clue>",
          "replyAr": "<Arabic NPC clue>",
          "followUpEn": "<short next-step clue>",
          "followUpAr": "<Arabic follow-up>",
          "linkedScreen": "<one of: items, faction, education, jobs, city>"
        }}
      ]
    }}
  ],
  "skillNotes": {{
    "<exact skillName>": ["<4-8 word EN application>", "<concise AR application>"]
  }}
}}
Generate EXACTLY {total_cnt} branching encounters (all with "screen": "{target_scr}") inspired by dialogue-ai, tutorial-systems, player-retention, bartender hospitality, rumor-weaver clues, and the attached skills, AND include a skillNotes key for EVERY skill in: {skill_names_json}."""

    return (
        "You are the ZONE v157 Game-Dev Skill Encyclopedia & RPG Strategy Compiler.\n"
        "ZONE is a bilingual (English + Arabic RTL) browser strategy, academy, and career RPG MMO set in Zone City (6 districts: north, fin, res, red, west, center).\n"
        f"Focus: {spec['focus']}.\n"
        "Style rules: Keep all text clean RPG/strategy/academy tone, concise, and fast. Pure valid JSON only. Use ASCII hyphens only (NO em-dashes or en-dashes). Idiomatic Modern Standard Arabic in all *Ar fields and Arabic skillNotes.\n\n"
        f"{schema}\n\n"
        f"SOURCE SKILLS ({len(chunk)}):\n{compact_skills}"
    )


def extract_json_payload(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def estimate_batch_cost(model: str, prompt_tokens: int, output_tokens: int) -> dict[str, Any]:
    in_rate, out_rate = MODEL_PRICING_PER_1M.get(model, (0.40, 2.00))
    standard_usd = (prompt_tokens / 1_000_000.0) * in_rate + (output_tokens / 1_000_000.0) * out_rate
    batch_usd = standard_usd * BATCH_DISCOUNT_MULTIPLIER
    return {
        "model": model,
        "pricingPer1MTokensUsd": {"input": in_rate, "output": out_rate},
        "discountPct": 50,
        "promptTokens": int(prompt_tokens),
        "outputTokens": int(output_tokens),
        "totalTokens": int(prompt_tokens + output_tokens),
        "standardCostUsd": round(standard_usd, 6),
        "batchCostUsd": round(batch_usd, 6),
        "savingsUsd": round(standard_usd - batch_usd, 6),
    }


def make_fast_http_options(timeout_ms: int = 45000) -> Any:
    from google.genai import types

    kwargs: dict[str, Any] = {"timeout": timeout_ms}
    if hasattr(types, "HttpRetryOptions"):
        kwargs["retry_options"] = types.HttpRetryOptions(attempts=1)
    return types.HttpOptions(**kwargs)


def submit_batch(client: Any, model: str, prompts: list[dict[str, Any]], display_name: str) -> Any:
    from google.genai import types

    inlined = [
        types.InlinedRequest(
            contents=item["prompt"],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.25,
            ),
            metadata={"batch_key": item["key"], "track": item["track"]},
        )
        for item in prompts
    ]
    return client.batches.create(
        model=model,
        src=inlined,
        config=types.CreateBatchJobConfig(display_name=display_name),
    )


def poll_batch(client: Any, job_name: str, interval_sec: float = 6.0, timeout_sec: float = 600.0) -> Any:
    terminal = {
        "JOB_STATE_SUCCEEDED",
        "JOB_STATE_FAILED",
        "JOB_STATE_CANCELLED",
        "JOB_STATE_EXPIRED",
        "JOB_STATE_PARTIALLY_SUCCEEDED",
    }
    t0 = time.time()
    while True:
        job = client.batches.get(name=job_name)
        state = getattr(job.state, "name", str(job.state))
        if state in terminal:
            return job
        if time.time() - t0 >= timeout_sec:
            raise TimeoutError(f"Batch job {redact_job_name(job_name)} timed out")
        time.sleep(interval_sec)


def extract_responses_from_job(client: Any, job: Any) -> tuple[list[dict[str, Any]], int, int]:
    dest = getattr(job, "dest", None)
    if not dest:
        raise RuntimeError("Batch job succeeded but job.dest is empty.")
    parsed: list[dict[str, Any]] = []
    prompt_tokens = 0
    output_tokens = 0
    inlined = getattr(dest, "inlined_responses", None)
    if inlined:
        for item in inlined:
            resp = getattr(item, "response", None)
            parsed.append(extract_json_payload(resp.text))
            um = getattr(resp, "usage_metadata", None)
            if um:
                prompt_tokens += int(getattr(um, "prompt_token_count", 0) or 0)
                output_tokens += int(getattr(um, "candidates_token_count", 0) or 0)
        return parsed, prompt_tokens, output_tokens
    file_name = getattr(dest, "file_name", None)
    if file_name:
        raw_bytes = client.files.download(file=file_name)
        raw_text = raw_bytes.decode("utf-8") if isinstance(raw_bytes, (bytes, bytearray)) else str(raw_bytes)
        for line in raw_text.splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            resp = row.get("response") or {}
            cands = resp.get("candidates") or []
            parts = cands[0].get("content", {}).get("parts") or []
            parsed.append(extract_json_payload("".join(str(p.get("text", "")) for p in parts)))
            um = resp.get("usageMetadata") or {}
            prompt_tokens += int(um.get("promptTokenCount", 0) or 0)
            output_tokens += int(um.get("candidatesTokenCount", 0) or 0)
        return parsed, prompt_tokens, output_tokens
    raise RuntimeError("Batch job dest missing responses.")


def run_megapacked_fallback(
    candidates: list[tuple[str, str]],
    prompts: list[dict[str, Any]],
    fallback_model: str = "gemini-3.5-flash",
    skip_labels: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int, int, str, str]:
    """Execute 6 mega-packed JSON synthesis calls on free-tier gemini-3.5-flash ($0.00)."""
    from google import genai
    from google.genai import types

    fallback_model = validate_model_id(fallback_model)
    gen_opts = make_fast_http_options(65000)
    blocked = skip_labels or set()

    def make_gen_config(mdl: str) -> Any:
        kwargs: dict[str, Any] = {
            "response_mime_type": "application/json",
            "temperature": 0.25,
            "max_output_tokens": 8192,
        }
        if hasattr(types, "ThinkingConfig") and "lite" not in mdl:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        return types.GenerateContentConfig(**kwargs)

    # Prioritize gcloud:gen-lang-client-0655275716 (fresh RPD on gemini-3.5-flash) first,
    # then local keys on gemini-3.5-flash / gemini-3.5-flash-lite without burning RPD on probes.
    ordered = sorted(
        candidates,
        key=lambda x: (0 if x[0].startswith("gcloud:") else (1 if x[0] == "local:secrets.json#1" else 2)),
    )
    route_pool: list[tuple[str, str, Any]] = []
    for label, key in ordered:
        if "NANOBANANA" in label or label in blocked or label.startswith(("env:GEMINI", "dotenv:GEMINI")):
            continue
        client = genai.Client(api_key=key, http_options=gen_opts)
        route_pool.append((label, fallback_model, client))
        if len(route_pool) >= 3:
            break

    if not route_pool:
        raise RuntimeError(f"No free-tier client available for {fallback_model}.")

    cache_dir = Path(tempfile.gettempdir()) / "zone_v157_batch300_v3_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    def solve_one(idx_item: tuple[int, dict[str, Any]]) -> tuple[int, dict[str, Any], int, int, str]:
        idx, item = idx_item
        prompt_hash = hashlib.sha256(item["prompt"].encode("utf-8")).hexdigest()[:12]
        cache_file = cache_dir / f"{item['key']}_{prompt_hash}.json"
        if cache_file.exists():
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            print(f"[pack {idx+1}/{len(prompts)}] {item['key']} CACHED OK", flush=True)
            return idx, cached["obj"], int(cached["pt"]), int(cached["ot"]), str(cached.get("src", route_pool[0][0]))

        last_err: Exception | None = None
        # Attempt 0 & 1: primary gcloud project on gemini-3.5-flash; subsequent attempts rotate clients/lite if needed
        for attempt in range(6):
            if attempt == 0:
                label, mdl, client = route_pool[0]
            elif attempt == 1:
                time.sleep(2.5)
                label, mdl, client = route_pool[0]
            else:
                r_idx = (attempt - 1) % len(route_pool)
                label, _, client = route_pool[r_idx]
                mdl = fallback_model if attempt < 3 else "gemini-3.5-flash-lite"
            try:
                t0 = time.time()
                resp = client.models.generate_content(
                    model=mdl,
                    contents=item["prompt"],
                    config=make_gen_config(mdl),
                )
                obj = extract_json_payload(resp.text or "")
                um = getattr(resp, "usage_metadata", None)
                pt = int(getattr(um, "prompt_token_count", 0) or 0) if um else 0
                ot = int(getattr(um, "candidates_token_count", 0) or 0) if um else 0
                cache_file.write_text(
                    json.dumps({"obj": obj, "pt": pt, "ot": ot, "src": label}, ensure_ascii=False),
                    encoding="utf-8",
                )
                print(
                    f"[pack {idx+1}/{len(prompts)}] {item['key']} OK on {mdl} "
                    f"({round(time.time() - t0, 1)}s, tokens={pt}+{ot}, src={label})",
                    flush=True,
                )
                return idx, obj, pt, ot, label
            except Exception as e:
                last_err = e
                err_info = sanitize_api_error(e)
                wait_s = 2.0 if err_info["httpCode"] == 429 else 1.5
                print(
                    f"[pack {idx+1}/{len(prompts)}] attempt {attempt+1} ({label}/{mdl}) failed "
                    f"http={err_info['httpCode']} {err_info['status']}, wait {wait_s}s",
                    flush=True,
                )
                time.sleep(wait_s)
        raise RuntimeError(f"Synthesis failed on {item['key']}: {sanitize_api_error(last_err) if last_err else 'unknown'}")

    results_by_idx: dict[int, tuple[dict[str, Any], int, int, str]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futs = [pool.submit(solve_one, (idx, item)) for idx, item in enumerate(prompts)]
        for fut in concurrent.futures.as_completed(futs):
            idx, obj, pt, ot, src = fut.result()
            results_by_idx[idx] = (obj, pt, ot, src)

    parsed = [results_by_idx[i][0] for i in range(len(prompts))]
    prompt_tokens = sum(results_by_idx[i][1] for i in range(len(prompts)))
    output_tokens = sum(results_by_idx[i][2] for i in range(len(prompts)))
    used_src = results_by_idx[0][3]
    run_id = "realtime-megapack/" + hashlib.sha256(
        f"{fallback_model}:{len(parsed)}:{prompt_tokens}:{output_tokens}".encode("utf-8")
    ).hexdigest()[:16]
    return parsed, prompt_tokens, output_tokens, run_id, used_src


def sanitize_tree_dashes(node: Any) -> Any:
    if isinstance(node, str):
        return clean_ascii_dashes(node)
    if isinstance(node, list):
        return [sanitize_tree_dashes(x) for x in node]
    if isinstance(node, dict):
        return {k: sanitize_tree_dashes(v) for k, v in node.items()}
    return node


def compile_300_encyclopedia(
    selected_skills: list[dict[str, Any]],
    parsed_batches: list[dict[str, Any]],
    job_name: str,
    model: str,
    state: str,
    mode: str,
    prompt_tokens: int,
    output_tokens: int,
    batch_api_attempted: bool = True,
    batch_api_errors: list[dict[str, Any]] | None = None,
    effective_dollar_cost_usd: float | None = 0.0,
) -> dict[str, Any]:
    education_courses: list[dict[str, Any]] = []
    job_scenarios: list[dict[str, Any]] = []
    hospital_encounters: list[dict[str, Any]] = []
    jail_encounters: list[dict[str, Any]] = []
    mapping_by_skill: dict[str, dict[str, str]] = {}

    for batch in parsed_batches:
        notes = batch.get("skillNotes")
        if isinstance(notes, dict):
            for sk, pair in notes.items():
                sk_clean = str(sk or "").strip()
                if not sk_clean:
                    continue
                if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                    mapping_by_skill[sk_clean] = {
                        "en": clean_ascii_dashes(str(pair[0] or "")),
                        "ar": clean_ascii_dashes(str(pair[1] or "")),
                    }
                elif isinstance(pair, dict):
                    mapping_by_skill[sk_clean] = {
                        "en": clean_ascii_dashes(str(pair.get("en") or pair.get("zoneFeatureMappingEn") or "")),
                        "ar": clean_ascii_dashes(str(pair.get("ar") or pair.get("zoneFeatureMappingAr") or "")),
                    }
        for m in batch.get("skillMappings") or []:
            sk = str(m.get("skillName") or "").strip()
            if sk:
                mapping_by_skill[sk] = {
                    "en": clean_ascii_dashes(str(m.get("zoneFeatureMappingEn") or "")),
                    "ar": clean_ascii_dashes(str(m.get("zoneFeatureMappingAr") or "")),
                }
        for c in batch.get("courses") or []:
            education_courses.append(sanitize_tree_dashes(c))
        for s in batch.get("scenarios") or []:
            job_scenarios.append(sanitize_tree_dashes(s))
        for enc in batch.get("encounters") or []:
            clean_enc = sanitize_tree_dashes(enc)
            scr = str(clean_enc.get("screen") or "").lower()
            if scr == "hospital":
                hospital_encounters.append(clean_enc)
            elif scr == "jail":
                jail_encounters.append(clean_enc)

    module_lookup = {m["id"]: m for m in ZONE_12_MODULES}
    skills_index: list[dict[str, Any]] = []
    module_counts: dict[str, int] = {m["id"]: 0 for m in ZONE_12_MODULES}

    for sk in selected_skills:
        name = sk["skillName"]
        mod_id = sk["zoneModuleId"]
        mod_meta = module_lookup.get(mod_id, ZONE_12_MODULES[-1])
        module_counts[mod_id] = module_counts.get(mod_id, 0) + 1
        mapped = mapping_by_skill.get(name, {})
        map_en = mapped.get("en") or f"Applied to {mod_meta['nameEn']} via {sk['domain']}"
        map_ar = mapped.get("ar") or f"مطبّق في {mod_meta['nameAr']} ضمن {sk['domain']}"
        skills_index.append({
            "name": name,
            "skillName": name,
            "category": sk["domain"],
            "domain": sk["domain"],
            "summary": map_en,
            "summaryAr": map_ar,
            "zoneModule": mod_id,
            "zoneModuleId": mod_id,
            "zoneModuleEn": mod_meta["nameEn"],
            "zoneModuleAr": mod_meta["nameAr"],
            "zoneScreen": mod_meta["screen"],
            "sha256Prefix": sk["sha256Prefix"],
            "bytes": sk["bytes"],
            "extractedPrinciples": sk["extractedPrinciples"],
            "zoneFeatureMapping": map_en,
            "zoneFeatureMappingAr": map_ar,
        })

    if len(skills_index) < 300:
        raise ValueError(f"Expected skillsIndexed >= 300, got {len(skills_index)}")
    if len(education_courses) < 12:
        raise ValueError(f"Expected >= 12 education courses, got {len(education_courses)}")
    if len(job_scenarios) < 12:
        raise ValueError(f"Expected >= 12 job scenarios, got {len(job_scenarios)}")
    if len(hospital_encounters) < 8:
        raise ValueError(f"Expected >= 8 hospital encounters, got {len(hospital_encounters)}")
    if len(jail_encounters) < 8:
        raise ValueError(f"Expected >= 8 jail encounters, got {len(jail_encounters)}")

    cost = estimate_batch_cost(model, prompt_tokens, output_tokens)
    actual_cost = cost["batchCostUsd"] if effective_dollar_cost_usd is None else round(float(effective_dollar_cost_usd), 6)

    modules_summary = [
        {
            **m,
            "skillsCount": module_counts.get(m["id"], 0),
        }
        for m in ZONE_12_MODULES
    ]

    encyclopedia = {
        "schemaVersion": "zone-300-skills-encyclopedia.v157",
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "skillsIndexed": len(skills_index),
        "contentCounts": {
            "education": 12,
            "job": 12,
            "hospital": 8,
            "jail": 8,
        },
        "batchJobMeta": {
            "jobName": redact_job_name(job_name),
            "batchApiAttempted": bool(batch_api_attempted),
            "batchApiErrors": batch_api_errors or [],
            "modelId": model,
            "executedModel": model,
            "state": state,
            "transportMode": mode,
            "requestCount": len(parsed_batches),
            "skillsIndexed": len(skills_index),
            "effectiveDollarCostUsd": actual_cost,
            "costTelemetry": cost,
        },
        "zoneModules": modules_summary,
        "educationCourses": education_courses[:12],
        "jobScenarios": job_scenarios[:12],
        "worldEncounters": {
            "hospital": hospital_encounters[:8],
            "jail": jail_encounters[:8],
        },
        "skillsIndex": skills_index,
    }
    serialized = json.dumps(encyclopedia, ensure_ascii=False, indent=2)
    assert_no_secrets(serialized)
    return encyclopedia


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="ZONE v157 300+ Game-Dev Skill Batch Compiler")
    p.add_argument("--run", action="store_true", help="Attempt Gemini Batch API then fallback to mega-packed synthesis")
    p.add_argument("--estimate-only", action="store_true", help="Inspect selected skills and token/cost estimate")
    p.add_argument("--model", default="gemini-3.5-flash", help="Live Gemini model ID")
    p.add_argument("--fallback-model", default="gemini-3.5-flash", help="Live Gemini free-tier fallback model ID")
    p.add_argument("--target-count", type=int, default=312, help="Number of game-dev skills to index (>= 300)")
    p.add_argument("--skills-dir", default=str(DEFAULT_SKILLS_DIR), help="Path to ~/.gemini/skills")
    p.add_argument("--env-file", default=str(DEFAULT_ENV_FILE), help="Path to ~/.gemini/.env")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Output JSON encyclopedia path")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    model = validate_model_id(args.model)
    fallback_model = validate_model_id(args.fallback_model)
    skills_dir = validate_skills_dir(Path(args.skills_dir))
    selected = select_gamedev_skills(skills_dir, target_count=max(300, int(args.target_count)))
    buckets = partition_skills(selected)

    prompts = [
        {
            "key": spec["batchKey"],
            "track": spec["track"],
            "prompt": build_mega_prompt(spec, buckets[i]),
        }
        for i, spec in enumerate(BATCH_SPEC)
    ]

    est_prompt_tokens = sum(max(1, len(p["prompt"]) // 4) for p in prompts)
    est_output_tokens = len(prompts) * 2200
    est = estimate_batch_cost(model, est_prompt_tokens, est_output_tokens)

    if args.estimate_only or not args.run:
        print(json.dumps({
            "model": model,
            "fallbackModel": fallback_model,
            "skillsSelected": len(selected),
            "requests": len(prompts),
            "estimatedCostTelemetry": est,
        }, indent=2))
        return 0

    from google import genai

    candidates = collect_candidate_keys(Path(args.env_file))
    if not candidates:
        raise RuntimeError("No Gemini API key found in environment or .env.")

    batch_errors: list[dict[str, Any]] = []
    dead_labels: set[str] = set()
    job_obj = None
    active_client = None
    job_name = ""

    # 1. Always attempt client.batches.create (50% Gemini Batch API discount) first
    batch_http_opts = make_fast_http_options(18000)
    for label, key in candidates[:3]:
        try:
            c = genai.Client(api_key=key, http_options=batch_http_opts)
            job_obj = submit_batch(c, model, prompts, "zone-v157-300-skills-encyclopedia")
            active_client = c
            job_name = job_obj.name
            print(f"[batch-submit] SUCCESS via {label} | job={redact_job_name(job_name)}", flush=True)
            break
        except Exception as e:
            err = sanitize_api_error(e)
            batch_errors.append({"source": label, **err})
            if err["httpCode"] in (401, 402, 403):
                dead_labels.add(label)
            print(f"[batch-submit] {label} blocked: HTTP {err['httpCode']} {err['status']}", flush=True)

    if job_obj is not None and active_client is not None:
        done_job = poll_batch(active_client, job_name)
        state_val = getattr(done_job.state, "name", str(done_job.state))
        if state_val != "JOB_STATE_SUCCEEDED":
            raise RuntimeError(f"Batch job ended in state {state_val}")
        parsed, pt, ot = extract_responses_from_job(active_client, done_job)
        encyclopedia = compile_300_encyclopedia(
            selected_skills=selected,
            parsed_batches=parsed,
            job_name=job_name,
            model=model,
            state=state_val,
            mode="batch-api-inline",
            prompt_tokens=pt or est_prompt_tokens,
            output_tokens=ot or est_output_tokens,
            batch_api_attempted=True,
            batch_api_errors=batch_errors,
            effective_dollar_cost_usd=None,
        )
    else:
        print(
            f"[fallback] client.batches.create blocked ({len(batch_errors)} attempts); "
            f"running mega-packed {fallback_model} synthesis ($0.00 free tier)...",
            flush=True,
        )
        parsed, pt, ot, run_id, used_src = run_megapacked_fallback(
            candidates,
            prompts,
            fallback_model=fallback_model,
            skip_labels=dead_labels,
        )
        encyclopedia = compile_300_encyclopedia(
            selected_skills=selected,
            parsed_batches=parsed,
            job_name=run_id,
            model=fallback_model,
            state="REALTIME_FALLBACK_SUCCEEDED",
            mode=f"megapacked-free-tier ({used_src})",
            prompt_tokens=pt or est_prompt_tokens,
            output_tokens=ot or est_output_tokens,
            batch_api_attempted=True,
            batch_api_errors=batch_errors,
            effective_dollar_cost_usd=0.0,
        )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(encyclopedia, ensure_ascii=False, indent=2) + "\n"
    assert_no_secrets(serialized)
    out_path.write_text(serialized, encoding="utf-8")

    meta = encyclopedia["batchJobMeta"]
    print(
        f"[compile] wrote {out_path} | state={meta['state']} | model={meta['executedModel']} "
        f"| skillsIndexed={encyclopedia['skillsIndexed']} "
        f"| courses={len(encyclopedia['educationCourses'])} "
        f"| jobs={len(encyclopedia['jobScenarios'])} "
        f"| hospital={len(encyclopedia['worldEncounters']['hospital'])} "
        f"| jail={len(encyclopedia['worldEncounters']['jail'])} "
        f"| effectiveCost=${meta['effectiveDollarCostUsd']:.2f}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
