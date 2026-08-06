# SCHEMA-01 — PostgreSQL schema: core game loop

**Status:** Draft, awaiting review
**Derived from:** [TRD-01](TRD-01-core-game-loop.md), verified 2026-08-06
**Governed by:** [BRD-01](BRD-01-core-game-loop.md) Amendments A–G
**Target:** PostgreSQL 14+ (uses `gen_random_uuid()`, built in since 13)

---

## 1. Scope

Tables for **TRD-01's domain model** — the core game loop.

**BRD-05 (Tours) and BRD-06 (Reputation) are approved but have no TRD yet**, so their tables are
not designed here; designing tables for an underived model is exactly the speculation this
process exists to prevent. What this schema does instead is make those additions **purely
additive** — new tables and new foreign keys, with no alteration to anything below. §10 names
each seam and shows where it attaches.

Two structures that *look* like they belong to BRD-05 are in fact core loop and are included:
signpost branches (WF-12) and doorway chains (Amendment D.4). Only the *container* — the named,
rated, owned tour — is deferred.

---

## 2. Conventions

**Identity — `uuid` surrogate keys on everything externally referenced.**

Every table gets a meaningless, immutable primary key, never a natural one. For entities a
client can reference — players, pages, placements — that key is a `uuid`, not a sequence.
Sequential ids are enumerable, and enumeration is a real leak here: a client that can walk
placement 1, 2, 3… learns about placements it never encountered. BRD-06 WF-06-5 restricts
exactly that listing for privacy, and a guessable key would hand it back.

Internal, append-only tables that clients never address by id (`resource_ledger`, `audit_log`,
`job_run`) use `bigint GENERATED ALWAYS AS IDENTITY` — compact, ordered, cheap to index.

At this scale (v1 peaked at 176 players and 24,193 placements) UUID index locality is not a
concern. If it ever becomes one, UUIDv7 is a drop-in replacement preserving the same column
type.

**Reference data is tables, not enums.** `tool_type`, `player_class`, and the cause vocabularies
are lookup tables. A PostgreSQL `enum` cannot have a value removed or reordered without a type
rewrite, and the parts note in PHP-ERA-FINDINGS §6b explicitly warns that **nothing should
hard-code the number six** — assembled tools mean the type set grows. A lookup table makes that
an `INSERT`.

**Naming.** Singular table names, `snake_case`, foreign keys as `<referent>_id`.

**Time.** `timestamptz` throughout, never `timestamp`. Placement age drives damage and XP
brackets; an ambiguous timezone silently shifts a player between damage tiers.

**Soft deletion for placements.** v1 deleted a trap row when it fired. This schema sets
`consumed_at` and `consumption_cause_id` instead. Three reasons: the ledger references the
placement that caused each grant, the audit trail is worthless if the subject vanishes, and
tool parts (deferred) are produced *at* consumption and will need the record. Live placements
are `consumed_at IS NULL`, indexed partially.

---

## 3. Reference data

Seeded by migration, not by an admin UI — BRD-01 **D2** fixes balance at build time.

```sql
CREATE TABLE player_class (
    id    smallint PRIMARY KEY,
    code  text     NOT NULL UNIQUE,
    name  text     NOT NULL
);
-- 1 giver, 2 guardian, 3 guide

CREATE TABLE tool_type (
    id                     smallint PRIMARY KEY,
    code                   text     NOT NULL UNIQUE,
    name                   text     NOT NULL,
    owning_class_id        smallint NOT NULL REFERENCES player_class(id),
    karma_delta            smallint NOT NULL CHECK (karma_delta IN (-1, 1)),
    is_placeable           boolean  NOT NULL,
    is_consumed_on_trigger boolean  NOT NULL
);
-- 0 trap     giver     -1  placeable      consumed
-- 1 barrel   giver     +1  placeable      not consumed
-- 2 spider   guardian  -1  placeable      consumed
-- 3 shield   guardian  +1  NOT placeable  n/a
-- 4 doorway  guide     -1  placeable      not consumed
-- 5 signpost guide     +1  placeable      not consumed
```

`is_placeable = false` for shield is the schema's record of TRD §2.1's keystone fact: shield is
the one tool that is carried, never placed. `karma_delta` encodes D10.

