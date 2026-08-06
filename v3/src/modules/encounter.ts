import { NotImplemented } from '../domain/errors.js';
import { GeographyModule } from './geography.js';
import { ProgressionModule } from './progression.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type { IConsumption } from '../contracts/consumption.js';
import type {
  IArmorRepository,
  IBarrelContentRepository,
  IGenericPlacementRepository,
  IInventoryRepository,
  IPlacementInteractionRepository
} from '../contracts/repositories.js';
import type { Page, PageCoordinates } from '../domain/geography.js';
import type { Armor, Player } from '../domain/player.js';
import type {
  BarrelPlacement,
  DoorwayPlacement,
  IPlaced,
  PlacementInteraction,
  SignpostPlacement,
  SpiderPlacement,
  TrapPlacement
} from '../domain/placement.js';
import type {
  LootResult,
  PageView,
  SignpostResult,
  TraversalResult,
  TriggerOutcome
} from '../domain/progression.js';

export class EncounterModule {
  constructor(
    private readonly geography: GeographyModule,
    private readonly placements: IGenericPlacementRepository,
    private readonly interactions: IPlacementInteractionRepository,
    private readonly barrelContents: IBarrelContentRepository,
    private readonly inventory: IInventoryRepository,
    private readonly armor: IArmorRepository,
    private readonly consumption: IConsumption,
    private readonly progression: ProgressionModule,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async arrive(
    actor: Player,
    coordinates: PageCoordinates,
    opts: { filterNsfw: boolean }
  ): Promise<PageView> {
    const page = await this.geography.resolvePage(coordinates);
    await this.geography.enter(actor, page);

    await this.placements.list(page.id, {
      toolTypes: [0, 2],
      excludeNsfw: opts.filterNsfw,
      liveOnly: true
    });

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.progression.adjustSg(tx, actor, 0, 'trap_damage', null, null);
      await this.consumption.consumePlacement(tx, {} as IPlaced, 'triggered');
    });

    await this.placements.list(page.id, {
      toolTypes: [1, 4, 5],
      excludeNsfw: opts.filterNsfw,
      excludeDismissedFor: actor.id,
      liveOnly: true
    });

    await this.geography.listOccupants(page.id);

    throw new NotImplemented('EncounterModule.arrive');
  }

  resolveTrap(visitor: Player, trap: TrapPlacement, now: Date): TriggerOutcome {
    this.balance.trapFailChance(trap.placerClass);
    this.balance.trapDamageFor(now.getTime() - trap.placedAt.getTime());
    this.balance.expertTrapBonus(visitor.karma, now.getTime() - trap.placedAt.getTime());
    throw new NotImplemented('EncounterModule.resolveTrap');
  }

  resolveSpider(visitor: Player, spider: SpiderPlacement, now: Date): TriggerOutcome {
    this.balance.spiderXpFor(now.getTime() - spider.placedAt.getTime());
    void visitor;
    throw new NotImplemented('EncounterModule.resolveSpider');
  }

  async toggleShield(actor: Player): Promise<Armor> {
    await this.armor.get(actor.id);
    await this.inventory.get(actor.id);
    this.balance.shieldChargesFor(actor.activeClass);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.consumption.consumeFromInventory(tx, actor.id, 3, 1, 'depleted');
      await this.armor.save({} as Armor, tx);
    });

    throw new NotImplemented('EncounterModule.toggleShield');
  }

  async lootBarrel(actor: Player, barrel: BarrelPlacement): Promise<LootResult> {
    await this.interactions.get(actor.id, barrel.id);
    await this.barrelContents.get(barrel.id);
    this.balance.levelGateFor('loot_own_barrel');
    this.balance.barrelXpFor(Date.now() - barrel.placedAt.getTime());

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.inventory.adjust(actor.id, 0, 0, tx);
      await this.progression.adjustSg(tx, actor, 0, 'barrel_loot', barrel.id, barrel.placerId);
      await this.progression.awardXp(tx, actor, barrel.placerClass, 0, 'trigger_reward', barrel.id);
      await this.barrelContents.clear(barrel.id, tx);
      await this.interactions.save({} as PlacementInteraction, tx);
      await this.consumption.consumePlacement(tx, barrel, 'exhausted');
    });

    throw new NotImplemented('EncounterModule.lootBarrel');
  }

  async traverseDoorway(
    actor: Player,
    doorway: DoorwayPlacement
  ): Promise<TraversalResult> {
    await this.interactions.get(actor.id, doorway.id);
    this.balance.doorwayPassThroughLimit(doorway.placerId === actor.id);
    this.balance.doorwayTransportChance(0);
    this.balance.forcedDoorwayChance(doorway.placerClass);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.placements.save(doorway, tx);
      await this.interactions.save({} as PlacementInteraction, tx);
      await this.progression.awardXp(
        tx,
        actor,
        doorway.placerClass,
        0,
        'trigger_reward',
        doorway.id
      );
      await this.consumption.consumePlacement(tx, doorway, 'depleted');
    });

    throw new NotImplemented('EncounterModule.traverseDoorway');
  }

  async followSignpost(
    actor: Player,
    signpost: SignpostPlacement
  ): Promise<SignpostResult> {
    await this.interactions.get(actor.id, signpost.id);
    this.balance.branchAllowance(signpost.placerClass, signpost.placerLevel);

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.interactions.save({} as PlacementInteraction, tx);
      await this.progression.awardXp(
        tx,
        actor,
        signpost.placerClass,
        0,
        'trigger_reward',
        signpost.id
      );
    });

    throw new NotImplemented('EncounterModule.followSignpost');
  }

  private async loadPage(coordinates: PageCoordinates): Promise<Page> {
    return this.geography.resolvePage(coordinates);
  }
}
