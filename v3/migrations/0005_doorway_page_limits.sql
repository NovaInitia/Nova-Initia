-- Doorway page limits: restrict live doorways per page
-- own: how many one player may have on one page (varies by class)
-- total: how many all players combined may have on one page

-- Seed the new reference data
INSERT INTO class_scalar (class_id, metric, value) VALUES
  (1, 'doorway_page_own_limit', 5),
  (2, 'doorway_page_own_limit', 5),
  (3, 'doorway_page_own_limit', 200);

INSERT INTO balance_constant (code, value, description) VALUES
  ('doorway_page_total_limit', 200, 'Maximum live doorways all players combined may have on one page');

-- Enforce doorway page limits via trigger
CREATE OR REPLACE FUNCTION enforce_doorway_page_limits() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    own_limit integer;
    total_limit integer;
    own_count integer;
    total_count integer;
BEGIN
    -- Get the own limit from class_scalar for the placer's class
    SELECT value INTO own_limit
    FROM class_scalar
    WHERE class_id = NEW.placer_class_id
      AND metric = 'doorway_page_own_limit';

    IF own_limit IS NULL THEN
        RAISE EXCEPTION 'class_scalar metric doorway_page_own_limit not found for class %',
              NEW.placer_class_id;
    END IF;

    -- Get the total limit from balance_constant
    SELECT value::integer INTO total_limit
    FROM balance_constant
    WHERE code = 'doorway_page_total_limit';

    IF total_limit IS NULL THEN
        RAISE EXCEPTION 'balance_constant code doorway_page_total_limit not found';
    END IF;

    -- Count live doorways by this placer on this page
    SELECT count(*) INTO own_count
    FROM placement
    WHERE page_id = NEW.page_id
      AND placer_id = NEW.placer_id
      AND tool_type_id = 4
      AND consumed_at IS NULL;

    -- Check own limit
    IF own_count >= own_limit THEN
        RAISE EXCEPTION 'doorway own limit reached for player % on page %',
              NEW.placer_id, NEW.page_id
              USING ERRCODE = 'NI010';
    END IF;

    -- Count all live doorways on this page (by any placer)
    SELECT count(*) INTO total_count
    FROM placement
    WHERE page_id = NEW.page_id
      AND tool_type_id = 4
      AND consumed_at IS NULL;

    -- Check total limit
    IF total_count >= total_limit THEN
        RAISE EXCEPTION 'doorway total limit reached on page %',
              NEW.page_id
              USING ERRCODE = 'NI011';
    END IF;

    RETURN NEW;
END $$;

-- Attach the trigger: BEFORE INSERT on placement, but only for doorways (tool_type_id = 4)
DROP TRIGGER IF EXISTS enforce_doorway_page_limits_trigger ON placement;
CREATE TRIGGER enforce_doorway_page_limits_trigger
BEFORE INSERT ON placement
FOR EACH ROW WHEN (NEW.tool_type_id = 4)
EXECUTE FUNCTION enforce_doorway_page_limits();
