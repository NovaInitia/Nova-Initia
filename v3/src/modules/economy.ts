import { NotImplemented } from '../domain/errors.js';
import { ProgressionModule } from './progression.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type {
  IClassProgressRepository,
  IInventoryRepository,
  ILevelDefinitionRepository,
  IPlayerRepository
} from '../contracts/repositories.js';
import type { JobRunId } from '../domain/ids.js';
import type { ToolType } from '../domain/enums.js';
import type { ClassProgress, Inventory, Player } from '../domain/player.js';
import type { StipendRunSummary } from '../domain/progression.js';

export class EconomyModule {
  constructor(
    private readonly players: IPlayerRepository,
    private readonly inventory: IInventoryRepository,
    private readonly progress: IClassProgressRepository,
    private readonly levels: ILevelDefinitionRepository,
    private readonly progression: ProgressionModule,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async purchase(actor: Player, tool: ToolType, quantity: number): Promise<Inventory> {
    this.balance.costOf(tool, actor.activeClass);
    this.balance.inventoryCap(0);
    await this.inventory.get(actor.id);
    await this.progress.list(actor.id);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.progression.adjustSg(tx, actor, 0, 'purchase', null, null);
      await this.inventory.adjust(actor.id, tool, quantity, tx);
    });

    throw new NotImplemented('EconomyModule.purchase');
  }

  async levelUp(actor: Player): Promise<ClassProgress> {
    const current = await this.progress.get(actor.id, actor.activeClass);
    if (current) {
      this.progression.canAdvance(actor, current);
      await this.levels.get(current.level);
    }

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.progression.adjustSg(tx, actor, 0, 'level_up', null, null);
      await this.progress.save({} as ClassProgress, tx);
    });

    throw new NotImplemented('EconomyModule.levelUp');
  }

  async runStipend(
    now: Date,
    jobRunId: JobRunId,
    activityWindowMs: number,
    intervalMs: number
  ): Promise<StipendRunSummary> {
    await this.players.listStipendDue(now, activityWindowMs, intervalMs);
    this.balance.stipendSgFor(1, 50);
    this.balance.stipendToolFor(1, 50, 1);

    await this.unitOfWork.run(null, async (tx) => {
      await this.progression.adjustSg({} as never, {} as Player, 0, 'stipend', null, null);
      await this.inventory.adjust({} as never, 0, 0, tx);
      await this.players.save({} as Player, tx);
    });

    void jobRunId;
    throw new NotImplemented('EconomyModule.runStipend');
  }
}
