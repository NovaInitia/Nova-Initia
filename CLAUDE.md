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
