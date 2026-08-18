# Roadmap

Slices are one-cycle-sized: one coherent, shippable increment, one commit.
Parcel numbers refer to [docs/STUBS-01-work-division.md](docs/STUBS-01-work-division.md).

## Next up

*Re-ordered 2026-08-06: a PostgreSQL server became available, so persistence moved from last
to second (CHARTER A1, Milestones).*

1. **Placement failure** (M2, WF-5 completion) — every placeable tool gains a failure chance;
   shields cannot fail because they are never placed. v1 defined the *consequences* of failure
   and never wired up the *decision*: `User::useTool($toolID, $fail)` takes `$fail` as a
   parameter. On failure a trap, barrel, doorway or signpost is consumed and still pays XP,
   while a spider is spared — v1 guarded those on `&& !$fail`.
   Needs `tool_type.fail_chance` (migration `0004`, 0.05 everywhere and 0 for shield,
   superseding `class_scalar.trap_fail_chance`), an **injected random source** so tests are
   deterministic, and `place` returning a `PlacementOutcome` rather than a bare `Placement` —
   a failed placement has no placement row but the caller still must learn the tool was spent.
2. **Doorway page limits** (M2, WF-5 completion) — `config.js` `pageLimits`: `own` 5 per player
   (200 for a guide) and `total` 200 across **all** players on a page. Confirmed a *placement*
   limit, distinct from `charges`, which are the uses. `own` varies by class so it belongs in
   `class_scalar`; `total` is class-independent and belongs in `balance_constant`. `total` needs
   a new trigger — counting across every placer on a page is a shape no existing constraint has.
3. **EncounterModule: arrival and triggers** (M2, parcel 7) — WF-3 ordering, trap and spider
   resolution as pure `TriggerOutcome`, shield absorption.
4. **EncounterModule: barrels, doorways, signposts** (M2, parcel 7) — loot, traverse, follow.
5. **EconomyModule: purchase and level-up** (M3, parcel 8).
6. **EconomyModule: the stipend job** (M3, parcels 8–9) — subject-level idempotency, advisory
    lock, run ledger. **Also lands `lastActiveAt`**, deferred in cycle 1: TRD §10.1 sets it on
    tool use only, and its trigger set spans PlacementModule and EncounterModule, so it could
    not be half-implemented inside `ProgressionModule.adjustKarma` without looking finished
    while being wrong. `InMemoryPlayerRepository.listStipendDue` throws `NotImplemented` until
    this lands.
7. **WorldModule: wandering spiders** (M3, parcel 9).

## Cut / deferred

- **HTTP boundary** (M4) — after the core loop and economy work against PostgreSQL.
- **In-memory repositories for interfaces no M0 module consumes** — speculative until a caller
  exists; M1 gives the real ones anyway.
- Tours, reputation, moderation, messaging, administration, parts, trading — out of scope per
  the charter's non-goals.

## Done

- [pre-charter] `IBalanceTable` + seed data (parcel 2) — 49 tests, uncommitted at charter time.
- [cycle 1] `ProgressionModule` + the in-memory repositories it consumes (parcels 1, 3a) —
  113 tests. Added `owningClassOf` and `maxLevel` to `IBalanceTable`; both were missing and
  `adjustKarma`/`canAdvance` cannot be written without them.
- [cycle 2] `IdentityModule` — register, authenticate, resolve, revoke, public profile
  (parcel 4) — 147 tests. Added inventory, armor and session in-memory repositories. Added
  `ILedgerRepository` to the module's constructor so D22's starting state is ledgered at
  registration, which is what makes "sum of the ledger equals the balance" true from birth
  rather than only after the first tool use.
- [cycle 3] Scenario harness — `npm run scenario` (A3). **M0 complete.**
- [cycle 4] **Migrations from SCHEMA-01** (M1) — hand-written forward-only runner
  (`src/db/migrate.ts`), `0001_core_schema.sql` (30 tables, all §9 indexes) and
  `0002_reference_data.sql` (all reference data incl. the D23 balance tables). 170 tests.
  Introduced `pg`, the project's first runtime dependency, under a spec naming it.
  `player.name` is `citext NOT NULL UNIQUE`, closing cycle 2's check-then-insert gap.
  Reference-data seeding was pulled forward into this slice — it was listed under the old
  item 2, but a schema with no reference data cannot satisfy a single foreign key, so the two
  were one increment in practice.
