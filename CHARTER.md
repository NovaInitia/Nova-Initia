# Charter: Nova Initia v3 server

**Mode:** directed
**Started:** 2026-08-06
**Source documents:** `docs/BRD-01` (Amendments A–I, approved), `docs/BRD-05` and `docs/BRD-06`
(approved), `docs/TRD-01` (verified), `docs/SCHEMA-01`, `docs/STUBS-01`

## Target user

A **Nova Initia player**: someone who browses the ordinary web with a game client installed, and
who leaves traps, barrels and doorways on the pages they visit for other players to walk into —
and who walks into other people's. They pick a caste, accumulate karma by how they play, and
spend the currency that earns them.

The *immediate* consumer is different and worth naming honestly: **no client exists and none is
in scope.** Until one does, the server's only consumers are its own test suite and a scripted
smoke harness. That is a real limitation, not a technicality — see Non-goals and A3.

## Core use case

A player arrives at a web page. The server resolves the page's identity from the hashes the
client supplies, registers the player as present, fires any trap or spider waiting there, and
reports what survives filtering — barrels, doorways, signposts. The player then places a tool of
their own, which costs them inventory, earns them experience, and moves their karma. That single
round trip is the game; everything else in scope exists to support it.

## Non-goals

- **Any client.** No browser extension, no web app, no UI of any kind.
- **Tours (BRD-05) and reputation/discovery (BRD-06).** Approved, but not this project's scope;
  the core-loop schema reserves their seams.
- **Moderation (BRD-03), messaging (BRD-02), administration (BRD-04).** Not written.
- **Tool parts and trading.** Deferred with intent recorded; the consumption seam is reserved.
- **Reviving the legacy code.** The v2 Node app at the repo root and its JSON fixture store stay
  as they are, runnable and untouched. v3 lives entirely in `v3/`.
- **Migrating v1 data.** The historical board is unreachable under any normalisation (BRD-01 F.7).

## Milestones

- **M0 — walking skeleton.** In-memory repositories, `ProgressionModule`, and `IdentityModule`
  registration and authentication. A scripted scenario creates a player with the D22 starting
  state and authenticates them. *(`IBalanceTable` is already complete — 49 tests.)*
- **M1 — the core loop.** `GeographyModule`, `PlacementModule`, `EncounterModule`. A player
  enters a page, places each of the five placeable tools, and trips a trap and a spider.
- **M2 — the economy.** `EconomyModule`: purchase, level purchase, and the stipend as a
  scheduled job with subject-level idempotency.
- **M3 — persistence.** PostgreSQL repositories, migrations from `SCHEMA-01`, audit triggers,
  and the balance tables under D23.
- **M4 — the API boundary.** HTTP surface, session resolution, and the request-scoped NSFW and
  normalisation-version handling.

## Definition of done

A player can, over HTTP against PostgreSQL: register and authenticate; enter and leave pages;
place all five placeable tools; trip traps and spiders with damage denominated in sg; equip a
shield and have it absorb; stash and loot barrels; traverse doorways; follow signposts; buy
tools; purchase a level; and receive stipends from a scheduled job. All eighteen BRD-01
workflows are represented, the suite is green, and a whole-codebase adversarial audit is clean.

## Stop criteria

- Stop when the definition of done is met.
- **Any single roadmap item unresolved after 3 cycles forces a pivot, pause or re-scope** — not
  a fourth attempt.
- Pause to `REQUESTS.md` if a source document turns out to be infeasible or self-contradictory
  in a way charter distillation did not surface.
- Pause if M3 is reached and no PostgreSQL server is available (see A1).

## Ambiguity resolutions

Each is a judgement call made during distillation, and each is what this sign-off approves.

**A1 — No PostgreSQL server is available in this environment.** `psql` is present; no server is.
Rather than block, milestones are sequenced so that **M0–M2 build against in-memory repositories
behind the existing repository interfaces**, and M3 introduces the real ones. The risk is
accepted and named: in-memory repositories cannot exercise transactional atomicity, the audit
triggers, or the advisory locks, so **M3 must re-verify every atomicity guarantee in TRD §8.2
rather than assume it**. A non-blocking `REQUESTS.md` item asks for a server before M3.

**A2 — Parcel 2 is already complete.** `StaticBalanceTable` and its seed data shipped before this
charter, with 49 passing tests. Cycle 1 therefore begins at parcel 1 (`ProgressionModule`), not
at a skeleton.

**A3 — "Usable from minute one" has no client to be usable from.** M0's walking skeleton is
therefore a **scripted scenario harness** that drives the modules directly and prints observable
state. It is the substitute for a UI, and it is how each milestone is smoke-tested.

**A4 — Two open design items are resolved here rather than left to an implementer.** The
placement-cap race (`SCHEMA-01` §8) is resolved as **a PostgreSQL advisory lock on
`(page, player, tool)` in the placement transaction**. Audit scope stays as designed: **sg,
experience and karma are all ledgered**.

**A5 — OPEN-14 (text fragments) takes its standing default:** fragments are stripped, both named
anchors and `#:~:text=` directives. No behaviour depends on the decision, so it does not block.

**A6 — Legacy code is frozen, not deleted.** `CODEBASE.md` documents it; the JSON fixture store
and its 51 tests remain runnable. No cycle may modify anything outside `v3/` and the state files
without a roadmap item saying so.
