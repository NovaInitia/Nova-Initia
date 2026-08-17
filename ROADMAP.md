# Roadmap

Slices are one-cycle-sized: one coherent, shippable increment, one commit.
Parcel numbers refer to [docs/STUBS-01-work-division.md](docs/STUBS-01-work-division.md).

## Next up

*Re-ordered 2026-08-06: a PostgreSQL server became available, so persistence moved from last
to second (CHARTER A1, Milestones).*

1. **GeographyModule** (M2, parcel 5) — page/domain resolution, normalisation-version gating,
   presence enter/leave/expire. **Note:** the URL normaliser itself is *not* server work —
   BRD-01 F.4 puts execution on the client and leaves the server owning only the specification
   and the version gate. Cycle 4 nearly built one before re-reading F.4; do not repeat that.
2. **PlacementModule** (M2, parcel 6) — placement with inventory, level gates, initial XP and
   karma; barrel stashing; dismissal. The D16 cap is **already enforced** by the cycle-5
   trigger; what this slice adds is the advisory lock on `(page, placer, tool)` that closes the
   READ COMMITTED race (CHARTER A4), plus a clean typed error for the `23514` the trigger
   raises.
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
