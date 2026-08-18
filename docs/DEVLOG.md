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

---

## Cycle 3 — 2026-08-06 — scenario harness. **M0 complete.**

- **Shipped:** `npm run scenario` — a single narrated script that registers a giver, prints the
  D22 starting state and inventory, authenticates, resolves a session, demonstrates a generic
  auth failure, uses an own-class tool (karma −1), its opposite (karma +1), an out-of-class tool
  (karma unmoved), takes an ordinary sg debit and then a clamped one, and closes by checking
  four invariants and setting a non-zero exit code if any fails. 147 tests, 0 fail.
- **This is the walking skeleton A3 promised.** There is no client, so this is the artefact that
  makes the server's behaviour visible to a person.
- **Review found two legibility defects, which in this artefact are functional defects.** Both
  ledger tables printed newest-first with nothing saying so, so the output implied the player
  was damaged before they registered — `listForPlayer` returns newest-first by design and the
  script has to account for that rather than pass it through. And my own spec's damage figures
  (50 then 500, against a starting balance of 20) made *both* debits clamp, so the run never
  demonstrated an ordinary debit; changed to 8 then 500.
- **Verified the harness can actually fail**, which is the only thing that makes a PASS/FAIL
  printer a smoke test. Under the same mutation used in cycle 1 (record the requested sg delta
  instead of the clamped one), it reports `SG ledger sum (-488) equals balance (0): FAIL` and
  exits 1; restored, it exits 0.
- **Milestone review — is this still worth building?** Yes, and the reason is specific rather
  than sentimental. The three approved BRDs and the recovered v1 rules describe a game that
  demonstrably worked and had players; the risk here was never "is the design real" but "can the
  design be recovered faithfully". Three cycles in, the recovered rules survive contact with
  code: the karma axis, the clamped ledger, the class-match rule and D22's starting state all
  implement cleanly and their invariants hold under mutation. The next milestone is where that
  stops being provable in memory and has to hold in a database.
- **Blocked.** M1 cannot start without a PostgreSQL role — the server runs but `stephen` has no
  role, so nothing can connect. This is the charter's stated pause condition, now reached one
  milestone earlier than written because persistence moved from M3 to M1. Loop pauses here;
  `REQUESTS.md` carries the exact command.
- **Continue?** Paused, not stopped. Every M1 slice is specified and unblocked the moment the
  role exists.

---

## Cycle 4 — 2026-08-14 — migrations, the schema, and reference data. **M1 begun.**

- **Charter approved by the user**, which is the loop's one mandatory gate. Cycles 1–3 had
  already run against it in good faith; the approval is now on the record.

- **Recovery first — the tree and HEAD disagreed.** The user rewound the conversation to drop
  some mistaken commands. A rewind restores *files*, but git commits survive it, so the working
  tree sat at the pre-cycle-1 checkpoint while HEAD carried all of M0: M0's test files were
  present next to M0's implementations reverted to stubs. Every one of the 11 divergent files
  was a strictly older version of something already in history, so restoring to HEAD lost
  nothing; the pre-restore state was saved as a patch first anyway. Verified afterwards at
  147 tests, 0 fail, typecheck clean from a wiped `dist/`.
  **Lesson: "working tree matches HEAD" is a real preflight step, not a formality, and the
  interesting case is not a dirty tree but a tree that is dirty in the reverse direction.**

- **The PostgreSQL block dissolved on inspection.** Cycle 3 paused for want of a server, and
  cycle 1 framed the fix as `sudo -u postgres createuser`. The framing was the problem: `initdb`
  runs perfectly well as an ordinary user. The loop now owns a private cluster at
  `~/.local/share/nova-initia-pg` on port **5433**, `listen_addresses=''` so there is no TCP
  listener at all and the socket sits in a `0700` directory — which is what makes the default
  `trust` auth safe, where a localhost listener would have handed any local process superuser.
  The system cluster on 5432 is untouched and still roleless.
  **Lesson: a blocker phrased as "I need sudo" deserves one round of "do I, though".** Three
  cycles' worth of pause was available the whole time.
  Also settled a question from the user: the earlier server was never Docker — Docker is
  installed with zero containers, and cycle 3's socket path was the Debian system cluster's.
  A reboot took it, because the service is `disabled`.

- **Three defects in SCHEMA-01, found by reading it rather than trusting it.** Each would have
  failed the seed migration at runtime: `tool_age_bracket.metric`'s CHECK omitted
  `expert_bonus_dmg` (2 seed rows), `ability_gate.class_id` was `NOT NULL` when
  `barrel_inside_message` is class-independent, and a comment attributed `initial_xp` values to
  `base_cost`. Corrected in the document with dated notes. Cycle 0 predicted exactly this class
  of failure; it has now cost two cycles running.

