import { Pool, PoolConfig } from 'pg';

export function createPool(overrides?: PoolConfig): Pool {
  const config: PoolConfig = {};

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) {
    config.connectionString = process.env.DATABASE_URL;
  }

  if (overrides) {
    Object.assign(config, overrides);
  }

  return new Pool(config);
}

export async function databaseName(pool: Pool): Promise<string> {
  const result = await pool.query('SELECT current_database()');
  return result.rows[0].current_database as string;
}
