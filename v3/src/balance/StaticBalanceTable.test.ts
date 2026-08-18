import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PlayerClass, ToolType } from '../domain/enums.js';
import { SEED_BALANCE } from './seed.js';
import { StaticBalanceTable, UnknownBalanceValue } from './StaticBalanceTable.js';

const DAY = 86_400_000;
const b = new StaticBalanceTable(SEED_BALANCE);

describe('tool cost — 1 in class, 3 out of class', () => {
  it('charges a giver 1 for their own tools', () => {
    assert.equal(b.costOf(ToolType.Trap, PlayerClass.Giver), 1);
    assert.equal(b.costOf(ToolType.Barrel, PlayerClass.Giver), 1);
  });

  it('charges a giver 3 for everyone else’s', () => {
    assert.equal(b.costOf(ToolType.Shield, PlayerClass.Giver), 3);
    assert.equal(b.costOf(ToolType.Doorway, PlayerClass.Giver), 3);
  });

  it('gives each class exactly two tools at cost 1', () => {
    for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
      const cheap = [0, 1, 2, 3, 4, 5].filter(
        (t) => b.costOf(t as ToolType, cls) === 1
      );
      assert.equal(cheap.length, 2, `class ${cls}`);
    }
  });
});

describe('trap damage by age — config.js baseDMG', () => {
  it('walks the bands', () => {
    assert.equal(b.trapDamageFor(0), 10);
    assert.equal(b.trapDamageFor(3 * DAY), 10);
    assert.equal(b.trapDamageFor(7 * DAY), 15);
    assert.equal(b.trapDamageFor(29 * DAY), 15);
    assert.equal(b.trapDamageFor(30 * DAY), 15);
    assert.equal(b.trapDamageFor(90 * DAY), 25);
    assert.equal(b.trapDamageFor(150 * DAY), 50);
    assert.equal(b.trapDamageFor(900 * DAY), 50);
  });

  it('treats a negative age as fresh rather than throwing', () => {
    assert.equal(b.trapDamageFor(-1), 10);
  });
});

describe('expert trap bonus — rewards LOW karma', () => {
  it('pays at or below the threshold', () => {
    assert.equal(b.expertTrapBonus(95, 0), 5);
    assert.equal(b.expertTrapBonus(50, 0), 5);
    assert.equal(b.expertTrapBonus(0, 0), 5);
  });

  it('pays nothing above it', () => {
    assert.equal(b.expertTrapBonus(96, 0), 0);
    assert.equal(b.expertTrapBonus(100, 900 * DAY), 0);
  });

  it('doubles once the trap is 90 days old', () => {
    assert.equal(b.expertTrapBonus(90, 89 * DAY), 5);
    assert.equal(b.expertTrapBonus(90, 90 * DAY), 10);
  });
});

describe('spider XP by age — matches v1 exactly', () => {
  it('walks the bands', () => {
    assert.equal(b.spiderXpFor(0), 5);
    assert.equal(b.spiderXpFor(7 * DAY), 10);
    assert.equal(b.spiderXpFor(30 * DAY), 15);
    assert.equal(b.spiderXpFor(90 * DAY), 25);
    assert.equal(b.spiderXpFor(150 * DAY), 50);
  });

  it('deals flat damage regardless of age', () => {
    assert.equal(b.spiderDamageFor(0), 10);
    assert.equal(b.spiderDamageFor(900 * DAY), 10);
  });
});

describe('XP on use', () => {
  it('pays 5 for traps, barrels and spiders', () => {
    assert.equal(b.initialXpFor(ToolType.Trap), 5);
    assert.equal(b.initialXpFor(ToolType.Barrel), 5);
    assert.equal(b.initialXpFor(ToolType.Spider), 5);
  });

  it('pays 10 for the guide tools', () => {
    assert.equal(b.initialXpFor(ToolType.Doorway), 10);
    assert.equal(b.initialXpFor(ToolType.Signpost), 10);
  });

  it('pays nothing for shields', () => {
    assert.equal(b.initialXpFor(ToolType.Shield), 0);
  });
});