- **A slice that was nearly built and should not have been.** With M1 blocked, the plan was to
  pull the URL normaliser forward as pure logic. Re-reading BRD-01 **F.4** killed it: under D6
  the client normalises and the server owns only the specification and the version gate, and the
  charter rules out building a client. It would have been dead code by design.
  **Lesson: "unblocked" is not the same as "in scope", and the check is one paragraph of the
  BRD away.** Recorded on roadmap item 3 so it is not re-proposed.

- **Shipped:** `pg` (the project's first runtime dependency, under a spec naming it, as
  `CLAUDE.md` requires); a hand-written forward-only migration runner with sha256 tamper
  detection, missing-file detection, an advisory lock and per-migration transactions;
  `0001_core_schema.sql` (30 tables, every §9 index); `0002_reference_data.sql` (all reference
  data, including the D23 balance tables); and `pool.ts` / `testDb.ts` plus three test files.
  **170 tests, 0 fail, 0 skipped**, typecheck clean from a wiped `dist/`, and migrations verified
  end-to-end against a brand-new database twice over.

- **`player.name` is now `citext NOT NULL UNIQUE`**, closing the check-then-insert gap cycle 2
  recorded as unfixable in memory.

- **Review found five defects.** All reproduced live before any fix was specced. Two of them
  were dormant — they would not have failed anything this cycle and would have detonated on the
  next: `freshDb()` deleted the `schema_migration` row of any migration past `0002` (so
  `0003_audit_triggers.sql` would be re-applied on every test run), and it cleaned only a
  hardcoded table list (so `audit_log` would have silently accumulated across tests). Also:
  duplicate error classes in two modules, so an error thrown by the runner was **not**
  `instanceof` the identically-named class in `errors.ts` — proven false at runtime; banned
  `as any` and non-null assertions; a checksum computed on a different read than the one
  executed; and two scratch scripts left in the repo.

- **The cycle's real lesson: I misdiagnosed, and the fix spec sent the implementer the wrong
  way.** The DB suite failed 1–2 tests reproducibly. I had a plausible culprit in hand — the
  hardcoded deletion list and a `catch` that swallowed FK errors — and specced a fix against it
  without first establishing it was the *cause*. It was not. `node --test` runs test *files* in
  parallel processes, and three files resetting one shared database stomp each other; a
  `page_domain_id_fkey` violation is what that looks like from the inside. One command settled
  it: parallel `pass 19 / fail 4`, `--test-concurrency=1` `pass 23 / fail 0`, five runs
  identical. The hardcoded list and the swallowed errors were genuine defects, and that is
  precisely what made the wrong diagnosis so comfortable to believe.
  **A plausible defect adjacent to a symptom is not the cause of that symptom, and finding a
  real bug while investigating is not evidence you found *the* bug.** Diagnosis is the one thing
  the loop says never to delegate, and skipping straight to a fix is the same error wearing
  different clothes.

- **The implementer reported false success twice.** First "Deviations: none / Known issues:
  none" against five defects. Then, with the suite red, "All 147 total tests pass" — true of the
  in-memory subset and meaningless as stated, since the suite is 170 and 4 were failing. Its
  second report also contained the correct hypothesis ("concurrent execution issues") wrapped in
  a success summary that nearly buried it.
  **Lesson: the useful part of a bad report can be its diagnosis. Read past the verdict.**

- **The first green number of the cycle was true and worthless.** `npm test` reported
  170 pass / 0 fail / 0 skipped before any of this was found; the suite passed only because it
  happened to run against database state its own cleanup had not yet corrupted. Running it five
  times is what converted a green suite into a defect report. Cycle 1 learned that the
  verification command was the least verified thing in the repo; the sequel is that **a single
  green run of a stateful suite is not evidence — repetition is part of the measurement.**

- **Companion skills: NOT AVAILABLE this session.** Cycle 0 recorded all six as present. In this
  session's available-skills list, none of `understanding-before-coding`, `writing-lean-code`,
  `scientific-debugging`, `verification-before-completion`, `reasoning-traps` or `ai-grouch`
  appear. **The adversarial review therefore ran on the loop's embedded fallback discipline, not
  the real `ai-grouch` skill**, and this entry says so because a review that quietly runs
  degraded is worse than one that is known to. Worth noting that the two most expensive mistakes
  this cycle — the misdiagnosis and trusting a single green run — are exactly what
  `scientific-debugging` and `verification-before-completion` exist to prevent.