- [cycle 5] **Audit triggers and cap guards** (M1) — migration `0003`: `audit_log`,
  `audit_row()` attached to 18 tables, and the D16 / A.4 cap-enforcement triggers. 185 tests
  (38 against the database), 31 tables, 21 triggers. Corrected three defects in SCHEMA-01 §7.2:
  the documented `NEW.id` body cannot work on the composite-key tables that are most of the
  audit set, `SECURITY DEFINER` lacked a pinned `search_path`, and the triggers needed to be
  `AFTER`. Both cap triggers read their limit from `balance_constant` (D23) rather than
  hard-coding 250. **Cycle 4's default-truncate rule was validated here** — `audit_log` is
  cleaned between tests with no edit to `testDb.ts`, which is exactly what it was designed for.
- [cycle 6] **`PgUnitOfWork` + ProgressionModule's repositories** (M1) — player, class progress
  and ledger against PostgreSQL, with an `AsyncLocalStorage` ambient transaction so repository
  reads join the transaction they run inside without a contract change. 211 tests. Concurrent
  transactions work, which the in-memory double refuses by design. `NameTaken` is now enforced
  by the `citext` unique constraint, closing cycle 2's check-then-insert gap. `npm test` no
  longer passes when the database is unreachable — it previously reported a green 147 while
  silently omitting 38 tests.
- [cycle 7] **IdentityModule's PostgreSQL repositories** (M1) — inventory, armor and session,
  plus `IdentityModule` exercised end to end against the real store. 237 tests. **M1 complete.**
  Inventory translates two different failures that share SQLSTATE `23514` — the `quantity >= 0`
  CHECK (which carries a `constraint` name) into `NegativeInventory`, and cycle 5's cap trigger
  (which does not) into `InventoryCapExceeded`. The concurrent same-name registration test is
  mutation-checked: dropping `player_name_key` makes it fail, so it is pinned to the database
  guarantee rather than to timing.
- [cycle 8] **`GeographyModule`** (M2, parcel 5) — page/domain resolution, version gating,
  presence enter/leave/touch/expire, plus its four PostgreSQL repositories. 279 tests.
  **M2 begun.** `resolvePage` resolves-or-creates without rewriting rows, since it runs on every
  page entry. Fixed four test defects inherited from earlier cycles: a rollback test that
  silently decayed to vacuous when cycle 5 added a third migration, a `normalisation_version`
  leak from `schema.test.ts` that survived four cycles, two unsound `BEGIN`-through-the-pool
  transactions, and 305 leaked temp directories that had filled `/tmp` to 100%.
  The URL normaliser remains **out of scope** — BRD-01 F.4 puts execution on the client.
- [cycle 10] **`stashBarrel` and `dismiss`** (M2, parcel 6) — completes `PlacementModule`.
  320 tests. **Parcel 6 complete.** Barrel capacity counts sg at 10-to-1, messages refuse HTML
  outright rather than sanitising, `durability` is 1 pending OPEN-8. Added a *discriminating*
  atomicity test: the existing one passed even with `ROLLBACK` replaced by `COMMIT`, because
  PostgreSQL treats `COMMIT` of an aborted transaction as a rollback — the new one fails on an
  application-level throw, where only the application's own rollback can save it.
- [cycle 9] **`PlacementModule.place`** (M2, parcel 6) — placement with inventory, level gates,
  the D16 cap, D17 snapshotting, initial XP and karma, plus `PgPlacementRepository` (five
  subtypes), interaction and barrel-content repositories, `PgAdvisoryLock` and `Consumption`.
  298 tests. Fixed a real bug in `PgInventoryRepository.adjust`: the upsert-with-delta idiom
  cannot decrement, because PostgreSQL checks constraints against the proposed INSERT tuple
  before `ON CONFLICT` resolution, so a negative delta always tripped `quantity >= 0`.
  **Mutation testing showed CHARTER A4's advisory lock is redundant** — the cap is actually
  enforced by cycle 5's trigger plus the row lock on `player_inventory`. The lock is kept as
  defence in depth, and no test distinguishes it.
