import type { GatedAbility, PlayerClass, ToolType } from '../domain/enums.js';
import type { LevelDefinition } from '../domain/progression.js';

export interface AbilityGate {
  readonly playerClass: PlayerClass;
  readonly level: number;
}

export interface IBalanceProvider {
  load(): Promise<IBalanceTable>;
  reload(): Promise<IBalanceTable>;
}

export interface IBalanceTable {
  constant(code: string): number;
  costOf(tool: ToolType, forClass: PlayerClass): number;
  levelGateFor(ability: GatedAbility): AbilityGate;
  trapDamageFor(ageMs: number): number;
  trapFailChance(forClass: PlayerClass): number;
  expertTrapBonus(karma: number, ageMs: number): number;
  spiderXpFor(ageMs: number): number;
  spiderDamageFor(ageMs: number): number;
  barrelXpFor(ageMs: number): number;
  initialXpFor(tool: ToolType): number;
  karmaDeltaFor(tool: ToolType): -1 | 1;
  extremityBonusFor(tool: ToolType, karma: number): number;
  shieldChargesFor(forClass: PlayerClass): number;
  doorwayChargesFor(forClass: PlayerClass, level: number): number;
  doorwayPassThroughLimit(isPlacer: boolean): number;
  doorwayTransportChance(level: number): number;
  forcedDoorwayChance(placerClass: PlayerClass): number;
  branchAllowance(playerClass: PlayerClass, level: number): number;
  barrelCapacityFor(forClass: PlayerClass): number;
  levelDefinition(level: number): LevelDefinition;
  stipendSgFor(level: number, karma: number): number;
  stipendToolFor(
    playerClass: PlayerClass,
    karma: number,
    level: number
  ): { tool: ToolType; quantity: number };
  inventoryCap(highestLevel: number): number;
  pagePlacementCap(): number;
  owningClassOf(tool: ToolType): PlayerClass;
  maxLevel(): number;
}
