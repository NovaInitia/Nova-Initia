import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import type { PlayerId } from '../domain/ids.js';
import type { Transaction, IUnitOfWork } from '../contracts/unitOfWork.js';

export interface PgTransaction extends Transaction {
  readonly client: PoolClient;
}

export const transactionContext = new AsyncLocalStorage<PgTransaction>();

export function executor(pool: Pool): PoolClient | Pool {
  return transactionContext.getStore()?.client ?? pool;
}

export class PgUnitOfWork implements IUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(actorId: PlayerId | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (actorId !== null) {
        await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
      }

      const tx: PgTransaction = {
        id: randomUUID(),
        client
      };

      const result = await transactionContext.run(tx, () => fn(tx));

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
