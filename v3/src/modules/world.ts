import { NotImplemented } from '../domain/errors.js';
import { GeographyModule } from './geography.js';
import type { IUnitOfWork } from '../contracts/unitOfWork.js';
import type { IGenericPlacementRepository } from '../contracts/repositories.js';
import type { Placement } from '../domain/placement.js';

export class WorldModule {
  constructor(
    private readonly placements: IGenericPlacementRepository,
    private readonly geography: GeographyModule,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async moveWanderingSpiders(now: Date): Promise<number> {
    await this.unitOfWork.run(null, async (tx) => {
      await this.geography.listPagesInDomain({} as never, {} as never);
      await this.placements.save({} as Placement, tx);
    });
    void now;
    throw new NotImplemented('WorldModule.moveWanderingSpiders');
  }
}