describe('karma — D10', () => {
  it('lowers on aggressive tools, raises on benevolent', () => {
    assert.equal(b.karmaDeltaFor(ToolType.Trap), -1);
    assert.equal(b.karmaDeltaFor(ToolType.Spider), -1);
    assert.equal(b.karmaDeltaFor(ToolType.Doorway), -1);
    assert.equal(b.karmaDeltaFor(ToolType.Barrel), 1);
    assert.equal(b.karmaDeltaFor(ToolType.Shield), 1);
    assert.equal(b.karmaDeltaFor(ToolType.Signpost), 1);
  });

  it('splits each class into one of each polarity', () => {
    for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
      const owned = SEED_BALANCE.toolTypes.filter((t) => t.owningClass === cls);
      assert.equal(owned.length, 2);
      assert.equal(owned.filter((t) => t.karmaDelta === -1).length, 1);
      assert.equal(owned.filter((t) => t.karmaDelta === 1).length, 1);
    }
  });
});

describe('extremity bonus — doubles XP at your tool’s pole', () => {
  it('pays an aggressive tool below karma 5', () => {
    assert.equal(b.extremityBonusFor(ToolType.Trap, 4), 5);
    assert.equal(b.extremityBonusFor(ToolType.Trap, 5), 0);
    assert.equal(b.extremityBonusFor(ToolType.Trap, 96), 0);
  });

  it('pays a benevolent tool above karma 95', () => {
    assert.equal(b.extremityBonusFor(ToolType.Barrel, 96), 5);
    assert.equal(b.extremityBonusFor(ToolType.Barrel, 95), 0);
    assert.equal(b.extremityBonusFor(ToolType.Barrel, 4), 0);
  });

  it('doubles the tool’s base award when it pays', () => {
    const base = b.initialXpFor(ToolType.Trap);
    assert.equal(base + b.extremityBonusFor(ToolType.Trap, 0), base * 2);
  });
});

describe('shields', () => {
  it('gives guardians three charges and everyone else one', () => {
    assert.equal(b.shieldChargesFor(PlayerClass.Guardian), 3);
    assert.equal(b.shieldChargesFor(PlayerClass.Giver), 1);
    assert.equal(b.shieldChargesFor(PlayerClass.Guide), 1);
  });
});

describe('doorway charges — D15 puts the upper tier on the GUIDE', () => {
  it('starts everyone at 50', () => {
    assert.equal(b.doorwayChargesFor(PlayerClass.Giver, 0), 50);
    assert.equal(b.doorwayChargesFor(PlayerClass.Guardian, 20), 50);
    assert.equal(b.doorwayChargesFor(PlayerClass.Guide, 14), 50);
  });

  it('doubles for a guide at level 15', () => {
    assert.equal(b.doorwayChargesFor(PlayerClass.Guide, 15), 100);
    assert.equal(b.doorwayChargesFor(PlayerClass.Guide, 25), 100);
  });

  it('never doubles for a giver, however high their level', () => {
    assert.equal(b.doorwayChargesFor(PlayerClass.Giver, 25), 50);
  });
});

describe('signpost branches', () => {
  it('starts a guide weaker and ends them twice as strong', () => {
    assert.equal(b.branchAllowance(PlayerClass.Guide, 0), 1);
    assert.equal(b.branchAllowance(PlayerClass.Guide, 8), 2);
    assert.equal(b.branchAllowance(PlayerClass.Guide, 12), 3);
    assert.equal(b.branchAllowance(PlayerClass.Guide, 20), 4);
    assert.equal(b.branchAllowance(PlayerClass.Giver, 25), 2);
  });

  it('never exceeds the four branch slots the schema provides', () => {
    for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
      for (let lvl = 0; lvl <= 25; lvl++) {
        assert.ok(b.branchAllowance(cls, lvl) <= 4);
      }
    }
  });
});

