import { NotImplemented, ConcurrentUnitOfWork, NegativeInventory } from '../domain/errors.js';
import type { Transaction, IUnitOfWork } from '../contracts/unitOfWork.js';
import type {
  IPlayerRepository,
  IClassProgressRepository,
  ILedgerRepository,
  IInventoryRepository,
  IArmorRepository,
  ISessionRepository
} from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { PlayerClass, ToolType } from '../domain/enums.js';
import type { Player, ClassProgress, Inventory, Armor, Session } from '../domain/player.js';
import type { LedgerEntry } from '../domain/progression.js';

export class InMemoryDatabase {
  private players: Map<PlayerId, Player> = new Map();
  private classProgress: Map<string, ClassProgress> = new Map();
  private ledger: Map<PlayerId, LedgerEntry[]> = new Map();
  private inventory: Map<PlayerId, Map<ToolType, number>> = new Map();
  private armor: Map<PlayerId, Armor> = new Map();
  private sessions: Map<string, Session> = new Map();

  reset(): void {
    this.players.clear();
    this.classProgress.clear();
    this.ledger.clear();
    this.inventory.clear();
    this.armor.clear();
    this.sessions.clear();
  }

  snapshot(): {
    players: Map<PlayerId, Player>;
    classProgress: Map<string, ClassProgress>;
    ledger: Map<PlayerId, LedgerEntry[]>;
    inventory: Map<PlayerId, Map<ToolType, number>>;
    armor: Map<PlayerId, Armor>;
    sessions: Map<string, Session>;
  } {
    const playersCopy = new Map<PlayerId, Player>();
    for (const [id, player] of this.players) {
      playersCopy.set(id, deepCopyPlayer(player));
    }

    const classPCopy = new Map<string, ClassProgress>();
    for (const [key, progress] of this.classProgress) {
      classPCopy.set(key, deepCopyClassProgress(progress));
    }

    const ledgerCopy = new Map<PlayerId, LedgerEntry[]>();
    for (const [id, entries] of this.ledger) {
      ledgerCopy.set(id, entries.map((e) => deepCopyLedgerEntry(e)));
    }

    const inventoryCopy = new Map<PlayerId, Map<ToolType, number>>();
    for (const [id, counts] of this.inventory) {
      inventoryCopy.set(id, new Map(counts));
    }

    const armorCopy = new Map<PlayerId, Armor>();
    for (const [id, armor] of this.armor) {
      armorCopy.set(id, deepCopyArmor(armor));
    }

    const sessionsCopy = new Map<string, Session>();
    for (const [id, session] of this.sessions) {
      sessionsCopy.set(id, deepCopySession(session));
    }

    return { players: playersCopy, classProgress: classPCopy, ledger: ledgerCopy, inventory: inventoryCopy, armor: armorCopy, sessions: sessionsCopy };
  }

  restore(snapshot: {
    players: Map<PlayerId, Player>;
    classProgress: Map<string, ClassProgress>;
    ledger: Map<PlayerId, LedgerEntry[]>;
    inventory: Map<PlayerId, Map<ToolType, number>>;
    armor: Map<PlayerId, Armor>;
    sessions: Map<string, Session>;
  }): void {
    this.players.clear();
    for (const [id, player] of snapshot.players) {
      this.players.set(id, deepCopyPlayer(player));
    }

    this.classProgress.clear();
    for (const [key, progress] of snapshot.classProgress) {
      this.classProgress.set(key, deepCopyClassProgress(progress));
    }

    this.ledger.clear();
    for (const [id, entries] of snapshot.ledger) {
      this.ledger.set(id, entries.map((e) => deepCopyLedgerEntry(e)));
    }

    this.inventory.clear();
    for (const [id, counts] of snapshot.inventory) {
      this.inventory.set(id, new Map(counts));
    }

    this.armor.clear();
    for (const [id, armor] of snapshot.armor) {
      this.armor.set(id, deepCopyArmor(armor));
    }

    this.sessions.clear();
    for (const [id, session] of snapshot.sessions) {
      this.sessions.set(id, deepCopySession(session));
    }
  }

  getPlayer(id: PlayerId): Player | null {
    const p = this.players.get(id);
    return p ? deepCopyPlayer(p) : null;
  }