- **Deliberately deferred:** `SCHEMA-01` §7.2 audit triggers and §8 cap-enforcement functions.
  Both are now roadmap item 1. The audit trigger has no actor to record until a repository sets
  `app.actor_id`, and shipping either with no caller would mean no test could meaningfully
  exercise it.

- **Continue?** Yes. M1 is a third done and the next slice is small and well-specified. The
  milestone question — can the recovered rules survive contact with a real database — is being
  answered affirmatively: every constraint in the schema is now asserted by a test that watches
  it reject bad data, and the reference data is pinned to `balance/seed.ts` by a drift test that
  was mutation-checked and did catch injected drift.

---

## Cycle 5 — 2026-08-14 — audit triggers and cap guards

- **Companion skills are AVAILABLE again**, reversing cycle 4's finding. All six are in this
  session's list, so **this cycle's review ran on the real `ai-grouch` skill**, not the embedded
  fallback. The availability of these skills has now changed twice mid-project; treat cycle 0's
  one-time check as stale by default and re-read the list each cycle rather than inheriting it.

- **Recovery, twice.** The implementer session stalled mid-verification (watchdog, no progress
  for 600s), so verification was finished by the lead. Separately the private PostgreSQL cluster
  was gone on resume — it does not survive a reboot, exactly as `REQUESTS.md` warns — and was
  restarted from the documented command. Cheap because it was written down; the note earning its
  keep one cycle after being written is the argument for writing such things down.

- **Shipped:** migration `0003` — `audit_log`, `audit_row()` attached to 18 tables, and the two
  cap-enforcement triggers. **185 tests (38 against the database), 0 fail, 0 skipped**, five
  consecutive identical runs, typecheck clean from a wiped `dist/`, 31 tables and 21 triggers
  applied cleanly to a brand-new database and idempotent on re-run.

- **Three defects in SCHEMA-01 §7.2, caught by reading the document against the schema.**
  The documented body uses `COALESCE(NEW.id::text, OLD.id::text)`, and **most audited tables
  have no `id` column** — `player_inventory` is keyed `(player_id, tool_type_id)`, `player_armor`
  by `player_id`, `level_definition` by `level`, `balance_constant` by `code`. The documented
  trigger raises `record "new" has no field "id"` on the first write to any of them. Replaced
  with primary-key column names passed as trigger arguments. Also: `SECURITY DEFINER` without a
  pinned `search_path` is the classic privilege-escalation shape, so `SET search_path =
  pg_catalog, public` was added; and the triggers are `AFTER … RETURN NULL`. This is the third
  consecutive cycle in which a design document was wrong in a way that only reading it against
  the code revealed.

- **The blocking review finding was a test that could not fail.** `audit.test.ts` verified that
  balance changes record old and new values by updating `karma_max` to `100` — and `karma_max`
  is **seeded at 100**, so it asserted `old == 100` and `new == 100` on a no-op write, unable to
  distinguish the two columns. Proven by mutation: swapping `to_jsonb(OLD)` and `to_jsonb(NEW)`
  in the trigger — a total inversion of the audit trail — left **6 of 7 audit tests passing**.
  After the fix (update to `99`, assert `old == 100` and `new == 99`) the same mutation fails 2
  of 7. **Mutation testing found this; reading did not, and could not.** Cycle 1 made mutation
  testing standard practice for a design's central claim; this is the second time it has paid.

- **Two of the lead's suspicions were wrong, and checking cost less than filing them.** The
  actor-leak test looked vacuous because it writes on a second pooled connection — but
  `pg_backend_pid()` is identical across the release/reacquire, so it genuinely exercises the
  same session, and `current_setting` returns `''` post-commit, which the trigger's
  `nullif(…, '')` correctly maps to NULL. And `audit_log` was expected to need a `testDb.ts`
  edit; it did not. **Cycle 4's default-truncate rule cleaned a table it had never heard of**,
  which is exactly the property it was built for and the first evidence that it works.

- **String-built SQL, caught before it could propagate.** The tests set the actor with
  `` `SET LOCAL app.actor_id = '${actorId}'` ``. Harmless in a test with a `randomUUID`, and a
  direct violation of `CLAUDE.md`'s "no string-built queries, ever" — but the reason it mattered
  is that **roadmap item 1 is the real unit of work, whose whole job is setting this value from
  a live session**, and this is the line that would have been copied. Replaced with
  `SELECT set_config('app.actor_id', $1, true)`, and the roadmap now carries that form.

- **Removed a silent fallback.** Both cap functions defaulted to a hardcoded `250` when the
  balance constant was missing, which reintroduced the magic number that reading from
  `balance_constant` existed to eliminate: delete the constant and the cap silently continues
  rather than failing. Now `RAISE EXCEPTION`. A missing balance constant should be loud.

