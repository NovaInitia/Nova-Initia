# Project constraints

Standing rules for anyone writing code in this repository. Read before every task.

## Scope

- **All new work happens in `v3/`.** The repository root holds a frozen legacy application
  (v2, Node/Express/Mongoose) documented in `CODEBASE.md`. Never modify `app.js`, `config.js`,
  `models/`, `controllers/`, `lib/`, `test/`, `node_modules/`, or `toolbar/`.
- Never modify `docs/`, `LORE/`, `CHARTER.md`, `ROADMAP.md`, `REQUESTS.md`, or `docs/DEVLOG.md`.
  Those are the lead's.

## Stack

- TypeScript, strict mode, ES modules. Relative imports carry the `.js` extension.
- **Zero runtime dependencies.** `typescript` and `@types/node` are the only devDependencies.
  Adding any dependency requires a spec that names it.
- Tests use the built-in `node:test` and `node:assert/strict`. No test framework.
- Test files sit beside their subject as `<Subject>.test.ts`.
- Verify with `npm run typecheck` and `npm test` from `v3/`.

## Correctness

- All SQL parameterized. No string-built queries, ever.
- File creation that must not clobber uses atomic create-exclusive (`O_EXCL`/`wx`), never
  check-then-open.
- All file I/O specifies an encoding explicitly.
- Tests write only to temp directories, never the repo or home directory.
- Product code must not spawn subprocesses or make network calls unless the spec says so.
  (Running the test suite to check your own work is expected — this constrains the code you
  write, not your tooling.)
- Errors surface as clean typed errors, never raw tracebacks, and never destroy user data.

## Domain rules that are easy to get wrong

- **A placement stores the placer's class and level as they were at placement** (`placerClass`,
  `placerLevel`). Never read the placer's *current* level to decide a placement's behaviour —
  this works perfectly until the first player levels up.
- **Damage is denominated in sg.** There is no health pool.
- **Karma moves only when the tool's owning class matches the player's active class**, by
  exactly ±1, clamped to `[0, 100]`.
- **`ProgressionModule` has no player-facing entry point.** Nothing that grants experience,
  currency or items may be reachable from a route.
- **Ledger `appliedDelta` is the delta after clamping**, so that the sum of a player's ledger
  always equals their balance.
- Shields are the one tool that is never placed on a page.

## Style

- Match the existing code style. No abstractions beyond what the spec requires, no defensive
  code for conditions the spec says cannot occur, no drive-by refactors, no reformatting of
  code you were not asked to change.
- No doc comments restating what a function obviously does. Comment only non-obvious *why*.
- Never run git. Never touch files outside the ones your task names.

## Working agreement

Every rule below exists because it was broken, and the break cost a review cycle. They are
listed in the order they have caused the most damage.

### Report only what the run supports

- Run the full suite and paste its verbatim `tests / pass / fail / skipped` line before writing
  any conclusion. **If anything fails, the first line of your report is "N tests failing"** —
  not a summary that mentions it further down.
- **"Verified" means you executed it and read the output.** Reading the code, or reasoning about
  a value, is not verification. "Not run" is a useful and acceptable answer; a claim that
  something passed when it was never executed is not.
- Cite only evidence produced by the code you changed. Before offering a command as proof, name
  the file it exercises — if it never constructs what you wrote, it proves nothing.
- Report the total from one full-suite run, never a subset and never a remembered number.
- Work through every numbered verification step in order and paste real output for each. If you
  cannot run one, say which and why; never drop it silently.
- If you catch yourself writing "except", "apart from" or "other than" about your own work, that
  is a deviation and belongs in the deviations list. **"None" is only correct when there is
  nothing left to qualify.**

### The suite must be able to catch you

- Never delete, rename away, or skip a test to reach green. A required test that cannot be made
  to pass is left failing and reported.
- State the suite total before and after your change. **A falling total is a defect, not
  progress** — green with fewer tests looks identical to green.
- Every test must be capable of failing. Before finishing, break the thing it asserts on,
  confirm it goes red, then restore it.
- A test's name must describe exactly what it asserts. If you narrowed what it checks, rename
  it; a name that overstates its test is worse than no test, because it reads as coverage.

### Leave the machine as you found it

- Scratch scripts, backups and probes go in a temp directory, never the repository. Finish by
  checking that only your assigned files have changed.
- Anything a test creates — database rows, files, directories — is removed in a `finally`, so
  cleanup runs even when an assertion fails. **Reference tables and temp directories survive
  between runs**, so a single leak silently corrupts later cycles rather than failing now.

### Types

- No `any` and no non-null assertions (`!`). If the types resist, narrow with a type guard and
  report the friction — never switch checking off to move on. Branded assertions at a database
  row boundary (`row.id as PlayerId`) are the exception and are fine.
- The Style rule against defensive code is not a stylistic preference: a fallback for a condition
  the spec excludes hides the fault and re-introduces the constant it was meant to remove.

### A transaction belongs to a connection, not a pool

Never issue `BEGIN`, `COMMIT` or `ROLLBACK` through `pool.query`. Each call may land on a
different connection, so the work can commit while the rollback runs somewhere else — silently,
and usually against shared reference data. Take a client with `pool.connect()` and use it for the
whole transaction, or commit the change and restore it in a `finally`.
