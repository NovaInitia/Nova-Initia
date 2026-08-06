# Roadmap

Slices are one-cycle-sized: one coherent, shippable increment, one commit.
Parcel numbers refer to [docs/STUBS-01-work-division.md](docs/STUBS-01-work-division.md).

## Next up

1. **In-memory repositories** (M0, parcel 3a) — implement every interface in
   `contracts/repositories.ts` against in-memory maps, plus an `IUnitOfWork` that runs the
   callback and records actor id. Enough to let modules be exercised without PostgreSQL.
2. **ProgressionModule** (M0, parcel 1) — `awardXp`, `adjustKarma`, `adjustSg`, `canAdvance`,
   with ledger entries and post-clamp `appliedDelta`. Karma moves only when the tool's class
   matches the player's active class (BRD-01 A.6).
3. **IdentityModule: register + authenticate** (M0, parcel 4) — D22 starting state written
   through the ledger; credentials hashed with scrypt; session tokens from `crypto.randomBytes`.
4. **Scenario harness** (M0, A3) — a runnable script that creates a player, authenticates, and
   prints observable state. The substitute for a client.
5. **GeographyModule** (M1, parcel 5) — page/domain resolution, normalisation-version gating,
   presence enter/leave/expire.
6. **PlacementModule** (M1, parcel 6) — placement with inventory, level gates, D16 page cap,
   initial XP and karma; barrel stashing; dismissal.
7. **EncounterModule: arrival and triggers** (M1, parcel 7) — WF-3 ordering, trap and spider
   resolution as pure `TriggerOutcome`, shield absorption.
8. **EncounterModule: barrels, doorways, signposts** (M1, parcel 7) — loot, traverse, follow.
9. **EconomyModule: purchase and level-up** (M2, parcel 8).
10. **EconomyModule: the stipend job** (M2, parcels 8–9) — subject-level idempotency, advisory
    lock, run ledger.
11. **WorldModule: wandering spiders** (M2, parcel 9).

## Cut / deferred

- **PostgreSQL repositories, migrations, audit triggers** (M3) — deferred behind M0–M2 because
  no server is available in this environment (CHARTER A1). Blocking item raised in REQUESTS.md.
- **HTTP boundary** (M4) — after M3.
- Tours, reputation, moderation, messaging, administration, parts, trading — out of scope per
  the charter's non-goals.

## Done

- [pre-charter] `IBalanceTable` + seed data (parcel 2) — 49 tests, uncommitted at charter time.
