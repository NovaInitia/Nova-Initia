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

---

## Cycle 2 — 2026-08-06 — IdentityModule

- **Shipped:** `register`, `authenticate`, `resolveSession`, `revokeSession`,
  `getPublicProfile`; in-memory inventory, armor and session repositories. **147 tests, 0 fail**,
  typecheck clean from a wiped `dist/`.
- **Security decisions were made in the spec, not by the implementer** — scrypt at
  `N=32768, r=8, p=1, keylen=64` with an explicit `maxmem: 64MB` (Node's 32MB default throws at
  this cost), 16-byte random salt, and the self-describing storage format
  `scrypt$N$r$p$salt$hash` so cost can be raised later without invalidating existing hashes.
  Verification re-derives with the *stored* parameters and length-guards before
  `timingSafeEqual`, which throws on unequal lengths.
- **Session tokens are 256-bit random and stored only as sha256.** Using a fast hash here is
  correct and is not an inconsistency with scrypt above: the token is uniform randomness, not a
  low-entropy human secret, so it needs no key stretching. Recorded because it looks like a
  defect to anyone reviewing quickly, and will keep looking like one.
- **Two stub-contract changes.** `IdentityModule` had no ledger dependency, so D22's starting
  state could not be ledgered and the "sum equals balance" invariant would have been false for
  every player until their first tool use; `ILedgerRepository` added. `register`/`authenticate`
  now also return the raw token, which is deliberately never stored and so cannot be recovered
  afterwards.
- **Review, verified against live reproductions rather than the test suite:** cross-player
  session revocation blocked; `PublicProfile` carries exactly seven keys and none of
  `credentialHash`/`email`/`sg`/`karma`/`isModerator`/`isOperator`; `resolveSession` returns
  `null` — never throws — on empty, garbage, path-traversal and 10k-character tokens; the same
  credential registered twice produces different stored hashes; sg and karma ledgers both sum
  to the balance at birth; D22 inventory is 10/10 in-class and 5 across the other four,
  asserted through `owningClassOf` rather than hardcoded tool ids.
- **One defect, and it was the *unreported* kind.** Ids were generated with
  `randomBytes(16).toString('hex')` instead of `randomUUID()`, and the report did not mention
  the deviation. `SCHEMA-01` declares these as `uuid` columns — and PostgreSQL *accepts* bare
  32-hex, so this would not have failed at M1; it would have silently produced ids that are not
  valid v4 UUIDs and match nothing else in the system. Fixed, with a format assertion added.
  **Lesson: a deviation that still "works" is more dangerous than one that breaks the build,
  and an implementer's silence is not evidence of conformance.**
- **Lesson — measure before reporting a timing attack.** First measurement showed unknown-name
  authentication 58ms slower than wrong-credential, which reads exactly like the username
  enumeration oracle the dummy-hash mitigation exists to prevent. With warmup and medians over
  25 samples the gap reversed sign (−7.4%): the original figure was the one-time lazy dummy-hash
  computation plus JIT noise. Both paths do exactly one scrypt. Had I filed it from the first
  number, a correct mitigation would have been "fixed".
- **Mutation-tested the highest-risk claim** (now standard practice, per cycle 1). Commenting
  out the inventory branch of `restore()` correctly failed `rolled back transaction includes
  inventory`. The rollback tests are real.
- **Known gap, deferred to M1 by necessity:** `register` check-then-inserts on name uniqueness.
  No in-memory store can make that safe; it needs a unique constraint on `player.name`, now
  recorded on roadmap item 2.
- **Continue?** Yes. One slice from M0 complete. Note for whoever runs cycle 3: the scenario
  harness is the first artefact a human is meant to *read the output of*, so it should print
  observable state legibly rather than assert.
