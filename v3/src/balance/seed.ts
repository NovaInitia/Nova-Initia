import { PlayerClass, ToolType } from '../domain/enums.js';
import type { GatedAbility } from '../domain/enums.js';
import type { LevelDefinition } from '../domain/progression.js';

const DAY = 86_400_000;

export interface ToolTypeRow {
  readonly id: ToolType;
  readonly code: string;
  readonly owningClass: PlayerClass;
  readonly karmaDelta: -1 | 1;
  readonly isPlaceable: boolean;
  readonly isConsumedOnTrigger: boolean;
  readonly baseCost: number;
  readonly initialXp: number;
}

export interface AbilityGateRow {
  readonly ability: GatedAbility;
  /** null means any class satisfies it. */
  readonly playerClass: PlayerClass | null;
  readonly requiredLevel: number;
}

export type AgeMetric = 'damage_sg' | 'placer_xp' | 'expert_bonus_dmg';

export interface AgeBracketRow {
  readonly toolType: ToolType;
  readonly metric: AgeMetric;
  readonly minAgeMs: number;
  readonly value: number;
}

export interface ClassScalarRow {
  readonly playerClass: PlayerClass;
  readonly metric: string;
  readonly value: number;
}

export interface ClassLevelScalarRow {
  readonly playerClass: PlayerClass;
  readonly metric: string;
  readonly minLevel: number;
  readonly value: number;
}

export interface BalanceSet {
  readonly toolTypes: readonly ToolTypeRow[];
  readonly levels: readonly LevelDefinition[];
  readonly abilityGates: readonly AbilityGateRow[];
  readonly ageBrackets: readonly AgeBracketRow[];
  readonly classScalars: readonly ClassScalarRow[];
  readonly classLevelScalars: readonly ClassLevelScalarRow[];
  readonly constants: Readonly<Record<string, number>>;
}

const toolTypes: ToolTypeRow[] = [
  { id: ToolType.Trap,     code: 'trap',     owningClass: PlayerClass.Giver,    karmaDelta: -1, isPlaceable: true,  isConsumedOnTrigger: true,  baseCost: 1, initialXp: 5 },
  { id: ToolType.Barrel,   code: 'barrel',   owningClass: PlayerClass.Giver,    karmaDelta:  1, isPlaceable: true,  isConsumedOnTrigger: false, baseCost: 1, initialXp: 5 },
  { id: ToolType.Spider,   code: 'spider',   owningClass: PlayerClass.Guardian, karmaDelta: -1, isPlaceable: true,  isConsumedOnTrigger: true,  baseCost: 1, initialXp: 5 },
  { id: ToolType.Shield,   code: 'shield',   owningClass: PlayerClass.Guardian, karmaDelta:  1, isPlaceable: false, isConsumedOnTrigger: false, baseCost: 1, initialXp: 0 },
  { id: ToolType.Doorway,  code: 'doorway',  owningClass: PlayerClass.Guide,    karmaDelta: -1, isPlaceable: true,  isConsumedOnTrigger: false, baseCost: 1, initialXp: 10 },
  { id: ToolType.Signpost, code: 'signpost', owningClass: PlayerClass.Guide,    karmaDelta:  1, isPlaceable: true,  isConsumedOnTrigger: false, baseCost: 1, initialXp: 10 }
];

