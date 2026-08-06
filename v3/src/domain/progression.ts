import type { JobRunId, PlacementId, PlayerId } from './ids.js';
import type {
  JobOutcome,
  JobName,
  LedgerCause,
  PlayerClass,
  ResourceKind,
  ToolType
} from './enums.js';
import type { Page, Presence } from './geography.js';
import type {
  BarrelPlacement,
  DoorwayPlacement,
  Placement,
  SignpostPlacement
} from './placement.js';

export interface LevelDefinition {
  readonly level: number;
  readonly name: string;
  readonly experienceThreshold: number;
  readonly sgCost: number;
  readonly stipendSg: number;
  readonly toolAllowance: number;
}

export interface XpAward {
  readonly playerClass: PlayerClass;
  readonly amount: number;
}

export interface TriggerOutcome {
  readonly fired: boolean;
  readonly sgLoss: number;
  readonly absorbedByShield: boolean;
  readonly placerXp: XpAward | null;
  readonly visitorXp: XpAward | null;
  readonly consumesPlacement: boolean;
  readonly placerId: PlayerId | null;
}

export interface LedgerEntry {
  readonly playerId: PlayerId;
  readonly resourceKind: ResourceKind;
  readonly playerClass: PlayerClass | null;
  readonly appliedDelta: number;
  readonly balanceAfter: number;
  readonly cause: LedgerCause;
  readonly placementId: PlacementId | null;
  readonly counterpartyId: PlayerId | null;
  readonly jobRunId: JobRunId | null;
  readonly occurredAt: Date;
}

export interface PageView {
  readonly page: Page;
  readonly outcomes: readonly TriggerOutcome[];
  readonly barrels: readonly BarrelPlacement[];
  readonly doorways: readonly DoorwayPlacement[];
  readonly signposts: readonly SignpostPlacement[];
  readonly occupants: readonly Presence[];
}

export interface LootResult {
  readonly sgGained: number;
  readonly toolsGained: ReadonlyMap<ToolType, number>;
  readonly barrelExhausted: boolean;
}

export interface TraversalResult {
  readonly destinationUrl: string;
  readonly chargesRemaining: number;
  readonly transportedBarrel: BarrelPlacement | null;
  readonly nextInChain: DoorwayPlacement | null;
}

export interface SignpostResult {
  readonly destinationUrl: string;
  readonly branches: readonly SignpostPlacement[];
  readonly isTerminal: boolean;
}

export interface JobResult {
  readonly considered: number;
  readonly affected: number;
  readonly note?: string;
}

export interface JobRunRecord {
  readonly id: JobRunId;
  readonly jobName: JobName;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly outcome: JobOutcome;
  readonly result: JobResult | null;
}

export interface StipendRunSummary extends JobResult {
  readonly totalSgGranted: number;
  readonly totalToolsGranted: number;
}

export interface ConsumptionRecord {
  readonly placement: Placement;
  readonly cause: string;
}
