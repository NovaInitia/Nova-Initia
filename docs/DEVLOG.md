# Development log

One entry per cycle, newest last. This file is the loop's judgment; `ROADMAP.md` is its plan.

---

## Cycle 0 — 2026-08-06 — setup

- **Shipped:** Charter, roadmap, requests, implementer constraints, this log, root `.gitignore`.
  No product code.
- **Companion skills — checked against the available-skills list, all six PRESENT:**
  `understanding-before-coding`, `writing-lean-code`, `scientific-debugging`,
  `verification-before-completion`, `reasoning-traps`, `ai-grouch`.
  Reviews therefore run the real **`ai-grouch`** skill, not the fallback persona. Later cycles
  inherit this answer rather than re-guessing it; if a review ever runs on the fallback, the
  entry must say so explicitly.
- **Preflight:** git author set (`Stephen <stephen@nova-initia.com>`), remote
  `github.com/NovaInitia/Nova-Initia` present, branch `master`. Working tree matched HEAD for
  `node_modules/` once the earlier module swap was accounted for.
- **Environment:** Node 22.19, TypeScript 5.6, `node:test`. **No PostgreSQL server** — `psql`
  present, no server, `pg_ctl`/`postgres` absent. Drove ambiguity resolution A1 and the
  milestone ordering.
- **Prior art carried in:** `IBalanceTable` (parcel 2) was implemented before the loop was
  adopted — 49 tests passing, typecheck clean. Recorded on the roadmap as done, and it is the
  reason cycle 1 starts at parcel 1 rather than a skeleton (CHARTER A2).
- **Lesson:** the design phases (BRD/TRD/SCHEMA/STUBS) leave far less for cycle-time judgement
  than a normal loop start — most decisions are already locked in approved documents. The
  corresponding risk is the opposite of the usual one: not under-specification, but a cycle
  faithfully implementing a document that turns out to be wrong. Review should probe the
  *documents'* claims, not only the code's conformance to them.
- **Continue?** Yes — pending charter sign-off, which is the one mandatory gate.

---

## Cycle 1 — 2026-08-06 — ProgressionModule + in-memory repositories

- **Charter approved** by the user. Two REQUESTS items came back answered in the same breath,
  and one of them changed the plan.
- **Shipped:** `ProgressionModule` (`awardXp`, `adjustKarma`, `adjustSg`, `canAdvance`),
  `InMemoryDatabase` with player / class-progress / ledger repositories and a unit of work,
  `owningClassOf()` and `maxLevel()` on `IBalanceTable`. **113 tests, 0 fail** (49 pre-existing,
  64 new), typecheck clean from a wiped `dist/`.
- **Re-plan: persistence moved from M3 to M1.** The user started a PostgreSQL server, voiding
  the constraint CHARTER A1 was built around. Rather than carry A1's accepted debt — build the
  economy on in-memory substitutes, then re-verify every atomicity guarantee retroactively —
  M1 now lands migrations, audit triggers and real repositories, and M2/M3 are built on them.
  A role for the `stephen` account is still missing, so M0 proceeds unblocked meanwhile.
- **Scope trimmed on the way in.** The roadmap said "implement every interface in
  `contracts/repositories.ts`". Only three have a consumer in M0, and M1 replaces them all with
  real ones, so building the other eleven would have been speculative work with a short
  shelf life. Built three.
- **Two gaps the stub could not express:** `IBalanceTable` exposed no tool→owning-class mapping
  and no maximum level, and `adjustKarma`/`canAdvance` are unwritable without them. Both added.
  Worth noting for later phases: the stub skeleton is a good contract for *shape*, and a poor
  one for *what a method needs to read*.
- **The TRD and the stub disagree on signatures.** TRD §7.1 lists `awardXp(tx, player, cls,
  amount)` and no `adjustSg` at all; the stub carries ledger cause, placement and counterparty
  and does have `adjustSg`. Went with the stub — the TRD summary predates the `LedgerEntry`
  shape, which cannot be populated from the TRD's parameter list. Cycle 0 predicted this class
  of problem ("a cycle faithfully implementing a document that turns out to be wrong"); it
  showed up in cycle 1.
- **Review found four defects, one blocking.** `adjustSg` validated nothing, so a `NaN` delta
  set a player's sg to `NaN` permanently — and the ledger invariant check reported *true* on the
  corrupt account, because `NaN === NaN` under `Object.is`. Also: the in-memory unit of work
  rolled back global state, so a rollback in one transaction silently destroyed another's
  committed write; no module test ran inside a unit of work at all; `listForPlayer` dropped rows
  on a negative limit. All fixed, all re-verified against the original reproductions.
- **Lesson — the verification command was the least verified thing in the repo.** I specced a
  change to `npm test` from `node --test dist/**/*.test.js` to `node --test dist/`, believing
  the runner recurses into a directory. It does not: it reports `ok 1 - dist`, `# fail 0`, and
  exits green having run nothing. The original worked only by accident (npm runs scripts under
  `sh`, where `**` degrades to `*`, and every test file happened to sit exactly one level deep).
  Both forms were wrong; the quoted `"dist/**/*.test.js"` is right at any depth. A test command
  that silently passes is worse than one that fails, and nothing in the loop's discipline
  catches it, because every downstream check *reads as green*. The implementer caught this and
  was right to refuse the spec — worth crediting.
- **Lesson — a test can assert an invariant and be incapable of observing it.** The
  ledger-invariant test used a sequence that never clamped, so `applied === delta` on every row.
  Mutating `appliedDelta: applied` → `appliedDelta: delta` left it passing. Reading the test
  would not have revealed this; mutating the code did. **Mutation-testing the one or two tests
  that carry a design's central claim is now standard practice for this loop.**
- **Deferred with intent:** `lastActiveAt`. TRD §10.1 sets it on tool use only, and its trigger
  set spans modules that do not exist yet. Recorded on roadmap item 11 rather than
  half-implemented where it would have looked finished.
- **Continue?** Yes. M0 is two slices from done and the next one, `IdentityModule`, is where
  credential hashing lands — the first genuinely security-sensitive slice of the project.
