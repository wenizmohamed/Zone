PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    installed INTEGER NOT NULL DEFAULT 1 CHECK (installed IN (0, 1)),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    manifest_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_version_history (
    module_id TEXT NOT NULL,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    PRIMARY KEY (module_id, from_version, to_version)
);

CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    installed INTEGER NOT NULL DEFAULT 1 CHECK (installed IN (0, 1)),
    active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
    manifest_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    cash INTEGER NOT NULL DEFAULT 0,
    energy INTEGER NOT NULL DEFAULT 100,
    nerve INTEGER NOT NULL DEFAULT 45,
    life INTEGER NOT NULL DEFAULT 250,
    happy INTEGER NOT NULL DEFAULT 1000,
    max_energy INTEGER NOT NULL DEFAULT 100,
    max_nerve INTEGER NOT NULL DEFAULT 45,
    max_life INTEGER NOT NULL DEFAULT 250,
    max_happy INTEGER NOT NULL DEFAULT 1000,
    resources_updated_at TEXT NOT NULL,
    strength INTEGER NOT NULL DEFAULT 10,
    defense INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    bank_balance INTEGER NOT NULL DEFAULT 0,
    city TEXT NOT NULL DEFAULT 'Zone City'
);

CREATE TABLE IF NOT EXISTS crimes (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    nerve_cost INTEGER NOT NULL CHECK (nerve_cost > 0),
    success_basis_points INTEGER NOT NULL CHECK (success_basis_points BETWEEN 0 AND 10000),
    cash_min INTEGER NOT NULL CHECK (cash_min >= 0),
    cash_max INTEGER NOT NULL CHECK (cash_max >= cash_min),
    xp_reward INTEGER NOT NULL CHECK (xp_reward >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS action_cooldowns (
    player_id TEXT NOT NULL,
    action TEXT NOT NULL,
    available_at TEXT NOT NULL,
    PRIMARY KEY (player_id, action)
);

CREATE TABLE IF NOT EXISTS action_rate_limits (
    player_id TEXT PRIMARY KEY,
    window_started_at TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS economy_ledger (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id),
    asset TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS economy_ledger_player_idx ON economy_ledger(player_id, created_at);
CREATE INDEX IF NOT EXISTS economy_ledger_correlation_idx ON economy_ledger(correlation_id);

CREATE TABLE IF NOT EXISTS event_log (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS event_log_name_idx ON event_log(event_name, occurred_at);

CREATE TABLE IF NOT EXISTS achievements (
    player_id TEXT NOT NULL REFERENCES players(id),
    code TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    source_event_id TEXT NOT NULL REFERENCES event_log(id),
    PRIMARY KEY (player_id, code)
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    run_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id),
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    uri TEXT NOT NULL,
    thumbnail_uri TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_drafts (
    channel TEXT PRIMARY KEY,
    manifest_json TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_releases (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    manifest_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
    published_by TEXT NOT NULL,
    published_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS content_releases_one_active_idx ON content_releases(active) WHERE active = 1;

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    previous_json TEXT,
    next_json TEXT,
    correlation_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit_log(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS admin_audit_correlation_idx ON admin_audit_log(correlation_id);