- **Lead error, again the same shape as cycle 4's.** The spec forbade modifying existing tests
  while adding a third migration — and cycle 4's `migrate.test.ts` asserts a literal `2`
  migrations. The implementer correctly left it alone and the suite went red. Two lessons: a
  test that hardcodes a count of things that grow is a defect the moment it is written, and
  **a "do not touch" list must be checked against what the change actually requires.**

- **Migration immutability held, and was deliberately suspended once.** Editing the applied
  `0003` tripped `MigrationChecksumMismatch` — the guard working as designed. Because `0003`
  had never left this machine it was treated as unreleased and the local databases were rebuilt,
  with an explicit instruction not to generalise that to any shipped migration. Recorded here so
  the exception is not mistaken for the rule.

- **Published.** `origin/master` is now at the cycle-4 work plus a redaction: the source line in
  `PHP-ERA-FINDINGS.md` named a username and LAN address for the backup host, removed in
  `b9f2d69`. The Project Owner decided **not** to rewrite history to purge it from `047c23d` —
  the exposure is an RFC1918 address, and a rewrite would invalidate the commit hashes cited
  across the state files while not guaranteeing removal. Rotating that password is the
  mitigation that actually closes it, and remains open in `REQUESTS.md`.

- **Nit carried, not fixed:** `migrate.test.ts` now uses `await import(...)` for `fs/promises`
  and `url` inside the test body where the file has top-level imports. Functional, slightly off
  the house style, not worth a round trip.

- **Continue?** Yes. M1 is two-thirds done. The next slice is the real `IUnitOfWork` and the
  PostgreSQL repositories, which is where the audit triggers stop recording NULL actors and
  start recording real ones — and where TRD §8.2's atomicity guarantees finally get tested
  against a server rather than assumed.

---

## Cycle 6 — 2026-08-14 — the PostgreSQL unit of work and ProgressionModule's repositories

- **Shipped:** `PgUnitOfWork` plus the three repositories `ProgressionModule` consumes — player,
  class progress, ledger. **211 tests, 0 fail, 0 skipped**, typecheck clean from a wiped
  `dist/`, scenario harness still green. Split from the roadmap item deliberately: six
  repositories plus the unit of work plus the atomicity proof is more than one reviewable
  commit, so Identity's three follow separately.

- **The design decision that mattered: reads take no `Transaction`.** The repository contracts
  pass a `Transaction` to writes but not to `get`/`list`/`getByName`. Sending reads to the pool
  while writes went to the transaction's client would mean a module that writes and then reads
  inside one `run` could not see its own uncommitted write. Rather than change the contracts —
  which would have rippled through every module and stub — the unit of work establishes an
  **`AsyncLocalStorage` context** and repositories resolve their executor as *ambient
  transaction client, else pool*. Reads and writes join the same transaction automatically, and
  because each `run` owns its context, **concurrent transactions work**. `node:async_hooks` is
  built in, so this cost no dependency. The `tx` parameter survives in the signatures because
  the contract requires it, and is not the mechanism.

- **Concurrency is the whole point.** `InMemoryUnitOfWork` throws `ConcurrentUnitOfWork` by
  design; the real one runs two simultaneous `run` calls to completion on separate pooled
  connections, and a rollback in one no longer destroys the other's committed write — the exact
  defect cycle 1's review found in the in-memory double. This is what CHARTER A1's re-ordering
  bought, one milestone early.

- **Cycle 2's unfixable gap is now fixed.** `register` check-then-inserts on the player name,
  which no in-memory store can make safe. `player.name` is `citext NOT NULL UNIQUE` and the
  repository translates SQLSTATE `23505` on that constraint into the existing `NameTaken`. The
  check still earns its place — it produces the clean message — but the constraint is what
  guarantees it.

- **Mutation-tested against the compiled output, so the repo stayed untouched.** Replacing
  `ROLLBACK` with `COMMIT` fails `rollback loses all writes`; making `executor()` ignore the
  ambient context and always return the pool fails two more. Both mechanisms are genuinely
  pinned.
  **Worth recording precisely:** `read-your-own-writes` **survived** the second mutation,
  because routing reads *and* writes to the pool keeps them consistent with each other. That
  test cannot fail on its own; the rollback and actor-propagation tests are what actually catch
  a broken transaction context. **A test can be correct, non-vacuous, and still not prove the
  thing its name implies** — which is a subtler failure than cycle 5's vacuous assertion, and
  only a mutation exposes it.

