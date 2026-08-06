import { PlayerClass, ToolType } from '../domain/enums.js';
import type { GatedAbility } from '../domain/enums.js';
import type { LevelDefinition } from '../domain/progression.js';
import type { AbilityGate, IBalanceTable } from '../contracts/balance.js';
import type { AgeMetric, BalanceSet } from './seed.js';

export class UnknownBalanceValue extends Error {
  constructor(what: string) {
    super(`No balance value for ${what}`);
    this.name = 'UnknownBalanceValue';
  }
}

export class StaticBalanceTable implements IBalanceTable {
  private readonly tools: Map<ToolType, BalanceSet['toolTypes'][number]>;
  private readonly levels: Map<number, LevelDefinition>;
  private readonly gates: Map<string, AbilityGate>;
  private readonly brackets: Map<string, { minAgeMs: number; value: number }[]>;
  private readonly classScalars: Map<string, number>;
  private readonly classLevelScalars: Map<string, { minLevel: number; value: number }[]>;
  private readonly constants: Readonly<Record<string, number>>;

  constructor(set: BalanceSet) {
    this.tools = new Map(set.toolTypes.map((t) => [t.id, t]));
    this.levels = new Map(set.levels.map((l) => [l.level, l]));
    this.constants = set.constants;

    this.gates = new Map(
      set.abilityGates.map((g) => [
        g.ability,
        { playerClass: g.playerClass as PlayerClass, level: g.requiredLevel }
      ])
    );

    this.brackets = new Map();
    for (const b of set.ageBrackets) {
      const key = `${b.toolType}:${b.metric}`;
      const list = this.brackets.get(key) ?? [];
      list.push({ minAgeMs: b.minAgeMs, value: b.value });
      this.brackets.set(key, list);
    }
    for (const list of this.brackets.values()) list.sort((a, b) => a.minAgeMs - b.minAgeMs);

    this.classScalars = new Map(
      set.classScalars.map((s) => [`${s.playerClass}:${s.metric}`, s.value])
    );

    this.classLevelScalars = new Map();
    for (const s of set.classLevelScalars) {
      const key = `${s.playerClass}:${s.metric}`;
      const list = this.classLevelScalars.get(key) ?? [];
      list.push({ minLevel: s.minLevel, value: s.value });
      this.classLevelScalars.set(key, list);
    }
    for (const list of this.classLevelScalars.values()) list.sort((a, b) => a.minLevel - b.minLevel);
  }

  constant(code: string): number {
    const v = this.constants[code];
    if (v === undefined) throw new UnknownBalanceValue(`constant ${code}`);
    return v;
  }

  private tool(t: ToolType) {
    const row = this.tools.get(t);
    if (!row) throw new UnknownBalanceValue(`tool type ${t}`);
    return row;
  }

  /** Highest band whose threshold the value has reached. */
  private band<T extends { value: number }>(list: T[] | undefined, at: (r: T) => number, v: number, what: string): number {
    if (!list || list.length === 0) throw new UnknownBalanceValue(what);
    let found: T | undefined;
    for (const row of list) {
      if (v >= at(row)) found = row;
      else break;
    }
    if (!found) throw new UnknownBalanceValue(`${what} below the lowest band`);
    return found.value;
  }

  private ageBand(tool: ToolType, metric: AgeMetric, ageMs: number): number {
    return this.band(
      this.brackets.get(`${tool}:${metric}`),
      (r) => r.minAgeMs,
      Math.max(0, ageMs),
      `${metric} for tool ${tool}`
    );
  }

  costOf(tool: ToolType, forClass: PlayerClass): number {
    const row = this.tool(tool);
    const multiplier =
      row.owningClass === forClass ? 1 : this.constant('out_of_class_cost_multiplier');
    return row.baseCost * multiplier;
  }

  levelGateFor(ability: GatedAbility): AbilityGate {
    const gate = this.gates.get(ability);
    if (!gate) throw new UnknownBalanceValue(`ability gate ${ability}`);
    return gate;
  }

  trapDamageFor(ageMs: number): number {
    return this.ageBand(ToolType.Trap, 'damage_sg', ageMs);
  }

  trapFailChance(forClass: PlayerClass): number {
    return this.classScalar(forClass, 'trap_fail_chance');
  }

  expertTrapBonus(karma: number, ageMs: number): number {
    if (karma > this.constant('expert_trap_karma_max')) return 0;
    return this.ageBand(ToolType.Trap, 'expert_bonus_dmg', ageMs);
  }

  spiderXpFor(ageMs: number): number {
    return this.ageBand(ToolType.Spider, 'placer_xp', ageMs);
  }

