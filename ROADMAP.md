# Roadmap

Slices are one-cycle-sized: one coherent, shippable increment, one commit.
Parcel numbers refer to [docs/STUBS-01-work-division.md](docs/STUBS-01-work-division.md).

## Next up

*Re-ordered 2026-08-06: a PostgreSQL server became available, so persistence moved from last
to second (CHARTER A1, Milestones).*

1. **Migrations from SCHEMA-01** (M1) — forward-only, data-preserving, applied by a runner that
   records what it applied. Introduces the `pg` dependency under a spec that names it.
   **Must add a unique constraint on `player.name`** — `IdentityModule.register` currently
   check-then-inserts, which no in-memory store can make safe. The check is necessary for a
   clean error message and is not sufficient on its own.
2. **Audit triggers and balance reference tables** (M1) — `audit_row()`, `SET LOCAL
   app.actor_id`, and the D23 balance tables seeded from `balance/seed.ts`.
3. **PostgreSQL repositories + real `IUnitOfWork`** (M1) — the same interfaces M0 exercised,
   now transactional. Every atomicity guarantee in TRD §8.2 verified here against the server.
   The real unit of work **must support concurrent transactions**, which the in-memory double
   deliberately refuses (see cycle 1) — that is the whole point of moving to it.
4. **GeographyModule** (M2, parcel 5) — page/domain resolution, normalisation-version gating,
   presence enter/leave/expire.
5. **PlacementModule** (M2, parcel 6) — placement with inventory, level gates, D16 page cap via
   advisory lock, initial XP and karma; barrel stashing; dismissal.
6. **EncounterModule: arrival and triggers** (M2, parcel 7) — WF-3 ordering, trap and spider
   resolution as pure `TriggerOutcome`, shield absorption.
7. **EncounterModule: barrels, doorways, signposts** (M2, parcel 7) — loot, traverse, follow.
8. **EconomyModule: purchase and level-up** (M3, parcel 8).
9. **EconomyModule: the stipend job** (M3, parcels 8–9) — subject-level idempotency, advisory
    lock, run ledger. **Also lands `lastActiveAt`**, deferred in cycle 1: TRD §10.1 sets it on
    tool use only, and its trigger set spans PlacementModule and EncounterModule, so it could
    not be half-implemented inside `ProgressionModule.adjustKarma` without looking finished
    while being wrong. `InMemoryPlayerRepository.listStipendDue` throws `NotImplemented` until
    this lands.
10. **WorldModule: wandering spiders** (M3, parcel 9).

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
