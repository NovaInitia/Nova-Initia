# v1 → v3 feature parity review

**Reviewed:** 2026-08-06. **Source:** the Recess app at `rf/apps/remog` plus the `nibkp.sql`
database dump. **Purpose:** the Node rewrite was never finished, so `config.js` and the v2
codebase are an unreliable guide to what the game actually did. This enumerates v1's real
feature surface and measures [BRD-01](BRD-01-core-game-loop.md) against it.

## Method

Three signals, because none alone is trustworthy:

1. **Route annotations.** Recess declares routes as `!Route` docblocks. Controllers with
   exactly **7** routes carry the framework's stock CRUD scaffold — `index`, `details`,
   `newForm`, `insert`, `editForm`, `update`, `delete` — and are admin scaffolding, not game
   features. Anything above 7, or custom-named, is real.
2. **Table population in the dump.** A feature with a controller, a model, and an empty table
   was designed and never shipped.
3. **Reading the handler** where the first two disagree.

## v1 feature inventory

### Shipped — controller, custom routes, and data

| Feature | Routes | Evidence |
|---|---|---|
| **Tours** (`Group`) | 16 — search, tourDetails, my, dismiss, updateTour, complete, buildForm, betaForm, disable | `Groups` populated |
| **Doorways** | 12 — doorlist by page, doorlist by group, **rate**, dismiss, delete | `Doorways`, `DoorwayUsers` populated |
| **Users** | 11 — signpostlist, profile, avatar, toggleShield | `Users` populated |
| **Signposts** | 10 — all, search, groupIndex | in `Laid` |
| **Barrels** (`Gift`) | 8 — dismiss, del | `Gifts`, `GiftUsers` populated |
| **Placed tools** (`Laid`) | 8 — alloftool | `Laid` populated |
| **Mail** (`Message`) | 8 — count | `Messages` populated |
| **Shop** (`Tool`) | 8 — buy | `Tools` populated |
| **Pages** | 6 — detail by hash pair, **place**, delete | `Track` populated |
| **Manual** (`Folio`) | 8 | `Folios` populated — the in-game help text |

### Designed but never shipped — scaffold only, empty tables

| Feature | Status |
|---|---|
| **Random events** (`RandomEvent`) | Scaffold CRUD, table empty, and **never referenced from `PageController`**. Designed, never wired. |
| **Stamps** (`Stamp`, `UserStamp`) | `Stamps` **has rows** — the stamps were defined — but `UserStamps` is empty, so none was ever awarded. A collectible system that never went live. |
| **Forums** (`Forum`, `Topic`, `Post`) | Scaffold, all three tables empty. Community ran on separate software. |
| **Beta testers** (`Tester`) | Scaffold, empty. |
| **Locations** | Table empty — presence was tracked through `Page`/`Domain` membership, not this table. |
| **Tour completions** (`GroupComplete`) | Controller has a custom `create` route and `GroupController::complete` pays out 50 sg, but the table is **empty**. Either completions were never recorded, or the payout shipped ahead of its audit trail. Relevant to D13. |

## Parity matrix against BRD-01

| v1 feature | BRD-01 | Verdict |
|---|---|---|
| Register / authenticate | WF-1, WF-2 | Covered |
| Enter a page by URL+domain hash | WF-3 | Covered |
| Buy tools | WF-4 | Covered — plus the level×250 cap from Amendment A |
| Place a tool | WF-5 | Covered |
| Trap / spider triggers | WF-6, WF-7 | Covered, once damage is redenominated in sg |
| Toggle shield | WF-8 | Covered |
| Stash / loot barrel | WF-9, WF-10 | Covered |
| Traverse doorway | WF-11 | Covered |
| Level up | WF-15 | Added by Amendment A |
| Stipend | WF-16 | Added by Amendment A |
| Leave a page | WF-14 | Covered |
| Mail | — | Correctly deferred to BRD-02 |

## Gaps — v1 features BRD-01 does not cover

These are shipped v1 features with live data. Each needs a workflow.

1. **Rate a doorway.** `PUT doorway/$ID/rate/$Rating`; the `Doorway` model carries `score` and
   `votes`, and the v2 `DoorwayModel.js` kept both fields. Player-facing quality signal on
   player-supplied destinations — and therefore also a moderation input. **Not in BRD-01 at
   all.**

2. **Dismiss.** Doorways, barrels, and tours each have a `dismiss` route, and
   `DoorwayUsers`/`GiftUsers` are populated — these are per-player interaction records. A
   player can hide a thing they have already seen or rejected. This is what stops a page you
   revisit from re-offering the same doorway forever, and it is load-bearing for WF-3.

3. **The tour subsystem is far larger than WF-12.** WF-12 describes placing and following a
   signpost. v1 has tour **building**, **searching** by text, **my tours**, **completion** with
   its 50 sg payout, **disabling**, and **dismissing**. This is a subsystem, not a workflow.

