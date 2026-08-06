# Requests for the human

Checkbox protocol: unchecked items are open. Check an item and add a note to answer it.
Checked at the start of every cycle.

- [ ] **2026-08-06, setup — non-blocking (becomes blocking at M3).** A **PostgreSQL server** is
  needed before milestone M3. `psql` is installed but no server is running and `postgres`/`pg_ctl`
  are not on PATH. Any of these works: install and start a local server (`sudo apt install
  postgresql && sudo systemctl start postgresql`), run one in Docker, or provide a connection
  URL for a remote database. Until then M0–M2 build against in-memory repositories, and the
  atomicity guarantees in TRD §8.2 remain unverified (CHARTER A1).

- [ ] **2026-08-06, setup — non-blocking.** The repo has **`node_modules/` committed** — 4,370
  of its 4,502 tracked files, the 2011 vendored dependency set. It is deliberately left tracked
  for now because the legacy v2 app depends on it and `CODEBASE.md` documents why. Say the word
  if you would like `git rm -r --cached node_modules` in a dedicated commit; it is not something
  a cycle will do unasked.

- [ ] **2026-08-06, setup — non-blocking.** The SSH password for the backup host was shared in
  conversation and is therefore in this session's history. Worth rotating when convenient.
