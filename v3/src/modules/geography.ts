import { randomUUID } from 'node:crypto';
import { UnknownNormalisationVersion } from '../domain/errors.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type {
  IDomainRepository,
  INormalisationVersionRepository,
  IPageRepository,
  IPresenceRepository
} from '../contracts/repositories.js';
import type { DomainId, PageId, PlayerId } from '../domain/ids.js';
import type { Page, PageCoordinates, Presence, WebDomain } from '../domain/geography.js';
import type { Player } from '../domain/player.js';
import { transactionContext } from '../repositories/PgUnitOfWork.js';

export class GeographyModule {
  constructor(
    private readonly pages: IPageRepository,
    private readonly domains: IDomainRepository,
    private readonly presence: IPresenceRepository,
    private readonly versions: INormalisationVersionRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async resolvePage(coordinates: PageCoordinates): Promise<Page> {
    // Version gating first
    const versionAcceptable = await this.versions.isAcceptable(
      coordinates.normalisationVersion
    );
    if (!versionAcceptable) {
      throw new UnknownNormalisationVersion(coordinates.normalisationVersion);
    }

    // Resolve domain: SELECT, INSERT...DO NOTHING, SELECT if needed
    let domain = await this.domains.getByHash(
      coordinates.domainHash,
      coordinates.normalisationVersion
    );

    if (!domain) {
      domain = await this.unitOfWork.run(null, async (tx) => {
        const newDomain: WebDomain = {
          id: randomUUID() as DomainId,
          domainHash: coordinates.domainHash,
          normalisationVersion: coordinates.normalisationVersion,
          uri: null,
          hitCount: 0,
          firstSeenAt: new Date()
        };

        await this.domains.save(newDomain, tx);

        // If another transaction beat us, get their domain
        const existing = await this.domains.getByHash(
          coordinates.domainHash,
          coordinates.normalisationVersion
        );
        return existing || newDomain;
      });
    }

    // Resolve page: SELECT, INSERT...DO NOTHING, SELECT if needed
    let page = await this.pages.getByHash(
      coordinates.urlHash,
      coordinates.normalisationVersion
    );

    if (!page) {
      page = await this.unitOfWork.run(null, async (tx) => {
        const newPage: Page = {
          id: randomUUID() as PageId,
          urlHash: coordinates.urlHash,
          domainId: domain.id,
          normalisationVersion: coordinates.normalisationVersion,
          firstSeenAt: new Date()
        };

        await this.pages.save(newPage, tx);

        // If another transaction beat us, get their page
        const existing = await this.pages.getByHash(
          coordinates.urlHash,
          coordinates.normalisationVersion
        );
        return existing || newPage;
      });
    }

    return page;
  }

  async enter(actor: Player, page: Page): Promise<void> {
    const now = new Date();

    await this.unitOfWork.run(actor.id, async (tx) => {
      // Upsert presence with conditional arrived_at update
      const presence: Presence = {
        playerId: actor.id,
        pageId: page.id,
        arrivedAt: now,
        lastSeenAt: now
      };

      await this.presence.save(presence, tx);

      // Increment domain hit count
      const transaction = transactionContext.getStore();
      if (transaction) {
        await transaction.client.query(
          `UPDATE domain SET hit_count = hit_count + 1
           WHERE id = (SELECT domain_id FROM page WHERE id = $1)`,
          [page.id]
        );
      }
    });
  }

  async leave(actor: Player): Promise<void> {
    await this.unitOfWork.run(actor.id, async (tx) => {
      await this.presence.remove(actor.id, tx);
    });
  }

  async listOccupants(pageId: PageId): Promise<Presence[]> {
    return this.presence.listOnPage(pageId);
  }

  async expireStalePresence(olderThan: Date): Promise<number> {
    return this.unitOfWork.run(null, async (tx) => {
      return this.presence.removeStale(olderThan, tx);
    });
  }

  async listPagesInDomain(domainId: DomainId, excluding: PageId): Promise<Page[]> {
    return this.pages.listInDomain(domainId, excluding);
  }

  async touch(playerId: PlayerId, at: Date): Promise<void> {
    const presence = await this.presence.get(playerId);

    // No-op if player has no presence
    if (!presence) {
      return;
    }

    await this.unitOfWork.run(playerId, async (tx) => {
      const updated: Presence = {
        ...presence,
        lastSeenAt: at
      };
      await this.presence.save(updated, tx);
    });
  }
}
