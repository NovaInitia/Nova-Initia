# Roadmap

Slices are one-cycle-sized: one coherent, shippable increment, one commit.
Parcel numbers refer to [docs/STUBS-01-work-division.md](docs/STUBS-01-work-division.md).

## Next up

*Re-ordered 2026-08-06: a PostgreSQL server became available, so persistence moved from last
to second (CHARTER A1, Milestones).*

1. **Audit triggers and the placement-cap guards** (M1) — `SCHEMA-01` §7.2 `audit_log` +
   `audit_row()` + `SET LOCAL app.actor_id`, and §8's `enforce_page_placement_cap()` and the
   inventory-cap equivalent. Both were deliberately held back from cycle 4: the audit trigger
   because it has no actor to record until a repository sets one, and the cap triggers because
   they belong with `PlacementModule`. Lands as migration `0003`.
   **Note for whoever takes this:** `audit_log` will be the first table to prove cycle 4's
   default-truncate rule in `freshDb()` — it should be cleaned automatically, with no edit to
   the helper. If it is not, the rule is broken and that is a finding.
2. **PostgreSQL repositories + real `IUnitOfWork`** (M1) — the same interfaces M0 exercised,
   now transactional. Every atomicity guarantee in TRD §8.2 verified here against the server.
   The real unit of work **must support concurrent transactions**, which the in-memory double
   deliberately refuses (see cycle 1) — that is the whole point of moving to it.
3. **GeographyModule** (M2, parcel 5) — page/domain resolution, normalisation-version gating,
   presence enter/leave/expire. **Note:** the URL normaliser itself is *not* server work —
   BRD-01 F.4 puts execution on the client and leaves the server owning only the specification
   and the version gate. Cycle 4 nearly built one before re-reading F.4; do not repeat that.
4. **PlacementModule** (M2, parcel 6) — placement with inventory, level gates, D16 page cap via
   advisory lock, initial XP and karma; barrel stashing; dismissal.
5. **EncounterModule: arrival and triggers** (M2, parcel 7) — WF-3 ordering, trap and spider
   resolution as pure `TriggerOutcome`, shield absorption.
6. **EncounterModule: barrels, doorways, signposts** (M2, parcel 7) — loot, traverse, follow.
7. **EconomyModule: purchase and level-up** (M3, parcel 8).
8. **EconomyModule: the stipend job** (M3, parcels 8–9) — subject-level idempotency, advisory
    lock, run ledger. **Also lands `lastActiveAt`**, deferred in cycle 1: TRD §10.1 sets it on
    tool use only, and its trigger set spans PlacementModule and EncounterModule, so it could
    not be half-implemented inside `ProgressionModule.adjustKarma` without looking finished
    while being wrong. `InMemoryPlayerRepository.listStipendDue` throws `NotImplemented` until
    this lands.
9. **WorldModule: wandering spiders** (M3, parcel 9).

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
