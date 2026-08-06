# STUBS-01 — Skeleton and work division

**Status:** Complete — compiles clean under `tsc --strict`
**Derived from:** [TRD-01](TRD-01-core-game-loop.md), [SCHEMA-01](SCHEMA-01-core-game-loop.md)
**Location:** `v3/` — deliberately separate from the legacy v2 code at the repository root, which
remains runnable against the JSON fixture store.

Verified: 21 source files, `npx tsc --noEmit` exits 0 with `strict: true`, and every stubbed
path throws `NotImplemented` when exercised.

---

## 1. Layout

```
v3/src/
  domain/        errors, ids, enums, player, geography, placement, progression
  contracts/     unitOfWork, balance, repositories, consumption, jobs
  modules/       identity, geography, placement, encounter, economy, progression, world
  jobs/          StipendJob, SpiderMovementJob, PresenceExpiryJob, JobRunner
  index.ts
```

`domain/` holds data shapes only. `contracts/` holds the interfaces consumers declare and
implementations satisfy. `modules/` holds the seven top-level classes from TRD §6. Nothing in
`domain/` or `contracts/` imports from `modules/`, so the dependency direction is one-way.

## 2. Work parcels

One parcel per top-level class. Each is independently implementable because its collaborators
are constructor-injected interfaces, already visible in the skeleton.

| # | Parcel | Depends on | Notes |
|---|---|---|---|
| **1** | `ProgressionModule` | repositories, balance | **Do this first.** Four other modules call it, and it owns the ledger writes that everything else relies on. |
| **2** | `IBalanceTable` implementation | `config.js` | Pure, synchronous, no database. Fully unit-testable against the recovered rules. The single highest-value parcel to get right. |
| **3** | Repository implementations | SCHEMA-01 | Postgres-backed. One parcel per repository group is reasonable if split further. |
| **4** | `IdentityModule` | 1, 3 | Registration, authentication, sessions. Unblocked — **D22** sets the starting state. Registration must write the sg and inventory grants **through the ledger**, not as direct column writes. |
| **5** | `GeographyModule` | 3 | Page registry, presence, normalisation-version gating. |
| **6** | `PlacementModule` | 1, 2, 3, 5 | Placement, barrel stashing, dismissal. |
| **7** | `EncounterModule` | 1, 2, 3, 5 | The largest parcel — arrival, triggers, shields, looting, traversal, signposts. Splittable by workflow. |
| **8** | `EconomyModule` | 1, 2, 3 | Shop, level purchase, stipend. |
| **9** | `WorldModule` + jobs | 3, 5, 8 | Scheduler entry points and the advisory-lock runner. |
| **10** | `IUnitOfWork`, `IConsumption` | 3 | Small but load-bearing — see §3. |

Parcels 1–3 unblock everything else. Parcels 4–9 can then proceed concurrently.

## 3. Two contracts that carry more weight than their size

**`IUnitOfWork.run(actorId, fn)`** takes the acting player as its first argument, not just a
callback. That is deliberate: it is the single place `SET LOCAL app.actor_id` is issued, which
is what makes the SCHEMA-01 audit triggers able to record *who*. An implementation that omits
it produces an audit trail with a null actor on every row.

**`IConsumption`** is the single point at which a tool ceases to exist — the six scattered
deletion paths collapsed into one operation.

Its importance has since grown. Parts were the Project Owner's intended fix for the economy's
reliance on a single global dial (PHP-ERA-FINDINGS §6b): consumed tools yield parts, parts
assemble into tools, and supply becomes proportional to play rather than to a configured rate.
**The economy's second loop attaches at `IConsumption` and nowhere else.** Implementers of
parcels 6 and 7 should route every consumption through it even where a direct delete would be
shorter.

## 4. What the skeleton deliberately does not contain

- **No shield placement type.** Shields are carried, never placed.
- **No tour or chain container.** BRD-05's named, rated container is not modelled; chains and
  tours are identified by their root placement via `chainRootId` and `tourRootId`.
- **No rating aggregation.** BRD-06's individual `rating` lives on `PlacementInteraction`;
  aggregates arrive with that BRD's TRD.
- **No HTTP layer.** The API boundary resolves a session into a `Player` and calls a module. It
  is intentionally out of the skeleton so the modules stay transport-agnostic — which is also
  what makes the D6 transport question (subdomain versus path) a non-issue for implementers.

## 5. Method names are contracts, not nomenclature

Repository methods use generic names — `get`, `save`, `list`, `remove` — so an implementer who
satisfies the contract under a better name has deviated from nothing. Domain operations keep
meaningful names (`traverseDoorway`, `lootBarrel`) because the name *is* the contract there.

## 6. Known blockers carried into implementation

| Item | Blocks |
|---|---|
| ~~**OPEN-1**~~ | **Resolved** by D22. Nothing blocks the core loop. |
| **OPEN-06-3** — rating scale | BRD-06 workflows only; no core-loop parcel. |
| **OPEN-14** — text fragments | Nothing. Default is to strip, already assumed. |
| SCHEMA-01 §12 — placement cap race | Parcel 6. Advisory lock, `SERIALIZABLE`, or accept overshoot. |
| SCHEMA-01 §12 — audit scope | Parcel 1. Currently sg, XP, and karma all ledgered. |
