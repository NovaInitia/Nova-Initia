import { NotImplemented } from '../domain/errors.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type {
  IArmorRepository,
  IClassProgressRepository,
  IInventoryRepository,
  IPlayerRepository,
  ISessionRepository
} from '../contracts/repositories.js';
import type { IBalanceTable } from '../contracts/balance.js';
import type { PlayerClass } from '../domain/enums.js';
import type { Player, PublicProfile, Session } from '../domain/player.js';
import type { PlayerId } from '../domain/ids.js';

export class IdentityModule {
  constructor(
    private readonly players: IPlayerRepository,
    private readonly sessions: ISessionRepository,
    private readonly inventory: IInventoryRepository,
    private readonly armor: IArmorRepository,
    private readonly progress: IClassProgressRepository,
    private readonly balance: IBalanceTable,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async register(
    name: string,
    credential: string,
    email: string,
    chosenClass: PlayerClass
  ): Promise<{ player: Player; session: Session }> {
    await this.players.getByName(name);
    await this.unitOfWork.run(null, async (tx) => {
      await this.players.save({} as Player, tx);
      await this.armor.save({} as never, tx);
      await this.inventory.adjust({} as PlayerId, 0, 0, tx);
      await this.progress.save({} as never, tx);
      await this.sessions.save({} as Session, tx);
    });
    void credential;
    void email;
    void chosenClass;
    this.balance.levelDefinition(1);
    throw new NotImplemented('IdentityModule.register');
  }

  async authenticate(name: string, credential: string): Promise<Session> {
    await this.players.getByName(name);
    await this.unitOfWork.run(null, async (tx) => {
      await this.sessions.save({} as Session, tx);
    });
    void credential;
    throw new NotImplemented('IdentityModule.authenticate');
  }

  async resolveSession(token: string): Promise<Player | null> {
    const session = await this.sessions.getByTokenHash(token);
    if (session) {
      await this.players.get(session.playerId);
    }
    throw new NotImplemented('IdentityModule.resolveSession');
  }

  async revokeSession(actor: Player, sessionId: string): Promise<void> {
    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.sessions.revoke(sessionId, new Date(), tx);
    });
    throw new NotImplemented('IdentityModule.revokeSession');
  }

  async getPublicProfile(playerId: PlayerId): Promise<PublicProfile | null> {
    await this.players.get(playerId);
    await this.progress.list(playerId);
    throw new NotImplemented('IdentityModule.getPublicProfile');
  }
}
