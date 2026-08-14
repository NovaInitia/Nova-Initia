CREATE EXTENSION IF NOT EXISTS citext;

-- §3: Reference data tables

CREATE TABLE IF NOT EXISTS player_class (
    id    smallint PRIMARY KEY,
    code  text     NOT NULL UNIQUE,
    name  text     NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_type (
    id                     smallint PRIMARY KEY,
    code                   text     NOT NULL UNIQUE,
    name                   text     NOT NULL,
    owning_class_id        smallint NOT NULL REFERENCES player_class(id),
    karma_delta            smallint NOT NULL CHECK (karma_delta IN (-1, 1)),
    is_placeable           boolean  NOT NULL,
    is_consumed_on_trigger boolean  NOT NULL,
    base_cost              integer  NOT NULL DEFAULT 1 CHECK (base_cost >= 0),
    initial_xp             smallint NOT NULL DEFAULT 0 CHECK (initial_xp >= 0)
);

CREATE TABLE IF NOT EXISTS level_definition (
    level                smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 25),
    name                 text     NOT NULL,
    experience_threshold integer  NOT NULL CHECK (experience_threshold >= 0),
    sg_cost              integer  NOT NULL CHECK (sg_cost >= 0),
    stipend_sg           integer  NOT NULL CHECK (stipend_sg >= 0),
    tool_allowance       integer  NOT NULL CHECK (tool_allowance >= 0)
);