const levels: LevelDefinition[] = [
  { level: 1,  name: 'Novice',      experienceThreshold: 0,     sgCost: 0,     stipendSg: 140,  toolAllowance: 10 },
  { level: 2,  name: 'Novice',      experienceThreshold: 630,   sgCost: 120,   stipendSg: 165,  toolAllowance: 12 },
  { level: 3,  name: 'Novice',      experienceThreshold: 945,   sgCost: 180,   stipendSg: 190,  toolAllowance: 14 },
  { level: 4,  name: 'Novice',      experienceThreshold: 1323,  sgCost: 252,   stipendSg: 220,  toolAllowance: 16 },
  { level: 5,  name: 'Apprentice',  experienceThreshold: 1764,  sgCost: 336,   stipendSg: 250,  toolAllowance: 18 },
  { level: 6,  name: 'Apprentice',  experienceThreshold: 2268,  sgCost: 432,   stipendSg: 275,  toolAllowance: 20 },
  { level: 7,  name: 'Apprentice',  experienceThreshold: 2835,  sgCost: 540,   stipendSg: 300,  toolAllowance: 22 },
  { level: 8,  name: 'Apprentice',  experienceThreshold: 3465,  sgCost: 660,   stipendSg: 330,  toolAllowance: 24 },
  { level: 9,  name: 'Apprentice',  experienceThreshold: 4158,  sgCost: 792,   stipendSg: 355,  toolAllowance: 26 },
  { level: 10, name: 'Experienced', experienceThreshold: 4914,  sgCost: 936,   stipendSg: 385,  toolAllowance: 28 },
  { level: 11, name: 'Experienced', experienceThreshold: 5733,  sgCost: 1092,  stipendSg: 410,  toolAllowance: 30 },
  { level: 12, name: 'Experienced', experienceThreshold: 6615,  sgCost: 1260,  stipendSg: 440,  toolAllowance: 32 },
  { level: 13, name: 'Experienced', experienceThreshold: 7560,  sgCost: 1440,  stipendSg: 465,  toolAllowance: 34 },
  { level: 14, name: 'Experienced', experienceThreshold: 8568,  sgCost: 1632,  stipendSg: 495,  toolAllowance: 36 },
  { level: 15, name: 'Master',      experienceThreshold: 9639,  sgCost: 1836,  stipendSg: 520,  toolAllowance: 38 },
  { level: 16, name: 'Master',      experienceThreshold: 10773, sgCost: 2052,  stipendSg: 550,  toolAllowance: 40 },
  { level: 17, name: 'Master',      experienceThreshold: 11970, sgCost: 2280,  stipendSg: 575,  toolAllowance: 42 },
  { level: 18, name: 'Master',      experienceThreshold: 13230, sgCost: 2520,  stipendSg: 600,  toolAllowance: 44 },
  { level: 19, name: 'Master',      experienceThreshold: 14553, sgCost: 2772,  stipendSg: 630,  toolAllowance: 46 },
  { level: 20, name: 'Legendary',   experienceThreshold: 15939, sgCost: 3036,  stipendSg: 685,  toolAllowance: 50 },
  { level: 21, name: 'Legendary',   experienceThreshold: 24413, sgCost: 4650,  stipendSg: 820,  toolAllowance: 60 },
  { level: 22, name: 'Legendary',   experienceThreshold: 38273, sgCost: 7290,  stipendSg: 955,  toolAllowance: 70 },
  { level: 23, name: 'Legendary',   experienceThreshold: 55676, sgCost: 10605, stipendSg: 1095, toolAllowance: 80 },
  { level: 24, name: 'Legendary',   experienceThreshold: 76230, sgCost: 14520, stipendSg: 1230, toolAllowance: 90 },
  { level: 25, name: 'Taco',        experienceThreshold: 99934, sgCost: 19035, stipendSg: 1365, toolAllowance: 100 }
];

const abilityGates: AbilityGateRow[] = [
  { ability: 'anonymous_trap',         playerClass: PlayerClass.Giver,    requiredLevel: 10 },
  { ability: 'barrel_outside_message', playerClass: PlayerClass.Giver,    requiredLevel: 5 },
  { ability: 'barrel_stash_sg',        playerClass: PlayerClass.Giver,    requiredLevel: 1 },
  { ability: 'loot_own_barrel',        playerClass: PlayerClass.Giver,    requiredLevel: 15 },
  { ability: 'wandering_spider',       playerClass: PlayerClass.Guardian, requiredLevel: 15 },
  { ability: 'anti_signpost_spider',   playerClass: PlayerClass.Guardian, requiredLevel: 10 },
  { ability: 'chain_own_doorway',      playerClass: PlayerClass.Guide,    requiredLevel: 0 },
  { ability: 'barrel_inside_message',  playerClass: null,                 requiredLevel: 1 }
];

const ageBrackets: AgeBracketRow[] = [
  { toolType: ToolType.Trap, metric: 'damage_sg', minAgeMs: 0,         value: 10 },
  { toolType: ToolType.Trap, metric: 'damage_sg', minAgeMs: 7 * DAY,   value: 15 },
  { toolType: ToolType.Trap, metric: 'damage_sg', minAgeMs: 30 * DAY,  value: 15 },
  { toolType: ToolType.Trap, metric: 'damage_sg', minAgeMs: 90 * DAY,  value: 25 },
  { toolType: ToolType.Trap, metric: 'damage_sg', minAgeMs: 150 * DAY, value: 50 },

  { toolType: ToolType.Trap, metric: 'expert_bonus_dmg', minAgeMs: 0,        value: 5 },
  { toolType: ToolType.Trap, metric: 'expert_bonus_dmg', minAgeMs: 90 * DAY, value: 10 },

  { toolType: ToolType.Trap, metric: 'placer_xp', minAgeMs: 0, value: 5 },

  { toolType: ToolType.Spider, metric: 'damage_sg', minAgeMs: 0, value: 10 },

  { toolType: ToolType.Spider, metric: 'placer_xp', minAgeMs: 0,         value: 5 },
  { toolType: ToolType.Spider, metric: 'placer_xp', minAgeMs: 7 * DAY,   value: 10 },
  { toolType: ToolType.Spider, metric: 'placer_xp', minAgeMs: 30 * DAY,  value: 15 },
  { toolType: ToolType.Spider, metric: 'placer_xp', minAgeMs: 90 * DAY,  value: 25 },
  { toolType: ToolType.Spider, metric: 'placer_xp', minAgeMs: 150 * DAY, value: 50 },

  { toolType: ToolType.Barrel, metric: 'placer_xp', minAgeMs: 0,         value: 5 },
  { toolType: ToolType.Barrel, metric: 'placer_xp', minAgeMs: 7 * DAY,   value: 10 },
  { toolType: ToolType.Barrel, metric: 'placer_xp', minAgeMs: 30 * DAY,  value: 10 },
  { toolType: ToolType.Barrel, metric: 'placer_xp', minAgeMs: 90 * DAY,  value: 25 },
  { toolType: ToolType.Barrel, metric: 'placer_xp', minAgeMs: 150 * DAY, value: 50 }
];

