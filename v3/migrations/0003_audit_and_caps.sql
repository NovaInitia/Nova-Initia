-- §7.2: Audit trigger infrastructure
-- General audit via triggers for full history tracking

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

-- Correction A: Build row_id from primary key columns passed as trigger arguments
-- Correction B: Add SECURITY DEFINER with pinned search_path to prevent privilege escalation
-- Correction C: AFTER triggers, return NULL
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
    rowdata jsonb;
    row_id text;
    row_id_parts text[] := ARRAY[]::text[];
    i int;
    col_value text;
BEGIN
    -- Read the row into jsonb based on operation
    IF TG_OP = 'DELETE' THEN
        rowdata := to_jsonb(OLD);
    ELSE
        rowdata := to_jsonb(NEW);
    END IF;

    -- Build row_id from primary key column names passed as trigger arguments
    IF TG_NARGS = 0 THEN
        -- Assume 'id' column
        row_id := rowdata ->> 'id';
    ELSE
        -- Loop over TG_ARGV to collect primary key values
        FOR i IN 0..TG_NARGS-1 LOOP
            col_value := rowdata ->> TG_ARGV[i];
            IF col_value IS NULL THEN
                RAISE EXCEPTION 'audit_row: table % primary key column % is NULL',
                    TG_TABLE_NAME, TG_ARGV[i];
            END IF;
            row_id_parts := array_append(row_id_parts, col_value);
        END LOOP;
        row_id := array_to_string(row_id_parts, ':');
    END IF;

    -- row_id must not be NULL
    IF row_id IS NULL THEN
        RAISE EXCEPTION 'audit_row: table % row_id is NULL', TG_TABLE_NAME;
    END IF;

    INSERT INTO audit_log (table_name, row_id, operation, changed_by, old_row, new_row)
    VALUES (
        TG_TABLE_NAME,
        row_id,
        LEFT(TG_OP, 1),
        actor,
        CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
    );
    RETURN NULL;
END $$;

-- §8: Cap enforcement triggers

-- D16 — at most 250 of a tool type per page per player
-- Read limit from balance_constant where code = 'page_placement_cap'
CREATE OR REPLACE FUNCTION enforce_page_placement_cap() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    cap integer;
BEGIN
    SELECT (value::integer) INTO cap
    FROM balance_constant
    WHERE code = 'page_placement_cap';

    IF cap IS NULL THEN
        RAISE EXCEPTION 'balance_constant code page_placement_cap not found';
    END IF;

    IF (SELECT count(*) FROM placement
        WHERE page_id = NEW.page_id
          AND placer_id = NEW.placer_id
          AND tool_type_id = NEW.tool_type_id
          AND consumed_at IS NULL) >= cap
    THEN
        RAISE EXCEPTION 'page placement cap reached for tool % on page %',
              NEW.tool_type_id, NEW.page_id
              USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- Amendment A.4 — inventory cap of max class level × inventory_cap_per_level
CREATE OR REPLACE FUNCTION enforce_inventory_cap() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    cap_per_level integer;
    max_level smallint;
    total_cap integer;
BEGIN
    SELECT (value::integer) INTO cap_per_level
    FROM balance_constant
    WHERE code = 'inventory_cap_per_level';

    IF cap_per_level IS NULL THEN
        RAISE EXCEPTION 'balance_constant code inventory_cap_per_level not found';
    END IF;

    -- Get the player's maximum level across all classes, defaulting to 1 if no rows
    SELECT COALESCE(max(level), 1) INTO max_level
    FROM player_class_progress
    WHERE player_id = NEW.player_id;

    total_cap := max_level * cap_per_level;

    IF NEW.quantity > total_cap THEN
        RAISE EXCEPTION 'inventory cap exceeded for tool type %',
              NEW.tool_type_id
              USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- Attach audit triggers to 18 tables
