import type { Transaction } from '../contracts/unitOfWork.js';
import type { IConsumption } from '../contracts/consumption.js';
import type { IGenericPlacementRepository, IInventoryRepository } from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { ConsumptionCause, ToolType } from '../domain/enums.js';
import type { IPlaced } from '../domain/placement.js';

export class Consumption implements IConsumption {
  constructor(
    private readonly placements: IGenericPlacementRepository,
    private readonly inventory: IInventoryRepository
  ) {}

  async consumeFromInventory(
    tx: Transaction,
    playerId: PlayerId,
    tool: ToolType,
    quantity: number,
    cause: ConsumptionCause
  ): Promise<void> {
    await this.inventory.adjust(playerId, tool, -quantity, tx);
  }

  async consumePlacement(
    tx: Transaction,
    placement: IPlaced,
    cause: ConsumptionCause
  ): Promise<void> {
    await this.placements.markConsumed(placement.id, cause, new Date(), tx);
  }
}