```sql
CREATE TABLE level_definition (
    level                smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 25),
    name                 text     NOT NULL,
    experience_threshold integer  NOT NULL CHECK (experience_threshold >= 0),
    sg_cost              integer  NOT NULL CHECK (sg_cost >= 0),
    stipend_sg           integer  NOT NULL CHECK (stipend_sg >= 0),
    tool_allowance       integer  NOT NULL CHECK (tool_allowance >= 0)
);
-- 25 rows, recovered verbatim in PHP-ERA-FINDINGS §1.
-- experience_threshold is the XP needed to advance FROM this level.

CREATE TABLE consumption_cause (
    id   smallint PRIMARY KEY,
    code text     NOT NULL UNIQUE
);
-- triggered, exhausted, depleted, looted, placement_failed

CREATE TABLE ledger_cause (
    id   smallint PRIMARY KEY,
    code text     NOT NULL UNIQUE
);
-- registration, purchase, stipend, level_up, trap_damage, spider_damage,
-- barrel_loot, barrel_stash, tour_completion, tour_owner_reward,
-- placement_reward, trigger_reward, tool_use
```

### 3.1 Balance tables — Amendment I / D23

Balance scalars are reference data an operator may tune without a deploy. Seeded from
`config.js` by migration; changed thereafter by `UPDATE`; **audited on every change** (§7.2).

Five tables rather than one key-value bag, so that each keeps its own constraints. Only genuinely
global scalars fall back to a keyed table.

```sql
-- Per tool: base price and the XP its use awards.
ALTER TABLE tool_type
    ADD COLUMN base_cost  integer  NOT NULL DEFAULT 1 CHECK (base_cost >= 0),
    ADD COLUMN initial_xp smallint NOT NULL DEFAULT 0 CHECK (initial_xp >= 0);
-- trap 5, barrel 5, spider 5, shield 0, doorway 10, signpost 10

-- Which class and level unlocks each gated ability.
CREATE TABLE ability_gate (
    ability_code   text     PRIMARY KEY,
    class_id       smallint NOT NULL REFERENCES player_class(id),
    required_level smallint NOT NULL CHECK (required_level BETWEEN 0 AND 25)
);
-- anonymous_trap giver 10 · barrel_outside_message giver 5 · barrel_stash_sg giver 1
-- loot_own_barrel giver 15 · wandering_spider guardian 15 · anti_signpost_spider guardian 10
-- chain_own_doorway guide 0

-- Age-banded curves: trap damage, spider XP, barrel XP.
CREATE TABLE tool_age_bracket (
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    metric       text     NOT NULL CHECK (metric IN ('damage_sg','placer_xp')),
    min_age_ms   bigint   NOT NULL CHECK (min_age_ms >= 0),
    value        integer  NOT NULL,
    PRIMARY KEY (tool_type_id, metric, min_age_ms)
);

-- Scalars that vary by class alone.
CREATE TABLE class_scalar (
    class_id smallint NOT NULL REFERENCES player_class(id),
    metric   text     NOT NULL,
    value    numeric  NOT NULL,
    PRIMARY KEY (class_id, metric)
);
-- shield_max_hits · barrel_tool_capacity · forced_doorway_chance · trap_fail_chance

-- Scalars that step with class AND level.
CREATE TABLE class_level_scalar (
    class_id  smallint NOT NULL REFERENCES player_class(id),
    metric    text     NOT NULL,
    min_level smallint NOT NULL CHECK (min_level BETWEEN 0 AND 25),
    value     numeric  NOT NULL,
    PRIMARY KEY (class_id, metric, min_level)
);
-- signpost_branches: guide 0→1, 8→2, 12→3, 20→4; giver/guardian 0→2
-- doorway_charges:   guide 0→50, 15→100 (D15); giver/guardian 0→50

-- Genuinely global magnitudes.
CREATE TABLE balance_constant (
    code        text    PRIMARY KEY,
    value       numeric NOT NULL,
    description text    NOT NULL
);
-- karma_min 0 · karma_max 100 · karma_step 1 · karma_neutral 50
-- stipend_floor_fraction 0.25 · extremity_karma_low 5 · extremity_karma_high 95
-- extremity_bonus_xp 5 · expert_trap_karma_max 95 · out_of_class_cost_multiplier 3
-- inventory_cap_per_level 250 · page_placement_cap 250 · barrel_visit_limit 3
-- barrel_inside_message_max 155 · barrel_outside_message_max 128
-- starting_sg 20 · starting_karma 50 · starting_tools_in_class 10 · starting_tools_other 5
-- doorway_transport_base 0.08 · doorway_transport_per_level 0.002
-- stipend_activity_window_ms · stipend_interval_ms
```

