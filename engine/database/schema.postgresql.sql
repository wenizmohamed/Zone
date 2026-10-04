CREATE TABLE IF NOT EXISTS gameplay_catalogs (
    channel VARCHAR(40) PRIMARY KEY,
    catalog_json JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_by VARCHAR(160) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS content_foundations (
    channel VARCHAR(40) PRIMARY KEY,
    manifest_json JSONB NOT NULL
);

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
    resources_updated_at TIMESTAMPTZ NOT NULL,
    strength BIGINT NOT NULL DEFAULT 10,
    defense BIGINT NOT NULL DEFAULT 10,
    speed BIGINT NOT NULL DEFAULT 10,
    dexterity BIGINT NOT NULL DEFAULT 10,
    bank_balance BIGINT NOT NULL DEFAULT 0,
    city VARCHAR(60) NOT NULL DEFAULT 'Zone City',
    login_streak INTEGER NOT NULL DEFAULT 0,
    last_login_day VARCHAR(10)
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS strength BIGINT NOT NULL DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS defense BIGINT NOT NULL DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS speed BIGINT NOT NULL DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dexterity BIGINT NOT NULL DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bank_balance BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS city VARCHAR(60) NOT NULL DEFAULT 'Zone City';
ALTER TABLE players ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_login_day VARCHAR(10);

CREATE TABLE IF NOT EXISTS player_progression (
    player_id VARCHAR(100) PRIMARY KEY REFERENCES players(id),
    state_json JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS combat_encounters (
    player_id VARCHAR(100) PRIMARY KEY REFERENCES players(id),
    state_json JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS player_travel (
    player_id VARCHAR(100) PRIMARY KEY REFERENCES players(id),
    origin VARCHAR(60) NOT NULL,
    destination VARCHAR(60) NOT NULL,
    departed_at TIMESTAMPTZ NOT NULL,
    arrives_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('traveling', 'arrived')),
    version INTEGER NOT NULL DEFAULT 1
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
    level_required INTEGER NOT NULL DEFAULT 1 CHECK (level_required >= 1),
    enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);
ALTER TABLE crimes ADD COLUMN IF NOT EXISTS level_required INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS action_cooldowns (
    player_id VARCHAR(100) NOT NULL,
    action VARCHAR(80) NOT NULL,
    available_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (player_id, action)
);

CREATE TABLE IF NOT EXISTS action_rate_limits (
    player_id VARCHAR(100) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
);

-- Server-clock cooldown durations, moved out of engine code into config so the
-- anti-hammer floors are tunable without a redeploy (Systems ownership).
CREATE TABLE IF NOT EXISTS cooldown_config (
    action VARCHAR(80) PRIMARY KEY,
    seconds INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0)
);

-- Per-player progress on the rotating daily contract (Retention Spec 3.3).
CREATE TABLE IF NOT EXISTS player_contract_progress (
    player_id VARCHAR(100) NOT NULL,
    day VARCHAR(10) NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    claimed SMALLINT NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
    PRIMARY KEY (player_id, day)
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

-- Territory definitions are immutable authoring data; territory_control and
-- territory_wars are live world state. Keeping them separate prevents a
-- content release or rollback from silently rewinding faction ownership.
CREATE TABLE IF NOT EXISTS factions (
    id VARCHAR(80) PRIMARY KEY,
    name_en VARCHAR(160) NOT NULL,
    name_ar VARCHAR(160) NOT NULL,
    color CHAR(7) NOT NULL,
    enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS faction_members (
    player_id VARCHAR(100) PRIMARY KEY REFERENCES players(id),
    faction_id VARCHAR(80) NOT NULL REFERENCES factions(id),
    role VARCHAR(40) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS territory_blocks (
    id VARCHAR(20) PRIMARY KEY,
    district_id VARCHAR(40) NOT NULL,
    name_en VARCHAR(160) NOT NULL,
    name_ar VARCHAR(160) NOT NULL,
    polygon_json JSONB NOT NULL,
    centroid_json JSONB NOT NULL,
    neighbors_json JSONB NOT NULL,
    sector INTEGER NOT NULL CHECK (sector BETWEEN 1 AND 7),
    size_tier INTEGER NOT NULL CHECK (size_tier BETWEEN 1 AND 5),
    density_tier INTEGER NOT NULL CHECK (density_tier BETWEEN 1 AND 3),
    wall_slots INTEGER NOT NULL CHECK (wall_slots BETWEEN 5 AND 30),
    daily_respect INTEGER NOT NULL CHECK (daily_respect >= 0),
    benefit_key VARCHAR(80) NOT NULL,
    benefit_name_en VARCHAR(160) NOT NULL,
    benefit_name_ar VARCHAR(160) NOT NULL,
    benefit_value INTEGER NOT NULL,
    benefit_unit VARCHAR(40) NOT NULL,
    enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    definition_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS territory_control (
    territory_id VARCHAR(20) PRIMARY KEY REFERENCES territory_blocks(id),
    faction_id VARCHAR(80) REFERENCES factions(id),
    state VARCHAR(20) NOT NULL DEFAULT 'neutral' CHECK (state IN ('neutral', 'owned', 'contested', 'cooldown')),
    control_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (control_basis_points BETWEEN 0 AND 10000),
    version INTEGER NOT NULL DEFAULT 1,
    captured_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS territory_control_faction_idx ON territory_control(faction_id, state);

CREATE TABLE IF NOT EXISTS territory_wars (
    id CHAR(32) PRIMARY KEY,
    territory_id VARCHAR(20) NOT NULL REFERENCES territory_blocks(id),
    attacker_faction_id VARCHAR(80) NOT NULL REFERENCES factions(id),
    defender_faction_id VARCHAR(80) NOT NULL REFERENCES factions(id),
    attacker_score BIGINT NOT NULL DEFAULT 0,
    defender_score BIGINT NOT NULL DEFAULT 0,
    target_score BIGINT NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS territory_wars_active_idx ON territory_wars(territory_id, state);

CREATE TABLE IF NOT EXISTS casino_high_low (
    player_id VARCHAR(100) PRIMARY KEY REFERENCES players(id),
    current_card INTEGER NOT NULL DEFAULT 7 CHECK (current_card BETWEEN 2 AND 14),
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL
);
