import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { SEED_BALANCE } from '../balance/seed.js';
import { closeDb, DB_SKIP, freshDb } from './testDb.js';
import { ConsumptionCause, LedgerCause } from '../domain/enums.js';

const DAY = 86_400_000;

describe('reference data anti-drift', { skip: DB_SKIP }, () => {
  test('tool_type matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT * FROM tool_type ORDER BY id');
      const dbTools = result.rows;

      assert.equal(dbTools.length, SEED_BALANCE.toolTypes.length, 'Tool count mismatch');

      for (let i = 0; i < SEED_BALANCE.toolTypes.length; i++) {
        const seed = SEED_BALANCE.toolTypes[i];
        const db = dbTools[i];

        assert.equal(db.id, seed.id, `Tool ${i}: id mismatch`);
        assert.equal(db.code, seed.code, `Tool ${i}: code mismatch`);
        assert.equal(db.owning_class_id, seed.owningClass, `Tool ${i}: owning_class_id mismatch`);
        assert.equal(db.karma_delta, seed.karmaDelta, `Tool ${i}: karma_delta mismatch`);
        assert.equal(db.is_placeable, seed.isPlaceable, `Tool ${i}: is_placeable mismatch`);
        assert.equal(db.is_consumed_on_trigger, seed.isConsumedOnTrigger, `Tool ${i}: is_consumed_on_trigger mismatch`);
        assert.equal(db.base_cost, seed.baseCost, `Tool ${i}: base_cost mismatch`);
        assert.equal(db.initial_xp, seed.initialXp, `Tool ${i}: initial_xp mismatch`);
        assert.equal(Number(db.fail_chance), seed.failChance, `Tool ${i}: fail_chance mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('level_definition matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT * FROM level_definition ORDER BY level');
      const dbLevels = result.rows;

      assert.equal(dbLevels.length, SEED_BALANCE.levels.length, 'Level count mismatch');

      for (let i = 0; i < SEED_BALANCE.levels.length; i++) {
        const seed = SEED_BALANCE.levels[i];
        const db = dbLevels[i];

        assert.equal(db.level, seed.level, `Level ${i}: level mismatch`);
        assert.equal(db.name, seed.name, `Level ${i}: name mismatch`);
        assert.equal(db.experience_threshold, seed.experienceThreshold, `Level ${i}: experience_threshold mismatch`);
        assert.equal(db.sg_cost, seed.sgCost, `Level ${i}: sg_cost mismatch`);
        assert.equal(db.stipend_sg, seed.stipendSg, `Level ${i}: stipend_sg mismatch`);
        assert.equal(db.tool_allowance, seed.toolAllowance, `Level ${i}: tool_allowance mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('ability_gate matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT * FROM ability_gate ORDER BY ability_code');
      const dbGates = result.rows;

      // Sort seed by ability code for comparison
      const seedGates = [...SEED_BALANCE.abilityGates].sort((a, b) => a.ability.localeCompare(b.ability));

      assert.equal(dbGates.length, seedGates.length, 'ability_gate count mismatch');

      for (let i = 0; i < seedGates.length; i++) {
        const seed = seedGates[i];
        const db = dbGates[i];

        assert.equal(db.ability_code, seed.ability, `Gate ${i}: ability_code mismatch`);
        assert.equal(db.class_id, seed.playerClass, `Gate ${i}: class_id mismatch`);
        assert.equal(db.required_level, seed.requiredLevel, `Gate ${i}: required_level mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('tool_age_bracket matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query(
        'SELECT * FROM tool_age_bracket ORDER BY tool_type_id, metric, min_age_ms'
      );
      const dbBrackets = result.rows;

      // Sort seed the same way
      const seedBrackets = [...SEED_BALANCE.ageBrackets].sort((a, b) => {
        if (a.toolType !== b.toolType) return a.toolType - b.toolType;
        if (a.metric !== b.metric) return a.metric.localeCompare(b.metric);
        return a.minAgeMs - b.minAgeMs;
      });

      assert.equal(dbBrackets.length, seedBrackets.length, 'tool_age_bracket count mismatch');

      for (let i = 0; i < seedBrackets.length; i++) {
        const seed = seedBrackets[i];
        const db = dbBrackets[i];

        assert.equal(db.tool_type_id, seed.toolType, `Bracket ${i}: tool_type_id mismatch`);
        assert.equal(db.metric, seed.metric, `Bracket ${i}: metric mismatch`);
        assert.equal(Number(db.min_age_ms), seed.minAgeMs, `Bracket ${i}: min_age_ms mismatch`);
        assert.equal(db.value, seed.value, `Bracket ${i}: value mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('class_scalar matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query(
        'SELECT * FROM class_scalar ORDER BY class_id, metric'
      );
      const dbScalars = result.rows;

      // Sort seed the same way
      const seedScalars = [...SEED_BALANCE.classScalars].sort((a, b) => {
        if (a.playerClass !== b.playerClass) return a.playerClass - b.playerClass;
        return a.metric.localeCompare(b.metric);
      });

      assert.equal(dbScalars.length, seedScalars.length, 'class_scalar count mismatch');

      for (let i = 0; i < seedScalars.length; i++) {
        const seed = seedScalars[i];
        const db = dbScalars[i];

        assert.equal(db.class_id, seed.playerClass, `Scalar ${i}: class_id mismatch`);
        assert.equal(db.metric, seed.metric, `Scalar ${i}: metric mismatch`);
        assert.equal(Number(db.value), seed.value, `Scalar ${i}: value mismatch`);
      }

      // Specific checks for doorway_page_own_limit
      const giverDoorwayOwn = dbScalars.find(r => r.class_id === 1 && r.metric === 'doorway_page_own_limit');
      assert.ok(giverDoorwayOwn, 'doorway_page_own_limit for giver must exist');
      assert.equal(Number(giverDoorwayOwn.value), 5, 'giver doorway_page_own_limit must be 5');

      const guardianDoorwayOwn = dbScalars.find(r => r.class_id === 2 && r.metric === 'doorway_page_own_limit');
      assert.ok(guardianDoorwayOwn, 'doorway_page_own_limit for guardian must exist');
      assert.equal(Number(guardianDoorwayOwn.value), 5, 'guardian doorway_page_own_limit must be 5');

      const guideDoorwayOwn = dbScalars.find(r => r.class_id === 3 && r.metric === 'doorway_page_own_limit');
      assert.ok(guideDoorwayOwn, 'doorway_page_own_limit for guide must exist');
      assert.equal(Number(guideDoorwayOwn.value), 200, 'guide doorway_page_own_limit must be 200');
    } finally {
      await closeDb(pool);
    }
  });

  test('class_level_scalar matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query(
        'SELECT * FROM class_level_scalar ORDER BY class_id, metric, min_level'
      );
      const dbScalars = result.rows;

      // Sort seed the same way
      const seedScalars = [...SEED_BALANCE.classLevelScalars].sort((a, b) => {
        if (a.playerClass !== b.playerClass) return a.playerClass - b.playerClass;
        if (a.metric !== b.metric) return a.metric.localeCompare(b.metric);
        return a.minLevel - b.minLevel;
      });

      assert.equal(dbScalars.length, seedScalars.length, 'class_level_scalar count mismatch');

      for (let i = 0; i < seedScalars.length; i++) {
        const seed = seedScalars[i];
        const db = dbScalars[i];

        assert.equal(db.class_id, seed.playerClass, `Scalar ${i}: class_id mismatch`);
        assert.equal(db.metric, seed.metric, `Scalar ${i}: metric mismatch`);
        assert.equal(db.min_level, seed.minLevel, `Scalar ${i}: min_level mismatch`);
        assert.equal(Number(db.value), seed.value, `Scalar ${i}: value mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('balance_constant matches seed', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT code, value FROM balance_constant ORDER BY code');
      const dbConstants = result.rows;

      const seedKeys = Object.keys(SEED_BALANCE.constants).sort();

      assert.equal(dbConstants.length, seedKeys.length, 'balance_constant count mismatch');

      for (let i = 0; i < seedKeys.length; i++) {
        const seedCode = seedKeys[i];
        const db = dbConstants[i];

        assert.equal(db.code, seedCode, `Constant ${i}: code mismatch`);
        assert.equal(Number(db.value), SEED_BALANCE.constants[seedCode], `Constant ${seedCode}: value mismatch`);
      }

      // Specific check for doorway_page_total_limit since it's new
      const doorwayTotalLimit = dbConstants.find(r => r.code === 'doorway_page_total_limit');
      assert.ok(doorwayTotalLimit, 'doorway_page_total_limit must exist');
      assert.equal(Number(doorwayTotalLimit.value), 200, 'doorway_page_total_limit must be 200');
    } finally {
      await closeDb(pool);
    }
  });

  test('consumption_cause contains exactly 5 causes', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT code FROM consumption_cause ORDER BY id');
      const dbCauses = result.rows.map(r => r.code as ConsumptionCause);

      const expectedCauses: readonly ConsumptionCause[] = ['triggered', 'exhausted', 'depleted', 'looted', 'placement_failed'];

      assert.equal(dbCauses.length, expectedCauses.length, 'consumption_cause count mismatch');

      for (let i = 0; i < expectedCauses.length; i++) {
        assert.equal(dbCauses[i], expectedCauses[i], `Cause ${i}: code mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('ledger_cause contains exactly 13 causes', async () => {
    const pool = await freshDb();

    try {
      const result = await pool.query('SELECT code FROM ledger_cause ORDER BY id');
      const dbCauses = result.rows.map(r => r.code as LedgerCause);

      const expectedCauses: readonly LedgerCause[] = [
        'registration',
        'purchase',
        'stipend',
        'level_up',
        'trap_damage',
        'spider_damage',
        'barrel_loot',
        'barrel_stash',
        'tour_completion',
        'tour_owner_reward',
        'placement_reward',
        'trigger_reward',
        'tool_use'
      ];

      assert.equal(dbCauses.length, expectedCauses.length, 'ledger_cause count mismatch');

      for (let i = 0; i < expectedCauses.length; i++) {
        assert.equal(dbCauses[i], expectedCauses[i], `Cause ${i}: code mismatch`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  // normalisation_version is reference data and therefore exempt from freshDb()'s
  // truncation, so a test that registers a version or retires one and fails to restore it
  // silently corrupts every later run. Cycle 8 lost a debugging session to a leaked
  // version 2 that made an expected rejection stop happening. This is the drift check.
  test('normalisation_version holds exactly the seeded version 1, un-retired', async () => {
    const pool = await freshDb();

    try {
      const rows = await pool.query(
        'SELECT version, retired_at FROM normalisation_version ORDER BY version'
      );

      assert.equal(rows.rows.length, 1, 'expected exactly one normalisation version');
      assert.equal(rows.rows[0].version, 1);
      assert.equal(
        rows.rows[0].retired_at,
        null,
        'version 1 must not be retired — a leaked retirement breaks every page resolution'
      );
    } finally {
      await closeDb(pool);
    }
  });
});