The starting-state constants come from **D22**, so Amendment H's values are tunable too — the
opening grant is a balance decision like any other.

**These tables are read-only to the application at runtime.** Only an operator changes them,
and §7.2's audit triggers apply to all five plus `tool_type` and `level_definition`. Without
that audit the ledger loses meaning: a past entry of *"stipend +140 sg"* cannot be interpreted
once `stipend_sg` has moved, and the audit log is what supplies the value in force at the time.

**Normalisation versions** — Amendment F / D18. A page's identity is only meaningful against
the rule that produced it.

```sql
CREATE TABLE normalisation_version (
    version     smallint PRIMARY KEY,
    description text        NOT NULL,
    adopted_at  timestamptz NOT NULL DEFAULT now(),
    retired_at  timestamptz
);
```

`retired_at IS NOT NULL` is what lets `resolvePage` reject hashes addressing a superseded board,
which F.5 requires.

---

## 4. Player

```sql
CREATE TABLE player (
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
```

Notes:

- `active_class_id` has no update path in the application — **D21** withdrew class switching.
- `karma DEFAULT 50` and `sg DEFAULT 0` are now settled by **D22** (Amendment H): a new player
  starts with **karma 50** and **20 sg**. The `sg` default stays `0` at the column level and the
  opening grant is written through the ledger by registration rather than appearing from a
  column default — otherwise the player's balance would not equal the sum of their ledger
  entries, breaking the invariant §7.1 depends on.
- `credential_hash` — WF-2 forbids storing anything recoverable.
- `sg >= 0` is enforced by the database, not only by `addSg`-style application logic. v1 clamped
  in PHP; a constraint cannot be bypassed by a migration or an ad-hoc statement.
- `last_stipend_at` is **TRD §10.1's subject-level idempotency key**. It is the reason a
  double-fired stipend is a no-op, and it belongs on the player rather than in a global run row.
- `citext` requires `CREATE EXTENSION citext` — used so player names and emails are unique
  case-insensitively.

```sql
CREATE TABLE player_armor (
    player_id         uuid     PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
    is_active         boolean  NOT NULL DEFAULT false,
    charges_remaining smallint NOT NULL DEFAULT 0 CHECK (charges_remaining >= 0)
);
```

Separate from inventory: WF-8 moves a shield *out of* inventory *into* armor, and they are
different quantities.

```sql
CREATE TABLE player_inventory (
    player_id    uuid     NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    quantity     integer  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (player_id, tool_type_id)
);
```

**Keyed rows, not six columns** — the parts note's second recommendation. When parts arrive they
become new rows against a generalised item reference rather than a table rewrite.

```sql
CREATE TABLE player_class_progress (
    player_id  uuid     NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    class_id   smallint NOT NULL REFERENCES player_class(id),
    level      smallint NOT NULL DEFAULT 1 REFERENCES level_definition(level),
    experience integer  NOT NULL DEFAULT 0 CHECK (experience >= 0),
    PRIMARY KEY (player_id, class_id)
);
```

Three rows per player, always — XP accrues to a class by action type regardless of the player's
own class, so all three fill up. Only the active class can be levelled (G.3).

```sql
CREATE TABLE session (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  uuid        NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    token_hash text        NOT NULL UNIQUE,
    issued_at  timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);
```

**`token_hash`, never the token.** A leaked database backup must not grant live sessions.

---

## 5. Geography

```sql
CREATE TABLE domain (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_hash           text        NOT NULL,
    normalisation_version smallint    NOT NULL REFERENCES normalisation_version(version),
    uri                   text,
    hit_count             bigint      NOT NULL DEFAULT 0,
    first_seen_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (domain_hash, normalisation_version)
);

CREATE TABLE page (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    url_hash              text        NOT NULL,
    domain_id             uuid        NOT NULL REFERENCES domain(id),
    normalisation_version smallint    NOT NULL REFERENCES normalisation_version(version),
    first_seen_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (url_hash, normalisation_version)
);
```

The unique key is `(hash, normalisation_version)`, not the hash alone. Under a future
normalisation the *same URL* produces a *different* page identity, and both must be able to
coexist while a migration runs — that is precisely what D18's version tag buys, and collapsing
the constraint to `url_hash` alone would throw it away.

```sql
CREATE TABLE presence (
    player_id    uuid        PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
    page_id      uuid        NOT NULL REFERENCES page(id),
    arrived_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
```

