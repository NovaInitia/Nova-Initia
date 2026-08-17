import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pool } from 'pg';
import { closeDb, DB_SKIP, freshDb } from './testDb.js';

function randomUuid(): string {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function setupPlayer(pool: Pool): Promise<string> {
  // First verify player_class exists
  const classCheck = await pool.query('SELECT COUNT(*) FROM player_class WHERE id = 1');
  if (parseInt(classCheck.rows[0].count, 10) === 0) {
    throw new Error('player_class(1) does not exist - reference data may have been lost');
  }

  const playerId = randomUuid();
  await pool.query(
    'INSERT INTO player (id, name, credential_hash, active_class_id) VALUES ($1, $2, $3, $4)',
    [playerId, `player_${randomUuid()}`, 'hash', 1]
  );
  return playerId;
}

async function setupPage(pool: Pool): Promise<string> {
  const pageId = randomUuid();
  const domainId = randomUuid();

  await pool.query(
    'INSERT INTO normalisation_version (version, description) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [1, 'test version']
  );

  await pool.query(
    'INSERT INTO domain (id, domain_hash, normalisation_version) VALUES ($1, $2, $3)',
    [domainId, 'test-domain-hash', 1]
  );

  await pool.query(
    'INSERT INTO page (id, url_hash, domain_id, normalisation_version) VALUES ($1, $2, $3, $4)',
    [pageId, 'test-url-hash', domainId, 1]
  );

  return pageId;
}

async function setupPlacement(pool: Pool, playerId: string, pageId: string): Promise<string> {
  const placementId = randomUuid();

  await pool.query(
    `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [placementId, 0, playerId, pageId, 1, 1]
  );

  return placementId;
}

describe('schema constraints', { skip: DB_SKIP }, () => {
  test('player.sg must be non-negative', async () => {
    const pool = await freshDb();

    try {
      let caught = false;
      try {
        await pool.query(
          'INSERT INTO player (id, name, credential_hash, active_class_id, sg) VALUES ($1, $2, $3, $4, $5)',
          [randomUuid(), `test_${randomUuid()}`, 'hash', 1, -1]
        );
      } catch (error) {
        caught = true;
      }

      assert.ok(caught, 'Expected negative sg to be rejected');
    } finally {
      await closeDb(pool);
    }
  });

  test('player.karma must be between 0 and 100', async () => {
    const pool = await freshDb();

    try {
      // Test too high
      let caught = false;
      try {
        await pool.query(
          'INSERT INTO player (id, name, credential_hash, active_class_id, karma) VALUES ($1, $2, $3, $4, $5)',
          [randomUuid(), `test_${randomUuid()}`, 'hash', 1, 101]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected karma 101 to be rejected');

      // Test too low
      caught = false;
      try {
        await pool.query(
          'INSERT INTO player (id, name, credential_hash, active_class_id, karma) VALUES ($1, $2, $3, $4, $5)',
          [randomUuid(), `test_${randomUuid()}`, 'hash', 1, -1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected karma -1 to be rejected');
    } finally {
      await closeDb(pool);
    }
  });

  test('player.name is case-insensitively unique', async () => {
    const pool = await freshDb();

    try {
      const name = `test_${randomUuid()}`;

      // Insert first name - if this throws, let it propagate
      await pool.query(
        'INSERT INTO player (id, name, credential_hash, active_class_id) VALUES ($1, $2, $3, $4)',
        [randomUuid(), name, 'hash', 1]
      );

      // Try to insert with different case - should be rejected
      let caught = false;
      let error: unknown;
      try {
        await pool.query(
          'INSERT INTO player (id, name, credential_hash, active_class_id) VALUES ($1, $2, $3, $4)',
          [randomUuid(), name.toUpperCase(), 'hash', 1]
        );
      } catch (err) {
        caught = true;
        error = err;
      }

      if (!caught) {
        // If no error was thrown, query to see what happened
        const result = await pool.query('SELECT COUNT(*) FROM player WHERE name ILIKE $1', [name]);
        const count = parseInt(result.rows[0].count, 10);
        assert.fail(`Expected duplicate name to be rejected, but got ${count} players with name like "${name}"`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  test('placement_consumption_consistent constraint', async () => {
    const pool = await freshDb();

    try {
      const playerId = await setupPlayer(pool);
      const pageId = await setupPage(pool);

      // Try: consumed_at set but consumption_cause_id NULL
      let caught = false;
      try {
        await pool.query(
          `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level, consumed_at, consumption_cause_id)
           VALUES ($1, $2, $3, $4, $5, $6, now(), NULL)`,
          [randomUuid(), 0, playerId, pageId, 1, 1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected consumed_at without cause to be rejected');

      // Try: consumption_cause_id set but consumed_at NULL
      caught = false;
      try {
        await pool.query(
          `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level, consumed_at, consumption_cause_id)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, 1)`,
          [randomUuid(), 0, playerId, pageId, 1, 1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected cause without consumed_at to be rejected');
    } finally {
      await closeDb(pool);
    }
  });

  test('disjoint subtypes: wrong tool_type_id is rejected', async () => {
    const pool = await freshDb();

    try {
      const playerId = await setupPlayer(pool);
      const pageId = await setupPage(pool);
      const placementId = randomUuid();

      // Create a placement with tool_type_id = 2 (spider)
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [placementId, 2, playerId, pageId, 1, 1]
      );

      // Try to insert a trap_placement (which expects tool_type_id = 0) with the spider placement
      let caught = false;
      try {
        await pool.query(
          `INSERT INTO trap_placement (id, tool_type_id) VALUES ($1, $2)`,
          [placementId, 0]
        );
      } catch (error) {
        caught = true;
      }

      assert.ok(caught, 'Expected wrong tool_type_id in subtype to be rejected');
    } finally {
      await closeDb(pool);
    }
  });

  test('page unique on (url_hash, normalisation_version)', async () => {
    const pool = await freshDb();

    try {
      // Insert normalisation_version
      await pool.query(
        'INSERT INTO normalisation_version (version, description) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [1, 'test']
      );

      const domainId = randomUuid();
      await pool.query(
        'INSERT INTO domain (id, domain_hash, normalisation_version) VALUES ($1, $2, $3)',
        [domainId, 'test-domain', 1]
      );

      const urlHash = 'test-url-hash';
      const pageId1 = randomUuid();
      await pool.query(
        'INSERT INTO page (id, url_hash, domain_id, normalisation_version) VALUES ($1, $2, $3, $4)',
        [pageId1, urlHash, domainId, 1]
      );

      // Try same hash, same version - should fail
      let caught = false;
      try {
        await pool.query(
          'INSERT INTO page (id, url_hash, domain_id, normalisation_version) VALUES ($1, $2, $3, $4)',
          [randomUuid(), urlHash, domainId, 1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected duplicate (url_hash, version) to be rejected');

      // Same hash, different version - should succeed
      await pool.query(
        'INSERT INTO normalisation_version (version, description) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [2, 'test v2']
      );

      const domain2Id = randomUuid();
      await pool.query(
        'INSERT INTO domain (id, domain_hash, normalisation_version) VALUES ($1, $2, $3)',
        [domain2Id, 'test-domain', 2]
      );

      // This should succeed
      await pool.query(
        'INSERT INTO page (id, url_hash, domain_id, normalisation_version) VALUES ($1, $2, $3, $4)',
        [randomUuid(), urlHash, domain2Id, 2]
      );
    } finally {
      await closeDb(pool);
    }
  });

  test('barrel_placement.visit_count <= 3', async () => {
    const pool = await freshDb();

    try {
      const playerId = await setupPlayer(pool);
      const pageId = await setupPage(pool);
      const barrelId = randomUuid();

      // Create a barrel placement
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [barrelId, 1, playerId, pageId, 1, 1]
      );

      // Try to insert barrel_placement with visit_count = 4
      let caught = false;
      try {
        await pool.query(
          `INSERT INTO barrel_placement (id, tool_type_id, visit_count) VALUES ($1, $2, $3)`,
          [barrelId, 1, 4]
        );
      } catch (error) {
        caught = true;
      }

      assert.ok(caught, 'Expected visit_count > 3 to be rejected');
    } finally {
      await closeDb(pool);
    }
  });

  test('resource_ledger_one_stipend_per_run index', async () => {
    const pool = await freshDb();

    try {
      const playerId = await setupPlayer(pool);

      // Create a job_run
      const jobResult = await pool.query(
        `INSERT INTO job_run (job_name, outcome) VALUES ($1, $2) RETURNING id`,
        ['stipend', 'completed']
      );
      const jobRunId = jobResult.rows[0].id;

      // Insert first stipend entry
      await pool.query(
        `INSERT INTO resource_ledger (player_id, resource_kind, applied_delta, balance_after, cause_id, job_run_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [playerId, 'sg', 100, 100, 3, jobRunId]
      );

      // Try to insert second stipend for same player/job_run/resource_kind - should fail
      let caught = false;
      try {
        await pool.query(
          `INSERT INTO resource_ledger (player_id, resource_kind, applied_delta, balance_after, cause_id, job_run_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, 'sg', 50, 150, 3, jobRunId]
        );
      } catch (error) {
        caught = true;
      }

      assert.ok(caught, 'Expected duplicate stipend entry to be rejected');

      // But allow two rows with job_run_id IS NULL
      await pool.query(
        `INSERT INTO resource_ledger (player_id, resource_kind, applied_delta, balance_after, cause_id, job_run_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [playerId, 'sg', 50, 50, 2, null]
      );

      await pool.query(
        `INSERT INTO resource_ledger (player_id, resource_kind, applied_delta, balance_after, cause_id, job_run_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [playerId, 'sg', 40, 90, 2, null]
      );
    } finally {
      await closeDb(pool);
    }
  });

  test('ledger_xp_has_class constraint', async () => {
    const pool = await freshDb();

    try {
      const playerId = await setupPlayer(pool);

      // Try: xp row with NULL class_id
      let caught = false;
      try {
        await pool.query(
          `INSERT INTO resource_ledger (player_id, resource_kind, class_id, applied_delta, balance_after, cause_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, 'xp', null, 10, 10, 1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected xp without class_id to be rejected');

      // Try: sg row WITH class_id
      caught = false;
      try {
        await pool.query(
          `INSERT INTO resource_ledger (player_id, resource_kind, class_id, applied_delta, balance_after, cause_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, 'sg', 1, 10, 10, 1]
        );
      } catch (error) {
        caught = true;
      }
      assert.ok(caught, 'Expected sg with class_id to be rejected');
    } finally {
      await closeDb(pool);
    }
  });
});
