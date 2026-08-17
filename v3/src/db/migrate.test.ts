import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { closeDb, DB_SKIP, freshDb } from './testDb.js';
import { runMigrations } from './migrate.js';
import { MigrationChecksumMismatch, MissingAppliedMigration } from '../domain/errors.js';

describe('migration runner', { skip: DB_SKIP }, () => {
  test('applies migrations to fresh database', async () => {
    const pool = await freshDb();

    try {
      // Count expected migrations from the migrations directory
      const fs = await import('fs/promises');
      const migDir = new URL('../../migrations/', import.meta.url);
      const { fileURLToPath } = await import('url');
      const realMigDir = fileURLToPath(migDir);
      const files = await fs.readdir(realMigDir);
      const migrationRegex = /^\d{4}_[a-z0-9_]+\.sql$/;
      const expectedCount = files.filter(f => migrationRegex.test(f)).length;

      const result = await pool.query('SELECT COUNT(*) FROM schema_migration');
      const count = parseInt(result.rows[0].count, 10);
      assert.equal(count, expectedCount, `Expected ${expectedCount} migrations applied`);
    } finally {
      await closeDb(pool);
    }
  });

  test('is idempotent', async () => {
    const pool = await freshDb();

    try {
      const applied = await runMigrations(pool);
      assert.equal(applied.length, 0, 'Expected no additional migrations on second run');
    } finally {
      await closeDb(pool);
    }
  });

  test('detects checksum tamper', async () => {
    // Created before the try so the finally can always remove it.
    const tempDir = await mkdtemp(join(tmpdir(), 'mig-test-'));
    const pool = await freshDb();

    try {

      // Copy real migration files
      const fs = await import('fs/promises');
      const migDir = new URL('../../migrations/', import.meta.url);
      const { fileURLToPath } = await import('url');
      const realMigDir = fileURLToPath(migDir);

      const files = await fs.readdir(realMigDir);
      for (const file of files) {
        const content = await fs.readFile(join(realMigDir, file), 'utf8');
        await writeFile(join(tempDir, file), content, 'utf8');
      }

      // Tamper with a migration file
      const firstMigPath = join(tempDir, '0001_core_schema.sql');
      const content = await fs.readFile(firstMigPath, 'utf8');
      await writeFile(firstMigPath, content + '\n-- tampered\n', 'utf8');

      // Try to run migrations; should detect checksum mismatch
      let caught = false;
      try {
        await runMigrations(pool, tempDir);
      } catch (error) {
        if (error instanceof MigrationChecksumMismatch) {
          caught = true;
        } else {
          throw error;
        }
      }

      assert.ok(caught, 'Expected MigrationChecksumMismatch error');

      // Clean up: the temp migration would have tried to re-apply 0001 and 0002,
      // but tamper detection stopped it before schema_migration was modified.
      // No cleanup needed for this test.
    } finally {
      await rm(tempDir, { recursive: true, force: true });
      await closeDb(pool);
    }
  });

  test('detects missing applied migration', async () => {
    const pool = await freshDb();

    try {
      // Insert a fake migration record
      await pool.query(
        'INSERT INTO schema_migration (version, name, checksum) VALUES ($1, $2, $3)',
        ['9999', 'fake_migration', 'abc123']
      );

      // Try to run migrations; should detect missing file
      let caught = false;
      try {
        await runMigrations(pool);
      } catch (error) {
        if (error instanceof MissingAppliedMigration) {
          caught = true;
        } else {
          throw error;
        }
      }

      assert.ok(caught, 'Expected MissingAppliedMigration error');

      // Clean up: remove the fake migration record
      await pool.query('DELETE FROM schema_migration WHERE version = $1', ['9999']);
    } finally {
      await closeDb(pool);
    }
  });

  test('rolls back failed migration', async () => {
    // Created before the try so the finally can always remove it.
    const tempDir = await mkdtemp(join(tmpdir(), 'mig-test-'));
    const pool = await freshDb();

    try {

      const fs = await import('fs/promises');

      // Copy real migrations to temp dir
      const migDir = new URL('../../migrations/', import.meta.url);
      const { fileURLToPath } = await import('url');
      const realMigDir = fileURLToPath(migDir);

      const files = await fs.readdir(realMigDir);
      for (const file of files) {
        const content = await fs.readFile(join(realMigDir, file), 'utf8');
        await writeFile(join(tempDir, file), content, 'utf8');
      }

      // The version must be higher than every real migration. Naming this 0003 while a
      // real 0003 exists makes the runner reject it on a checksum mismatch before the SQL
      // ever executes — which is how this test silently stopped testing rollback when
      // cycle 5 added a third migration, while staying green.
      const badMigration = `CREATE TABLE should_not_survive (id uuid PRIMARY KEY);
INVALID SQL HERE;`;
      await writeFile(join(tempDir, '9998_bad.sql'), badMigration, 'utf8');

      // Try to run migrations from temp dir; should fail executing the bad SQL
      let caught: unknown = null;
      try {
        await runMigrations(pool, tempDir);
      } catch (error) {
        caught = error;
      }

      assert.ok(caught, 'Expected migration to fail');
      assert.ok(
        !(caught instanceof MigrationChecksumMismatch),
        'Expected a SQL failure, not a checksum mismatch — the bad migration must actually run'
      );
      assert.ok(
        !(caught instanceof MissingAppliedMigration),
        'Expected a SQL failure, not a missing-file error'
      );

      // Verify table was not created (rolled back)
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'should_not_survive'
        )`
      );

      assert.equal(
        result.rows[0].exists,
        false,
        'Expected should_not_survive table to not exist after rollback'
      );

      // Clean up: the failure on 0003 should have rolled back before schema_migration insert,
      // so no migration records were created for this test. No cleanup needed.
    } finally {
      await rm(tempDir, { recursive: true, force: true });
      await closeDb(pool);
    }
  });
});
