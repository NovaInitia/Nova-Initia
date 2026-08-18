import { randomUUID } from 'node:crypto';
import {
  AbilityLocked,
  PagePlacementCapReached,
  BarrelCapacityExceeded,
  MessageTooLong,
  HtmlNotPermitted
} from '../domain/errors.js';
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
    // Resolve the placer's level for the active class
    const progress = await this.classProgress.get(actor.id, actor.activeClass);
    if (!progress) {
      throw new Error(`No progress for player ${actor.id} in class ${actor.activeClass}`);
    }
    const placerLevel = progress.level;

    // Check capacity first (decision 1a)
    const capacity = this.balance.barrelCapacityFor(actor.activeClass);
    const slotsUsed = Array.from(spec.contents.values()).reduce((sum, qty) => sum + qty, 0) +
      Math.ceil(spec.sgAmount / 10);
    if (slotsUsed > capacity) {
      throw new BarrelCapacityExceeded(slotsUsed, capacity);
    }

    // Check gates (decision 1b)
    if (spec.sgAmount > 0) {
      const gate = this.balance.levelGateFor('barrel_stash_sg');
      const playerCanUse = gate.playerClass === null || gate.playerClass === actor.activeClass;
      if (!playerCanUse || placerLevel < gate.level) {
        throw new AbilityLocked('barrel_stash_sg');
      }
    }

    if (spec.insideMessage !== undefined && spec.insideMessage !== null) {
      const gate = this.balance.levelGateFor('barrel_inside_message');
      const playerCanUse = gate.playerClass === null || gate.playerClass === actor.activeClass;
      if (!playerCanUse || placerLevel < gate.level) {
        throw new AbilityLocked('barrel_inside_message');
      }
    }

    if (spec.outsideMessage !== undefined && spec.outsideMessage !== null) {
      const gate = this.balance.levelGateFor('barrel_outside_message');
      const playerCanUse = gate.playerClass === null || gate.playerClass === actor.activeClass;
      if (!playerCanUse || placerLevel < gate.level) {
        throw new AbilityLocked('barrel_outside_message');
      }
    }

    // Check message lengths and HTML (decision 1c)
    const insideMax = this.balance.constant('barrel_inside_message_max');
    const outsideMax = this.balance.constant('barrel_outside_message_max');

    if (spec.insideMessage !== undefined && spec.insideMessage !== null) {
      if (spec.insideMessage.length > insideMax) {
        throw new MessageTooLong('insideMessage', insideMax);
      }
      if (spec.insideMessage.includes('<') || spec.insideMessage.includes('>')) {
        throw new HtmlNotPermitted('insideMessage');
      }
    }

    if (spec.outsideMessage !== undefined && spec.outsideMessage !== null) {
      if (spec.outsideMessage.length > outsideMax) {
        throw new MessageTooLong('outsideMessage', outsideMax);
      }
      if (spec.outsideMessage.includes('<') || spec.outsideMessage.includes('>')) {
        throw new HtmlNotPermitted('outsideMessage');
      }
    }

    // Everything inside one transaction (decision 1 intro)
    return await this.unitOfWork.run(actor.id, async (tx) => {
      // Decision 1d: Consume inventory for barrel and each tool inside
      await this.consumption.consumeFromInventory(
        tx,
        actor.id,
        ToolType.Barrel,
        1,
        'placement_failed'
      );

      for (const [toolType, quantity] of spec.contents.entries()) {
        await this.consumption.consumeFromInventory(
          tx,
          actor.id,
          toolType,
          quantity,
          'placement_failed'
        );
      }

      // Decision 1e: Adjust sg
      await this.progression.adjustSg(
        tx,
        actor,
        -spec.sgAmount,
        'barrel_stash',
        null,
        null
      );

      // Decision 1f: Create the barrel row
      const placementId = randomUUID() as PlacementId;
      const now = new Date();

      const placement: BarrelPlacement = {
        id: placementId,
        toolType: ToolType.Barrel,
        placerId: actor.id,
        pageId: page.id,
        placedAt: now,
        placerClass: actor.activeClass,
        placerLevel,
        consumedAt: null,
        consumptionCause: null,
        sgAmount: spec.sgAmount,
        insideMessage: spec.insideMessage ?? null,
        outsideMessage: spec.outsideMessage ?? null,
        visitCount: 0,
        durability: 1, // Open-8: undefined reuse chance means used once, no recycling
        contents: spec.contents,
        useLimitFor: () => 0
      };

      await this.placements.save(placement, tx);

      // Decision 1g: Save contents
      await this.barrelContents.save(placementId, spec.contents, tx);

      // Decision 1h: Award XP with fullness bonus
      const baseXp = this.balance.initialXpFor(ToolType.Barrel);
      const bonus = Math.floor(baseXp * slotsUsed / capacity);
      const totalXp = baseXp + bonus;
      // Award as single XP entry (base + bonus combined)
      await this.progression.awardXp(
        tx,
        actor,
        actor.activeClass,
        totalXp,
        'placement_reward',
        placementId
      );

      // Award karma (follows same pattern as place())
      await this.progression.adjustKarma(tx, actor, ToolType.Barrel, placementId);

      return placement;
    });
  }

  async dismiss(actor: Player, placement: Placement): Promise<void> {
    return await this.unitOfWork.run(actor.id, async (tx) => {
      // Get existing interaction if it exists (to preserve fields)
      const existing = await this.interactions.get(actor.id, placement.id);

      if (existing) {
        // Preserve useCount, rating, ratedAt, firstSeenAt; update only isDismissed
        const interaction: PlacementInteraction = {
          playerId: existing.playerId,
          placementId: existing.placementId,
          useCount: existing.useCount,
          isDismissed: true,
          rating: existing.rating,
          ratedAt: existing.ratedAt,
          firstSeenAt: existing.firstSeenAt,
          lastUsedAt: existing.lastUsedAt
        };
        await this.interactions.save(interaction, tx);
      } else {
        // Create new row with isDismissed = true
        const now = new Date();
        const interaction: PlacementInteraction = {
          playerId: actor.id,
          placementId: placement.id,
          useCount: 0,
          isDismissed: true,
          rating: null,
          ratedAt: null,
          firstSeenAt: now,
          lastUsedAt: null
        };
        await this.interactions.save(interaction, tx);
      }
    });
  }
}
