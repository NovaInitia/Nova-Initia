# Requests for the human

Checkbox protocol: unchecked items are open. Check an item and add a note to answer it.
Checked at the start of every cycle.

- [X] **2026-08-06, setup — non-blocking (becomes blocking at M3).** A **PostgreSQL server** is
  needed before milestone M3. `psql` is installed but no server is running and `postgres`/`pg_ctl`
  are not on PATH. Any of these works: install and start a local server (`sudo apt install
  postgresql && sudo systemctl start postgresql`), run one in Docker, or provide a connection
  URL for a remote database. Until then M0–M2 build against in-memory repositories, and the
  atomicity guarantees in TRD §8.2 remain unverified (CHARTER A1).
  > **Answered:** server is up and accepting connections on `/var/run/postgresql:5432`.
  > Persistence moved from M3 to M1 and the accepted risk retired. See the follow-up below —
  > the server has no role yet, so nothing can actually connect.

- [X] **2026-08-06, setup — non-blocking.** The repo has **`node_modules/` committed** — 4,370
  of its 4,502 tracked files, the 2011 vendored dependency set. It is deliberately left tracked
  for now because the legacy v2 app depends on it and `CODEBASE.md` documents why. Say the word
  if you would like `git rm -r --cached node_modules` in a dedicated commit; it is not something
  a cycle will do unasked.
  > **Answered and done** in commit `07e3054`, alongside the user removing both module
  > directories from disk. CHARTER A6 amended: the legacy suite no longer runs, since
  > `config.js` requires the 2011 `express` eagerly. Restore without re-tracking via
  > `git archive 047c23d node_modules | tar -x`.

- [ ] **2026-08-06, cycle 1 — blocking for M1, not for M0.** The PostgreSQL server has **no role
  for the `stephen` account** (`FATAL: role "stephen" does not exist`), and `sudo` here needs a
  password I do not have, so I cannot create one. Please run:
  ```
  sudo -u postgres createuser -s stephen && createdb nova_initia_dev && createdb nova_initia_test
  ```
  Two databases because the test suite must be free to truncate everything it touches, and it
  must never be able to do that to a database holding real data. If you would rather keep the
  role unprivileged, say so and I will write the migrations to expect an explicit owner and
  schema instead of superuser.

- [ ] **2026-08-06, setup — non-blocking.** The SSH password for the backup host was shared in
  conversation and is therefore in this session's history. Worth rotating when convenient.