const classScalars: ClassScalarRow[] = [
  { playerClass: PlayerClass.Giver,    metric: 'shield_max_hits', value: 1 },
  { playerClass: PlayerClass.Guardian, metric: 'shield_max_hits', value: 3 },
  { playerClass: PlayerClass.Guide,    metric: 'shield_max_hits', value: 1 },

  { playerClass: PlayerClass.Giver,    metric: 'barrel_tool_capacity', value: 100 },
  { playerClass: PlayerClass.Guardian, metric: 'barrel_tool_capacity', value: 10 },
  { playerClass: PlayerClass.Guide,    metric: 'barrel_tool_capacity', value: 10 },

  { playerClass: PlayerClass.Giver,    metric: 'forced_doorway_chance', value: 0.01 },
  { playerClass: PlayerClass.Guardian, metric: 'forced_doorway_chance', value: 0.01 },
  { playerClass: PlayerClass.Guide,    metric: 'forced_doorway_chance', value: 0.03 },

  { playerClass: PlayerClass.Giver,    metric: 'trap_fail_chance', value: 0.05 },
  { playerClass: PlayerClass.Guardian, metric: 'trap_fail_chance', value: 0.05 },
  { playerClass: PlayerClass.Guide,    metric: 'trap_fail_chance', value: 0.05 }
];

const classLevelScalars: ClassLevelScalarRow[] = [
  { playerClass: PlayerClass.Giver,    metric: 'signpost_branches', minLevel: 0,  value: 2 },
  { playerClass: PlayerClass.Guardian, metric: 'signpost_branches', minLevel: 0,  value: 2 },
  { playerClass: PlayerClass.Guide,    metric: 'signpost_branches', minLevel: 0,  value: 1 },
  { playerClass: PlayerClass.Guide,    metric: 'signpost_branches', minLevel: 8,  value: 2 },
  { playerClass: PlayerClass.Guide,    metric: 'signpost_branches', minLevel: 12, value: 3 },
  { playerClass: PlayerClass.Guide,    metric: 'signpost_branches', minLevel: 20, value: 4 },

  { playerClass: PlayerClass.Giver,    metric: 'doorway_charges', minLevel: 0,  value: 50 },
  { playerClass: PlayerClass.Guardian, metric: 'doorway_charges', minLevel: 0,  value: 50 },
  { playerClass: PlayerClass.Guide,    metric: 'doorway_charges', minLevel: 0,  value: 50 },
  { playerClass: PlayerClass.Guide,    metric: 'doorway_charges', minLevel: 15, value: 100 }
];

const constants: Record<string, number> = {
  karma_min: 0,
  karma_max: 100,
  karma_step: 1,
  karma_neutral: 50,

  stipend_floor_fraction: 0.25,
  stipend_activity_window_ms: 3_600_000,
  stipend_interval_ms: 3_600_000,

  extremity_karma_low: 5,
  extremity_karma_high: 95,
  extremity_bonus_xp: 5,

  expert_trap_karma_max: 95,

  out_of_class_cost_multiplier: 3,
  inventory_cap_per_level: 250,
  page_placement_cap: 250,

  barrel_visit_limit: 3,
  barrel_inside_message_max: 155,
  barrel_outside_message_max: 128,

  doorway_transport_base: 0.08,
  doorway_transport_per_level: 0.002,
  doorway_pass_through_limit: 1,
  doorway_owner_pass_through_limit: 3,

  starting_sg: 20,
  starting_karma: 50,
  starting_tools_in_class: 10,
  starting_tools_other: 5
};

export const SEED_BALANCE: BalanceSet = {
  toolTypes,
  levels,
  abilityGates,
  ageBrackets,
  classScalars,
  classLevelScalars,
  constants
};
