import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pool } from 'pg';
import { freshDb, closeDb, DB_SKIP } from './testDb.js';
import { randomUUID } from 'crypto';

describe('cap enforcement triggers', { skip: DB_SKIP }, () => {
  let pool: Pool;

  it('D16: page placement cap at 250 - insert up to cap succeeds, next fails', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0; // trap
      const domainHash = randomUUID();
      const urlHash1 = randomUUID();

      // Create player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'capper', 'hash', 1]
      );

      // Create domain
      await pool.query(
        `INSERT INTO domain (domain_hash, normalisation_version, uri)
         VALUES ($1, $2, $3)`,
        [domainHash, 1, 'http://example.com']
      );

      // Get domain id
      const domainResult = await pool.query(
        `SELECT id FROM domain WHERE domain_hash = $1`,
        [domainHash]
      );
      const domainId = domainResult.rows[0].id;

      // Create page
      await pool.query(
        `INSERT INTO page (url_hash, domain_id, normalisation_version)
         VALUES ($1, $2, $3)`,
        [urlHash1, domainId, 1]
      );

      // Get page id
      const pageResult = await pool.query(
        `SELECT id FROM page WHERE url_hash = $1`,
        [urlHash1]
      );
      const actualPageId = pageResult.rows[0].id;

      // Bulk insert 250 placements using generate_series
      await pool.query(
        `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT $1, $2, $3, $4, 1
         FROM generate_series(1, 250)`,
        [toolTypeId, playerId, actualPageId, 1]
      );

      // Verify we got 250
      const countResult = await pool.query(
        `SELECT count(*) FROM placement
         WHERE page_id = $1 AND placer_id = $2 AND tool_type_id = $3 AND consumed_at IS NULL`,
        [actualPageId, playerId, toolTypeId]
      );
      assert.equal(parseInt(countResult.rows[0].count, 10), 250);

      // Attempt to insert the 251st placement
      try {
        await pool.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           VALUES ($1, $2, $3, $4, 1)`,
          [toolTypeId, playerId, actualPageId, 1]
        );
        assert.fail('Should have raised exception for placement cap');
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.ok(error instanceof Error);
        assert.match(error.message, /page placement cap reached/);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('D16: consumed placements do not count toward cap', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0; // trap
      const domainHash = randomUUID();
      const urlHash = randomUUID();

      // Create player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'consumer', 'hash', 1]
      );

      // Create domain and page
      await pool.query(
        `INSERT INTO domain (domain_hash, normalisation_version, uri)
         VALUES ($1, $2, $3)`,
        [domainHash, 1, 'http://example.com']
      );

      const domainResult = await pool.query(
        `SELECT id FROM domain WHERE domain_hash = $1`,
        [domainHash]
      );
      const domainId = domainResult.rows[0].id;

      await pool.query(
        `INSERT INTO page (url_hash, domain_id, normalisation_version)
         VALUES ($1, $2, $3)`,
        [urlHash, domainId, 1]
      );

      const pageResult = await pool.query(
        `SELECT id FROM page WHERE url_hash = $1`,
        [urlHash]
      );
      const actualPageId = pageResult.rows[0].id;

      // Insert 250 placements
      const insertResult = await pool.query(
        `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT $1, $2, $3, 1, 1
         FROM generate_series(1, 250)
         RETURNING id`,
        [toolTypeId, playerId, actualPageId]
      );

      const firstPlacementId = insertResult.rows[0].id;

      // Consume the first placement
      await pool.query(
        `UPDATE placement SET consumed_at = now(), consumption_cause_id = 1
         WHERE id = $1`,
        [firstPlacementId]
      );

      // Now we should be able to insert one more
      try {
        await pool.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           VALUES ($1, $2, $3, 1, 1)`,
          [toolTypeId, playerId, actualPageId]
        );
      } catch (error) {
        assert.fail(`Should allow insertion when one placement is consumed: ${error}`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('D16: cap is read from balance_constant, not hard-coded', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0;
      const domainHash = randomUUID();
      const urlHash = randomUUID();

      // Create player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'captuner', 'hash', 1]
      );

      // Create domain and page
      await pool.query(
        `INSERT INTO domain (domain_hash, normalisation_version, uri)
         VALUES ($1, $2, $3)`,
        [domainHash, 1, 'http://example.com']
      );

      const domainResult = await pool.query(
        `SELECT id FROM domain WHERE domain_hash = $1`,
        [domainHash]
      );
      const domainId = domainResult.rows[0].id;

      await pool.query(
        `INSERT INTO page (url_hash, domain_id, normalisation_version)
         VALUES ($1, $2, $3)`,
        [urlHash, domainId, 1]
      );

      const pageResult = await pool.query(
        `SELECT id FROM page WHERE url_hash = $1`,
        [urlHash]
      );
      const actualPageId = pageResult.rows[0].id;

      // Transaction that lowers the cap and then rolls back
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lower the cap to 2
        await client.query(
          `UPDATE balance_constant SET value = 2 WHERE code = 'page_placement_cap'`
        );

        // Insert 2 placements (should succeed)
        await client.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           SELECT $1, $2, $3, 1, 1
           FROM generate_series(1, 2)`,
          [toolTypeId, playerId, actualPageId]
        );

        // Try to insert a 3rd (should fail with the lowered cap)
        try {
          await client.query(
            `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
             VALUES ($1, $2, $3, 1, 1)`,
            [toolTypeId, playerId, actualPageId]
          );
          assert.fail('Should have raised exception with lowered cap');
        } catch (error) {
          if (error instanceof assert.AssertionError) throw error;
          assert.ok(error instanceof Error);
          assert.match(error.message, /page placement cap reached/);
        }

        // ROLLBACK to preserve reference data
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('D16: different tool types or pages are unaffected by cap', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId1 = 0; // trap
      const toolTypeId2 = 1; // barrel
      const domainHash = randomUUID();
      const urlHash1 = randomUUID();
      const urlHash2 = randomUUID();

      // Create player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'multi', 'hash', 1]
      );

      // Create domain
      await pool.query(
        `INSERT INTO domain (domain_hash, normalisation_version, uri)
         VALUES ($1, $2, $3)`,
        [domainHash, 1, 'http://example.com']
      );

      const domainResult = await pool.query(
        `SELECT id FROM domain WHERE domain_hash = $1`,
        [domainHash]
      );
      const domainId = domainResult.rows[0].id;

      // Create two pages
      await pool.query(
        `INSERT INTO page (url_hash, domain_id, normalisation_version)
         VALUES ($1, $2, $3), ($4, $5, $6)`,
        [urlHash1, domainId, 1, urlHash2, domainId, 1]
      );

      const pagesResult = await pool.query(
        `SELECT id FROM page ORDER BY url_hash`
      );
      const [page1Id, page2Id] = [pagesResult.rows[0].id, pagesResult.rows[1].id];

      // Fill page1 with tool_type_id1 up to cap
      await pool.query(
        `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT $1, $2, $3, 1, 1
         FROM generate_series(1, 250)`,
        [toolTypeId1, playerId, page1Id]
      );

      // Should still be able to insert tool_type_id2 on the same page
      try {
        await pool.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           VALUES ($1, $2, $3, 1, 1)`,
          [toolTypeId2, playerId, page1Id]
        );
      } catch (error) {
        assert.fail(`Should allow different tool_type on same page: ${error}`);
      }

      // Should still be able to insert tool_type_id1 on a different page
      try {
        await pool.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           VALUES ($1, $2, $3, 1, 1)`,
          [toolTypeId1, playerId, page2Id]
        );
      } catch (error) {
        assert.fail(`Should allow same tool_type on different page: ${error}`);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('A.4: inventory cap of level × 250', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0;

      // Create player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'invtest', 'hash', 1]
      );

      // Create player_class_progress at level 1
      await pool.query(
        `INSERT INTO player_class_progress (player_id, class_id, level, experience)
         VALUES ($1, 1, 1, 0)`,
        [playerId]
      );

      // At level 1, max inventory should be 250
      // INSERT 250 should succeed
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, toolTypeId, 250]
        );
      } catch (error) {
        assert.fail(`Should allow quantity 250 at level 1: ${error}`);
      }

      // INSERT 251 should fail
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, 1, 251]
        );
        assert.fail('Should reject quantity 251 at level 1');
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.ok(error instanceof Error);
        assert.match(error.message, /inventory cap exceeded/);
      }

      // Advance player to level 2
      await pool.query(
        `UPDATE player_class_progress SET level = 2 WHERE player_id = $1 AND class_id = 1`,
        [playerId]
      );

      // At level 2, max inventory should be 500
      // INSERT 500 should succeed
      const toolTypeId2 = 1;
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, toolTypeId2, 500]
        );
      } catch (error) {
        assert.fail(`Should allow quantity 500 at level 2: ${error}`);
      }

      // INSERT 501 should fail
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, 2, 501]
        );
        assert.fail('Should reject quantity 501 at level 2');
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.ok(error instanceof Error);
        assert.match(error.message, /inventory cap exceeded/);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('A.4: UPDATE path is guarded, not only INSERT', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0;

      // Create player at level 1
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'updatetest', 'hash', 1]
      );

      await pool.query(
        `INSERT INTO player_class_progress (player_id, class_id, level, experience)
         VALUES ($1, 1, 1, 0)`,
        [playerId]
      );

      // Insert inventory at 200
      await pool.query(
        `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
         VALUES ($1, $2, $3)`,
        [playerId, toolTypeId, 200]
      );

      // UPDATE to 250 should succeed
      try {
        await pool.query(
          `UPDATE player_inventory SET quantity = 250
           WHERE player_id = $1 AND tool_type_id = $2`,
          [playerId, toolTypeId]
        );
      } catch (error) {
        assert.fail(`Should allow update to 250: ${error}`);
      }

      // UPDATE to 251 should fail
      try {
        await pool.query(
          `UPDATE player_inventory SET quantity = 251
           WHERE player_id = $1 AND tool_type_id = $2`,
          [playerId, toolTypeId]
        );
        assert.fail('Should reject update to 251');
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.ok(error instanceof Error);
        assert.match(error.message, /inventory cap exceeded/);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('A.4: player with no player_class_progress is treated as level 1', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0;

      // Create player WITHOUT creating player_class_progress
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'noprogress', 'hash', 1]
      );

      // Should be able to insert up to 250
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, toolTypeId, 250]
        );
      } catch (error) {
        assert.fail(`Should allow inventory at level 1 (default): ${error}`);
      }

      // Should reject 251
      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId, 1, 251]
        );
        assert.fail('Should reject 251');
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.ok(error instanceof Error);
        assert.match(error.message, /inventory cap exceeded/);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('cap enforcement errors carry SQLSTATE 23514 (check_violation)', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const toolTypeId = 0;
      const domainHash = randomUUID();
      const urlHash = randomUUID();

      // Test placement cap error
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'errtest', 'hash', 1]
      );

      // Create domain and page
      await pool.query(
        `INSERT INTO domain (domain_hash, normalisation_version, uri)
         VALUES ($1, $2, $3)`,
        [domainHash, 1, 'http://example.com']
      );

      const domainResult = await pool.query(
        `SELECT id FROM domain WHERE domain_hash = $1`,
        [domainHash]
      );
      const domainId = domainResult.rows[0].id;

      await pool.query(
        `INSERT INTO page (url_hash, domain_id, normalisation_version)
         VALUES ($1, $2, $3)`,
        [urlHash, domainId, 1]
      );

      const pageResult = await pool.query(
        `SELECT id FROM page WHERE url_hash = $1`,
        [urlHash]
      );
      const pageId = pageResult.rows[0].id;

      // Fill to cap
      await pool.query(
        `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT $1, $2, $3, 1, 1
         FROM generate_series(1, 250)`,
        [toolTypeId, playerId, pageId]
      );

      // Placement cap error
      try {
        await pool.query(
          `INSERT INTO placement (tool_type_id, placer_id, page_id, placer_class_id, placer_level)
           VALUES ($1, $2, $3, 1, 1)`,
          [toolTypeId, playerId, pageId]
        );
        assert.fail('Should raise check_violation');
      } catch (error) {
        assert.ok(error instanceof Error && 'code' in error);
        const code = (error as any).code;
        assert.equal(code, '23514', `Expected SQLSTATE 23514, got ${code}`);
      }

      // Test inventory cap error
      const playerId2 = randomUUID();
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId2, 'invtest2', 'hash', 1]
      );

      try {
        await pool.query(
          `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [playerId2, toolTypeId, 251]
        );
        assert.fail('Should raise check_violation');
      } catch (error) {
        assert.ok(error instanceof Error && 'code' in error);
        const code = (error as any).code;
        assert.equal(code, '23514', `Expected SQLSTATE 23514, got ${code}`);
      }
    } finally {
      await closeDb(pool);
    }
  });
});
