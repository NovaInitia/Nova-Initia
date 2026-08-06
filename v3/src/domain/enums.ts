export const PlayerClass = {
  Giver: 1,
  Guardian: 2,
  Guide: 3
} as const;

export type PlayerClass = (typeof PlayerClass)[keyof typeof PlayerClass];

export const ToolType = {
  Trap: 0,
  Barrel: 1,
  Spider: 2,
  Shield: 3,
  Doorway: 4,
  Signpost: 5
} as const;

export type ToolType = (typeof ToolType)[keyof typeof ToolType];

export const PLACEABLE_TOOL_TYPES = [
  ToolType.Trap,
  ToolType.Barrel,
  ToolType.Spider,
  ToolType.Doorway,
  ToolType.Signpost
] as const;

export type PlaceableToolType = (typeof PLACEABLE_TOOL_TYPES)[number];

export type SpiderVariant = 'standard' | 'wandering' | 'anti_signpost';

export type ConsumptionCause =
  | 'triggered'
  | 'exhausted'
  | 'depleted'
  | 'looted'
  | 'placement_failed';

export type ResourceKind = 'sg' | 'xp' | 'karma';

export type LedgerCause =
  | 'registration'
  | 'purchase'
  | 'stipend'
  | 'level_up'
  | 'trap_damage'
  | 'spider_damage'
  | 'barrel_loot'
  | 'barrel_stash'
  | 'tour_completion'
  | 'tour_owner_reward'
  | 'placement_reward'
  | 'trigger_reward'
  | 'tool_use';

export type GatedAbility =
  | 'anonymous_trap'
  | 'barrel_outside_message'
  | 'barrel_inside_message'
  | 'barrel_stash_sg'
  | 'loot_own_barrel'
  | 'wandering_spider'
  | 'anti_signpost_spider'
  | 'chain_own_doorway';

export type JobName = 'stipend' | 'spider_movement' | 'presence_expiry';

export type JobOutcome = 'running' | 'completed' | 'skipped' | 'failed';
