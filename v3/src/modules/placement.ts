import { NotImplemented } from '../domain/errors.js';
import { ProgressionModule } from './progression.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type { IConsumption } from '../contracts/consumption.js';
import type {
  IBarrelContentRepository,
  IGenericPlacementRepository,
  IInventoryRepository,
  IPlacementInteractionRepository
} from '../contracts/repositories.js';
import type { Page } from '../domain/geography.js';
import type { Player } from '../domain/player.js';
import type {
  BarrelPlacement,
  BarrelSpec,
  Placement,
  PlacementInteraction,
  PlacementSpec
} from '../domain/placement.js';

export class PlacementModule {
  constructor(
    private readonly placements: IGenericPlacementRepository,
    private readonly interactions: IPlacementInteractionRepository,
    private readonly barrelContents: IBarrelContentRepository,
    private readonly inventory: IInventoryRepository,
    private readonly consumption: IConsumption,
    private readonly progression: ProgressionModule,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async place(actor: Player, page: Page, spec: PlacementSpec): Promise<Placement> {
    await this.inventory.get(actor.id);
    this.balance.levelGateFor('anonymous_trap');
    this.balance.pagePlacementCap();
    await this.placements.countOnPageBy(page.id, actor.id, spec.toolType);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.consumption.consumeFromInventory(
        tx,
        actor.id,
        spec.toolType,
        1,
        'placement_failed'
      );
      await this.placements.save({} as Placement, tx);
      await this.progression.awardXp(
        tx,
        actor,
        actor.activeClass,
        this.balance.initialXpFor(spec.toolType),
        'placement_reward',
        null
      );
      await this.progression.adjustKarma(tx, actor, spec.toolType, null);
    });

    throw new NotImplemented('PlacementModule.place');
  }

  async stashBarrel(
    actor: Player,
    page: Page,
    spec: BarrelSpec
  ): Promise<BarrelPlacement> {
    this.balance.barrelCapacityFor(actor.activeClass);
    this.balance.levelGateFor('barrel_stash_sg');
    await this.inventory.get(actor.id);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.consumption.consumeFromInventory(tx, actor.id, 1, 1, 'placement_failed');
      await this.placements.save({} as Placement, tx);
      await this.barrelContents.save({} as never, spec.contents, tx);
      await this.progression.awardXp(
        tx,
        actor,
        actor.activeClass,
        this.balance.initialXpFor(1),
        'placement_reward',
        null
      );
      await this.progression.adjustKarma(tx, actor, 1, null);
    });

    void page;
    throw new NotImplemented('PlacementModule.stashBarrel');
  }

  async dismiss(actor: Player, placement: Placement): Promise<void> {
    await this.interactions.get(actor.id, placement.id);
    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.interactions.save({} as PlacementInteraction, tx);
    });
    throw new NotImplemented('PlacementModule.dismiss');
  }
}
