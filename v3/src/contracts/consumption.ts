import type { Transaction } from './unitOfWork.js';
import type { PlayerId } from '../domain/ids.js';
import type { ConsumptionCause, ToolType } from '../domain/enums.js';
import type { IPlaced } from '../domain/placement.js';

export interface IConsumption {
  consumePlacement(
    tx: Transaction,
    placement: IPlaced,
    cause: ConsumptionCause
  ): Promise<void>;

  consumeFromInventory(
    tx: Transaction,
    playerId: PlayerId,
    tool: ToolType,
    quantity: number,
    cause: ConsumptionCause
  ): Promise<void>;
}