describe('doorway traversal', () => {
  it('lets the placer through three times and others once', () => {
    assert.equal(b.doorwayPassThroughLimit(true), 3);
    assert.equal(b.doorwayPassThroughLimit(false), 1);
  });

  it('decays barrel transport to zero by level 40, never negative', () => {
    assert.ok(Math.abs(b.doorwayTransportChance(0) - 0.08) < 1e-9);
    assert.ok(Math.abs(b.doorwayTransportChance(20) - 0.04) < 1e-9);
    assert.equal(b.doorwayTransportChance(40), 0);
    assert.equal(b.doorwayTransportChance(100), 0);
  });

  it('forces a guide’s doorway three times as often', () => {
    assert.equal(b.forcedDoorwayChance(PlayerClass.Guide), 0.03);
    assert.equal(b.forcedDoorwayChance(PlayerClass.Giver), 0.01);
  });
});

describe('levels — the 25-row table', () => {
  it('starts at zero cost and zero threshold', () => {
    const l1 = b.levelDefinition(1);
    assert.equal(l1.experienceThreshold, 0);
    assert.equal(l1.sgCost, 0);
    assert.equal(l1.stipendSg, 140);
  });

  it('rises monotonically in threshold, cost and stipend', () => {
    for (let lvl = 2; lvl <= 25; lvl++) {
      const prev = b.levelDefinition(lvl - 1);
      const cur = b.levelDefinition(lvl);
      assert.ok(cur.experienceThreshold > prev.experienceThreshold, `threshold at ${lvl}`);
      assert.ok(cur.sgCost > prev.sgCost, `cost at ${lvl}`);
      assert.ok(cur.stipendSg > prev.stipendSg, `stipend at ${lvl}`);
    }
  });

  it('holds cost at a constant ratio of threshold', () => {
    for (let lvl = 2; lvl <= 25; lvl++) {
      const d = b.levelDefinition(lvl);
      assert.ok(Math.abs(d.sgCost / d.experienceThreshold - 0.1905) < 0.0005, `level ${lvl}`);
    }
  });

  it('rejects a level outside the table', () => {
    assert.throws(() => b.levelDefinition(26), UnknownBalanceValue);
    assert.throws(() => b.levelDefinition(0), UnknownBalanceValue);
  });
});

describe('the stipend — a triangle peaking at neutral karma', () => {
  it('pays most at karma 50', () => {
    assert.equal(b.stipendSgFor(1, 50), 140);
  });

  it('falls to the 25% floor at both poles', () => {
    assert.equal(b.stipendSgFor(1, 0), 35);
    assert.equal(b.stipendSgFor(1, 100), 35);
  });

  it('is symmetric about neutral', () => {
    for (const d of [10, 25, 40, 49]) {
      assert.equal(b.stipendSgFor(12, 50 - d), b.stipendSgFor(12, 50 + d), `offset ${d}`);
    }
  });

  it('never pays below the floor anywhere on the curve', () => {
    for (let lvl = 1; lvl <= 25; lvl++) {
      const floor = Math.round(b.levelDefinition(lvl).stipendSg * 0.25);
      for (let k = 0; k <= 100; k++) {
        assert.ok(b.stipendSgFor(lvl, k) >= floor, `level ${lvl} karma ${k}`);
      }
    }
  });

  it('always pays neutral karma at least as well as any other', () => {
    for (let lvl = 1; lvl <= 25; lvl++) {
      const best = b.stipendSgFor(lvl, 50);
      for (let k = 0; k <= 100; k++) {
        assert.ok(b.stipendSgFor(lvl, k) <= best, `level ${lvl} karma ${k}`);
      }
    }
  });
});

