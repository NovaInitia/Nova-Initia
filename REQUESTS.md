# Requests for the human

Checkbox protocol: unchecked items are open. Check an item and add a note to answer it.
Checked at the start of every cycle.

- [ ] **2026-08-17, cycle 9 — non-blocking, but it is a balance decision only you can make.**
  **Signposts: 0 or 10 initial XP?** The sources disagree, and the disagreement is load-bearing
  because signposts are the guide's benevolent tool and XP is half of what levelling needs.

  | Source | Value |
  |---|---|
  | `config.js` (v2) | **0** |
  | BRD-01 WF-5's table | **0** |
  | v1's actual behaviour, per PHP-ERA-FINDINGS §"Signposts award 10 XP on use, not 0" | **10** |
  | `balance/seed.ts` and the seeded database | **10** |

  PHP-ERA-FINDINGS says *"under D1, `config.js` wins, but this one looks like an oversight in
  the rewrite rather than a decision."* So the implemented value (10) follows v1's observed
  behaviour and contradicts both the approved BRD and the stated decision rule.

  **Proceeding with 10** — it is the status quo, it is what the recovered game actually did, and
  0 would make signposts worthless for progression. Say the word and it becomes a one-row change
  to `0002_reference_data.sql`'s successor plus `seed.ts`. Flagging it because a cycle should
  not quietly overrule an approved BRD.

- [ ] **2026-08-17, cycle 9 — needs a decision before doorways are placeable.**
  BRD-01 WF-5 states a **doorway-specific page limit** that exists nowhere else in the design:
  *"a page accepts at most 200 doorways in total; a single player may own at most 5 of them,
  except a guide, who may own up to 200."*

  This is a different shape from **D16** (250 per tool type, per page, **per player**), which is
  what `SCHEMA-01` §8 and cycle 5's trigger actually implement. The doorway rule is partly
  *per page across all players* (200 total), which no current constraint can express, and its
  per-player limit varies by class (5, or 200 for guides).

  Options: (a) implement it as an additional trigger reading `class_scalar`, (b) treat D16 as
  having superseded it, (c) keep it but move the numbers into `balance_constant`. **Not
  implemented this cycle** — placement ships with the D16 cap only, so doorways are currently
  capped at 250 per player per page like everything else.

- [ ] **2026-08-17, cycle 9 — informational, no action needed yet.**
  PHP-ERA-FINDINGS records that in v1 **a failed placement still consumed the tool and still
  paid XP** for traps, barrels, doorways and signposts, while spiders and shields were spared.
  `class_scalar` carries `trap_fail_chance` (0.05 for every class) and the schema has a
  `placement_failed` consumption cause, so the mechanism is reserved. BRD-01 WF-5 does not
  mention random placement failure at all, so **it is not implemented**. Raising it so the
  reserved cause is not mistaken for dead weight later.

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

- [X] **2026-08-06, setup — non-blocking. STILL OPEN, and now the one that matters.** The SSH
  password for the backup host was shared in conversation and is therefore in this session's
  history. Worth rotating when convenient.

  > **Context added 2026-08-14 (cycle 5).** The repository is now public. The host's address and
  > username were published in `docs/PHP-ERA-FINDINGS.md` and were removed in `b9f2d69`, but
  > they remain in commit `047c23d` in the pushed history.
  >
  > **Decision by the Project Owner: leave the history alone.** Purging would rewrite six
  > commits and force-push over a public branch, it would invalidate the commit hashes cited in
  > `CHARTER.md`, `REQUESTS.md` and `docs/DEVLOG.md` — including the `git archive 047c23d
  > node_modules` recovery instruction — and it would not guarantee removal anyway, since the
  > old objects are already fetched, indexed, and reachable by SHA. The exposure is an RFC1918
  > address that routes nowhere from outside the LAN, plus a username.
  >
  > Rotating this password is therefore the mitigation that actually closes the risk, and it
  > closes it regardless of what the repository says. Do not re-propose a history rewrite.