**One row per player** — a player is in exactly one place, so arriving is an upsert and leaving
is a delete. "Who is on this page" is an index lookup. `last_seen_at` drives expiry (OPEN-11),
which is naturally idempotent.

---

## 6. Placements

### 6.1 The base table

```sql
CREATE TABLE placement (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_type_id         smallint    NOT NULL REFERENCES tool_type(id),
    placer_id            uuid        NOT NULL REFERENCES player(id),
    page_id              uuid        NOT NULL REFERENCES page(id),
    placed_at            timestamptz NOT NULL DEFAULT now(),

    -- D17: snapshotted at placement, never re-read from the placer
    placer_class_id      smallint    NOT NULL REFERENCES player_class(id),
    placer_level         smallint    NOT NULL CHECK (placer_level BETWEEN 1 AND 25),

    consumed_at          timestamptz,
    consumption_cause_id smallint    REFERENCES consumption_cause(id),

    CONSTRAINT placement_consumption_consistent
        CHECK ((consumed_at IS NULL) = (consumption_cause_id IS NULL)),
    UNIQUE (id, tool_type_id)
);
```

`placer_class_id` and `placer_level` are **D17** made structural. They are columns rather than
joins to `player` precisely so that reading the placer's *current* level — the bug D17 exists to
prevent — requires writing a join that is visibly wrong.

The trailing `UNIQUE (id, tool_type_id)` is redundant for uniqueness, since `id` is already the
key. It exists to be the target of the composite foreign keys in §6.2, which is what makes the
subtypes disjoint.

### 6.2 Disjoint subtypes

Class-table inheritance with a shared primary key — the pattern v1 used, and the one that lets
each subtype carry its own `NOT NULL` constraints instead of a wide table of mostly-NULL
columns.

```sql
CREATE TABLE trap_placement (
    id           uuid     PRIMARY KEY,
    tool_type_id smallint NOT NULL DEFAULT 0 CHECK (tool_type_id = 0),
    is_anonymous boolean  NOT NULL DEFAULT false,
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE spider_placement (
    id            uuid     PRIMARY KEY,
    tool_type_id  smallint NOT NULL DEFAULT 2 CHECK (tool_type_id = 2),
    variant       text     NOT NULL DEFAULT 'standard'
                           CHECK (variant IN ('standard','wandering','anti_signpost')),
    last_moved_at timestamptz,
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE barrel_placement (
    id               uuid     PRIMARY KEY,
    tool_type_id     smallint NOT NULL DEFAULT 1 CHECK (tool_type_id = 1),
    sg_amount        integer  NOT NULL DEFAULT 0 CHECK (sg_amount >= 0),
    inside_message   text     CHECK (length(inside_message)  <= 155),
    outside_message  text     CHECK (length(outside_message) <= 128),
    durability       smallint NOT NULL CHECK (durability >= 0),
    visit_count      smallint NOT NULL DEFAULT 0 CHECK (visit_count >= 0 AND visit_count <= 3),
    FOREIGN KEY (id, tool_type_id) REFERENCES placement(id, tool_type_id) ON DELETE CASCADE
);

CREATE TABLE barrel_content (
    barrel_id    uuid     NOT NULL REFERENCES barrel_placement(id) ON DELETE CASCADE,
    tool_type_id smallint NOT NULL REFERENCES tool_type(id),
    quantity     integer  NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (barrel_id, tool_type_id)
);

CREATE TABLE doorway_placement (
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

CREATE TABLE signpost_placement (
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
```

There is **no `shield_placement`** — shields are never placed.

`chain_root_id` and `tour_root_id` give a chain or tour its identity **without needing the
BRD-05 container table**: the root placement is the identity, exactly as v1's `Group` id was its
root placement's id. When BRD-05 adds the named, rated container, it references these roots.

`tour_root_id` being a **single nullable column rather than a junction table** is BRD-05
**OPEN-05-4**, resolved 2026-08-06: a signpost belongs to **one tour at a time**. One-to-many is
therefore structural — the schema cannot express simultaneous membership, which is the
guarantee wanted. Because the column is nullable and updatable, a signpost may still be *moved*
between tours, which "at a time" permits.

The four branch columns are BRD-05 §3's tree, and the count of four is the ceiling from
`config.js`.

`barrel_placement.visit_count <= 3` and the message length limits encode `config.js` directly.

### 6.3 Per-player interaction — one row, three jobs

```sql
CREATE TABLE placement_interaction (
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
```

Amendment D.1's single record: pass-through limits (`use_count`), dismissal (`is_dismissed`),
and rating eligibility.