describe('the stipend tool grant — karma picks which of your two you get', () => {
  it('gives a giver traps below neutral and barrels above', () => {
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 10, 1).tool, ToolType.Trap);
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 90, 1).tool, ToolType.Barrel);
  });

  it('gives a guardian spiders below neutral — the only ongoing source', () => {
    assert.equal(b.stipendToolFor(PlayerClass.Guardian, 10, 1).tool, ToolType.Spider);
    assert.equal(b.stipendToolFor(PlayerClass.Guardian, 90, 1).tool, ToolType.Shield);
  });

  it('gives a guide doorways below neutral and signposts above', () => {
    assert.equal(b.stipendToolFor(PlayerClass.Guide, 10, 1).tool, ToolType.Doorway);
    assert.equal(b.stipendToolFor(PlayerClass.Guide, 90, 1).tool, ToolType.Signpost);
  });

  it('grants nothing at exactly neutral', () => {
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 50, 1).quantity, 0);
  });

  it('grants the full allowance at the poles', () => {
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 0, 1).quantity, 10);
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 100, 1).quantity, 10);
    assert.equal(b.stipendToolFor(PlayerClass.Giver, 0, 25).quantity, 100);
  });

  it('trades sg against tools — the poles give tools, the middle gives currency', () => {
    const poleSg = b.stipendSgFor(10, 0);
    const midSg = b.stipendSgFor(10, 50);
    const poleTools = b.stipendToolFor(PlayerClass.Giver, 0, 10).quantity;
    const midTools = b.stipendToolFor(PlayerClass.Giver, 50, 10).quantity;
    assert.ok(midSg > poleSg);
    assert.ok(poleTools > midTools);
  });
});

describe('ability gates', () => {
  it('recovers the config.js level gates', () => {
    assert.deepEqual(b.levelGateFor('anonymous_trap'), { playerClass: PlayerClass.Giver, level: 10 });
    assert.deepEqual(b.levelGateFor('loot_own_barrel'), { playerClass: PlayerClass.Giver, level: 15 });
    assert.deepEqual(b.levelGateFor('wandering_spider'), { playerClass: PlayerClass.Guardian, level: 15 });
    assert.deepEqual(b.levelGateFor('anti_signpost_spider'), { playerClass: PlayerClass.Guardian, level: 10 });
    assert.deepEqual(b.levelGateFor('chain_own_doorway'), { playerClass: PlayerClass.Guide, level: 0 });
  });

  it('rejects an unknown ability rather than defaulting open', () => {
    assert.throws(() => b.levelGateFor('not_an_ability' as never), UnknownBalanceValue);
  });
});

describe('caps', () => {
  it('scales the inventory cap with the highest class level', () => {
    assert.equal(b.inventoryCap(1), 250);
    assert.equal(b.inventoryCap(20), 5000);
  });

  it('caps placements per page per player at a flat 250', () => {
    assert.equal(b.pagePlacementCap(), 250);
  });
});

describe('starting state — D22', () => {
  it('matches Amendment H', () => {
    assert.equal(b.constant('starting_sg'), 20);
    assert.equal(b.constant('starting_karma'), 50);
    assert.equal(b.constant('starting_tools_in_class'), 10);
    assert.equal(b.constant('starting_tools_other'), 5);
  });

  it('starts a player at the peak of the stipend curve', () => {
    assert.equal(b.constant('starting_karma'), b.constant('karma_neutral'));
  });

  it('cannot afford the first level, by design', () => {
    assert.ok(b.constant('starting_sg') < b.levelDefinition(1).sgCost || b.levelDefinition(1).sgCost === 0);
    assert.ok(b.constant('starting_sg') < b.levelDefinition(2).sgCost);
  });
});

describe('placement failure chances', () => {
  it('shields have zero fail chance and are never placed', () => {
    assert.equal(b.failChanceFor(ToolType.Shield), 0);
  });

  it('all other tools have 0.05 fail chance', () => {
    assert.equal(b.failChanceFor(ToolType.Trap), 0.05);
    assert.equal(b.failChanceFor(ToolType.Barrel), 0.05);
    assert.equal(b.failChanceFor(ToolType.Spider), 0.05);
    assert.equal(b.failChanceFor(ToolType.Doorway), 0.05);
    assert.equal(b.failChanceFor(ToolType.Signpost), 0.05);
  });
});
