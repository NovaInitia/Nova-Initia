import { NotImplemented } from '../domain/errors.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type {
  IDomainRepository,
  INormalisationVersionRepository,
  IPageRepository,
  IPresenceRepository
} from '../contracts/repositories.js';
import type { DomainId, PageId, PlayerId } from '../domain/ids.js';
import type { Page, PageCoordinates, Presence } from '../domain/geography.js';
import type { Player } from '../domain/player.js';

export class GeographyModule {
  constructor(
    private readonly pages: IPageRepository,
    private readonly domains: IDomainRepository,
    private readonly presence: IPresenceRepository,
    private readonly versions: INormalisationVersionRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async resolvePage(coordinates: PageCoordinates): Promise<Page> {
    await this.versions.isAcceptable(coordinates.normalisationVersion);
    await this.domains.getByHash(
      coordinates.domainHash,
      coordinates.normalisationVersion
    );
    await this.pages.getByHash(
      coordinates.urlHash,
      coordinates.normalisationVersion
    );
    await this.unitOfWork.run(null, async (tx) => {
      await this.domains.save({} as never, tx);
      await this.pages.save({} as Page, tx);
    });
    throw new NotImplemented('GeographyModule.resolvePage');
  }

  async enter(actor: Player, page: Page): Promise<void> {
    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.presence.save({} as Presence, tx);
    });
    void page;
    throw new NotImplemented('GeographyModule.enter');
  }

  async leave(actor: Player): Promise<void> {
    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.presence.remove(actor.id, tx);
    });
    throw new NotImplemented('GeographyModule.leave');
  }

  async listOccupants(pageId: PageId): Promise<Presence[]> {
    await this.presence.listOnPage(pageId);
    throw new NotImplemented('GeographyModule.listOccupants');
  }

  async expireStalePresence(olderThan: Date): Promise<number> {
    await this.unitOfWork.run(null, async (tx) => {
      await this.presence.removeStale(olderThan, tx);
    });
    throw new NotImplemented('GeographyModule.expireStalePresence');
  }

  async listPagesInDomain(domainId: DomainId, excluding: PageId): Promise<Page[]> {
    await this.pages.listInDomain(domainId, excluding);
    throw new NotImplemented('GeographyModule.listPagesInDomain');
  }

  async touch(playerId: PlayerId, at: Date): Promise<void> {
    await this.presence.get(playerId);
    void at;
    throw new NotImplemented('GeographyModule.touch');
  }
}