**`rating` stores the individual vote**, answering BRD-06 **OPEN-06-5** as that document
recommended. A running mean alone cannot be audited, a bad-faith vote cannot be retracted, and
a moderator cannot discount a voter — and an aggregate can always be recomputed from the votes,
never the reverse. `has_rated` from TRD §2.5 collapses into `rating IS NOT NULL`.

No `CHECK` on the rating range: **OPEN-06-3** has not decided the scale. It is added as a
constraint when it is, which is a non-destructive `ALTER`.

---

## 7. Full history

### 7.1 sg, XP, and karma are ledgered

The skill's bright line: *in any system with accounting features, all records regarding
financial transactions get full history.* **sg is currency** — it is earned by stipend, loot,
and tours, and spent on tools and levels. It qualifies.

XP and karma are included on the same reasoning: both are earned, both gate progression, and
both are exactly what a forged client would inflate.

```sql
CREATE TABLE resource_ledger (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id      uuid        NOT NULL REFERENCES player(id),
    resource_kind  text        NOT NULL CHECK (resource_kind IN ('sg','xp','karma')),
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
```

Three design points:

**`applied_delta` is the delta after clamping, not the requested one.** Karma is clamped to
`[0,100]` and sg to `>= 0`. Recording the requested change would make the ledger disagree with
the balance; recording the applied one keeps `SUM(applied_delta) = balance` as a checkable
invariant. `balance_after` is denormalised deliberately so that invariant can be verified
without summing the whole history.

**`placement_id` and `counterparty_id` make abuse traceable.** TRD §8.4 accepted RISK-1 —
the server cannot verify a client's claims — and asked that grants remain traceable to the
placement and player that caused them so abuse is at least detectable afterwards. This is that
mechanism, and it is the only defence the design has against a forged client.

**`job_run_id` closes the stipend loop.** A unique index over `(player_id, cause_id, job_run_id)`
for stipend rows makes a double-grant impossible at the database level, not merely unlikely.

```sql
CREATE UNIQUE INDEX resource_ledger_one_stipend_per_run
    ON resource_ledger (player_id, job_run_id, resource_kind)
    WHERE job_run_id IS NOT NULL;
```

### 7.2 General audit via triggers

Application-level auditing sees only writes that travel the application path. A trigger fires
whatever performs the write — the app, a migration, or a psql session.

```sql
CREATE TABLE audit_log (
    id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name text        NOT NULL,
    row_id     text        NOT NULL,
    operation  char(1)     NOT NULL CHECK (operation IN ('I','U','D')),
    changed_by uuid,
    changed_at timestamptz NOT NULL DEFAULT now(),
    old_row    jsonb,
    new_row    jsonb
);

CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
BEGIN
    INSERT INTO audit_log (table_name, row_id, operation, changed_by, old_row, new_row)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        LEFT(TG_OP, 1),
        actor,
        CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
    );
    RETURN COALESCE(NEW, OLD);
END $$;
```

Attached to `player`, `player_inventory`, `player_class_progress`, `player_armor`, `placement`,
and every placement subtype.

**The application must set the actor once per transaction:**

```sql
SET LOCAL app.actor_id = '<the acting player uuid>';
```

`IUnitOfWork.run` is the single place that happens — it already wraps every mutating operation,
so the actor is captured by construction rather than by remembering. Where there is no acting
player (a scheduled job), it is left unset and `changed_by` is NULL, which the `job_run_id` on
the ledger disambiguates.

### 7.3 Scheduler bookkeeping

```sql
CREATE TABLE job_run (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_name    text        NOT NULL,
    started_at  timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    outcome     text        NOT NULL DEFAULT 'running'
                            CHECK (outcome IN ('running','completed','skipped','failed')),
    considered  integer,
    affected    integer,
    note        text
);
```

Per TRD §10.1 this is **observability, not the correctness mechanism** — correctness lives on
`player.last_stipend_at` and `spider_placement.last_moved_at`. `outcome = 'skipped'` records a
run that could not take the advisory lock.

---

## 8. Constraints that encode game rules

Two caps cannot be expressed as `CHECK` constraints, because both depend on other rows.

**D16 — at most 250 of a tool type per page per player:**

```sql
CREATE OR REPLACE FUNCTION enforce_page_placement_cap() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT count(*) FROM placement
        WHERE page_id = NEW.page_id
          AND placer_id = NEW.placer_id
          AND tool_type_id = NEW.tool_type_id
          AND consumed_at IS NULL) >= 250
    THEN
        RAISE EXCEPTION 'page placement cap reached for tool % on page %',
              NEW.tool_type_id, NEW.page_id
              USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
```