CREATE TABLE IF NOT EXISTS consumption_cause (
    id   smallint PRIMARY KEY,
    code text     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ledger_cause (
    id   smallint PRIMARY KEY,
    code text     NOT NULL UNIQUE
);

-- §3.1: Balance tables

CREATE TABLE IF NOT EXISTS ability_gate (
    ability_code   text     PRIMARY KEY,
    class_id       smallint REFERENCES player_class(id),
    required_level smallint NOT NULL CHECK (required_level BETWEEN 0 AND 25)
);

CREATE TABLE IF NOT EXISTS tool_age_bracket (
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    metric       text     NOT NULL CHECK (metric IN ('damage_sg', 'placer_xp', 'expert_bonus_dmg')),
    min_age_ms   bigint   NOT NULL CHECK (min_age_ms >= 0),
    value        integer  NOT NULL,
    PRIMARY KEY (tool_type_id, metric, min_age_ms)
);

CREATE TABLE IF NOT EXISTS class_scalar (
    class_id smallint NOT NULL REFERENCES player_class(id),
    metric   text     NOT NULL,
    value    numeric  NOT NULL,
    PRIMARY KEY (class_id, metric)
);

CREATE TABLE IF NOT EXISTS class_level_scalar (
    class_id  smallint NOT NULL REFERENCES player_class(id),
    metric    text     NOT NULL,
    min_level smallint NOT NULL CHECK (min_level BETWEEN 0 AND 25),
    value     numeric  NOT NULL,
    PRIMARY KEY (class_id, metric, min_level)
);

CREATE TABLE IF NOT EXISTS balance_constant (
    code        text    PRIMARY KEY,
    value       numeric NOT NULL,
    description text    NOT NULL
);

CREATE TABLE IF NOT EXISTS normalisation_version (
    version     smallint PRIMARY KEY,
    description text        NOT NULL,
    adopted_at  timestamptz NOT NULL DEFAULT now(),
    retired_at  timestamptz
);

-- §4: Player

CREATE TABLE IF NOT EXISTS player (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             citext      NOT NULL UNIQUE,
    credential_hash  text        NOT NULL,
    email            citext,
    active_class_id  smallint    NOT NULL REFERENCES player_class(id),
    karma            smallint    NOT NULL DEFAULT 50 CHECK (karma BETWEEN 0 AND 100),
    sg               integer     NOT NULL DEFAULT 0 CHECK (sg >= 0),
    is_moderator     boolean     NOT NULL DEFAULT false,
    is_operator      boolean     NOT NULL DEFAULT false,
    is_active        boolean     NOT NULL DEFAULT true,
    avatar_url       text,
    comment          text,
    registered_at    timestamptz NOT NULL DEFAULT now(),
    last_active_at   timestamptz,
    last_stipend_at  timestamptz
);

CREATE TABLE IF NOT EXISTS player_armor (
    player_id         uuid     PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
    is_active         boolean  NOT NULL DEFAULT false,
    charges_remaining smallint NOT NULL DEFAULT 0 CHECK (charges_remaining >= 0)
);

CREATE TABLE IF NOT EXISTS player_inventory (
    player_id    uuid     NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    quantity     integer  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (player_id, tool_type_id)
);

CREATE TABLE IF NOT EXISTS player_class_progress (
    player_id  uuid     NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    class_id   smallint NOT NULL REFERENCES player_class(id),
    level      smallint NOT NULL DEFAULT 1 REFERENCES level_definition(level),
    experience integer  NOT NULL DEFAULT 0 CHECK (experience >= 0),
    PRIMARY KEY (player_id, class_id)
);

CREATE TABLE IF NOT EXISTS session (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  uuid        NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    token_hash text        NOT NULL UNIQUE,
    issued_at  timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

-- §5: Geography

CREATE TABLE IF NOT EXISTS domain (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_hash           text        NOT NULL,
    normalisation_version smallint    NOT NULL REFERENCES normalisation_version(version),
    uri                   text,
    hit_count             bigint      NOT NULL DEFAULT 0,
    first_seen_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (domain_hash, normalisation_version)
);

CREATE TABLE IF NOT EXISTS page (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    url_hash              text        NOT NULL,
    domain_id             uuid        NOT NULL REFERENCES domain(id),
    normalisation_version smallint    NOT NULL REFERENCES normalisation_version(version),
    first_seen_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (url_hash, normalisation_version)
);

CREATE TABLE IF NOT EXISTS presence (
    player_id    uuid        PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
    page_id      uuid        NOT NULL REFERENCES page(id),
    arrived_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- §6: Placements

CREATE TABLE IF NOT EXISTS placement (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_type_id         smallint    NOT NULL REFERENCES tool_type(id),
    placer_id            uuid        NOT NULL REFERENCES player(id),
    page_id              uuid        NOT NULL REFERENCES page(id),
    placed_at            timestamptz NOT NULL DEFAULT now(),
    placer_class_id      smallint    NOT NULL REFERENCES player_class(id),
    placer_level         smallint    NOT NULL CHECK (placer_level BETWEEN 1 AND 25),
    consumed_at          timestamptz,
    consumption_cause_id smallint    REFERENCES consumption_cause(id),
    CONSTRAINT placement_consumption_consistent
        CHECK ((consumed_at IS NULL) = (consumption_cause_id IS NULL)),
    UNIQUE (id, tool_type_id)
);

-- §6.2: Disjoint subtypes

CREATE TABLE IF NOT EXISTS trap_placement (
    id           uuid     PRIMARY KEY,
    tool_type_id smallint NOT NULL DEFAULT 0 CHECK (tool_type_id = 0),
    is_anonymous boolean  NOT NULL DEFAULT false,
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spider_placement (
    id            uuid     PRIMARY KEY,
    tool_type_id  smallint NOT NULL DEFAULT 2 CHECK (tool_type_id = 2),
    variant       text     NOT NULL DEFAULT 'standard'
                           CHECK (variant IN ('standard', 'wandering', 'anti_signpost')),
    last_moved_at timestamptz,
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barrel_placement (
    id               uuid     PRIMARY KEY,
    tool_type_id     smallint NOT NULL DEFAULT 1 CHECK (tool_type_id = 1),
    sg_amount        integer  NOT NULL DEFAULT 0 CHECK (sg_amount >= 0),
    inside_message   text     CHECK (length(inside_message)  <= 155),
    outside_message  text     CHECK (length(outside_message) <= 128),
    durability       smallint NOT NULL CHECK (durability >= 0),
    visit_count      smallint NOT NULL DEFAULT 0 CHECK (visit_count >= 0 AND visit_count <= 3),
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barrel_content (
    barrel_id    uuid     NOT NULL REFERENCES barrel_placement(id) ON DELETE CASCADE,
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    quantity     integer  NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (barrel_id, tool_type_id)
);

CREATE TABLE IF NOT EXISTS doorway_placement (
    id                 uuid     PRIMARY KEY,
    tool_type_id       smallint NOT NULL DEFAULT 4 CHECK (tool_type_id = 4),
    destination_url    text     NOT NULL,
    title              text,
    comment            text,
    is_nsfw            boolean  NOT NULL DEFAULT false,
    charges_remaining  smallint NOT NULL CHECK (charges_remaining >= 0),
    chain_root_id      uuid     REFERENCES placement(id),
    next_id            uuid     REFERENCES placement(id),
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signpost_placement (
    id             uuid     PRIMARY KEY,
    tool_type_id   smallint NOT NULL DEFAULT 5 CHECK (tool_type_id = 5),
    destination_url text    NOT NULL,
    title          text,
    comment        text,
    is_nsfw        boolean  NOT NULL DEFAULT false,
    tour_root_id   uuid     REFERENCES placement(id),
    branch_a_id    uuid     REFERENCES placement(id),
    branch_b_id    uuid     REFERENCES placement(id),
    branch_c_id    uuid     REFERENCES placement(id),
    branch_d_id    uuid     REFERENCES placement(id),
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

-- §6.3: Per-player interaction

CREATE TABLE IF NOT EXISTS placement_interaction (
    player_id     uuid        NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    placement_id  uuid        NOT NULL REFERENCES placement(id) ON DELETE CASCADE,
    use_count     integer     NOT NULL DEFAULT 0 CHECK (use_count >= 0),
    is_dismissed  boolean     NOT NULL DEFAULT false,
    rating        smallint,
    rated_at      timestamptz,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz,
    PRIMARY KEY (player_id, placement_id),
    CONSTRAINT interaction_rating_consistent
        CHECK ((rating IS NULL) = (rated_at IS NULL))
);

-- §7.3: Scheduler bookkeeping (must come before resource_ledger)

CREATE TABLE IF NOT EXISTS job_run (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_name    text        NOT NULL,
    started_at  timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    outcome     text        NOT NULL DEFAULT 'running'
                            CHECK (outcome IN ('running', 'completed', 'skipped', 'failed')),
    considered  integer,
    affected    integer,
    note        text
);

-- §7.1: Full history — ledger

CREATE TABLE IF NOT EXISTS resource_ledger (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id      uuid        NOT NULL REFERENCES player(id),
    resource_kind  text        NOT NULL CHECK (resource_kind IN ('sg', 'xp', 'karma')),
    class_id       smallint    REFERENCES player_class(id),
    applied_delta  integer     NOT NULL,
    balance_after  integer     NOT NULL,
    cause_id       smallint    NOT NULL REFERENCES ledger_cause(id),
    placement_id   uuid        REFERENCES placement(id),
    counterparty_id uuid       REFERENCES player(id),
    job_run_id     bigint      REFERENCES job_run(id),
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ledger_xp_has_class
        CHECK ((resource_kind = 'xp') = (class_id IS NOT NULL))
);

CREATE UNIQUE INDEX resource_ledger_one_stipend_per_run
    ON resource_ledger (player_id, job_run_id, resource_kind)
    WHERE job_run_id IS NOT NULL;

-- §9: Indexes

-- Geography: the hottest lookup in the system, run on every page entry
CREATE INDEX page_lookup            ON page (url_hash, normalisation_version);
CREATE INDEX page_domain            ON page (domain_id);
CREATE INDEX presence_page          ON presence (page_id);
CREATE INDEX presence_stale         ON presence (last_seen_at);

-- WF-3: live placements on a page, by type
CREATE INDEX placement_live_on_page ON placement (page_id, tool_type_id)
                                    WHERE consumed_at IS NULL;
CREATE INDEX placement_placer       ON placement (placer_id);

-- D16 cap check
CREATE INDEX placement_cap_check    ON placement (page_id, placer_id, tool_type_id)
                                    WHERE consumed_at IS NULL;

-- Interaction lookups
CREATE INDEX interaction_player     ON placement_interaction (player_id);

-- Ledger
CREATE INDEX ledger_player_time     ON resource_ledger (player_id, occurred_at DESC);
CREATE INDEX ledger_placement       ON resource_ledger (placement_id)
                                    WHERE placement_id IS NOT NULL;

-- Stipend eligibility (TRD §10.1)
CREATE INDEX player_stipend_due     ON player (last_stipend_at, last_active_at)
                                    WHERE is_active;

-- Spider movement
CREATE INDEX spider_movement_due    ON spider_placement (last_moved_at)
                                    WHERE variant = 'wandering';

-- Tree and chain walks
CREATE INDEX signpost_tour_root     ON signpost_placement (tour_root_id)
                                    WHERE tour_root_id IS NOT NULL;
CREATE INDEX doorway_chain_root     ON doorway_placement (chain_root_id)
                                    WHERE chain_root_id IS NOT NULL;

-- Auth
CREATE INDEX session_live           ON session (player_id) WHERE revoked_at IS NULL;