4. **Discovery.** `signpost/search`, `signpost/all`, `group/search`, `user/signposts`,
   `laid/tool/$ID`. Players could browse and search what exists. BRD-01 assumes you only ever
   encounter things by walking into them.

5. **Doorway chains as first-class.** `doorway/list/$group/$page` lists a chain. BRD-01 has
   chaining only as OPEN-9.

6. **Avatars.** `user/$ID/avatar`, plus `public/i/avatar/ava.php`.

7. **The page registry (`Track`).** v1 has a dedicated table mapping URL hash and domain hash
   to a page identity, referenced by `MoveSpiders_sp`. BRD-01 treats page identity as implicit
   in WF-3.

8. **NSFW filtering.** The `nsfw` flag exists on doorways and signposts in both v1 and v2, and
   the toolbar had a `filter_nsfw_all` preference — so filtering was a server responsibility.
   BRD-01 records the flag but never filters on it.

## What `Group` actually is

Asked directly, and the answer is **an abstraction** — not chained doorways. Chaining is a
separate mechanism. Three distinct things were conflated in v1's vocabulary:

### The placement spine

`Laid` is the one table of placed tool instances: `ID`, `TOOLID` (0–5), `USERID`, `HASHID`
(the page), `DATE`, `LEVEL`. Every placement of every tool is a `Laid` row.

The per-tool tables — `Doorways`, `Signposts`, `Gifts` — hold the type-specific detail and
**share the `Laid` row's primary key**. Their `ID` columns are `PrimaryKey, Integer` with no
auto-increment, and each declares `!BelongsTo laid, Key: ID`. This is table-per-subtype with a
shared primary key: `Doorway 4711` *is* `Laid 4711`.

### The two link structures are different shapes

| | Structure | Mechanism |
|---|---|---|
| **Signpost tour** | a **tree**, up to 4 children per node | `Signpost.ANextID`, `BNextID`, `CNextID`, `DNextID` |
| **Doorway chain** | a **linked list**, one successor | `Doorway.NextID` |

`Signpost::loadBranches()` walks the tree recursively, carrying a list of already-visited IDs
as cycle protection — so tours could loop back on themselves and the code defends against it.

The four branch columns are exactly `config.js`'s `signposts.branches`: a guide gets 1 branch
at level 0, rising to 4 at level 20, while givers and guardians are fixed at 2. The v2 design
and the v1 schema agree precisely.

### `Group` is the container over both

```
Group: ID, Title, Description, OwnerID, CreationDate, Rating, Votes, ImageUrl, Enabled
  !HasMany signposts, Key: GroupID
  !HasMany doorways,  Key: GroupID
  !HasMany groupCompletes
  !BelongsTo laid / signpost / doorway, Key: ID
```

`Group` holds no link structure of its own. It is **presentation, ownership, and social
metadata** for a collection that both signposts and doorways join by setting `GroupID`. It
carries its own `Rating` and `Votes`, so tours were rated as wholes — separate from the
per-doorway rating in gap 1.

Its identity is the subtle part: `Group` declares `!BelongsTo laid/signpost/doorway, Key: ID`,
and `Group::toTour()` does `new Signpost($this->ID)`. **A group's ID is its root placement's
ID.** A group is created when a player places the root tool, and the group *is* that placement
plus metadata. Members then point back via `GroupID`.

`Enabled` is what `group/$ID/disable` toggles — an owner could retire a tour without deleting
its signposts.

### Consequences for BRD-05

- "Tour" and "doorway chain" are **two different structures sharing one container type**. They
  should be modelled as such, not merged.
- The tree shape is the real WF-12 gap: BRD-01 describes a signpost as a single marker with
  branches, but a tour is a navigable tree with cycle protection.
- Group-level `Rating`/`Votes` and doorway-level `Rating`/`Votes` are **separate systems**.
  BRD-06 must not collapse them.
- The shared-primary-key inheritance between `Laid` and its subtype tables is a v1
  *implementation* choice, not a business rule. It belongs in the TRD, not the BRD — but it
  explains why `config.js` and `models/` in v2 both use timestamp-derived IDs for placements.

## Recommendation

Adding all eight to BRD-01 would make it too large to review, which is the failure mode the
one-BRD-per-block rule exists to prevent. Suggested split:

- **Into BRD-01** (core loop, small additions): dismiss (2), the page registry (7), NSFW
  filtering (8), and doorway chains (5, closing OPEN-9).
- **New BRD-05 — Tours**: the whole `Group` subsystem (3), plus tour and signpost discovery
  (4). It has its own actors, its own economy hook via D13, and its own completion audit.
- **New BRD-06 — Reputation and discovery**: doorway rating (1), remaining discovery surfaces
  (4), avatars (6). Rating feeds BRD-03 Moderation, so these should be reconciled.

**Not recommended for any BRD:** random events, stamps, forums, and the tester programme. All
four were scaffolded and abandoned in v1, and reviving unshipped features is scope the project
never had. They should be recorded as deliberate exclusions so a future reader knows they were
considered.