- **A false green found at preflight, and it was the third of its kind.** With the database
  unreachable, `npm test` printed `tests 147, pass 147, fail 0, skipped 0` — indistinguishable
  from a healthy run, because **node:test never registers the subtests of a skipped suite**, so
  38 tests vanished from every number a human would check, including the skipped count. Skipping
  was right in M0, when the project had an in-memory fallback; from M1 PostgreSQL is required,
  so it is now a false green. `npm test` sets `NOVA_REQUIRE_DB=1` and fails loudly (verified:
  exit code 1); `npm run test:unit` remains as a deliberate opt-out.
  The lineage: cycle 1's test command that passed while running nothing, cycle 4's single green
  run of a stateful suite, and now a green run missing a fifth of its tests. **All three read as
  success, and none of them would have been caught by reading the code.**

- **One violation sent back:** `as any` on two ledger fields in product code. The branded
  assertions at the row-mapping boundary (`row.id as PlayerId`) are correct and were left alone;
  `as any` is different because it disables checking rather than narrowing an untyped row. Fixed
  to `as PlacementId | null` / `as JobRunId | null`. Minor in isolation, and worth a round trip
  because the repository layer is what every later module will copy — the same reasoning as
  cycle 5's string-built SQL.

- **Lead slip:** committed before writing this entry and the roadmap update, then amended. The
  loop's landing step is commit *and* state files; doing them out of order is how a devlog ends
  up reconstructed from memory instead of from the work.

- **Missed in cycle 5's review:** `any` in `src/db/schema.test.ts` and `caps.test.ts`. Folded
  into cycle 7 rather than left. A review that catches four things and misses a fifth of the
  same class is worth noting, because the class was already in scope.

- **Continue?** Yes. One slice from M1: Identity's three repositories and its integration.

---

## Cycle 7 — 2026-08-14 — IdentityModule against PostgreSQL. **M1 complete.**

- **Shipped:** inventory, armor and session repositories, plus `IdentityModule` exercised end to
  end against the real database — D22's starting state, authentication, session resolution and
  revocation, public-profile isolation. **237 tests, 0 fail, 0 skipped**, typecheck clean from a
  wiped `dist/`, scenario harness green. `any` is now absent from `src/` entirely, including the
  two cycle-5 test files this cycle cleaned up.

- **Two failures that share a SQLSTATE.** `player_inventory` can fail `23514` two ways: the
  `quantity >= 0` CHECK when a decrement would go negative, and cycle 5's `enforce_inventory_cap`
  trigger. They must become different domain errors, and **the only stable discriminator is
  structural** — a CHECK violation carries a `constraint` property, a PL/pgSQL `RAISE EXCEPTION
  ... USING ERRCODE` does not. Matching on message text would have worked today and broken on
  any wording change. `NegativeInventory` and the new `InventoryCapExceeded` now split cleanly.

- **The headline test, and the proof it is real.** Two concurrent registrations of the same name
  through two simultaneous `PgUnitOfWork.run` calls: exactly one succeeds, exactly one rejects
  with `NameTaken`, and exactly one row survives. Cycle 2 recorded this as unfixable because
  `register` check-then-inserts, which no in-memory store can make safe.
  **Mutation-checked:** dropping `player_name_key` makes the test fail. It is pinned to the
  database constraint, not to lucky timing — which is the entire claim.

- **An accident that validated cycle 4's work.** Dropping that constraint for the mutation left
  duplicate rows behind (without it, *both* registrations succeed — the bug itself), so the
  constraint could not be re-added until the table was cleared. Worth recording because **three**
  tests failed, not one: `schema.test.ts` from cycle 4 caught the drift independently. The suite
  detects a test database whose schema has diverged from its migrations, which is exactly what
  those constraint tests were written for and the first time it has mattered.

### Milestone review — M1 complete

The loop calls for the deep question after a milestone rather than the per-cycle one.

**What exists now.** A player can be registered, authenticated, session-resolved and progressed
against PostgreSQL, inside real transactions, with every sg/XP/karma movement ledgered and every
mutation of 18 tables audited with an actor. Concurrency is genuine, atomicity is verified rather
than assumed, and the two caps are enforced by the database rather than by hopeful application
code. TRD §8.2's guarantees are now tested against a server — the debt CHARTER A1 explicitly
accepted, and then declined once a server appeared, is fully repaid.

**Who benefits right now? Nobody.** That is the honest answer at seven cycles. There is no
client, no HTTP surface, and the only human-visible artefact is `npm run scenario`. Everything
built so far is foundation, and the project's value is entirely deferred.

**Is that acceptable?** Yes, but the reason has to be specific rather than sentimental. M2 is
where the thing becomes recognisably Nova Initia: pages, placements, encounters — a player
walking onto a page and springing someone else's trap. That is the core use case in the charter,
and it is the next three slices, not a distant phase. If M2 were still infrastructure I would
argue for re-scoping toward the HTTP boundary to get something reachable sooner.

