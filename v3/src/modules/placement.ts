import { randomUUID } from 'node:crypto';
import { NotImplemented, AbilityLocked, PagePlacementCapReached } from '../domain/errors.js';
import { ProgressionModule } from './progression.js';
import type { IUnitOfWork, IAdvisoryLock } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type { IConsumption } from '../contracts/consumption.js';
import type {
  IBarrelContentRepository,
  IGenericPlacementRepository,
  IInventoryRepository,
  IPlacementInteractionRepository,
  IClassProgressRepository
} from '../contracts/repositories.js';
import type { Page } from '../domain/geography.js';
import type { Player } from '../domain/player.js';
import type {
  BarrelPlacement,
  BarrelSpec,
  Placement,
  PlacementInteraction,
  PlacementSpec,
  TrapPlacement,
  SpiderPlacement,
  DoorwayPlacement,
  SignpostPlacement
} from '../domain/placement.js';
import { ToolType } from '../domain/enums.js';
import type { PlacementId } from '../domain/ids.js';

export class PlacementModule {
  constructor(
    private readonly placements: IGenericPlacementRepository,
    private readonly interactions: IPlacementInteractionRepository,
    private readonly barrelContents: IBarrelContentRepository,
    private readonly inventory: IInventoryRepository,
    private readonly consumption: IConsumption,
    private readonly progression: ProgressionModule,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork,
    private readonly classProgress: IClassProgressRepository,
    private readonly advisoryLock: IAdvisoryLock
  ) {}

  async place(actor: Player, page: Page, spec: PlacementSpec): Promise<Placement> {
    // Step 1: Resolve the placer's level for the active class
    const progress = await this.classProgress.get(actor.id, actor.activeClass);
    if (!progress) {
      throw new Error(`No progress for player ${actor.id} in class ${actor.activeClass}`);
    }
    const placerLevel = progress.level;

    // Step 2: Check the level gate if requested
    if (spec.isAnonymous && spec.toolType === ToolType.Trap) {
      const gate = this.balance.levelGateFor('anonymous_trap');
      if (gate.playerClass === null || gate.playerClass === actor.activeClass) {
        if (placerLevel < gate.level) {
          throw new AbilityLocked('anonymous_trap');
        }
      }
    } else if (spec.spiderVariant === 'wandering') {
      const gate = this.balance.levelGateFor('wandering_spider');
      if (gate.playerClass === null || gate.playerClass === actor.activeClass) {
        if (placerLevel < gate.level) {
          throw new AbilityLocked('wandering_spider');
        }
      }
    } else if (spec.spiderVariant === 'anti_signpost') {
      const gate = this.balance.levelGateFor('anti_signpost_spider');
      if (gate.playerClass === null || gate.playerClass === actor.activeClass) {
        if (placerLevel < gate.level) {
          throw new AbilityLocked('anti_signpost_spider');
        }
      }
    }

    // Step 3: Open unit of work and do everything remaining inside it
    return await this.unitOfWork.run(actor.id, async (tx) => {
      // Step 3a: Take the advisory lock
      const lockKey = `placement:${page.id}:${actor.id}:${spec.toolType}`;
      const acquired = await this.advisoryLock.tryAcquire(lockKey);
      if (!acquired) {
        throw new Error('Failed to acquire advisory lock');
      }

      try {
        // Step 3b: Check the D16 cap
        const currentCount = await this.placements.countOnPageBy(page.id, actor.id, spec.toolType);
        const cap = this.balance.pagePlacementCap();
        if (currentCount >= cap) {
          throw new PagePlacementCapReached(spec.toolType, page.id);
        }

        // Step 3c: Consume one from inventory
        await this.consumption.consumeFromInventory(
          tx,
          actor.id,
          spec.toolType,
          1,
          'placement_failed'
        );

        // Step 3d: Insert the placement
        const placementId = randomUUID() as PlacementId;
        const now = new Date();

        let placement: Placement;
        if (spec.toolType === ToolType.Trap) {
          placement = {
            id: placementId,
            toolType: ToolType.Trap,
            placerId: actor.id,
            pageId: page.id,
            placedAt: now,
            placerClass: actor.activeClass,
            placerLevel,
            consumedAt: null,
            consumptionCause: null,
            isAnonymous: spec.isAnonymous ?? false
          } as TrapPlacement;
        } else if (spec.toolType === ToolType.Spider) {
          placement = {
            id: placementId,
            toolType: ToolType.Spider,
            placerId: actor.id,
            pageId: page.id,
            placedAt: now,
            placerClass: actor.activeClass,
            placerLevel,
            consumedAt: null,
            consumptionCause: null,
            variant: spec.spiderVariant ?? 'standard',
            lastMovedAt: null
          } as SpiderPlacement;
        } else if (spec.toolType === ToolType.Doorway) {
          placement = {
            id: placementId,
            toolType: ToolType.Doorway,
            placerId: actor.id,
            pageId: page.id,
            placedAt: now,
            placerClass: actor.activeClass,
            placerLevel,
            consumedAt: null,
            consumptionCause: null,
            destinationUrl: spec.destinationUrl ?? '',
            title: spec.title ?? null,
            comment: spec.comment ?? null,
            isNsfw: spec.isNsfw ?? false,
            chargesRemaining: this.balance.doorwayChargesFor(actor.activeClass, placerLevel),
            chainRootId: (spec.chainRootId ?? null) as PlacementId | null,
            nextId: null,
            useLimitFor: () => 0
          } as unknown as DoorwayPlacement;
        } else {
          // Signpost
          placement = {
            id: placementId,
            toolType: ToolType.Signpost,
            placerId: actor.id,
            pageId: page.id,
            placedAt: now,
            placerClass: actor.activeClass,
            placerLevel,
            consumedAt: null,
            consumptionCause: null,
            destinationUrl: spec.destinationUrl ?? '',
            title: spec.title ?? null,
            comment: spec.comment ?? null,
            isNsfw: spec.isNsfw ?? false,
            tourRootId: (spec.tourRootId ?? null) as PlacementId | null,
            branchAId: null,
            branchBId: null,
            branchCId: null,
            branchDId: null,
            useLimitFor: () => 0
          } as unknown as SignpostPlacement;
        }

        await this.placements.save(placement, tx);

        // Step 3e: Award initial XP
        const xpAmount = this.balance.initialXpFor(spec.toolType);
        await this.progression.awardXp(
          tx,
          actor,
          actor.activeClass,
          xpAmount,
          'placement_reward',
          placementId
        );

        // Step 3f: Adjust karma
        await this.progression.adjustKarma(tx, actor, spec.toolType, placementId);

        // Release the advisory lock before returning
        await this.advisoryLock.release(lockKey);

        return placement;
      } catch (err) {
        // If something failed, try to release the lock (best effort)
        try {
          await this.advisoryLock.release(lockKey);
        } catch {
          // Ignore errors during cleanup
        }
        throw err;
      }
    });
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