  savePlayer(player: Player): void {
    this.players.set(player.id, deepCopyPlayer(player));
  }

  getPlayerByName(name: string): Player | null {
    for (const player of this.players.values()) {
      if (player.name === name) return deepCopyPlayer(player);
    }
    return null;
  }

  getClassProgress(playerId: PlayerId, playerClass: PlayerClass): ClassProgress | null {
    const key = `${playerId}:${playerClass}`;
    const progress = this.classProgress.get(key);
    return progress ? deepCopyClassProgress(progress) : null;
  }

  listClassProgress(playerId: PlayerId): ClassProgress[] {
    const result: ClassProgress[] = [];
    for (const [key, progress] of this.classProgress) {
      if (key.startsWith(`${playerId}:`)) {
        result.push(deepCopyClassProgress(progress));
      }
    }
    result.sort((a, b) => a.playerClass - b.playerClass);
    return result;
  }

  saveClassProgress(progress: ClassProgress): void {
    const key = `${progress.playerId}:${progress.playerClass}`;
    this.classProgress.set(key, deepCopyClassProgress(progress));
  }

  appendLedgerEntry(entry: LedgerEntry): void {
    const entries = this.ledger.get(entry.playerId) ?? [];
    entries.push(deepCopyLedgerEntry(entry));
    this.ledger.set(entry.playerId, entries);
  }

  listLedgerEntries(playerId: PlayerId, limit: number): LedgerEntry[] {
    const entries = this.ledger.get(playerId) ?? [];
    const clampedLimit = Math.max(limit, 0);
    const result = entries.slice().reverse().slice(0, clampedLimit);
    return result.map((e) => deepCopyLedgerEntry(e));
  }

  getInventory(playerId: PlayerId): Map<ToolType, number> {
    const counts = this.inventory.get(playerId);
    return counts ? new Map(counts) : new Map();
  }

  adjustInventory(playerId: PlayerId, tool: ToolType, delta: number): void {
    const counts = this.inventory.get(playerId) ?? new Map();
    const current = counts.get(tool) ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw new NegativeInventory(tool);
    }
    counts.set(tool, next);
    this.inventory.set(playerId, counts);
  }

  getArmor(playerId: PlayerId): Armor | null {
    const armor = this.armor.get(playerId);
    return armor ? deepCopyArmor(armor) : null;
  }

  saveArmor(armor: Armor): void {
    this.armor.set(armor.playerId, deepCopyArmor(armor));
  }

  getSession(id: string): Session | null {
    const session = this.sessions.get(id);
    return session ? deepCopySession(session) : null;
  }

  saveSession(session: Session): void {
    this.sessions.set(session.id, deepCopySession(session));
  }

  getSessionByTokenHash(tokenHash: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) {
        return deepCopySession(session);
      }
    }
    return null;
  }

  revokeSession(id: string, at: Date): void {
    const session = this.sessions.get(id);
    if (session) {
      session.revokedAt = at;
      this.sessions.set(id, session);
    }
  }
}

function deepCopyPlayer(player: Player): Player {
  return {
    id: player.id,
    name: player.name,
    credentialHash: player.credentialHash,
    email: player.email,
    activeClass: player.activeClass,
    karma: player.karma,
    sg: player.sg,
    isModerator: player.isModerator,
    isOperator: player.isOperator,
    isActive: player.isActive,
    avatarUrl: player.avatarUrl,
    comment: player.comment,
    registeredAt: new Date(player.registeredAt),
    lastActiveAt: player.lastActiveAt ? new Date(player.lastActiveAt) : null,
    lastStipendAt: player.lastStipendAt ? new Date(player.lastStipendAt) : null
  };
}

function deepCopyClassProgress(progress: ClassProgress): ClassProgress {
  return {
    playerId: progress.playerId,
    playerClass: progress.playerClass,
    level: progress.level,
    experience: progress.experience
  };
}

function deepCopyLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return {
    playerId: entry.playerId,
    resourceKind: entry.resourceKind,
    playerClass: entry.playerClass,
    appliedDelta: entry.appliedDelta,
    balanceAfter: entry.balanceAfter,
    cause: entry.cause,
    placementId: entry.placementId,
    counterpartyId: entry.counterpartyId,
    jobRunId: entry.jobRunId,
    occurredAt: new Date(entry.occurredAt)
  };
}

function deepCopyArmor(armor: Armor): Armor {
  return {
    playerId: armor.playerId,
    isActive: armor.isActive,
    chargesRemaining: armor.chargesRemaining
  };
}

function deepCopySession(session: Session): Session {
  return {
    id: session.id,
    playerId: session.playerId,
    tokenHash: session.tokenHash,
    issuedAt: new Date(session.issuedAt),
    expiresAt: new Date(session.expiresAt),
    revokedAt: session.revokedAt ? new Date(session.revokedAt) : null
  };
}

export class InMemoryPlayerRepository implements IPlayerRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async get(id: PlayerId): Promise<Player | null> {
    return this.db.getPlayer(id);
  }

  async save(player: Player, _tx: Transaction): Promise<void> {
    this.db.savePlayer(player);
  }

  async getByName(name: string): Promise<Player | null> {
    return this.db.getPlayerByName(name);
  }

  async listStipendDue(_now: Date, _activityWindowMs: number, _intervalMs: number): Promise<Player[]> {
    // No consumer in this milestone; deferred on activity rule.
    throw new NotImplemented('InMemoryPlayerRepository.listStipendDue');
  }
}

export class InMemoryClassProgressRepository implements IClassProgressRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async get(playerId: PlayerId, playerClass: PlayerClass): Promise<ClassProgress | null> {
    return this.db.getClassProgress(playerId, playerClass);
  }

  async list(playerId: PlayerId): Promise<ClassProgress[]> {
    return this.db.listClassProgress(playerId);
  }

  async save(progress: ClassProgress, _tx: Transaction): Promise<void> {
    this.db.saveClassProgress(progress);
  }
}

export class InMemoryLedgerRepository implements ILedgerRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async append(entry: LedgerEntry, _tx: Transaction): Promise<void> {
    this.db.appendLedgerEntry(entry);
  }

  async listForPlayer(playerId: PlayerId, limit: number): Promise<LedgerEntry[]> {
    return this.db.listLedgerEntries(playerId, limit);
  }
}

export class InMemoryInventoryRepository implements IInventoryRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async get(playerId: PlayerId): Promise<Inventory> {
    const counts = this.db.getInventory(playerId);
    return { playerId, counts };
  }

  async adjust(playerId: PlayerId, tool: ToolType, delta: number, _tx: Transaction): Promise<void> {
    this.db.adjustInventory(playerId, tool, delta);
  }
}

export class InMemoryArmorRepository implements IArmorRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async get(playerId: PlayerId): Promise<Armor | null> {
    return this.db.getArmor(playerId);
  }

  async save(armor: Armor, _tx: Transaction): Promise<void> {
    this.db.saveArmor(armor);
  }
}

export class InMemorySessionRepository implements ISessionRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async get(id: string): Promise<Session | null> {
    return this.db.getSession(id);
  }

  async save(session: Session, _tx: Transaction): Promise<void> {
    this.db.saveSession(session);
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.db.getSessionByTokenHash(tokenHash);
  }

  async revoke(id: string, at: Date, _tx: Transaction): Promise<void> {
    this.db.revokeSession(id, at);
  }
}

export class InMemoryUnitOfWork implements IUnitOfWork {
  lastActorId: PlayerId | null = null;
  private isRunInFlight = false;

  constructor(private readonly db: InMemoryDatabase) {}

  async run<T>(actorId: PlayerId | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    if (this.isRunInFlight) {
      throw new ConcurrentUnitOfWork();
    }

    this.lastActorId = actorId;
    this.isRunInFlight = true;
    const snapshot = this.db.snapshot();
    const tx: Transaction = { id: generateTransactionId() };
    try {
      return await fn(tx);
    } catch (error) {
      this.db.restore(snapshot);
      throw error;
    } finally {
      this.isRunInFlight = false;
    }
  }
}

let transactionCounter = 0;

function generateTransactionId(): string {
  return `tx_${++transactionCounter}_${Date.now()}`;
}
