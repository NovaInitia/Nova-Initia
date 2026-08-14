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

- [X] **2026-08-06, cycle 1, restated and then RESOLVED cycle 4 — was blocking for M1.**
  PostgreSQL needs to be running and to have a role for `stephen`.

  > **Resolved without sudo, and without touching your system cluster.** The sudo-shaped
  > framing was wrong: `initdb` runs perfectly well as an ordinary user, so the loop now owns a
  > private cluster and no longer needs anything from you for M1.
  >
  > | | |
  > |---|---|
  > | Data directory | `/home/stephen/.local/share/nova-initia-pg` (mode `0700`) |
  > | Port | **5433** — the system cluster keeps 5432 |
  > | Listener | **none** — `listen_addresses=''`, unix socket only, inside the `0700` dir |
  > | Databases | `nova_initia_dev`, `nova_initia_test` |
  > | Binaries | `/usr/lib/postgresql/18/bin` (PostgreSQL 18.4) |
  >
  > Socket-only is what makes the default `trust` auth safe: with no TCP listener, no other
  > local account can reach it. Had it listened on localhost, any local process could have
  > connected as superuser.
  >
  > Lifecycle — it does **not** survive a reboot, by design:
  > ```
  > PGDATA=/home/stephen/.local/share/nova-initia-pg
  > /usr/lib/postgresql/18/bin/pg_ctl -D $PGDATA -l $PGDATA/server.log \
  >   -o "-p 5433 -k $PGDATA -c listen_addresses=''" start   # or: stop
  > ```
  > To undo entirely: `pg_ctl … stop` then delete that one directory. Nothing else changed.
  >
  > You may still prefer the system cluster (`sudo systemctl enable --now postgresql`, then
  > `createuser`/`createdb`). Say so and I will repoint the connection settings; the migrations
  > are written against a connection URL, not against this cluster.

  Since cycle 3 the situation got one step worse: the **cluster is now down and the service is
  disabled** (`pg_lsclusters` → `18 main 5432 down`; `systemctl is-enabled postgresql` →
  `disabled`), so a reboot appears to have taken away the server cycle 3 was promised. The whole
  unblock is:
  ```
  sudo systemctl enable --now postgresql
  sudo -u postgres createuser -s stephen
  createdb nova_initia_dev && createdb nova_initia_test
  ```
  `enable` as well as `start` so the next reboot does not silently re-block the loop.

  Two databases because the test suite must be free to truncate everything it touches, and it
  must never be able to do that to a database holding real data. If you would rather keep the
  role unprivileged, say so and I will write the migrations to expect an explicit owner and
  schema instead of superuser.

  **Until this lands, M1 (roadmap items 1–3) cannot start.** The loop is working ahead on the
  pure-logic slices that do not touch a database rather than idling — see cycle 4.

- [ ] **2026-08-06, setup — non-blocking.** The SSH password for the backup host was shared in
  conversation and is therefore in this session's history. Worth rotating when convenient.