**Amendment A.4 — inventory cap of `max class level × 250`** follows the same shape, reading
`player_class_progress`.

**Honest limitation:** under `READ COMMITTED`, two concurrent placements can each see 249 and
both succeed. Options are `SERIALIZABLE`, or an advisory lock on
`(page_id, placer_id, tool_type_id)` in the placement transaction. Given that a cap of 250 is a
brake rather than an invariant, a transient overshoot of one is harmless — but the choice
should be deliberate, and the advisory lock is cheap. Recorded so it is not mistaken for
exact enforcement.

---

## 9. Indexes

Foreign keys first — PostgreSQL does **not** index them automatically, and an unindexed FK makes
every parent delete a sequential scan.

```sql
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
```

`placement_live_on_page` is partial on `consumed_at IS NULL`, which matters because consumed
placements accumulate forever under soft deletion and would otherwise bloat the index that WF-3
hits on every page entry.

Nothing beyond this is speculated. Real query patterns will differ from these guesses, and
measurement after the system runs is what justifies the rest.

---

## 10. Seams for BRD-05 and BRD-06

Each of these is a pure addition. **No table above is altered.**

| Addition | Attaches via | For |
|---|---|---|
| `tour` — title, description, owner, rating, votes, enabled | FK to `signpost_placement.tour_root_id` | BRD-05 |
| `tour_completion` — per player per tour, date, taken, dismissed, rated | FK to `tour` and `player` | BRD-05 WF-05-5 |
| `chain` — the named container for a doorway chain | FK to `doorway_placement.chain_root_id` | BRD-05 |
| Rating aggregates on `doorway_placement` | new columns, defaulted | BRD-06 WF-06-1 |
| `rating` range constraint | `ALTER … ADD CONSTRAINT` | BRD-06 OPEN-06-3 |
| Withheld/moderated state on placements | new nullable columns | BRD-03 |
| `item_type` generalising `tool_type` | new table, `player_inventory` re-pointed | Parts |

The last row is the only one requiring a change to an existing table, and it is a foreign key
re-point rather than a rewrite — which is exactly why `player_inventory` is keyed rows instead
of six columns.

---

## 11. Migration discipline

**The schema must always be altered, never regenerated.** In development, where tables are
empty, dropping and recreating costs nothing — that is what makes it a dangerous habit rather
than a harmless shortcut.

Rules for this project:

1. **Plain SQL migrations**, forward-only, one file per change, applied in order and recorded in
   a migrations table. `node-pg-migrate` or `graphile-migrate` both fit Node and TypeScript.
   **ORM-generated migrations are not acceptable here** unless the emitted SQL is reviewed
   before it runs — the failure mode is a tool that silently drops and recreates a column to
   change its type.
2. **No migration may drop a column or table holding data** without an explicit, separate
   decision from the Project Owner. Renames are `ADD` + backfill + switch + `DROP` in a later
   migration, never an in-place destructive change.
3. **Every migration runs in a transaction** so a failure leaves no partial schema. The
   exceptions are `CREATE INDEX CONCURRENTLY` and similar, which must be in their own file.
4. **A normalisation change is a data migration, not a schema change.** Under D18 it mints new
   `page` rows at a new version; existing pages and their placements stay addressable at the old
   version until deliberately retired. This is why `page` is unique on
   `(url_hash, normalisation_version)`.

---

## 12. Review

1. Does this represent the domain model faithfully?
2. Is the audit scope right — sg, XP, and karma ledgered, plus trigger history on mutable
   entities? It could reasonably be narrowed to sg alone.

Two points worth a decision:

- ~~**§4 — starting values.**~~ **Resolved by D22** (Amendment H): 20 sg, karma 50, level 1,
  zero XP, 10 of each own-class tool and 5 of every other. Registration writes the sg grant and
  the inventory grant **through the ledger**, not as column defaults, so
  `SUM(applied_delta) = balance` holds from the first row.
- **§8 — the placement caps race** under `READ COMMITTED`. Advisory lock, `SERIALIZABLE`, or
  accept a transient overshoot of one.
- **§2 — soft deletion of placements.** It keeps the audit trail whole and is what tool parts
  will need, at the cost of a table that only grows. A retention policy for long-consumed
  placements can be added later, but it should be a decision rather than a discovery.