-- §6: player
CREATE TRIGGER audit_player
AFTER INSERT OR UPDATE OR DELETE ON player
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §4: player_armor
CREATE TRIGGER audit_player_armor
AFTER INSERT OR UPDATE OR DELETE ON player_armor
FOR EACH ROW EXECUTE FUNCTION audit_row('player_id');

-- §4: player_inventory
CREATE TRIGGER audit_player_inventory
AFTER INSERT OR UPDATE OR DELETE ON player_inventory
FOR EACH ROW EXECUTE FUNCTION audit_row('player_id', 'tool_type_id');

-- §4: player_class_progress
CREATE TRIGGER audit_player_class_progress
AFTER INSERT OR UPDATE OR DELETE ON player_class_progress
FOR EACH ROW EXECUTE FUNCTION audit_row('player_id', 'class_id');

-- §6: placement
CREATE TRIGGER audit_placement
AFTER INSERT OR UPDATE OR DELETE ON placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: trap_placement
CREATE TRIGGER audit_trap_placement
AFTER INSERT OR UPDATE OR DELETE ON trap_placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: spider_placement
CREATE TRIGGER audit_spider_placement
AFTER INSERT OR UPDATE OR DELETE ON spider_placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: barrel_placement
CREATE TRIGGER audit_barrel_placement
AFTER INSERT OR UPDATE OR DELETE ON barrel_placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: doorway_placement
CREATE TRIGGER audit_doorway_placement
AFTER INSERT OR UPDATE OR DELETE ON doorway_placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: signpost_placement
CREATE TRIGGER audit_signpost_placement
AFTER INSERT OR UPDATE OR DELETE ON signpost_placement
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §6.2: barrel_content
CREATE TRIGGER audit_barrel_content
AFTER INSERT OR UPDATE OR DELETE ON barrel_content
FOR EACH ROW EXECUTE FUNCTION audit_row('barrel_id', 'tool_type_id');

-- §3: tool_type
CREATE TRIGGER audit_tool_type
AFTER INSERT OR UPDATE OR DELETE ON tool_type
FOR EACH ROW EXECUTE FUNCTION audit_row('id');

-- §3: level_definition
CREATE TRIGGER audit_level_definition
AFTER INSERT OR UPDATE OR DELETE ON level_definition
FOR EACH ROW EXECUTE FUNCTION audit_row('level');

-- §3.1: ability_gate
CREATE TRIGGER audit_ability_gate
AFTER INSERT OR UPDATE OR DELETE ON ability_gate
FOR EACH ROW EXECUTE FUNCTION audit_row('ability_code');

-- §3.1: tool_age_bracket
CREATE TRIGGER audit_tool_age_bracket
AFTER INSERT OR UPDATE OR DELETE ON tool_age_bracket
FOR EACH ROW EXECUTE FUNCTION audit_row('tool_type_id', 'metric', 'min_age_ms');

-- §3.1: class_scalar
CREATE TRIGGER audit_class_scalar
AFTER INSERT OR UPDATE OR DELETE ON class_scalar
FOR EACH ROW EXECUTE FUNCTION audit_row('class_id', 'metric');

-- §3.1: class_level_scalar
CREATE TRIGGER audit_class_level_scalar
AFTER INSERT OR UPDATE OR DELETE ON class_level_scalar
FOR EACH ROW EXECUTE FUNCTION audit_row('class_id', 'metric', 'min_level');

-- §3.1: balance_constant
CREATE TRIGGER audit_balance_constant
AFTER INSERT OR UPDATE OR DELETE ON balance_constant
FOR EACH ROW EXECUTE FUNCTION audit_row('code');

-- D16 cap enforcement trigger
CREATE TRIGGER enforce_page_placement_cap_trigger
BEFORE INSERT ON placement
FOR EACH ROW EXECUTE FUNCTION enforce_page_placement_cap();

-- A.4 inventory cap enforcement trigger
CREATE TRIGGER enforce_inventory_cap_insert
BEFORE INSERT ON player_inventory
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_cap();

CREATE TRIGGER enforce_inventory_cap_update
BEFORE UPDATE ON player_inventory
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_cap();
