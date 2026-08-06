import { InvalidXpAmount, InvalidSgDelta, UnknownClassProgress } from '../domain/errors.js';
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
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidXpAmount(amount);
    }

    const progress = await this.progress.get(player.id, playerClass);
    if (!progress) {
      throw new UnknownClassProgress(player.id, playerClass);
    }

    progress.experience += amount;
    await this.progress.save(progress, tx);

    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'xp',
        playerClass,
        appliedDelta: amount,
        balanceAfter: progress.experience,
        cause,
        placementId,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );
  }

  async adjustKarma(
    tx: Transaction,
    player: Player,
    tool: ToolType,
    placementId: PlacementId | null
  ): Promise<void> {
    if (this.balance.owningClassOf(tool) !== player.activeClass) {
      return;
    }

    const delta = this.balance.karmaDeltaFor(tool);
    const next = Math.min(
      Math.max(player.karma + delta, this.balance.constant('karma_min')),
      this.balance.constant('karma_max')
    );

    const applied = next - player.karma;
    if (applied === 0) {
      return;
    }

    player.karma = next;
    await this.players.save(player, tx);

    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'karma',
        playerClass: null,
        appliedDelta: applied,
        balanceAfter: next,
        cause: 'tool_use',
        placementId,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );
  }

  async adjustSg(
    tx: Transaction,
    player: Player,
    delta: number,
    cause: LedgerCause,
    placementId: PlacementId | null,
    counterpartyId: PlayerId | null
  ): Promise<number> {
    if (!Number.isInteger(delta)) {
      throw new InvalidSgDelta(delta);
    }

    const next = Math.max(player.sg + delta, 0);
    const applied = next - player.sg;

    if (applied === 0) {
      return 0;
    }

    player.sg = next;
    await this.players.save(player, tx);

    await this.ledger.append(
      {
        playerId: player.id,
        resourceKind: 'sg',
        playerClass: null,
        appliedDelta: applied,
        balanceAfter: next,
        cause,
        placementId,
        counterpartyId,
        jobRunId: null,
        occurredAt: new Date()
      },
      tx
    );

    return applied;
  }

  canAdvance(player: Player, progress: ClassProgress): boolean {
    if (progress.level >= this.balance.maxLevel()) {
      return false;
    }

    const nextLevel = this.balance.levelDefinition(progress.level + 1);
    if (progress.experience < nextLevel.experienceThreshold) {
      return false;
    }

    if (player.sg < nextLevel.sgCost) {
      return false;
    }

    return true;
  }
}
