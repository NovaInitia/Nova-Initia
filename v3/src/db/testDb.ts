import { Pool } from 'pg';
import { createPool } from './pool.js';
import { runMigrations } from './migrate.js';
import { UnsafeTestDatabase } from '../domain/errors.js';

let dbSkipReason: string | false = false;

try {
  const probePool = createPool({
    connectionTimeoutMillis: 2000
  });

  try {
    const result = await probePool.query('SELECT current_database()');
    const currentDb = result.rows[0].current_database as string;

    if (!currentDb.endsWith('_test')) {
      throw new UnsafeTestDatabase(currentDb);
    }

    dbSkipReason = false;
  } catch (error) {
    if (error instanceof UnsafeTestDatabase) {
      throw error;
    }

    if (process.env.NOVA_REQUIRE_DB === '1') {
      throw error;
    }

    if (error instanceof Error) {
      dbSkipReason = error.message;
    } else {
      dbSkipReason = String(error);
    }
  } finally {
    await probePool.end();
  }
} catch (error) {
  if (error instanceof UnsafeTestDatabase) {
    throw error;
  }

  if (process.env.NOVA_REQUIRE_DB === '1') {
    throw error;
  }

  if (error instanceof Error) {
    dbSkipReason = error.message;
  } else {
    dbSkipReason = String(error);
  }
}

export const DB_SKIP = dbSkipReason;

function isPgError(e: unknown): e is { code?: string } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

export async function freshDb(): Promise<Pool> {
  const pool = createPool();

  try {
    // Ensure migrations have run (idempotent when already applied).
    await runMigrations(pool);

    // Reset test data by truncating all user-created tables, preserving reference data and schema_migration.
    // freshDb() must never write to schema_migration — migrations are applied once and left alone.
    const REFERENCE_TABLES = new Set([
      'player_class', 'tool_type', 'level_definition', 'consumption_cause', 'ledger_cause',
      'ability_gate', 'tool_age_bracket', 'class_scalar', 'class_level_scalar', 'balance_constant',
      'normalisation_version', 'schema_migration'
    ]);

    const tablesResult = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
    );

    const tablesToTruncate = tablesResult.rows
      .map(r => r.table_name as string)
      .filter(name => !REFERENCE_TABLES.has(name));

    if (tablesToTruncate.length > 0) {
      // Validate all table names before use — tables come from the database
      for (const name of tablesToTruncate) {
        if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
          throw new Error(`Invalid table name: ${name}`);
        }
      }

      // TRUNCATE all user tables in one statement with CASCADE to handle foreign keys
      // and RESTART IDENTITY to reset sequences. CASCADE makes dependency order irrelevant.
      const quotedNames = tablesToTruncate.map(name => `"${name}"`).join(', ');
      await pool.query(`TRUNCATE ${quotedNames} RESTART IDENTITY CASCADE`);
    }

    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

export async function closeDb(pool: Pool): Promise<void> {
  await pool.end();
}
