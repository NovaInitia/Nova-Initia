import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import {
  InvalidRegistration,
  NameTaken,
  AuthenticationFailed,
  SessionNotOwned
} from '../domain/errors.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type {
  IArmorRepository,
  IClassProgressRepository,
  IInventoryRepository,
  IPlayerRepository,
  ISessionRepository,
  ILedgerRepository
} from '../contracts/repositories.js';
import type { IBalanceTable } from '../contracts/balance.js';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { Player, PublicProfile, Session } from '../domain/player.js';
import type { PlayerId, SessionId } from '../domain/ids.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256Hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    }, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
}

async function hashCredential(credential: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(credential, salt);
  return `scrypt$32768$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyCredential(credential: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const saltB64 = parts[4];
  const hashB64 = parts[5];

  const salt = Buffer.from(saltB64, 'base64');
  const storedHash = Buffer.from(hashB64, 'base64');

  const hash = await scryptAsync(credential, salt);

  if (hash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(hash, storedHash);
}

let dummyHashPromise: Promise<string> | null = null;

async function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashCredential('dummy');
  }
  return dummyHashPromise;
}

export class IdentityModule {
  constructor(
    private readonly players: IPlayerRepository,
    private readonly sessions: ISessionRepository,
    private readonly inventory: IInventoryRepository,
    private readonly armor: IArmorRepository,
    private readonly progress: IClassProgressRepository,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork,
    private readonly ledger: ILedgerRepository
  ) {}

  async register(
    name: string,
    credential: string,
    email: string,
    chosenClass: PlayerClass
  ): Promise<{ player: Player; session: Session; token: string }> {
    const trimmedName = name.trim();

    if (trimmedName.length < 3 || trimmedName.length > 32) {
      throw new InvalidRegistration('name');
    }

    if (!/^[A-Za-z0-9_-]+$/.test(trimmedName)) {
      throw new InvalidRegistration('name');
    }

    if (credential.length < 8) {
      throw new InvalidRegistration('credential');
    }

    if (!email || !email.includes('@')) {
      throw new InvalidRegistration('email');
    }

    if (chosenClass !== PlayerClass.Giver && chosenClass !== PlayerClass.Guardian && chosenClass !== PlayerClass.Guide) {
      throw new InvalidRegistration('chosenClass');
    }

    const existing = await this.players.getByName(trimmedName);
    if (existing) {
      throw new NameTaken();
    }

    let player: Player;
    let session: Session;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256Hash(token);

    await this.unitOfWork.run(null, async (tx) => {
      const playerId = randomUUID() as PlayerId;
      const now = new Date();
      const credentialHash = await hashCredential(credential);

      player = {
        id: playerId,
        name: trimmedName,
        credentialHash,
        email,
        activeClass: chosenClass,
        karma: this.balance.constant('starting_karma'),
        sg: this.balance.constant('starting_sg'),
        isModerator: false,
        isOperator: false,
        isActive: true,
        avatarUrl: null,
        comment: null,
        registeredAt: now,
        lastActiveAt: null,
        lastStipendAt: null
      };

      await this.players.save(player, tx);

      const startingSg = this.balance.constant('starting_sg');
      const startingKarma = this.balance.constant('starting_karma');

      await this.ledger.append(
        {
          playerId,
          resourceKind: 'sg',
          playerClass: null,
          appliedDelta: startingSg,
          balanceAfter: startingSg,
          cause: 'registration',
          placementId: null,
          counterpartyId: null,
          jobRunId: null,
          occurredAt: now
        },
        tx
      );

      await this.ledger.append(
        {
          playerId,
          resourceKind: 'karma',
          playerClass: null,
          appliedDelta: startingKarma,
          balanceAfter: startingKarma,
          cause: 'registration',
          placementId: null,
          counterpartyId: null,
          jobRunId: null,
          occurredAt: now
        },
        tx
      );

      for (const pc of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
        await this.progress.save(
          {
            playerId,
            playerClass: pc,
            level: 1,
            experience: 0
          },
          tx
        );
      }

      for (const tool of [
        ToolType.Trap,
        ToolType.Barrel,
        ToolType.Spider,
        ToolType.Shield,
        ToolType.Doorway,
        ToolType.Signpost
      ]) {
        const qty =
          this.balance.owningClassOf(tool) === chosenClass
            ? this.balance.constant('starting_tools_in_class')
            : this.balance.constant('starting_tools_other');
        await this.inventory.adjust(playerId, tool, qty, tx);
      }

      await this.armor.save(
        {
          playerId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const sessionId = randomUUID() as SessionId;
      const issuedAt = now;
      const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);

      session = {
        id: sessionId,
        playerId,
        tokenHash,
        issuedAt,
        expiresAt,
        revokedAt: null
      };

      await this.sessions.save(session, tx);
    });

    return { player: player!, session: session!, token };
  }

  async authenticate(name: string, credential: string): Promise<{ session: Session; token: string }> {
    const player = await this.players.getByName(name);

    let isValid = false;
    if (!player) {
      const dummyHash = await getDummyHash();
      await verifyCredential(credential, dummyHash);
    } else {
      isValid = await verifyCredential(credential, player.credentialHash);
    }

    if (!player || !isValid || !player.isActive) {
      throw new AuthenticationFailed();
    }

    let session: Session;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256Hash(token);

    await this.unitOfWork.run(player.id, async (tx) => {
      const sessionId = randomUUID() as SessionId;
      const now = new Date();
      const issuedAt = now;
      const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);

      session = {
        id: sessionId,
        playerId: player.id,
        tokenHash,
        issuedAt,
        expiresAt,
        revokedAt: null
      };

      await this.sessions.save(session, tx);
    });

    return { session: session!, token };
  }

  async resolveSession(token: string): Promise<Player | null> {
    const tokenHash = sha256Hash(token);
    const session = await this.sessions.getByTokenHash(tokenHash);

    if (!session || session.revokedAt !== null || new Date() > session.expiresAt) {
      return null;
    }

    const player = await this.players.get(session.playerId);

    if (!player || !player.isActive) {
      return null;
    }

    return player;
  }

  async revokeSession(actor: Player, sessionId: string): Promise<void> {
    const session = await this.sessions.get(sessionId);

    if (!session || session.playerId !== actor.id) {
      throw new SessionNotOwned();
    }

    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.sessions.revoke(sessionId, new Date(), tx);
    });
  }

  async getPublicProfile(playerId: PlayerId): Promise<PublicProfile | null> {
    const player = await this.players.get(playerId);

    if (!player || !player.isActive) {
      return null;
    }

    const progressList = await this.progress.list(playerId);
    const levels = new Map<PlayerClass, number>();

    for (const progress of progressList) {
      levels.set(progress.playerClass, progress.level);
    }

    return {
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      activeClass: player.activeClass,
      levels,
      registeredAt: player.registeredAt,
      comment: player.comment
    };
  }
}
