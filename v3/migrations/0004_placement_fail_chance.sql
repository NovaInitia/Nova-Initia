-- Placement failure mechanic: each placeable tool gets a per-tool failure chance.
-- Trap fires but fails to catch; barrel placed but empty; doorway/signpost placed but
-- dysfunctional; spider never materializes.
-- Kept separate from trapFailChance (whether a trap fires when triggered).

ALTER TABLE tool_type
    ADD COLUMN fail_chance numeric NOT NULL DEFAULT 0
        CHECK (fail_chance >= 0 AND fail_chance <= 1);

UPDATE tool_type SET fail_chance = 0.05 WHERE is_placeable;
