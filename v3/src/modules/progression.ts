import { NotImplemented } from '../domain/errors.js';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type {
  IClassProgressRepository,
  ILedgerRepository,
  IPlayerRepository
} from '../contracts/repositories.js';
import type { PlacementId, PlayerId } from '../domain/ids.js';
import type { LedgerCause, PlayerClass, ToolType } from '../domain/enums.js';
import type { Player, ClassProgress } from '../domain/player.js';

export class ProgressionModule {
  constructor(
    private readonly players: IPlayerRepository,
    private readonly progress: IClassProgressRepository,
    private readonly ledger: ILedgerRepository,
    private readonly balance: IBalanceTable
  ) {}

  async awardXp(
    tx: Transaction,
    player: Player,
    playerClass: PlayerClass,
    amount: number,
    cause: LedgerCause,
    placementId: PlacementId | null
  ): Promise<void> {
    await this.progress.get(player.id, playerClass);
    await this.progress.save({} as ClassProgress, tx);
    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'xp',
        playerClass,
        appliedDelta: amount,
        balanceAfter: 0,
        cause,
        placementId,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );
    throw new NotImplemented('ProgressionModule.awardXp');
  }

  async adjustKarma(
    tx: Transaction,
    player: Player,
    tool: ToolType,
    placementId: PlacementId | null
  ): Promise<void> {
    this.balance.karmaDeltaFor(tool);
    await this.players.save(player, tx);
    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'karma',
        playerClass: null,
        appliedDelta: 0,
        balanceAfter: 0,
        cause: 'tool_use',
        placementId,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );
    throw new NotImplemented('ProgressionModule.adjustKarma');
  }

  async adjustSg(
    tx: Transaction,
    player: Player,
    delta: number,
    cause: LedgerCause,
    placementId: PlacementId | null,
    counterpartyId: PlayerId | null
  ): Promise<number> {
    await this.players.save(player, tx);
    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'sg',
        playerClass: null,
        appliedDelta: delta,
        balanceAfter: 0,
        cause,
        placementId,
        counterpartyId,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );
    throw new NotImplemented('ProgressionModule.adjustSg');
  }

  canAdvance(_player: Player, _progress: ClassProgress): boolean {
    throw new NotImplemented('ProgressionModule.canAdvance');
  }
}
