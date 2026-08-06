import type { PlayerId } from '../domain/ids.js';

export interface Transaction {
  readonly id: string;
}

export interface IUnitOfWork {
  run<T>(actorId: PlayerId | null, fn: (tx: Transaction) => Promise<T>): Promise<T>;
}

export interface IAdvisoryLock {
  tryAcquire(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
}
