import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IClassProgressRepository } from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { PlayerClass } from '../domain/enums.js';
import type { ClassProgress } from '../domain/player.js';
import { executor } from './PgUnitOfWork.js';

function dbToClassProgress(row: {
  player_id: string;
  class_id: number;
  level: number;
  experience: number;
}): ClassProgress {
  return {
    playerId: row.player_id as PlayerId,
    playerClass: row.class_id as PlayerClass,
    level: row.level,
    experience: row.experience
  };
}

export class PgClassProgressRepository implements IClassProgressRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: PlayerId, playerClass: PlayerClass): Promise<ClassProgress | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT player_id, class_id, level, experience FROM player_class_progress
       WHERE player_id = $1 AND class_id = $2`,
      [playerId, playerClass]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToClassProgress(result.rows[0]);
  }

  async list(playerId: PlayerId): Promise<ClassProgress[]> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT player_id, class_id, level, experience FROM player_class_progress
       WHERE player_id = $1
       ORDER BY class_id ASC`,
      [playerId]
    );

    return result.rows.map(dbToClassProgress);
  }

  async save(progress: ClassProgress, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO player_class_progress (player_id, class_id, level, experience)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, class_id) DO UPDATE SET
         level = $3,
         experience = $4`,
      [progress.playerId, progress.playerClass, progress.level, progress.experience]
    );
  }
}
