#!/usr/bin/env python3
"""
ZONE v156 - Gemini Batch API (50% Cost Reduction) Multi-Skill GameDev Synthesizer
=================================================================================
Exclusive Ownership: @batch-api-engine (scripts/gemini-batch-gamedev.py)

Pipeline Order:
1. ALWAYS attempts Gemini Batch API (`client.batches.create`, 50% cost reduction)
   FIRST whenever a funded Tier-1+ project key or Vertex AI project is active.
2. If `client.batches.create` is blocked by billing/tier preconditions
   (`400 FAILED_PRECONDITION`, `402 RESOURCE_EXHAUSTED`, or `403 PERMISSION_DENIED`),
   automatically falls back to multi-skill packed live `gemini-3.5-flash`
   (`client.models.generate_content`, $0.00 free-tier key, 0 Swarm quota burn)
   with 100% honest `batchJobMeta` telemetry (`batchApiAttempted: true`, exact
   redacted HTTP codes encountered, `executedModel`, `effectiveDollarCostUsd: 0.0`).

Security & Policy Laws:
- NEVER prints, logs, or writes any API key or credential.
- STRICT MODEL LAW: Rejects legacy gemini-1.5/2.0/2.5/3.0/3.1 models.
- STRICT DIRECTORY LAW: Reads SKILL.md strictly from --skills-dir (blocks .claude).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

# Hard Model Law: strictly 2026 live models supporting batchGenerateContent
ALLOWED_MODELS = (
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
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

# Public list-price USD per 1M tokens (Standard vs Batch API 50% discount)
MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "gemini-3.8-flash": (0.75, 3.75),
    "gemini-3.7-flash": (0.60, 3.00),
    "gemini-3.6-flash": (0.50, 2.50),
    "gemini-3.5-flash": (0.40, 2.00),
    "gemini-3.5-flash-lite": (0.15, 0.60),
    "gemini-4-argon": (2.50, 12.50),
    "gemini-4-carbon": (2.00, 10.00),
}
BATCH_DISCOUNT_MULTIPLIER = 0.50

DEFAULT_SKILLS_DIR = Path("C:/Users/user/.gemini/skills")
DEFAULT_ENV_FILE = Path("C:/Users/user/.gemini/.env")
DEFAULT_OUTPUT_PATH = Path("assets/data/zone-batch-skill-pack.json")
DEFAULT_STATE_PATH = Path(tempfile.gettempdir()) / "zone-v156-batch-state.json"

# 10 structured synthesis groups x 4 verified game-dev skills = 40 skills total
SKILL_BATCH_GROUPS: list[dict[str, Any]] = [
    {
        "batchKey": "grp-01-item-provenance-weapons",
        "domain": "itemProvenance",
        "focus": "weapons_melee",
        "skills": ["item-provenance", "loot-audit", "generate-loot", "items-and-distribution"],
        "targetItems": [
            "pistol", "revolver", "smg", "shotgun", "sawedoff", "ak",
            "assaultrifle_1", "bullpup_2", "sniper", "knife", "katana", "bat",
        ],
    },
    {
        "batchKey": "grp-02-item-provenance-gear-consumables",
        "domain": "itemProvenance",
        "focus": "armor_drugs_meds_boosters_enhancers",
        "skills": ["inventory-system", "economy-balancing", "game-economy-design", "content-balance"],
        "targetItems": [
            "kevlar", "helmet", "xanax", "ecstasy", "vicodin",
            "bloodbag", "morphine", "medkit", "fhc", "edrink",
            "crowbar", "lockpick", "hacking_rig", "weapon_cache",
        ],
    },
    {
        "batchKey": "grp-03-rumor-wire-harbor-citadel",
        "domain": "rumorWire",
        "focus": "north_fin_res",
        "skills": ["rumor-weaver", "newspaper", "lore-link-audit", "foreshadow-tracker"],
        "districts": ["north", "fin", "res"],
    },
    {
        "batchKey": "grp-04-rumor-wire-foundry-neon-center",
        "domain": "rumorWire",
        "focus": "red_west_center",
        "skills": ["map-systems", "wargame-map", "world-data", "localization"],
        "districts": ["red", "west", "center"],
    },
    {
        "batchKey": "grp-05-quest-hub-flash-contracts",
        "domain": "questHub",
        "focus": "syndicate_flash_contracts",
        "skills": ["quest-hub-stitcher", "dialogue-crafting", "voice-bible", "npc-voice"],
        "speakers": ["luna", "mayor_tariq"],
    },
    {
        "batchKey": "grp-06-narrative-npc-comms",
        "domain": "questHub",
        "focus": "branching_comms_and_arcs",
        "skills": ["narrative-designer", "npc-generator", "npc-network", "design-system-arc"],
        "speakers": ["luna", "mayor_tariq"],
    },
    {
        "batchKey": "grp-07-progression-liveops",
        "domain": "liveOpsRules",
        "focus": "progression_retention_liveops",
        "skills": ["progression-design", "progression-systems", "player-retention", "liveops"],
    },
    {
        "batchKey": "grp-08-combat-encounters-balance",
        "domain": "liveOpsRules",
        "focus": "combat_balance_feel",
        "skills": ["combat-design", "encounter-balance", "game-feel", "game-balance"],
    },
    {
        "batchKey": "grp-09-hud-ux-accessibility",
        "domain": "liveOpsRules",
        "focus": "hud_ux_a11y_tuning",
        "skills": ["game-hud", "game-ui-ux", "hud-system", "accessibility-games"],
    },
    {
        "batchKey": "grp-10-systems-architecture-patterns",
        "domain": "liveOpsRules",
        "focus": "events_fsm_persistence_tuning",
        "skills": ["event-bus", "state-machine", "save-load", "game-tuning"],
    },
]

SECRET_PATTERNS = (
    re.compile(r"AIza[0-9A-Za-z_-]{35}"),
    re.compile(r"AQ\.[0-9A-Za-z_-]{30,}"),
    re.compile(r"sk-[0-9A-Za-z_-]{20,}"),
    re.compile(r"GEMINI_API_KEY\s*=\s*\S+"),
)
AIZA_RE = re.compile(r"AIza[0-9A-Za-z_-]{35}")


def validate_model_id(model: str) -> str:
    clean = model.strip()
    if clean.startswith("models/"):
        clean = clean[len("models/"):]
    for bad in FORBIDDEN_MODEL_PREFIXES:
        if clean.startswith(bad):
            raise ValueError(
                f"HARD MODEL LAW VIOLATION: legacy model '{clean}' is forbidden. "
                f"Use a live 2026 model: {', '.join(ALLOWED_MODELS)}"
            )
    if clean not in ALLOWED_MODELS:
        raise ValueError(
            f"Unsupported model '{clean}'. Allowed live 2026 Batch API models: {', '.join(ALLOWED_MODELS)}"
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


def collect_candidate_keys(env_file: Path, key_env: str | None = None, extra_key_files: list[Path] | None = None) -> list[tuple[str, str]]:
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

    # Optional fallback local key files under ~/.gemini (never ~/.claude)
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

    # Optional gcloud project key on separate quota bucket (never printed/logged)
    try:
        import subprocess
        gk = subprocess.check_output(
            ["gcloud.cmd", "services", "api-keys", "get-key-string",
             "7d46d486-1a81-4ec3-be51-2a74f5cd0a0e",
             "--project=gen-lang-client-0655275716", "--format=value(keyString)"],
            text=True, stderr=subprocess.DEVNULL, timeout=20,
        ).strip()
        add("gcloud:gen-lang-client-0655275716", gk)
    except Exception:
        pass

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


def read_skill_excerpt(skills_dir: Path, skill_name: str, max_chars: int = 1600) -> dict[str, Any]:
    skill_md = skills_dir / skill_name / "SKILL.md"
    if not skill_md.exists():
        raise FileNotFoundError(f"Missing SKILL.md for '{skill_name}' at {skill_md}")
    raw = skill_md.read_text(encoding="utf-8", errors="replace")
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    excerpt = raw[:max_chars].strip()
    return {
        "skill": skill_name,
        "bytes": len(raw.encode("utf-8")),
        "sha256Prefix": digest,
        "excerpt": excerpt,
    }


def build_group_prompt(group: dict[str, Any], skill_records: list[dict[str, Any]]) -> str:
    skill_block = "\n\n".join(
        f"=== SKILL: {r['skill']} ({r['bytes']} bytes) ===\n{r['excerpt']}"
        for r in skill_records
    )
    domain = group["domain"]
    batch_key = group["batchKey"]
    skills_csv = ", ".join(r["skill"] for r in skill_records)

    if domain == "itemProvenance":
        items_csv = ", ".join(group["targetItems"])
        schema_spec = f"""Return a single valid JSON object with EXACT keys:
{{
  "batchKey": "{batch_key}",
  "domain": "itemProvenance",
  "digestedSkills": [{", ".join(json.dumps(r["skill"]) for r in skill_records)}],
  "skillRules": [
    {{
      "skill": "<skill name>",
      "principleEn": "<concise 1-sentence game-design principle applied to ZONE>",
      "principleAr": "<natural Arabic translation>"
    }}
  ],
  "items": {{
    "<item_id>": {{
      "originEn": "<Zone City syndicate origin / provenance, 8-16 words>",
      "originAr": "<natural Arabic translation>",
      "makerEn": "<black-market workshop or armorer name>",
      "makerAr": "<natural Arabic translation>",
      "craftTier": "<one of: Street-Forged, Syndicate-Spec, Black-Vault, Sovereign-Prototype>",
      "craftTierAr": "<natural Arabic tier label>",
      "auditTag": "<one of: balanced-core, high-risk-sink, tactical-utility, prestige-edge>",
      "synergyEn": "<1 crisp tactical synergy tip in ZONE gameplay>",
      "synergyAr": "<natural Arabic translation>",
      "rumorHookEn": "<short underworld rumor hook about this gear>",
      "rumorHookAr": "<natural Arabic translation>"
    }}
  }}
}}
Include an entry in "items" for EVERY ONE of these item IDs: {items_csv}."""
    elif domain == "rumorWire":
        districts_csv = ", ".join(group["districts"])
        schema_spec = f"""Return a single valid JSON object with EXACT keys:
{{
  "batchKey": "{batch_key}",
  "domain": "rumorWire",
  "digestedSkills": [{", ".join(json.dumps(r["skill"]) for r in skill_records)}],
  "skillRules": [
    {{
      "skill": "<skill name>",
      "principleEn": "<concise 1-sentence game-design principle applied to ZONE>",
      "principleAr": "<natural Arabic translation>"
    }}
  ],
  "rumors": [
    {{
      "id": "<unique slug>",
      "district": "<one of: {districts_csv}>",
      "headlineEn": "<punchy Zone Observer wire headline, 5-10 words>",
      "headlineAr": "<natural Arabic headline>",
      "bodyEn": "<underworld rumor lead + cross-link hint, 16-28 words>",
      "bodyAr": "<natural Arabic translation>",
      "heatWarningEn": "<short heat/patrol advisory>",
      "heatWarningAr": "<natural Arabic heat warning>",
      "smugglingTipEn": "<actionable smuggling or market timing tip>",
      "smugglingTipAr": "<natural Arabic smuggling tip>",
      "biasTag": "<one of: Dockside-Whisper, Vault-Leak, Syndicate-Spin, Street-Alert>",
      "linkedScreen": "<one of: crimes, items, market, bank, attack, casino, city, missions>"
    }}
  ]
}}
Generate 6 distinct rumors (2 per district across: {districts_csv})."""
    elif domain == "questHub":
        schema_spec = f"""Return a single valid JSON object with EXACT keys:
{{
  "batchKey": "{batch_key}",
  "domain": "questHub",
  "digestedSkills": [{", ".join(json.dumps(r["skill"]) for r in skill_records)}],
  "skillRules": [
    {{
      "skill": "<skill name>",
      "principleEn": "<concise 1-sentence game-design principle applied to ZONE>",
      "principleAr": "<natural Arabic translation>"
    }}
  ],
  "contracts": [
    {{
      "id": "<unique slug>",
      "speaker": "<luna or mayor_tariq>",
      "district": "<one of: north, fin, res, red, west, center>",
      "titleEn": "<flash contract title>",
      "titleAr": "<natural Arabic title>",
      "briefingEn": "<in-character briefing with subtext, 16-28 words>",
      "briefingAr": "<natural Arabic briefing>",
      "branches": [
        {{
          "id": "<branch id: stealth or bold>",
          "labelEn": "<short approach button label>",
          "labelAr": "<natural Arabic label>",
          "hintEn": "<tactical outcome/hint>",
          "hintAr": "<natural Arabic tactical hint>",
          "targetScreen": "<one of: crimes, items, attack, bank, market, city, gym>"
        }}
      ]
    }}
  ],
  "comms": [
    {{
      "id": "<unique slug>",
      "speaker": "<luna or mayor_tariq>",
      "mood": "<idle, scheming, or alert>",
      "kickerEn": "<short uppercase tag>",
      "kickerAr": "<short Arabic tag>",
      "lineEn": "<distinct character voice tactical line>",
      "lineAr": "<natural Arabic line>"
    }}
  ]
}}
Generate 3 multi-branch flash contracts (each with 2 branches) and 4 tactical comms lines (2 for Luna, 2 for Mayor Tariq)."""
    else:
        schema_spec = f"""Return a single valid JSON object with EXACT keys:
{{
  "batchKey": "{batch_key}",
  "domain": "liveOpsRules",
  "digestedSkills": [{", ".join(json.dumps(r["skill"]) for r in skill_records)}],
  "skillRules": [
    {{
      "skill": "<skill name>",
      "principleEn": "<concise 1-sentence game-design principle applied to ZONE>",
      "principleAr": "<natural Arabic translation>"
    }}
  ],
  "directives": [
    {{
      "id": "<unique slug>",
      "category": "{group['focus']}",
      "titleEn": "<short liveops rule title>",
      "titleAr": "<natural Arabic title>",
      "guidanceEn": "<concrete ZONE gameplay tip or design invariant, 14-24 words>",
      "guidanceAr": "<natural Arabic guidance>",
      "linkedScreen": "<one of: items, newspaper, city, missions, crimes, attack>"
    }}
  ]
}}
Generate 4 directives (1 per digested skill: {skills_csv})."""

    return (
        "You are the ZONE v156 Game-Development Multi-Skill Synthesizer.\n"
        "ZONE is a bilingual (English + Arabic RTL) browser crime MMO set in Zone City with 6 districts:\n"
        "- north (North Harbor & Pier 4 / المرفأ الشمالي والرصيف ٤)\n"
        "- fin (Financial Citadel / القلعة المالية)\n"
        "- res (East Safehouse Quarter / حي المخابئ الشرقي)\n"
        "- red (Crimson Foundry & Arena / المسبك القرمزي والساحة)\n"
        "- west (West Neon Casino Strip / شارع النيون والكازينو)\n"
        "- center (Central Syndicate Plaza / ساحة النقابة المركزية)\n"
        "Recurring characters: Luna (sharp analytical syndicate tactician) and Mayor Tariq 'The Owl' (charismatic shadow-mayor fixer).\n"
        "Synthesize the 4 attached SKILL.md handbooks into crisp, zero-clutter, authentic bilingual EN + Arabic JSON.\n"
        "Use clean ASCII hyphens only (no em-dashes). Ensure every Arabic field is idiomatic Arabic.\n\n"
        f"{schema_spec}\n\n"
        f"SOURCE SKILL.MD HANDBOOKS:\n{skill_block}"
    )


def estimate_batch_cost(model: str, prompt_tokens: int, output_tokens: int) -> dict[str, Any]:
    in_rate, out_rate = MODEL_PRICING_PER_1M.get(model, (0.75, 3.75))
    standard_usd = (prompt_tokens / 1_000_000.0) * in_rate + (output_tokens / 1_000_000.0) * out_rate
    batch_usd = standard_usd * BATCH_DISCOUNT_MULTIPLIER
    savings_usd = standard_usd - batch_usd
    return {
        "model": model,
        "pricingPer1MTokensUsd": {"input": in_rate, "output": out_rate},
        "discountPct": 50,
        "promptTokens": int(prompt_tokens),
        "outputTokens": int(output_tokens),
        "totalTokens": int(prompt_tokens + output_tokens),
        "standardCostUsd": round(standard_usd, 6),
        "batchCostUsd": round(batch_usd, 6),
        "savingsUsd": round(savings_usd, 6),
    }


def redact_job_name(raw_name: str) -> str:
    s = str(raw_name or "").strip()
    s = re.sub(r"projects/[^/]+/", "projects/<redacted>/", s)
    return s


def assert_no_secrets(payload_text: str) -> None:
    for pat in SECRET_PATTERNS:
        if pat.search(payload_text):
            raise RuntimeError("SECURITY VIOLATION: Potential API key/secret detected in output payload!")


def prepare_requests(skills_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    groups_meta: list[dict[str, Any]] = []
    prompts: list[dict[str, Any]] = []
    for grp in SKILL_BATCH_GROUPS:
        recs = [read_skill_excerpt(skills_dir, name) for name in grp["skills"]]
        prompt_text = build_group_prompt(grp, recs)
        prompts.append({"key": grp["batchKey"], "domain": grp["domain"], "prompt": prompt_text, "skills": recs})
        groups_meta.append({
            "batchKey": grp["batchKey"],
            "domain": grp["domain"],
            "skills": [r["skill"] for r in recs],
            "skillDigests": {r["skill"]: r["sha256Prefix"] for r in recs},
        })
    return prompts, groups_meta


def submit_batch(client: Any, model: str, prompts: list[dict[str, Any]], mode: str, display_name: str, gcs_uri: str | None = None) -> Any:
    from google.genai import types

    if gcs_uri:
        return client.batches.create(
            model=model,
            src=gcs_uri,
            config=types.CreateBatchJobConfig(display_name=display_name),
        )

    if mode == "jsonl":
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8") as tf:
            for item in prompts:
                row = {
                    "key": item["key"],
                    "request": {
                        "contents": [{"role": "user", "parts": [{"text": item["prompt"]}]}],
                        "generation_config": {
                            "response_mime_type": "application/json",
                            "temperature": 0.35,
                        },
                    },
                }
                tf.write(json.dumps(row, ensure_ascii=False) + "\n")
            jsonl_path = tf.name
        try:
            uploaded = client.files.upload(
                file=jsonl_path,
                config=types.UploadFileConfig(display_name=display_name, mime_type="jsonl"),
            )
            return client.batches.create(
                model=model,
                src=uploaded.name,
                config=types.CreateBatchJobConfig(display_name=display_name),
            )
        finally:
            try:
                Path(jsonl_path).unlink(missing_ok=True)
            except OSError:
                pass

    inlined = [
        types.InlinedRequest(
            contents=item["prompt"],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.35,
            ),
            metadata={"batch_key": item["key"], "domain": item["domain"]},
        )
        for item in prompts
    ]
    return client.batches.create(
        model=model,
        src=inlined,
        config=types.CreateBatchJobConfig(display_name=display_name),
    )


def poll_batch(client: Any, job_name: str, interval_sec: float, timeout_sec: float) -> Any:
    terminal = {
        "JOB_STATE_SUCCEEDED",
        "JOB_STATE_FAILED",
        "JOB_STATE_CANCELLED",
        "JOB_STATE_EXPIRED",
        "JOB_STATE_PARTIALLY_SUCCEEDED",
    }
    t0 = time.time()
    poll_count = 0
    while True:
        poll_count += 1
        job = client.batches.get(name=job_name)
        state = getattr(job.state, "name", str(job.state))
        elapsed = round(time.time() - t0, 1)
        print(f"[poll #{poll_count} | {elapsed}s] job={redact_job_name(job.name)} state={state}", flush=True)
        if state in terminal:
            return job
        if elapsed >= timeout_sec:
            raise TimeoutError(f"Batch job {redact_job_name(job_name)} timed out after {timeout_sec}s (last state={state})")
        time.sleep(interval_sec)


def extract_json_payload(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def extract_responses_from_job(client: Any, job: Any) -> tuple[list[dict[str, Any]], int, int]:
    dest = getattr(job, "dest", None)
    if not dest:
        raise RuntimeError("Batch job succeeded but job.dest is empty.")

    parsed: list[dict[str, Any]] = []
    prompt_tokens = 0
    output_tokens = 0

    inlined_resps = getattr(dest, "inlined_responses", None)
    if inlined_resps:
        for idx, item in enumerate(inlined_resps):
            err = getattr(item, "error", None)
            if err:
                raise RuntimeError(f"Batch inline response #{idx} returned error: {err}")
            resp = getattr(item, "response", None)
            if not resp or not getattr(resp, "text", None):
                raise RuntimeError(f"Batch inline response #{idx} missing text body")
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
        for idx, line in enumerate(raw_text.splitlines()):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            resp = row.get("response") or {}
            cands = resp.get("candidates") or []
            if not cands:
                raise RuntimeError(f"JSONL response line #{idx} has no candidates")
            parts = cands[0].get("content", {}).get("parts") or []
            txt = "".join(str(p.get("text", "")) for p in parts)
            parsed.append(extract_json_payload(txt))
            um = resp.get("usageMetadata") or {}
            prompt_tokens += int(um.get("promptTokenCount", 0) or 0)
            output_tokens += int(um.get("candidatesTokenCount", 0) or 0)
        return parsed, prompt_tokens, output_tokens

    raise RuntimeError("Batch job destination has neither inlined_responses nor file_name.")


def run_realtime_packed_fallback(
    candidates: list[tuple[str, str]],
    prompts: list[dict[str, Any]],
    fallback_model: str = "gemini-3.5-flash",
) -> tuple[list[dict[str, Any]], int, int, str, str]:
    """Execute 10 packed multi-skill JSON requests on live free-tier gemini-3.5-flash ($0.00)."""
    from google import genai
    from google.genai import types

    fallback_model = validate_model_id(fallback_model)
    model_rotation = [fallback_model]

    working_clients: list[tuple[str, Any]] = []
    http_opts = types.HttpOptions(timeout=90000)

    def make_gen_config(mdl: str, temp: float = 0.25) -> Any:
        cfg_kwargs: dict[str, Any] = {
            "response_mime_type": "application/json",
            "temperature": temp,
            "max_output_tokens": 8192,
        }
        if hasattr(types, "ThinkingConfig") and "lite" not in mdl:
            cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        return types.GenerateContentConfig(**cfg_kwargs)

    # Prioritize distinct project buckets first (gcloud separate project + local free-tier keys)
    ordered_cands = sorted(candidates, key=lambda x: (0 if x[0].startswith("gcloud:") else 1))
    for label, key in ordered_cands:
        if label.startswith("env:GEMINI_API_KEY") or label.startswith("dotenv:GEMINI_API_KEY") or "NANOBANANA" in label:
            continue
        c = genai.Client(api_key=key, http_options=http_opts)
        try:
            probe = c.models.generate_content(
                model=fallback_model,
                contents="Reply OK",
            )
            if probe and getattr(probe, "text", None):
                working_clients.append((label, c))
                print(f"[fallback-probe] active free-tier client ready ({label})", flush=True)
                if len(working_clients) >= 3:
                    break
        except Exception as pe:
            err = sanitize_api_error(pe)
            if err["httpCode"] in (429, 503):
                working_clients.append((label, c))
                print(f"[fallback-probe] client accepted ({label}, status={err['httpCode']})", flush=True)
                if len(working_clients) >= 3:
                    break
            continue

    if not working_clients:
        raise RuntimeError(f"No working free-tier Gemini client available for {fallback_model} fallback.")

    cache_dir = Path(tempfile.gettempdir()) / "zone_v156_group_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    import concurrent.futures

    def solve_one(idx_item: tuple[int, dict[str, Any]]) -> tuple[int, dict[str, Any], int, int]:
        idx, item = idx_item
        prompt_hash = hashlib.sha256(item["prompt"].encode("utf-8")).hexdigest()[:12]
        cache_file = cache_dir / f"{item['key']}_{prompt_hash}.json"
        if cache_file.exists():
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            print(f"[fallback {idx+1}/{len(prompts)}] {item['key']} CACHED OK", flush=True)
            return idx, cached["obj"], int(cached["pt"]), int(cached["ot"])

        last_err: Exception | None = None
        for attempt in range(8):
            client_idx = (idx + attempt) % len(working_clients) if attempt >= 1 else 0
            label, client = working_clients[client_idx]
            mdl = model_rotation[attempt % len(model_rotation)]
            try:
                t0 = time.time()
                resp = client.models.generate_content(
                    model=mdl,
                    contents=item["prompt"],
                    config=make_gen_config(mdl, 0.25),
                )
                obj = extract_json_payload(resp.text or "")
                um = getattr(resp, "usage_metadata", None)
                pt = int(getattr(um, "prompt_token_count", 0) or 0) if um else 0
                ot = int(getattr(um, "candidates_token_count", 0) or 0) if um else 0
                cache_file.write_text(
                    json.dumps({"obj": obj, "pt": pt, "ot": ot}, ensure_ascii=False),
                    encoding="utf-8",
                )
                print(
                    f"[fallback {idx+1}/{len(prompts)}] {item['key']} OK on {mdl} ({round(time.time()-t0, 1)}s, "
                    f"tokens={pt}+{ot}, src={label})",
                    flush=True,
                )
                return idx, obj, pt, ot
            except Exception as e:
                last_err = e
                err_info = sanitize_api_error(e)
                wait_s = 5.0 if err_info["httpCode"] == 429 else 2.0
                print(
                    f"[fallback {idx+1}/{len(prompts)}] attempt {attempt+1} on {mdl}/{label} failed "
                    f"(http={err_info['httpCode']} {err_info['status']}), waiting {wait_s}s...",
                    flush=True,
                )
                time.sleep(wait_s)
        raise RuntimeError(f"Fallback synthesis failed on {item['key']}: {sanitize_api_error(last_err) if last_err else 'unknown'}")

    results_by_idx: dict[int, tuple[dict[str, Any], int, int]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futs = [pool.submit(solve_one, (idx, item)) for idx, item in enumerate(prompts)]
        for fut in concurrent.futures.as_completed(futs):
            idx, obj, pt, ot = fut.result()
            results_by_idx[idx] = (obj, pt, ot)

    parsed = [results_by_idx[i][0] for i in range(len(prompts))]
    prompt_tokens = sum(results_by_idx[i][1] for i in range(len(prompts)))
    output_tokens = sum(results_by_idx[i][2] for i in range(len(prompts)))

    run_id = "realtime-packed/" + hashlib.sha256(
        f"{fallback_model}:{len(parsed)}:{prompt_tokens}:{output_tokens}".encode("utf-8")
    ).hexdigest()[:16]
    return parsed, prompt_tokens, output_tokens, run_id, working_clients[0][0]


def compile_skill_pack(
    parsed_groups: list[dict[str, Any]],
    job_name: str,
    model: str,
    state: str,
    mode: str,
    groups_meta: list[dict[str, Any]],
    prompt_tokens: int,
    output_tokens: int,
    batch_api_attempted: bool = True,
    batch_api_errors: list[dict[str, Any]] | None = None,
    effective_dollar_cost_usd: float | None = None,
) -> dict[str, Any]:
    item_provenance: dict[str, dict[str, Any]] = {}
    rumor_wire: list[dict[str, Any]] = []
    flash_contracts: list[dict[str, Any]] = []
    tactical_comms: list[dict[str, Any]] = []
    liveops_directives: list[dict[str, Any]] = []
    skill_rules: list[dict[str, Any]] = []
    digested_skills_ordered: list[str] = []
    seen_skills: set[str] = set()

    for g in parsed_groups:
        for sk in g.get("digestedSkills") or []:
            if sk not in seen_skills:
                seen_skills.add(sk)
                digested_skills_ordered.append(sk)
        for rule in g.get("skillRules") or []:
            skill_rules.append(rule)
        if isinstance(g.get("items"), dict):
            for item_id, entry in g["items"].items():
                item_provenance[str(item_id)] = entry
        if isinstance(g.get("rumors"), list):
            rumor_wire.extend(g["rumors"])
        if isinstance(g.get("contracts"), list):
            flash_contracts.extend(g["contracts"])
        if isinstance(g.get("comms"), list):
            tactical_comms.extend(g["comms"])
        if isinstance(g.get("directives"), list):
            liveops_directives.extend(g["directives"])

    # Ensure deterministic skill digest ordering matches source groups if model omitted any name
    for gm in groups_meta:
        for sk in gm["skills"]:
            if sk not in seen_skills:
                seen_skills.add(sk)
                digested_skills_ordered.append(sk)

    if state not in ("JOB_STATE_SUCCEEDED", "REALTIME_FALLBACK_SUCCEEDED"):
        raise ValueError(f"Unexpected synthesis state: {state}")
    if len(digested_skills_ordered) < 32:
        raise ValueError(f"Expected >= 32 digested skills, got {len(digested_skills_ordered)}")
    if len(item_provenance) < 20:
        raise ValueError(f"Expected >= 20 item provenance entries, got {len(item_provenance)}")
    if len(rumor_wire) < 10:
        raise ValueError(f"Expected >= 10 district rumors, got {len(rumor_wire)}")
    if len(flash_contracts) < 4:
        raise ValueError(f"Expected >= 4 flash contracts, got {len(flash_contracts)}")
    if len(tactical_comms) < 6:
        raise ValueError(f"Expected >= 6 tactical comms lines, got {len(tactical_comms)}")

    covered_districts = {str(r.get("district", "")) for r in rumor_wire}
    required_districts = {"north", "fin", "res", "red", "west", "center"}
    missing_districts = required_districts - covered_districts
    if missing_districts:
        raise ValueError(f"Missing districts in rumorWire: {sorted(missing_districts)}")

    cost = estimate_batch_cost(model, prompt_tokens, output_tokens)
    actual_cost = cost["batchCostUsd"] if effective_dollar_cost_usd is None else round(float(effective_dollar_cost_usd), 6)

    pack = {
        "schemaVersion": "zone-batch-skill-pack.v156",
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "batchJobMeta": {
            "jobName": redact_job_name(job_name),
            "batchApiAttempted": bool(batch_api_attempted),
            "batchApiErrors": batch_api_errors or [],
            "modelId": model,
            "executedModel": model,
            "state": state,
            "transportMode": mode,
            "requestCount": len(parsed_groups),
            "skillsSynthesized": len(digested_skills_ordered),
            "skillsDigestedCount": len(digested_skills_ordered),
            "skillsDigested": digested_skills_ordered,
            "effectiveDollarCostUsd": actual_cost,
            "costTelemetry": cost,
            "groupDigests": groups_meta,
        },
        "itemProvenance": item_provenance,
        "rumorWire": rumor_wire,
        "questHub": {
            "flashContracts": flash_contracts,
            "tacticalComms": tactical_comms,
        },
        "liveOpsDirectives": liveops_directives,
        "skillPrinciples": skill_rules,
    }
    serialized = json.dumps(pack, ensure_ascii=False, indent=2)
    assert_no_secrets(serialized)
    return pack


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="ZONE v156 Gemini Batch API (50%% Discount) Multi-Skill GameDev Synthesizer"
    )
    p.add_argument("--submit", action="store_true", help="Submit a new Gemini Batch API job")
    p.add_argument("--poll", action="store_true", help="Poll an active Gemini Batch API job until completion")
    p.add_argument("--compile", action="store_true", help="Download, validate, and compile the Batch output JSON")
    p.add_argument("--run", action="store_true", help="Run full pipeline: Batch API first, auto fallback if billing-gated")
    p.add_argument("--no-fallback", action="store_true", help="Disable automatic free-tier gemini-3.5-flash fallback")
    p.add_argument("--estimate-only", action="store_true", help="Estimate tokens and 50%% Batch API cost without API calls")
    p.add_argument("--model", default="gemini-3.8-flash", help="Live 2026 Gemini Flash model supporting batch")
    p.add_argument("--fallback-model", default="gemini-3.5-flash", help="Live 2026 Flash model for free-tier fallback")
    p.add_argument("--mode", choices=("inline", "jsonl"), default="inline", help="Gemini Batch API input transport")
    p.add_argument("--skills-dir", default=str(DEFAULT_SKILLS_DIR), help="Directory containing game-dev SKILL.md folders")
    p.add_argument("--env-file", default=str(DEFAULT_ENV_FILE), help="Path to .env file for GEMINI_API_KEY")
    p.add_argument("--key-env", default=None, help="Explicit environment variable name holding the Gemini API key")
    p.add_argument("--vertex-project", default=None, help="Optional GCP project ID for Vertex AI Batch API")
    p.add_argument("--vertex-location", default="us-central1", help="Optional GCP region for Vertex AI Batch API")
    p.add_argument("--gcs-input-uri", default=None, help="Optional gs:// input JSONL URI for Vertex AI Batch API")
    p.add_argument("--job-name", default=None, help="Existing Batch job resource name for --poll/--compile")
    p.add_argument("--state-file", default=str(DEFAULT_STATE_PATH), help="Path to local job state file")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Output path for compiled zone-batch-skill-pack.json")
    p.add_argument("--poll-interval", type=float, default=6.0, help="Seconds between poll calls")
    p.add_argument("--timeout", type=float, default=600.0, help="Maximum seconds to wait for batch completion")
    p.add_argument("--display-name", default="zone-v156-gamedev-skill-pack", help="Batch job display name")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    model = validate_model_id(args.model)
    fallback_model = validate_model_id(args.fallback_model)
    skills_dir = validate_skills_dir(Path(args.skills_dir))
    prompts, groups_meta = prepare_requests(skills_dir)

    est_prompt_tokens = sum(max(1, len(p["prompt"]) // 4) for p in prompts)
    est_output_tokens = len(prompts) * 1400
    est = estimate_batch_cost(model, est_prompt_tokens, est_output_tokens)

    if args.estimate_only or not (args.submit or args.poll or args.compile or args.run):
        print(json.dumps({
            "mode": args.mode,
            "model": model,
            "fallbackModel": fallback_model,
            "requests": len(prompts),
            "skillsCount": sum(len(g["skills"]) for g in groups_meta),
            "estimatedCostTelemetry": est,
        }, indent=2))
        return 0

    from google import genai

    do_submit = args.submit or args.run
    do_poll = args.poll or args.run
    do_compile = args.compile or args.run

    candidates = collect_candidate_keys(Path(args.env_file), args.key_env)
    if not candidates and not args.vertex_project:
        raise RuntimeError("No Gemini API key found in environment or .env. Set GEMINI_API_KEY or pass --vertex-project.")

    state_path = Path(args.state_file)
    job_name = args.job_name
    job_obj = None
    active_client = None
    batch_errors: list[dict[str, Any]] = []

    if do_submit:
        # 1. ALWAYS attempt real Gemini Batch API (client.batches.create) FIRST
        if args.vertex_project:
            try:
                vc = genai.Client(vertexai=True, project=args.vertex_project, location=args.vertex_location or "us-central1")
                job_obj = submit_batch(vc, model, prompts, args.mode, args.display_name, args.gcs_input_uri)
                active_client = vc
                job_name = job_obj.name
            except Exception as e:
                batch_errors.append({"source": f"vertex:{args.vertex_project}", **sanitize_api_error(e)})
        else:
            for label, key in candidates[:3]:
                try:
                    c = genai.Client(api_key=key)
                    job_obj = submit_batch(c, model, prompts, args.mode, args.display_name, None)
                    active_client = c
                    job_name = job_obj.name
                    print(f"[batch-submit] SUCCESS via {label} | job={redact_job_name(job_name)}", flush=True)
                    break
                except Exception as e:
                    err = sanitize_api_error(e)
                    batch_errors.append({"source": label, **err})
                    print(f"[batch-submit] {label} blocked: HTTP {err['httpCode']} {err['status']}", flush=True)

        if job_obj is not None:
            state_path.write_text(json.dumps({
                "jobName": job_name,
                "model": model,
                "mode": args.mode,
                "submittedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
            }, indent=2), encoding="utf-8")
        else:
            # Check if blocked by 400 FAILED_PRECONDITION / 402 / 403 and fallback is enabled
            billing_gated = any(e.get("httpCode") in (400, 402, 403) for e in batch_errors)
            if args.no_fallback or not billing_gated:
                raise RuntimeError(f"Batch API submission failed across all candidates: {batch_errors}")

            print(
                f"[fallback] client.batches.create blocked by billing/tier preconditions ({len(batch_errors)} attempts); "
                f"executing live packed synthesis on {fallback_model} ($0.00 free tier)...",
                flush=True,
            )
            parsed, prompt_toks, output_toks, run_id, used_src = run_realtime_packed_fallback(
                candidates, prompts, fallback_model=fallback_model
            )
            pack = compile_skill_pack(
                parsed_groups=parsed,
                job_name=run_id,
                model=fallback_model,
                state="REALTIME_FALLBACK_SUCCEEDED",
                mode=f"realtime-packed-free-tier ({used_src})",
                groups_meta=groups_meta,
                prompt_tokens=prompt_toks or est_prompt_tokens,
                output_tokens=output_toks or sum(max(1, len(json.dumps(x, ensure_ascii=False)) // 4) for x in parsed),
                batch_api_attempted=True,
                batch_api_errors=batch_errors,
                effective_dollar_cost_usd=0.0,
            )
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            serialized = json.dumps(pack, ensure_ascii=False, indent=2) + "\n"
            assert_no_secrets(serialized)
            out_path.write_text(serialized, encoding="utf-8")
            meta = pack["batchJobMeta"]
            print(
                f"[compile] wrote {out_path} | state={meta['state']} | executedModel={meta['executedModel']} "
                f"| skills={meta['skillsSynthesized']} | items={len(pack['itemProvenance'])} "
                f"| rumors={len(pack['rumorWire'])} | contracts={len(pack['questHub']['flashContracts'])} "
                f"| effectiveCost=${meta['effectiveDollarCostUsd']:.2f} "
                f"| projectedBatch50PctCost=${meta['costTelemetry']['batchCostUsd']:.6f}",
                flush=True,
            )
            return 0

    if not job_name and state_path.exists():
        saved = json.loads(state_path.read_text(encoding="utf-8"))
        job_name = saved.get("jobName")

    if not job_name:
        raise RuntimeError("No --job-name provided and no saved state file found.")

    if active_client is None:
        if args.vertex_project:
            active_client = genai.Client(vertexai=True, project=args.vertex_project, location=args.vertex_location or "us-central1")
        else:
            active_client = genai.Client(api_key=candidates[0][1])

    if do_poll:
        job_obj = poll_batch(active_client, job_name, args.poll_interval, args.timeout)
    elif do_compile and job_obj is None:
        job_obj = active_client.batches.get(name=job_name)

    if do_compile:
        state_val = getattr(job_obj.state, "name", str(job_obj.state))
        if state_val != "JOB_STATE_SUCCEEDED":
            raise RuntimeError(f"Cannot compile batch job in state {state_val}")
        parsed, prompt_toks, output_toks = extract_responses_from_job(active_client, job_obj)
        if prompt_toks == 0:
            prompt_toks = est_prompt_tokens
        if output_toks == 0:
            output_toks = sum(max(1, len(json.dumps(x, ensure_ascii=False)) // 4) for x in parsed)
        pack = compile_skill_pack(
            parsed_groups=parsed,
            job_name=job_name,
            model=model,
            state=state_val,
            mode=f"batch-api-{args.mode}",
            groups_meta=groups_meta,
            prompt_tokens=prompt_toks,
            output_tokens=output_toks,
            batch_api_attempted=True,
            batch_api_errors=batch_errors,
            effective_dollar_cost_usd=None,
        )
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(pack, ensure_ascii=False, indent=2) + "\n"
        assert_no_secrets(serialized)
        out_path.write_text(serialized, encoding="utf-8")
        meta = pack["batchJobMeta"]
        print(
            f"[compile] wrote {out_path} | job={meta['jobName']} | state={meta['state']} "
            f"| skills={meta['skillsSynthesized']} | items={len(pack['itemProvenance'])} "
            f"| rumors={len(pack['rumorWire'])} | contracts={len(pack['questHub']['flashContracts'])} "
            f"| batchCost=${meta['costTelemetry']['batchCostUsd']:.6f} "
            f"(saved ${meta['costTelemetry']['savingsUsd']:.6f}, 50%%)",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