  spiderDamageFor(ageMs: number): number {
    return this.ageBand(ToolType.Spider, 'damage_sg', ageMs);
  }

  barrelXpFor(ageMs: number): number {
    return this.ageBand(ToolType.Barrel, 'placer_xp', ageMs);
  }

  initialXpFor(tool: ToolType): number {
    return this.tool(tool).initialXp;
  }

  karmaDeltaFor(tool: ToolType): -1 | 1 {
    return this.tool(tool).karmaDelta;
  }

  /** Doubles a tool's XP when its owner sits at the pole that tool pulls toward. */
  extremityBonusFor(tool: ToolType, karma: number): number {
    const row = this.tool(tool);
    const low = this.constant('extremity_karma_low');
    const high = this.constant('extremity_karma_high');
    const qualifies = row.karmaDelta === -1 ? karma < low : karma > high;
    return qualifies ? this.constant('extremity_bonus_xp') : 0;
  }

  private classScalar(forClass: PlayerClass, metric: string): number {
    const v = this.classScalars.get(`${forClass}:${metric}`);
    if (v === undefined) throw new UnknownBalanceValue(`${metric} for class ${forClass}`);
    return v;
  }

  shieldChargesFor(forClass: PlayerClass): number {
    return this.classScalar(forClass, 'shield_max_hits');
  }

  barrelCapacityFor(forClass: PlayerClass): number {
    return this.classScalar(forClass, 'barrel_tool_capacity');
  }

  forcedDoorwayChance(placerClass: PlayerClass): number {
    return this.classScalar(placerClass, 'forced_doorway_chance');
  }

  doorwayChargesFor(forClass: PlayerClass, level: number): number {
    return this.band(
      this.classLevelScalars.get(`${forClass}:doorway_charges`),
      (r) => r.minLevel,
      level,
      `doorway_charges for class ${forClass}`
    );
  }

  branchAllowance(playerClass: PlayerClass, level: number): number {
    return this.band(
      this.classLevelScalars.get(`${playerClass}:signpost_branches`),
      (r) => r.minLevel,
      level,
      `signpost_branches for class ${playerClass}`
    );
  }

  doorwayPassThroughLimit(isPlacer: boolean): number {
    return this.constant(
      isPlacer ? 'doorway_owner_pass_through_limit' : 'doorway_pass_through_limit'
    );
  }

  doorwayTransportChance(level: number): number {
    const chance =
      this.constant('doorway_transport_base') -
      this.constant('doorway_transport_per_level') * level;
    return Math.max(0, chance);
  }

  levelDefinition(level: number): LevelDefinition {
    const def = this.levels.get(level);
    if (!def) throw new UnknownBalanceValue(`level ${level}`);
    return def;
  }

  /**
   * Triangular curve peaking at neutral karma, with a floor so the poles still pay.
   * Recovered from AwardStipend_sp.
   */
  stipendSgFor(level: number, karma: number): number {
    const base = this.levelDefinition(level).stipendSg;
    const neutral = this.constant('karma_neutral');
    const weighted = base * (1 - Math.abs(1 - karma / neutral));
    const floor = base * this.constant('stipend_floor_fraction');
    return Math.max(Math.round(weighted), Math.round(floor));
  }

  /**
   * Karma below neutral yields the class's aggressive tool, above it the benevolent one.
   * Exactly neutral yields nothing, which is what makes neutrality pay in sg alone.
   */
  stipendToolFor(
    playerClass: PlayerClass,
    karma: number,
    level: number
  ): { tool: ToolType; quantity: number } {
    const neutral = this.constant('karma_neutral');
    const wantAggressive = karma < neutral;
    const row = [...this.tools.values()].find(
      (t) => t.owningClass === playerClass && t.karmaDelta === (wantAggressive ? -1 : 1)
    );
    if (!row) throw new UnknownBalanceValue(`stipend tool for class ${playerClass}`);

    const fraction = wantAggressive ? 1 - karma / neutral : (karma - neutral) / neutral;
    const allowance = this.levelDefinition(level).toolAllowance;
    return { tool: row.id, quantity: Math.round(allowance * fraction) };
  }

  inventoryCap(highestLevel: number): number {
    return highestLevel * this.constant('inventory_cap_per_level');
  }

  pagePlacementCap(): number {
    return this.constant('page_placement_cap');
  }

  owningClassOf(tool: ToolType): PlayerClass {
    return this.tool(tool).owningClass;
  }

  maxLevel(): number {
    let max = 0;
    for (const level of this.levels.keys()) {
      if (level > max) max = level;
    }
    return max;
  }
}
