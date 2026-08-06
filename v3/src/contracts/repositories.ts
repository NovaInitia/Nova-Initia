import type { Transaction } from './unitOfWork.js';
import type {
  DomainId,
  JobRunId,
  PageId,
  PlacementId,
  PlayerId
} from '../domain/ids.js';
import type { PlaceableToolType, PlayerClass, ToolType } from '../domain/enums.js';
import type {
  Armor,
  ClassProgress,
  Inventory,
  Player,
  Session
} from '../domain/player.js';
import type { Page, Presence, WebDomain } from '../domain/geography.js';
import type {
  BarrelPlacement,
  IPlaced,
  Placement,
  PlacementInteraction
} from '../domain/placement.js';
import type {
  JobRunRecord,
  LedgerEntry,
  LevelDefinition
} from '../domain/progression.js';

export interface IRepository<T, TId> {
  get(id: TId): Promise<T | null>;
  save(entity: T, tx: Transaction): Promise<void>;
}

export interface PlacementFilter {
  readonly toolTypes?: readonly PlaceableToolType[];
  readonly excludeNsfw: boolean;
  readonly excludeDismissedFor?: PlayerId;
  readonly liveOnly: boolean;
}

export interface IPlacementRepository<T extends IPlaced>
  extends IRepository<T, PlacementId> {
  list(pageId: PageId, filter: PlacementFilter): Promise<T[]>;
  countOnPageBy(
    pageId: PageId,
    playerId: PlayerId,
    tool: PlaceableToolType
  ): Promise<number>;
  markConsumed(
    id: PlacementId,
    cause: string,
    at: Date,
    tx: Transaction
  ): Promise<void>;
}

export interface IPlayerRepository extends IRepository<Player, PlayerId> {
  getByName(name: string): Promise<Player | null>;
  listStipendDue(now: Date, activityWindowMs: number, intervalMs: number): Promise<Player[]>;
}

export interface IInventoryRepository {
  get(playerId: PlayerId): Promise<Inventory>;
  adjust(
    playerId: PlayerId,
    tool: ToolType,
    delta: number,
    tx: Transaction
  ): Promise<void>;
}

export interface IArmorRepository extends IRepository<Armor, PlayerId> {}

export interface IClassProgressRepository {
  get(playerId: PlayerId, playerClass: PlayerClass): Promise<ClassProgress | null>;
  list(playerId: PlayerId): Promise<ClassProgress[]>;
  save(progress: ClassProgress, tx: Transaction): Promise<void>;
}

export interface ISessionRepository extends IRepository<Session, string> {
  getByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(id: string, at: Date, tx: Transaction): Promise<void>;
}

export interface IPageRepository extends IRepository<Page, PageId> {
  getByHash(urlHash: string, normalisationVersion: number): Promise<Page | null>;
  listInDomain(domainId: DomainId, excluding: PageId): Promise<Page[]>;
}

export interface IDomainRepository extends IRepository<WebDomain, DomainId> {
  getByHash(domainHash: string, normalisationVersion: number): Promise<WebDomain | null>;
}

export interface IPresenceRepository {
  get(playerId: PlayerId): Promise<Presence | null>;
  listOnPage(pageId: PageId): Promise<Presence[]>;
  save(presence: Presence, tx: Transaction): Promise<void>;
  remove(playerId: PlayerId, tx: Transaction): Promise<void>;
  removeStale(olderThan: Date, tx: Transaction): Promise<number>;
}

export interface IPlacementInteractionRepository {
  get(playerId: PlayerId, placementId: PlacementId): Promise<PlacementInteraction | null>;
  save(interaction: PlacementInteraction, tx: Transaction): Promise<void>;
}

export interface IBarrelContentRepository {
  get(barrelId: PlacementId): Promise<ReadonlyMap<ToolType, number>>;
  save(barrelId: PlacementId, contents: ReadonlyMap<ToolType, number>, tx: Transaction): Promise<void>;
  clear(barrelId: PlacementId, tx: Transaction): Promise<void>;
}

export interface ILedgerRepository {
  append(entry: LedgerEntry, tx: Transaction): Promise<void>;
  listForPlayer(playerId: PlayerId, limit: number): Promise<LedgerEntry[]>;
}

export interface ILevelDefinitionRepository {
  get(level: number): Promise<LevelDefinition | null>;
  list(): Promise<LevelDefinition[]>;
}

export interface INormalisationVersionRepository {
  isAcceptable(version: number): Promise<boolean>;
}

export interface IJobRunRepository {
  open(jobName: string, at: Date): Promise<JobRunId>;
  close(id: JobRunId, record: Partial<JobRunRecord>): Promise<void>;
}

export interface IGenericPlacementRepository
  extends IPlacementRepository<Placement> {}

export interface IBarrelRepository extends IPlacementRepository<BarrelPlacement> {}
