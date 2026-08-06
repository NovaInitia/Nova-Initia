import { PlayerClass, ToolType } from '../domain/enums.js';
import { AuthenticationFailed } from '../domain/errors.js';
import { InMemoryDatabase, InMemoryPlayerRepository, InMemoryClassProgressRepository, InMemoryLedgerRepository, InMemoryInventoryRepository, InMemoryArmorRepository, InMemorySessionRepository, InMemoryUnitOfWork } from '../repositories/InMemoryDatabase.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { IdentityModule } from '../modules/identity.js';
import { ProgressionModule } from '../modules/progression.js';

const toolCodeMap: Record<ToolType, string> = {
  [ToolType.Trap]: 'trap',
  [ToolType.Barrel]: 'barrel',
  [ToolType.Spider]: 'spider',
  [ToolType.Shield]: 'shield',
  [ToolType.Doorway]: 'doorway',
  [ToolType.Signpost]: 'signpost'
};

const classNameMap: Record<PlayerClass, string> = {
  [PlayerClass.Giver]: 'Giver',
  [PlayerClass.Guardian]: 'Guardian',
  [PlayerClass.Guide]: 'Guide'
};

async function main() {
  const db = new InMemoryDatabase();
  const balance = new StaticBalanceTable(SEED_BALANCE);
  const unitOfWork = new InMemoryUnitOfWork(db);

  const players = new InMemoryPlayerRepository(db);
  const progress = new InMemoryClassProgressRepository(db);
  const ledger = new InMemoryLedgerRepository(db);
  const inventory = new InMemoryInventoryRepository(db);
  const armor = new InMemoryArmorRepository(db);
  const sessions = new InMemorySessionRepository(db);

  const identity = new IdentityModule(players, sessions, inventory, armor, progress, balance, unitOfWork, ledger);
  const progression = new ProgressionModule(players, progress, ledger, balance);

  console.log('=== REGISTRATION ===');
  const reg = await identity.register('Aurelian', 'credential123', 'test@example.com', PlayerClass.Giver);
  const playerId = reg.player.id;

  console.log(`Player ID: ${playerId}`);
  console.log(`Name: ${reg.player.name}`);
  console.log(`Active Class: ${classNameMap[reg.player.activeClass]}`);
  console.log(`SG: ${reg.player.sg}`);
  console.log(`Karma: ${reg.player.karma}`);

  const allProgress = await progress.list(playerId);
  for (const p of allProgress) {
    console.log(`${classNameMap[p.playerClass]} level: ${p.level}`);
  }

  console.log('\n=== STARTING INVENTORY ===');
  const startingInv = await inventory.get(playerId);
  const sortedTools = [ToolType.Trap, ToolType.Barrel, ToolType.Spider, ToolType.Shield, ToolType.Doorway, ToolType.Signpost];
  const nameCol = 'Tool'.padEnd(12);
  const classCol = 'Class'.padEnd(12);
  const countCol = 'Count'.padEnd(6);
  console.log(`${nameCol}${classCol}${countCol}`);
  for (const tool of sortedTools) {
    const count = startingInv.counts.get(tool) ?? 0;
    const toolCode = toolCodeMap[tool];
    const toolClass = classNameMap[balance.owningClassOf(tool)];
    console.log(`${toolCode.padEnd(12)}${toolClass.padEnd(12)}${count.toString().padEnd(6)}`);
  }

  console.log('\n=== OPENING LEDGER (oldest first) ===');
  const openingLedger = await ledger.listForPlayer(playerId, 100);
  const kindCol = 'Resource'.padEnd(10);
  const classCol2 = 'Class'.padEnd(12);
  const deltaCol = 'Delta'.padEnd(8);
  const balCol = 'Balance'.padEnd(10);
  const causeCol = 'Cause'.padEnd(20);
  console.log(`${kindCol}${classCol2}${deltaCol}${balCol}${causeCol}`);
  for (const entry of openingLedger.reverse()) {
    const cls = entry.playerClass !== null ? classNameMap[entry.playerClass] : '-';
    console.log(`${entry.resourceKind.padEnd(10)}${cls.padEnd(12)}${entry.appliedDelta.toString().padEnd(8)}${entry.balanceAfter.toString().padEnd(10)}${entry.cause.padEnd(20)}`);
  }

  console.log('\n=== AUTHENTICATION ===');
  const auth = await identity.authenticate('Aurelian', 'credential123');
  const sessionId = auth.session.id;
  const token = auth.token;
  console.log(`Session ID: ${sessionId}`);
  console.log(`Expires at: ${auth.session.expiresAt.toISOString()}`);

  console.log('\n=== RESOLVE SESSION ===');
  const resolved = await identity.resolveSession(token);
  if (resolved) {
    console.log(`Token resolves to player: ${resolved.name}`);
  }

  console.log('\n=== WRONG AUTHENTICATION ===');
  try {
    await identity.authenticate('Aurelian', 'wrongpassword');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(`Error: ${err.name}`);
    }
  }

  console.log('\n=== PLACE TRAP (own class tool) ===');
  let currentPlayer = (await players.get(playerId))!;
  let karmaBefore = currentPlayer.karma;
  await unitOfWork.run(playerId, async (tx) => {
    const xpAmount = balance.initialXpFor(ToolType.Trap);
    await progression.awardXp(tx, currentPlayer, PlayerClass.Giver, xpAmount, 'placement_reward', null);
    await progression.adjustKarma(tx, currentPlayer, ToolType.Trap, null);
  });
  currentPlayer = (await players.get(playerId))!;
  const trapLedger = await ledger.listForPlayer(playerId, 100);
  const giverXp = trapLedger.filter(e => e.resourceKind === 'xp' && e.playerClass === PlayerClass.Giver).pop();
  console.log(`Karma: ${karmaBefore} -> ${currentPlayer.karma} (trap, own class)`);
  console.log(`Giver XP: ${giverXp?.balanceAfter}`);

  console.log('\n=== PLACE BARREL (own class tool) ===');
  karmaBefore = currentPlayer.karma;
  await unitOfWork.run(playerId, async (tx) => {
    const xpAmount = balance.initialXpFor(ToolType.Barrel);
    await progression.awardXp(tx, currentPlayer, PlayerClass.Giver, xpAmount, 'placement_reward', null);
    await progression.adjustKarma(tx, currentPlayer, ToolType.Barrel, null);
  });
  currentPlayer = (await players.get(playerId))!;
  console.log(`Karma: ${karmaBefore} -> ${currentPlayer.karma} (barrel, own class)`);

  console.log('\n=== USE SPIDER (different class tool) ===');
  karmaBefore = currentPlayer.karma;
  await unitOfWork.run(playerId, async (tx) => {
    await progression.adjustKarma(tx, currentPlayer, ToolType.Spider, null);
  });
  currentPlayer = (await players.get(playerId))!;
  console.log(`Karma: ${karmaBefore} -> ${currentPlayer.karma} (spider, Guardian class, did not move)`);

  console.log('\n=== TRAP DAMAGE 8 SG (ordinary debit) ===');
  const sgBefore8 = currentPlayer.sg;
  await unitOfWork.run(playerId, async (tx) => {
    const applied = await progression.adjustSg(tx, currentPlayer, -8, 'trap_damage', null, null);
    console.log(`Requested: -8, Applied: ${applied}`);
  });
  currentPlayer = (await players.get(playerId))!;
  console.log(`SG: ${sgBefore8} -> ${currentPlayer.sg}`);

  console.log('\n=== TRAP DAMAGE 500 SG (clamped at zero) ===');
  const sgBefore500 = currentPlayer.sg;
  await unitOfWork.run(playerId, async (tx) => {
    const applied = await progression.adjustSg(tx, currentPlayer, -500, 'trap_damage', null, null);
    console.log(`Requested: -500, Applied: ${applied}`);
  });
  currentPlayer = (await players.get(playerId))!;
  console.log(`SG: ${sgBefore500} -> ${currentPlayer.sg}`);
  console.log('(Ledger records applied delta, not requested delta — that is why the sum still equals the balance)');

  console.log('\n=== FINAL LEDGER (oldest first) ===');
  const finalLedger = await ledger.listForPlayer(playerId, 100);
  console.log(`${kindCol}${classCol2}${deltaCol}${balCol}${causeCol}`);
  for (const entry of finalLedger.reverse()) {
    const cls = entry.playerClass !== null ? classNameMap[entry.playerClass] : '-';
    console.log(`${entry.resourceKind.padEnd(10)}${cls.padEnd(12)}${entry.appliedDelta.toString().padEnd(8)}${entry.balanceAfter.toString().padEnd(10)}${entry.cause.padEnd(20)}`);
  }

  console.log('\n=== CLOSING STATE ===');
  currentPlayer = (await players.get(playerId))!;
  const finalProgress = await progress.list(playerId);
  console.log(`${currentPlayer.name} - SG: ${currentPlayer.sg}, Karma: ${currentPlayer.karma}`);
  for (const p of finalProgress) {
    console.log(`${classNameMap[p.playerClass]} level: ${p.level}, XP: ${p.experience}`);
  }

  console.log('\n=== INVARIANT CHECKS ===');
  let allPassed = true;

  const sgEntries = finalLedger.filter(e => e.resourceKind === 'sg');
  const sgSum = sgEntries.reduce((acc, e) => acc + e.appliedDelta, 0);
  const sgCheck = sgSum === currentPlayer.sg;
  console.log(`SG ledger sum (${sgSum}) equals balance (${currentPlayer.sg}): ${sgCheck ? 'PASS' : 'FAIL'}`);
  if (!sgCheck) allPassed = false;

  const karmaEntries = finalLedger.filter(e => e.resourceKind === 'karma');
  const karmaSum = karmaEntries.reduce((acc, e) => acc + e.appliedDelta, 0);
  const karmaCheck = karmaSum === currentPlayer.karma;
  console.log(`Karma ledger sum (${karmaSum}) equals balance (${currentPlayer.karma}): ${karmaCheck ? 'PASS' : 'FAIL'}`);
  if (!karmaCheck) allPassed = false;

  const giverXpEntries = finalLedger.filter(e => e.resourceKind === 'xp' && e.playerClass === PlayerClass.Giver);
  const giverXpSum = giverXpEntries.reduce((acc, e) => acc + e.appliedDelta, 0);
  const giverProgress = finalProgress.find(p => p.playerClass === PlayerClass.Giver)!;
  const giverXpCheck = giverXpSum === giverProgress.experience;
  console.log(`Giver XP ledger sum (${giverXpSum}) equals level progress (${giverProgress.experience}): ${giverXpCheck ? 'PASS' : 'FAIL'}`);
  if (!giverXpCheck) allPassed = false;

  const karmaMin = balance.constant('karma_min');
  const karmaMax = balance.constant('karma_max');
  const karmaInBounds = currentPlayer.karma >= karmaMin && currentPlayer.karma <= karmaMax;
  console.log(`Karma (${currentPlayer.karma}) in [${karmaMin}, ${karmaMax}]: ${karmaInBounds ? 'PASS' : 'FAIL'}`);
  if (!karmaInBounds) allPassed = false;

  const sgNonNegative = currentPlayer.sg >= 0;
  console.log(`SG (${currentPlayer.sg}) is non-negative: ${sgNonNegative ? 'PASS' : 'FAIL'}`);
  if (!sgNonNegative) allPassed = false;

  if (allPassed) {
    console.log('\nAll invariants passed.');
  } else {
    console.log('\nSome invariants failed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
