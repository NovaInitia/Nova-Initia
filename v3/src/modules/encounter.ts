import { NotImplemented } from '../domain/errors.js';
import { GeographyModule } from './geography.js';
import { ProgressionModule } from './progression.js';
import { ToolType } from '../domain/enums.js';
import type { PageCoordinates } from '../domain/geography.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type { IConsumption } from '../contracts/consumption.js';
import type {
  IArmorRepository,
  IBarrelContentRepository,
  IGenericPlacementRepository,
  IInventoryRepository,
  IPlacementInteractionRepository,
  IPlayerRepository
} from '../contracts/repositories.js';
import type { Page } from '../domain/geography.js';
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
    private readonly unitOfWork: IUnitOfWork,
    private readonly players: IPlayerRepository,
    private readonly random: () => number = Math.random
  ) {}

  async arrive(
    actor: Player,
    coordinates: PageCoordinates,
    opts: { filterNsfw: boolean }
  ): Promise<PageView> {
    // Decision 5 WF-3 step 1: Resolve page and register presence
    const page = await this.geography.resolvePage(coordinates);
    await this.geography.enter(actor, page);

    // Decision 5 WF-3 step 2: List triggerable placements without NSFW filter
    // (a trap fires whether or not the visitor filters content)
    const triggerable = await this.placements.list(page.id, {
      toolTypes: [ToolType.Trap, ToolType.Spider],
      excludeNsfw: false,
      liveOnly: true
    });

    // Decision 5 WF-3 step 3: Resolve each trigger purely
    const outcomes: TriggerOutcome[] = [];
    for (const placement of triggerable) {
      if (placement.toolType === ToolType.Trap) {
        const trap = placement as TrapPlacement;
        const placer = await this.players.get(trap.placerId);
        if (!placer) {
          throw new Error(`Placer not found: ${trap.placerId}`);
        }
        const outcome = this.resolveTrap(actor, trap, placer.karma, new Date());
        outcomes.push(outcome);
      } else if (placement.toolType === ToolType.Spider) {
        const spider = placement as SpiderPlacement;
        const outcome = this.resolveSpider(actor, spider, new Date());
        outcomes.push(outcome);
      }
    }

    // Decision 5 WF-3 step 4: Apply all outcomes in one transaction
    // Get armor before transaction to determine shield behavior for all outcomes
    const visitorArmor = await this.armor.get(actor.id);
    let shieldsRemaining = visitorArmor?.isActive && visitorArmor?.chargesRemaining > 0 ? visitorArmor.chargesRemaining : 0;
    let shieldActive = visitorArmor?.isActive ?? false;

    await this.unitOfWork.run(actor.id, async (tx) => {
      let triggerIndex = 0;
      for (const placement of triggerable) {
        const outcome = outcomes[triggerIndex];
        triggerIndex += 1;

        if (!outcome.fired) {
          // Just consume the placement, no sg loss or XP
          await this.consumption.consumePlacement(tx, placement, 'triggered');
          continue;
        }

        // Decision 5 WF-3: Shield absorption applies per hit
        // Per spec: "two traps firing on one arrival against a 1-charge shield means
        // the first is absorbed and the second lands"
        if (shieldsRemaining > 0 && shieldActive) {
          // Shield absorbs the hit
          shieldsRemaining -= 1;
          if (shieldsRemaining === 0) {
            shieldActive = false;
          }
          // Mark this outcome as absorbed (mutating the outcome object is acceptable here
          // since we're only reading it after this, not using it again)
          (outcome as TriggerOutcome & { absorbedByShield: boolean }).absorbedByShield = true;
        } else {
          // No shield absorption, apply sg loss
          await this.progression.adjustSg(
            tx,
            actor,
            -outcome.sgLoss,
            placement.toolType === ToolType.Trap ? 'trap_damage' : 'spider_damage',
            placement.id,
            placement.placerId
          );
        }

        // Award placer's XP
        if (outcome.placerXp) {
          await this.progression.awardXp(
            tx,
            actor,
            outcome.placerXp.playerClass,
            outcome.placerXp.amount,
            'trigger_reward',
            placement.id
          );
        }

        // Consume the placement
        await this.consumption.consumePlacement(tx, placement, 'triggered');
      }

      // Update armor if charges changed
      if (visitorArmor && (shieldsRemaining !== visitorArmor.chargesRemaining || shieldActive !== visitorArmor.isActive)) {
        visitorArmor.chargesRemaining = shieldsRemaining;
        visitorArmor.isActive = shieldActive;
        await this.armor.save(visitorArmor, tx);
      }
    });

    // Decision 5 WF-3 step 5: List contents with filters
    const contents = await this.placements.list(page.id, {
      toolTypes: [ToolType.Barrel, ToolType.Doorway, ToolType.Signpost],
      excludeNsfw: opts.filterNsfw,
      excludeDismissedFor: actor.id,
      liveOnly: true
    });

    // Separate contents by type
    const barrels: BarrelPlacement[] = [];
    const doorways: DoorwayPlacement[] = [];
    const signposts: SignpostPlacement[] = [];

    for (const content of contents) {
      if (content.toolType === ToolType.Barrel) {
        barrels.push(content as BarrelPlacement);
      } else if (content.toolType === ToolType.Doorway) {
        doorways.push(content as DoorwayPlacement);
      } else if (content.toolType === ToolType.Signpost) {
        signposts.push(content as SignpostPlacement);
      }
    }

    // Decision 5 WF-3 step 6: Create placement_interaction rows for reported contents
    // (Amendment D.1: create whether or not player dismisses or rates)
    await this.unitOfWork.run(actor.id, async (tx) => {
      for (const content of contents) {
        const existing = await this.interactions.get(actor.id, content.id);
        if (!existing) {
          const now = new Date();
          const interaction: PlacementInteraction = {
            playerId: actor.id,
            placementId: content.id,
            useCount: 0,
            isDismissed: false,
            rating: null,
            ratedAt: null,
            firstSeenAt: now,
            lastUsedAt: null
          };
          await this.interactions.save(interaction, tx);
        }
      }
    });

    // Decision 5 WF-3 step 7: List occupants
    const occupants = await this.geography.listOccupants(page.id);

    // Decision 5 WF-3 step 8: Return PageView
    return {
      page,
      outcomes,
      barrels,
      doorways,
      signposts,
      occupants
    };
  }

  resolveTrap(
    visitor: Player,
    trap: TrapPlacement,
    placerKarma: number,
    now: Date
  ): TriggerOutcome {
    const ageMs = now.getTime() - trap.placedAt.getTime();

    // Decision 2 WF-6: Failure roll
    const failed = this.random() < this.balance.trapFailChance(trap.placerClass);
    if (failed) {
      return {
        fired: false,
        sgLoss: 0,
        absorbedByShield: false,
        placerXp: null,
        visitorXp: null,
        consumesPlacement: true,
        placerId: trap.isAnonymous ? null : trap.placerId
      };
    }

    // Decision 2 WF-6: Damage calculation
    const baseDamage = this.balance.trapDamageFor(ageMs);
    const expertBonus = this.balance.expertTrapBonus(placerKarma, ageMs);
    const totalDamage = baseDamage + expertBonus;

    // Decision 2 WF-6: XP to placer is flat 5
    const xpAmount = this.balance.initialXpFor(ToolType.Trap);

    return {
      fired: true,
      sgLoss: totalDamage,
      absorbedByShield: false,
      placerXp: {
        playerClass: trap.placerClass,
        amount: xpAmount
      },
      visitorXp: null,
      consumesPlacement: true,
      placerId: trap.isAnonymous ? null : trap.placerId
    };
  }

  resolveSpider(visitor: Player, spider: SpiderPlacement, now: Date): TriggerOutcome {
    const ageMs = now.getTime() - spider.placedAt.getTime();

    // Decision 3 WF-7: Spider has no failure roll, flat damage
    const damage = this.balance.spiderDamageFor(ageMs);

    // Decision 3 WF-7: XP scales with age
    const xpAmount = this.balance.spiderXpFor(ageMs);

    // Spiders are not anonymous, so placerId is always reported
    return {
      fired: true,
      sgLoss: damage,
      absorbedByShield: false,
      placerXp: {
        playerClass: spider.placerClass,
        amount: xpAmount
      },
      visitorXp: null,
      consumesPlacement: true,
      placerId: spider.placerId
    };
  }

  async toggleShield(actor: Player): Promise<Armor> {
    // Decision 4 WF-8: Get current armor and inventory state
    const currentArmor = await this.armor.get(actor.id);
    if (!currentArmor) {
      throw new Error(`No armor record for player ${actor.id}`);
    }

    // If armor is active, just deactivate it (no inventory consumed, no XP)
    if (currentArmor.isActive) {
      return await this.unitOfWork.run(actor.id, async (tx) => {
        currentArmor.isActive = false;
        await this.armor.save(currentArmor, tx);
        return currentArmor;
      });
    }

    // Shield is inactive. If charges are not zero, just activate it.
    if (currentArmor.chargesRemaining > 0) {
      return await this.unitOfWork.run(actor.id, async (tx) => {
        currentArmor.isActive = true;
        await this.armor.save(currentArmor, tx);
        return currentArmor;
      });
    }

    // Charges are zero and shield is inactive. Must consume a shield from inventory.
    // If no shields in inventory, NegativeInventory will be thrown by consumption.
    const charges = this.balance.shieldChargesFor(actor.activeClass);

    return await this.unitOfWork.run(actor.id, async (tx) => {
      // Decision 4 WF-8: Consume one shield from inventory
      await this.consumption.consumeFromInventory(tx, actor.id, ToolType.Shield, 1, 'depleted');

      // Grant charges and activate
      currentArmor.isActive = true;
      currentArmor.chargesRemaining = charges;

      await this.armor.save(currentArmor, tx);
      return currentArmor;
    });
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
