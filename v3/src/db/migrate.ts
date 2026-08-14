import { Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import { createPool } from './pool.js';
import { MigrationChecksumMismatch, MissingAppliedMigration } from '../domain/errors.js';

export interface AppliedMigration {
  version: string;
  name: string;
}

const MIGRATION_LOCK_KEY = 742319011223344;

export async function runMigrations(pool: Pool, dir?: string): Promise<AppliedMigration[]> {
  const migrationDir = dir || fileURLToPath(new URL('../../migrations/', import.meta.url));

  const client = await pool.connect();

  try {
    // Step 1: Take session advisory lock
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    try {
      // Step 2: Bootstrap schema_migration table
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migration (
            version    text        PRIMARY KEY,
            name       text        NOT NULL,
            checksum   text        NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      // Step 3: Read migrations from disk
      const files = await readdir(migrationDir);
      const migrationRegex = /^(\d{4})_([a-z0-9_]+)\.sql$/;
      const migrations = files
        .filter(f => migrationRegex.test(f))
        .sort()
        .map(f => {
          const match = migrationRegex.exec(f);
          if (!match) {
            throw new Error(`Migration filename does not match pattern: ${f}`);
          }
          return {
            version: match[1],
            name: match[2],
            filename: f,
            path: join(migrationDir, f)
          };
        });

      // Step 4: Read and hash each migration file (read once, use for both hash and execution)
      const migrationTexts = new Map<string, string>();
      const checksums = new Map<string, string>();
      for (const mig of migrations) {
        const text = await readFile(mig.path, 'utf8');
        migrationTexts.set(mig.version, text);
        const hash = createHash('sha256').update(text, 'utf8').digest('hex');
        checksums.set(mig.version, hash);
      }

      const appliedRows = await client.query(
        'SELECT version, checksum FROM schema_migration ORDER BY version'
      );
      const appliedMap = new Map(appliedRows.rows.map(r => [r.version, r.checksum]));

      // Step 5: Tamper check
      for (const [version, storedChecksum] of appliedMap) {
        const fileChecksum = checksums.get(version);
        if (fileChecksum && fileChecksum !== storedChecksum) {
          throw new MigrationChecksumMismatch(version);
        }
      }

      // Step 6: Missing check
      for (const [version] of appliedMap) {
        if (!checksums.has(version)) {
          throw new MissingAppliedMigration(version);
        }
      }

      // Step 7: Apply new migrations
      const applied: AppliedMigration[] = [];
      for (const mig of migrations) {
        if (!appliedMap.has(mig.version)) {
          const text = migrationTexts.get(mig.version);
          if (!text) {
            throw new Error(`Migration text not found for version ${mig.version}`);
          }
          const checksum = checksums.get(mig.version);
          if (!checksum) {
            throw new Error(`Checksum not found for version ${mig.version}`);
          }

          try {
            await client.query('BEGIN');
            await client.query(text);
            await client.query(
              'INSERT INTO schema_migration (version, name, checksum) VALUES ($1,$2,$3)',
              [mig.version, mig.name, checksum]
            );
            await client.query('COMMIT');
            applied.push({ version: mig.version, name: mig.name });
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }
      }

      return applied;
    } finally {
      // Release advisory lock
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

// CLI entry
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool();

  try {
    const applied = await runMigrations(pool);
    if (applied.length === 0) {
      console.log('already up to date');
    } else {
      for (const mig of applied) {
        console.log(`${mig.version}_${mig.name}`);
      }
    }
    process.exitCode = 0;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
