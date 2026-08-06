import type { PageId, PlacementId, PlayerId } from './ids.js';
import type {
  ConsumptionCause,
  PlaceableToolType,
  PlayerClass,
  SpiderVariant,
  ToolType
} from './enums.js';

export interface IPlaced {
  readonly id: PlacementId;
  readonly toolType: PlaceableToolType;
  readonly placerId: PlayerId;
  readonly pageId: PageId;
  readonly placedAt: Date;
  readonly placerClass: PlayerClass;
  readonly placerLevel: number;
  consumedAt: Date | null;
  consumptionCause: ConsumptionCause | null;
}

export interface IHasDestination extends IPlaced {
  readonly destinationUrl: string;
  readonly isNsfw: boolean;
}

export interface IInteractable extends IPlaced {
  useLimitFor(player: { id: PlayerId }): number;
}

export interface IDismissable extends IInteractable {}

export interface TrapPlacement extends IPlaced {
  readonly toolType: typeof ToolType.Trap;
  readonly isAnonymous: boolean;
}

export interface SpiderPlacement extends IPlaced {
  readonly toolType: typeof ToolType.Spider;
  readonly variant: SpiderVariant;
  lastMovedAt: Date | null;
}

export interface BarrelPlacement extends IInteractable {
  readonly toolType: typeof ToolType.Barrel;
  sgAmount: number;
  insideMessage: string | null;
  outsideMessage: string | null;
  durability: number;
  visitCount: number;
  readonly contents: ReadonlyMap<ToolType, number>;
}

export interface DoorwayPlacement extends IInteractable, IHasDestination {
  readonly toolType: typeof ToolType.Doorway;
  title: string | null;
  comment: string | null;
  chargesRemaining: number;
  chainRootId: PlacementId | null;
  nextId: PlacementId | null;
}

export interface SignpostPlacement extends IInteractable, IHasDestination {
  readonly toolType: typeof ToolType.Signpost;
  title: string | null;
  comment: string | null;
  tourRootId: PlacementId | null;
  branchAId: PlacementId | null;
  branchBId: PlacementId | null;
  branchCId: PlacementId | null;
  branchDId: PlacementId | null;
}

export type Placement =
  | TrapPlacement
  | SpiderPlacement
  | BarrelPlacement
  | DoorwayPlacement
  | SignpostPlacement;

export interface PlacementInteraction {
  readonly playerId: PlayerId;
  readonly placementId: PlacementId;
  useCount: number;
  isDismissed: boolean;
  rating: number | null;
  ratedAt: Date | null;
  firstSeenAt: Date;
  lastUsedAt: Date | null;
}

export interface PlacementSpec {
  readonly toolType: PlaceableToolType;
  readonly destinationUrl?: string;
  readonly title?: string;
  readonly comment?: string;
  readonly isNsfw?: boolean;
  readonly isAnonymous?: boolean;
  readonly spiderVariant?: SpiderVariant;
  readonly chainRootId?: PlacementId;
  readonly tourRootId?: PlacementId;
}

export interface BarrelSpec {
  readonly sgAmount: number;
  readonly contents: ReadonlyMap<ToolType, number>;
  readonly insideMessage?: string;
  readonly outsideMessage?: string;
}