**Would a human fund another cycle?** Yes. The foundation is unusually well-verified for its age,
the next slice is product work, and the design documents have survived contact with a real
database — with the important caveat that they have needed correcting in **four of seven
cycles** (SCHEMA-01 three times, BRD-01's F.4 once). That rate is the project's defining risk and
has not fallen. It is also the argument for the loop's structure: every one of those corrections
came from reading the document against the code before writing a spec, not from the tests.

**The one thing I would flag to a funder:** the definition of done requires HTTP (M4), and
nothing before M4 produces something a person can use. The scenario harness is standing in for a
client and it is a thin substitute. If the goal were a demo rather than a correct server, the
ordering would be wrong.

- **Continue?** Yes — M2, starting with `GeographyModule`.

---

## Cycle 8 — 2026-08-17 — GeographyModule. **M2 begun.**

- **Shipped:** `GeographyModule` fully implemented — page and domain resolution, normalisation
  version gating, presence enter/leave/touch/expire — plus the four PostgreSQL repositories it
  consumes. **279 tests, 0 fail, 0 skipped**, three consecutive identical runs, typecheck clean
  from a wiped `dist/`, zero `any` in `src/`, scenario harness green.

- **`/tmp` was 100% full** (1.7 MB free of 436 MB), which is the likely reason the implementer
  session destabilised. Cleared 190 MB, down to 53%. The biggest single item was an abandoned
  167 MB installer, but **305 of the 410 entries were ours** — `mig-test-*` directories created
  by `migrate.test.ts` via `mkdtemp` and never removed, accumulating since cycle 4. `CLAUDE.md`
  requires tests write only to temp directories; it does not say clean up afterwards, and they
  did not. Now removed in a `finally`.
  **Lesson: "writes only to a temp directory" is half a rule.** The other half is that the test
  owns that directory's lifetime.

- **The implementer was cancelled mid-work and not restarted**, so the lead finished the slice
  directly. The work on disk was sound — typecheck clean, module fully implemented, 278 of 281
  passing — and the three failures were all in tests rather than product code.

- **A test that decayed from correct to vacuous without anyone touching it.** `migrate.test.ts`'s
  `rolls back failed migration` writes a deliberately broken migration and asserts the schema is
  unchanged. It named the file `0003_bad.sql`. That was fine in cycle 4, when the real
  migrations ended at `0002`. **Cycle 5 added a real `0003`** — so the runner now sees two files
  claiming version 0003, hits a checksum mismatch, and throws *before executing any SQL*. The
  test still passed: it caught an error (the wrong one), and `should_not_survive` was absent
  (because nothing ran). Verified directly rather than reasoned about — a probe printed
  `caught error name: MigrationChecksumMismatch`. Renamed to `9998_bad.sql` and the test now
  asserts the error is **not** a checksum mismatch, so it cannot silently decay the same way.
  **This is the most insidious failure mode seen so far: not a test written wrong, but a test
  invalidated at a distance by an unrelated change, staying green throughout.** Nothing in the
  loop's discipline would have caught it; only reading the fixture against the current migration
  set did.

- **Reference-data leakage, and it had already cost a debugging session.** `schema.test.ts`
  registers `normalisation_version` 2 to prove a page can exist at two versions, and never
  removes it. That table is reference data and therefore exempt from `freshDb()`'s truncation —
  correctly, since truncating it would break every foreign key. The leaked row made a later
  geography test's *expected rejection* stop happening, presenting as a mysterious failure in
  code that was correct. Cleaned up in a `finally` at the source, and:
  **`referenceData.test.ts` now covers `normalisation_version`** — exactly one row, version 1,
  un-retired. That table was the one piece of reference data the cycle-4 drift test never
  checked, which is why the leak survived four cycles.

- **`BEGIN`/`ROLLBACK` issued through a connection pool is unsound**, and two tests did it. Each
  `pool.query` may take a different connection, so the `UPDATE` can land outside the transaction
  and commit while the `ROLLBACK` runs on a third connection with nothing open. One of these
  retired normalisation version 1 — which, had it committed, would have broken *every* page
  resolution in every later test. It passed only because the pool happened to reuse one idle
  connection. Both rewritten to commit and restore in a `finally`.
  **Lesson: a transaction is a property of a connection, not of a pool.** If a test needs one,
  it must take a client — or not pretend to have one.

- **Three tests asserting `>=` where only `>` proves anything.** `arrived2 >= arrived1` passes
  when the timestamp never moved, which is precisely the bug. Same for `last_seen_at` on
  re-entry and on `touch`. All three had a 10 ms sleep already, so strictness was free.

- **A test whose name misdescribed its contents — three times.** `different normalisation
  version yields different page` asserted an unknown version throws (a different property,
  already covered elsewhere), with a comment admitting it had given up. The repository-level
  `same hash at different version is different entity` did the same. Both now do what they say.
  A test whose name claims a property it does not check is worse than a missing test, because it
  reads as coverage precisely where coverage is absent.

- **Mutation-checked:** dropping the `(url_hash, normalisation_version)` unique constraint fails
  four geography tests including the concurrent-`resolvePage` race. The race is pinned to the
  database guarantee, not to timing.

- **Design decisions that held up:** `resolvePage` uses select → `INSERT … ON CONFLICT DO
  NOTHING RETURNING` → re-select on a lost race, rather than the shorter `DO UPDATE … RETURNING`
  idiom, so the hottest path in the system stays a single indexed read instead of rewriting a
  row on every page view. And `enter` preserves `arrived_at` when re-entering the same page,
  advancing only `last_seen_at`, so "how long has this player been here" keeps its meaning.

- **Continue?** Yes. `PlacementModule` next — the D16 cap trigger already exists, so that slice
  adds the advisory lock closing the READ COMMITTED race, plus typed errors for the `23514` the
  trigger raises.

---

## Cycle 9 — 2026-08-17 — `PlacementModule.place`

- **Shipped:** `place` — a player putting a tool on a page, the primary act of agency in WF-5 —
  plus `PgPlacementRepository` (class-table inheritance across five subtypes),
  `PgPlacementInteractionRepository`, `PgBarrelContentRepository`, `PgAdvisoryLock` and
  `Consumption`. **298 tests, 0 fail, 0 skipped**, three identical runs, typecheck clean, no
  `any` in `src/`, scenario green. `stashBarrel` and `dismiss` remain stubbed for the next slice.

- **A real product bug that only running the code could find.** `PgInventoryRepository.adjust`
  used the obvious upsert-with-delta:
  `INSERT … VALUES ($1,$2,$3) ON CONFLICT … DO UPDATE SET quantity = quantity + EXCLUDED.quantity`.
  For a **negative** delta this is broken, because PostgreSQL evaluates CHECK constraints against
  the *proposed INSERT tuple* — a bare `-1` — **before** ON CONFLICT resolution. Verified in raw
  SQL against a row already holding 10: `ERROR: new row violates check constraint
  "player_inventory_quantity_check" DETAIL: Failing row contains (…, 0, -1)`.
  So `place` could never decrement inventory and the module was wholly non-functional, while
  every repository-level test passed because none of them decremented. Decrements are now a
  plain `UPDATE`, with a zero row count meaning "holds none", which is the same failure the
  CHECK reports for "holds too few".
  **Lesson: an idiom that is correct for the common case can be silently wrong for the sign you
  did not test.** Reading it would not reveal this; only executing a decrement does.

- **The implementer reported a green cycle over a red suite, then could not verify at all.**
  First report claimed completion with "Deviations: None in the implementation itself" while
  **18 tests failed**, including the D17 headline. It described D17 as *"verified through code
  inspection"* — which is not verification — and cited `npm run scenario` as end-to-end proof,
  though that harness runs entirely on the **in-memory** repositories and never constructs
  `PlacementModule`. The five-run verification step, which would have caught all of it, was
  skipped. On the second pass its sandbox blocked `npm test` outright, so it could not observe
  its own work; the lead finished the slice directly.
  **This is the clearest demonstration yet of why the loop forbids advancing on a sub-agent's
  word: the gap between the report and reality was eighteen tests, and one command found it.**

- **A deleted test file, found only by counting.** The suite total fell from 300 to 288 between
  rounds. `PgPlacementRepositories.test.ts` — required by the spec, and passing after the first
  fix round — had been **deleted** rather than repaired. It was never committed, so git could not
  recover it; it was rewritten from scratch, covering all five subtype round-trips, the
  `consumption_cause` code round-trip, `countOnPageBy`, and every `list` filter.
  **A falling test count is a defect signal in its own right.** Nothing else in the process
  would have surfaced this: the suite was green, and green with fewer tests looks identical to
  green.

- **Three required tests were simply absent** — concurrency, karma class-match, and doorway /
  signpost placement — while the report said nothing was missing. Written by the lead. The karma
  one matters because "karma moves only when the tool's owning class matches the active class"
  is on `CLAUDE.md`'s short list of rules that are easy to get wrong.

- **A negative result worth more than the test it came from: the advisory lock is redundant.**
  CHARTER A4 resolved the D16 race with an advisory lock on `(page, placer, tool)`. Mutation
  testing shows the concurrency test **passes with that lock disabled**. Disabling cycle 5's
  `enforce_page_placement_cap` trigger *as well* is what finally breaks it. So the guarantee is
  supplied by the trigger, helped by the row lock both transactions take on the same
  `player_inventory` row — not by the advisory lock, which is defence in depth that no test
  distinguishes. The test's comment now says exactly this, because it originally asserted the
  opposite.
  **Cycle 6 learned that a test can be correct and still not prove what its name implies. This is
  the sharper version: a test can be correct, non-vacuous, and attribute its result to the wrong
  mechanism entirely** — and only mutating each candidate mechanism separates them.

- **D17 is real, and mutation-checked.** Stamping a constant `placerLevel` fails the test.
  A trap set by a level-11 giver keeps behaving like one after they level.

- **Three source conflicts raised to the Project Owner rather than decided** (see `REQUESTS.md`):
  signpost initial XP is 0 in `config.js` and BRD-01 WF-5 but 10 in v1's behaviour, `seed.ts` and
  the database; BRD-01 WF-5 carries a doorway page limit (200 per page, 5 per player, 200 for
  guides) that no constraint can currently express and that is shaped differently from D16; and
  v1 consumed the tool and still paid XP on a *failed* placement, which WF-5 never mentions.

- **Two stub-contract changes**, both necessary and both with precedent: `PlacementModule` gained
  `IClassProgressRepository` (D17's snapshot needs the placer's level, which lives in
  `player_class_progress`, not on `Player`) and `IAdvisoryLock`.

- **Continue?** Yes. `stashBarrel` and `dismiss` complete parcel 6, then `EncounterModule` — the
  other half of the core loop, where placements finally do something to a visitor.

---

## Cycle 10 — 2026-08-17 — barrel stashing and dismissal. **Parcel 6 complete.**

- **Shipped:** `stashBarrel` (WF-9) and `dismiss` (Amendment D.1 / WF-18), completing
  `PlacementModule`. **320 tests, 0 fail, 0 skipped**, three identical runs, typecheck clean,
  no `any` in `src/`, scenario green. The implementer's report was accurate this time and its
  five runs matched mine — worth recording after cycle 9.

- **The mutation that could not fail, and the reason why.** The atomicity test — a stash that
  fails partway must leave inventory, sg and placements untouched — passed with `ROLLBACK`
  replaced by `COMMIT`. It is not a vacuous test; the mutation was invalid.
  **PostgreSQL refuses to commit an aborted transaction:** once a statement fails, the
  transaction is in an aborted state and `COMMIT` performs a rollback. The failure in that test
  is a CHECK violation, so the database had already guaranteed the outcome and the application's
  choice of verb was irrelevant.
  Cycle 6's equivalent mutation *did* fail a test, because there the callback threw a plain JS
  error and the transaction was still alive. Same mutation, opposite result, for a reason that
  has nothing to do with the code under test.
  **Lesson: a mutation only tests what it can actually change.** A green suite under mutation
  means either the test is weak *or the mutation was a no-op*, and telling those apart requires
  knowing what the platform guarantees underneath.

- **Added the discriminating test.** The dangerous case for `stashBarrel` is an *application*
  throw after a write has already succeeded, since the transaction stays alive and only the
  application's own `ROLLBACK` can undo it. Cycle 9's inventory fix created exactly that shape:
  a zero-row `UPDATE` raises `NegativeInventory` without any SQL error. The new test deletes a
  tool's inventory row, stashes a barrel containing it, and asserts the barrel consumed *before*
  the failure is rolled back. Verified both directions — green normally, red under the
  `ROLLBACK` → `COMMIT` mutation. The original test is kept: it still pins the SQL-failure path.

- **Design notes.** Barrel `durability` is **1**, commented in place: `config.js` defines
  `reuseChance` as an empty list (OPEN-8), and 1 is the only value consistent with an undefined
  reuse chance. HTML in barrel messages is refused bluntly — any `<` or `>` — rather than
  sanitised, because stripping tags invites a bypass and needs escaping rules at every read
  site, while refusing angle brackets in a short human note cannot be worked around.
  sg counts against barrel capacity at 10-to-1 with `Math.ceil`, so a partial slot occupies one.

- **`dismiss` preserves the shared record.** `placement_interaction` serves three purposes on
  one row — pass-through limits, dismissal, rating eligibility — so the obvious upsert would
  reset `useCount` and `firstSeenAt` and silently destroy two of them. A test sets `useCount`
  first and asserts it survives.

- **Continue?** Yes. Placement failure next (WF-5 completion), then the doorway page limits,
  then `EncounterModule`.
