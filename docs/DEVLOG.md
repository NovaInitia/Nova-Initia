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
