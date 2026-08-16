import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pool } from 'pg';
import { freshDb, closeDb, DB_SKIP } from './testDb.js';
import { randomUUID } from 'crypto';

describe('audit_log table and audit_row() trigger', { skip: DB_SKIP }, () => {
  let pool: Pool;

  it('INSERT, UPDATE, DELETE a player and verify audit trail', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();

      // INSERT
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'testplayer', 'hash123', 1]
      );

      // UPDATE
      await pool.query(
        `UPDATE player SET karma = 75 WHERE id = $1`,
        [playerId]
      );

      // DELETE
      await pool.query(
        `DELETE FROM player WHERE id = $1`,
        [playerId]
      );

      // Verify audit log
      const auditRows = await pool.query(
        `SELECT table_name, row_id, operation, old_row, new_row
         FROM audit_log
         WHERE table_name = 'player' AND row_id = $1
         ORDER BY id ASC`,
        [playerId]
      );

      assert.equal(auditRows.rows.length, 3, 'Should have 3 audit rows');

      const [insertRow, updateRow, deleteRow] = auditRows.rows;

      // INSERT row
      assert.equal(insertRow.operation, 'I', 'First operation should be INSERT');
      assert.equal(insertRow.table_name, 'player');
      assert.equal(insertRow.row_id, playerId);
      assert.equal(insertRow.old_row, null, 'INSERT should have old_row IS NULL');
      assert.notEqual(insertRow.new_row, null, 'INSERT should have new_row');

      // UPDATE row
      assert.equal(updateRow.operation, 'U', 'Second operation should be UPDATE');
      assert.equal(updateRow.table_name, 'player');
      assert.equal(updateRow.row_id, playerId);
      assert.notEqual(updateRow.old_row, null, 'UPDATE should have old_row');
      assert.notEqual(updateRow.new_row, null, 'UPDATE should have new_row');
      // Verify the karma change is recorded
      assert.equal(updateRow.old_row.karma, 50, 'old_row should have karma 50');
      assert.equal(updateRow.new_row.karma, 75, 'new_row should have karma 75');

      // DELETE row
      assert.equal(deleteRow.operation, 'D', 'Third operation should be DELETE');
      assert.equal(deleteRow.table_name, 'player');
      assert.equal(deleteRow.row_id, playerId);
      assert.notEqual(deleteRow.old_row, null, 'DELETE should have old_row');
      assert.equal(deleteRow.new_row, null, 'DELETE should have new_row IS NULL');
    } finally {
      await closeDb(pool);
    }
  });

  it('composite-key regression test: player_inventory audited with colon-separated row_id', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();

      // Create a player first
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'inventorytest', 'hash456', 1]
      );

      // Insert a player_inventory row (tool_type_id 0 is trap)
      const toolTypeId = 0;
      await pool.query(
        `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
         VALUES ($1, $2, $3)`,
        [playerId, toolTypeId, 5]
      );

      // Verify audit log with composite key
      const auditRows = await pool.query(
        `SELECT row_id FROM audit_log
         WHERE table_name = 'player_inventory' AND operation = 'I'`
      );

      assert.equal(auditRows.rows.length, 1, 'Should have one INSERT audit row');
      const expectedRowId = `${playerId}:${toolTypeId}`;
      assert.equal(auditRows.rows[0].row_id, expectedRowId);
    } finally {
      await closeDb(pool);
    }
  });

  it('changed_by IS NULL when app.actor_id not set', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();

      await pool.query(
        `INSERT INTO player (id, name, credential_hash, active_class_id)
         VALUES ($1, $2, $3, $4)`,
        [playerId, 'noactor', 'hash789', 1]
      );

      const auditRows = await pool.query(
        `SELECT changed_by FROM audit_log
         WHERE table_name = 'player' AND row_id = $1`,
        [playerId]
      );

      assert.equal(auditRows.rows.length, 1);
      assert.equal(auditRows.rows[0].changed_by, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('changed_by populated when app.actor_id set with SET LOCAL', async () => {
    pool = await freshDb();
    try {
      const playerId = randomUUID();
      const actorId = randomUUID();

      // Get a dedicated client to use set_config (transaction-scoped)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await client.query(
          `INSERT INTO player (id, name, credential_hash, active_class_id)
           VALUES ($1, $2, $3, $4)`,
          [playerId, 'withactor', 'hash999', 1]
        );
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      // Verify the audit row has the correct actor
      const auditRows = await pool.query(
        `SELECT changed_by FROM audit_log
         WHERE table_name = 'player' AND row_id = $1`,
        [playerId]
      );

      assert.equal(auditRows.rows.length, 1);
      assert.equal(auditRows.rows[0].changed_by, actorId);
    } finally {
      await closeDb(pool);
    }
  });

  it('app.actor_id does not leak after SET LOCAL transaction commits', async () => {
    pool = await freshDb();
    try {
      const playerId1 = randomUUID();
      const playerId2 = randomUUID();
      const actorId = randomUUID();

      // First transaction with set_config
      const client1 = await pool.connect();
      try {
        await client1.query('BEGIN');
        await client1.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
        await client1.query(
          `INSERT INTO player (id, name, credential_hash, active_class_id)
           VALUES ($1, $2, $3, $4)`,
          [playerId1, 'actor1', 'hash111', 1]
        );
        await client1.query('COMMIT');
      } finally {
        client1.release();
      }

      // Second transaction on a fresh connection (no SET LOCAL)
      const client2 = await pool.connect();
      try {
        await client2.query(
          `INSERT INTO player (id, name, credential_hash, active_class_id)
           VALUES ($1, $2, $3, $4)`,
          [playerId2, 'actor2', 'hash222', 1]
        );
      } finally {
        client2.release();
      }

      // Verify first write had the actor
      const firstAudit = await pool.query(
        `SELECT changed_by FROM audit_log
         WHERE table_name = 'player' AND row_id = $1`,
        [playerId1]
      );
      assert.equal(firstAudit.rows[0].changed_by, actorId);

      // Verify second write does NOT have the actor
      const secondAudit = await pool.query(
        `SELECT changed_by FROM audit_log
         WHERE table_name = 'player' AND row_id = $1`,
        [playerId2]
      );
      assert.equal(secondAudit.rows[0].changed_by, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('balance_constant changes are audited with old/new values', async () => {
    pool = await freshDb();
    try {
      const client = await pool.connect();
      try {
        // Use a transaction that we ROLLBACK to preserve reference data
        await client.query('BEGIN');

        // Update a balance constant from its seeded value (100) to 99
        await client.query(
          `UPDATE balance_constant SET value = 99 WHERE code = 'karma_max'`
        );

        // Check the audit log
        const auditRows = await client.query(
          `SELECT old_row, new_row FROM audit_log
           WHERE table_name = 'balance_constant' AND row_id = 'karma_max'`
        );

        assert.equal(auditRows.rows.length, 1, 'Should have one UPDATE audit row');
        const auditRow = auditRows.rows[0];
        assert.notEqual(auditRow.old_row, null);
        assert.notEqual(auditRow.new_row, null);
        // values in jsonb are numbers, not strings
        // old value should be the seeded value (100)
        assert.equal(auditRow.old_row.value, 100);
        // new value should be what we updated to (99)
        assert.equal(auditRow.new_row.value, 99);

        // ROLLBACK to preserve reference data
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('three-part composite key audit: class_level_scalar', async () => {
    pool = await freshDb();
    try {
      const client = await pool.connect();
      try {
        // Use a transaction that we ROLLBACK to preserve reference data
        await client.query('BEGIN');

        // Insert a new class_level_scalar row (will be rolled back)
        await client.query(
          `INSERT INTO class_level_scalar (class_id, metric, min_level, value)
           VALUES (1, 'test_metric', 5, 42)`
        );

        // Check the audit log with three-part row_id
        const auditRows = await client.query(
          `SELECT row_id FROM audit_log
           WHERE table_name = 'class_level_scalar'`
        );

        assert.equal(auditRows.rows.length, 1);
        const expectedRowId = '1:test_metric:5';
        assert.equal(auditRows.rows[0].row_id, expectedRowId);

        // ROLLBACK to preserve reference data
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await closeDb(pool);
    }
  });
});
