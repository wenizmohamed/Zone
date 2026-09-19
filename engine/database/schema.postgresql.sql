CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    version VARCHAR(40) NOT NULL,
    installed SMALLINT NOT NULL DEFAULT 1 CHECK (installed IN (0, 1)),
    enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    manifest_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS module_version_history (
    module_id VARCHAR(100) NOT NULL,
    from_version VARCHAR(40) NOT NULL,
    to_version VARCHAR(40) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (module_id, from_version, to_version)
);

CREATE TABLE IF NOT EXISTS themes (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    version VARCHAR(40) NOT NULL,
    installed SMALLINT NOT NULL DEFAULT 1 CHECK (installed IN (0, 1)),
    active SMALLINT NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
    manifest_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    cash BIGINT NOT NULL DEFAULT 0,
    energy INTEGER NOT NULL DEFAULT 100,
    nerve INTEGER NOT NULL DEFAULT 45,
    life INTEGER NOT NULL DEFAULT 250,
    happy INTEGER NOT NULL DEFAULT 1000,
    max_energy INTEGER NOT NULL DEFAULT 100,
    max_nerve INTEGER NOT NULL DEFAULT 45,
    max_life INTEGER NOT NULL DEFAULT 250,
    max_happy INTEGER NOT NULL DEFAULT 1000,
    resources_updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS crimes (
    id VARCHAR(100) PRIMARY KEY,
    name_en VARCHAR(160) NOT NULL,
    name_ar VARCHAR(160) NOT NULL,
    nerve_cost INTEGER NOT NULL CHECK (nerve_cost > 0),
    success_basis_points INTEGER NOT NULL CHECK (success_basis_points BETWEEN 0 AND 10000),
    cash_min BIGINT NOT NULL CHECK (cash_min >= 0),
    cash_max BIGINT NOT NULL CHECK (cash_max >= cash_min),
    xp_reward INTEGER NOT NULL CHECK (xp_reward >= 0),
    enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS economy_ledger (
    id CHAR(32) PRIMARY KEY,
    player_id VARCHAR(100) NOT NULL REFERENCES players(id),
    asset VARCHAR(60) NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reason VARCHAR(160) NOT NULL,
    correlation_id CHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS economy_ledger_player_idx ON economy_ledger(player_id, created_at);
CREATE INDEX IF NOT EXISTS economy_ledger_correlation_idx ON economy_ledger(correlation_id);

CREATE TABLE IF NOT EXISTS event_log (
    id CHAR(32) PRIMARY KEY,
    event_name VARCHAR(160) NOT NULL,
    payload_json JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS event_log_name_idx ON event_log(event_name, occurred_at);

CREATE TABLE IF NOT EXISTS achievements (
    player_id VARCHAR(100) NOT NULL REFERENCES players(id),
    code VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL,
    source_event_id CHAR(32) NOT NULL REFERENCES event_log(id),
    PRIMARY KEY (player_id, code)
);

CREATE TABLE IF NOT EXISTS jobs (
    id CHAR(32) PRIMARY KEY,
    job_type VARCHAR(160) NOT NULL,
    payload_json JSONB NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    run_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id CHAR(32) PRIMARY KEY,
    player_id VARCHAR(100) NOT NULL REFERENCES players(id),
    type VARCHAR(160) NOT NULL,
    payload_json JSONB NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id CHAR(32) PRIMARY KEY,
    owner_type VARCHAR(80) NOT NULL,
    owner_id VARCHAR(100) NOT NULL,
    media_type VARCHAR(40) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uri TEXT NOT NULL,
    thumbnail_uri TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS content_drafts (
    channel VARCHAR(80) PRIMARY KEY,
    manifest_json JSONB NOT NULL,
    updated_by VARCHAR(160) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS content_releases (
    id CHAR(32) PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    manifest_json JSONB NOT NULL,
    active SMALLINT NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
    published_by VARCHAR(160) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS content_releases_one_active_idx ON content_releases(active) WHERE active = 1;

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id CHAR(32) PRIMARY KEY,
    actor VARCHAR(160) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(160) NOT NULL,
    previous_json JSONB,
    next_json JSONB,
    correlation_id CHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit_log(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS admin_audit_correlation_idx ON admin_audit_log(correlation_id);
