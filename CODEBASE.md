# Nova Initia — Codebase Analysis

*Analysis date: 2026-08-06. Repo: `github.com/NovaInitia/Nova-Initia`, branch `master`, HEAD `74b6f02`.*

## What this is

Nova Initia is a browser-based MMO ("reMOG" — real-world/meta MOG) where the game board is
the web itself. Players browse ordinary websites through a Firefox toolbar and leave game
objects on the pages they visit — traps, spiders, barrels (caches), doorways (portals to
other pages), and signposts (guided tours). Other players trip, loot, or follow them.

This repo is **v2.0, the Node.js rewrite** of an earlier PHP server (`README`). The rewrite
was never finished. Last substantive commit was 2011-10-30; a Mongoose-related commit landed
2012-06-01, then the project stopped.

Two halves live here:

| Half | Location | Stack |
|---|---|---|
| Game server | `app.js`, `config.js`, `models/`, `controllers/` | Node + Express + MongoDB (Mongoose) |
| Game client | `toolbar/` | Firefox XUL/overlay extension (~5k lines JS) |

## Current state: does not run

Verified — `node -e "require('./app.js')"` fails immediately:

```
node_modules/jquery/dist/jquery.js:30
	throw new Error( "jQuery requires a window with a document" );
```

`config.js:23` calls `require('jquery')` at module load in a bare Node process. Even past
that, `app.js:33` calls `App.express.createServer()` — the Express **2.x** API, removed in
Express 3. The installed Express is 5.2.1.

The `package.json` dependency list has been bumped to current versions (Express 5, Mongoose 9,
jQuery 4, jsdom 29, socket.io 4) at some point after the code was written, but **no source
was updated to match**. The code is written against roughly Express 2.x / Mongoose 1.x /
node-mongodb-native circa 2011. Everything below follows from that mismatch.

## Layout

```
app.js              Entry point: DB connect, model registration, Express routes, listen
config.js           Single shared `App` object: settings, DB/web config, required modules,
                    and the entire game-balance table (costs, XP curves, level gates)
models/             Mongoose schemas, one file per entity, each `module.exports = fn(mongoose)`
controllers/        A second, unused CRUD layer (see below)
  get/ put/ delete/   Per-verb generic Controller.js + one file per resource
  *Helper.js          Shared findAndModify wrappers for Users/Pages
include/            Vendored libs: sjcl, murmurhash, fluidinfo, cityhash.node — nothing
                    in the repo requires any of them
toolbar/            Firefox extension (chrome.manifest, install.rdf, XUL overlays, JS)
old_modules/        Untracked snapshot of the pre-npm vendored dependencies
node_modules/       Committed to git — 4370 of the repo's 4502 tracked files
```

There is no `.gitignore`, no tests, no build step, no lint config, no CI.

## Domain model

Six tools, each with its own schema and its own balance block in `config.js`:

- **traps** — damage the next player to visit the page
- **spiders** — like traps, but can wander and hunt signposts
- **barrels** — caches; stash sg/tools/messages for others to find, with durability and reuse limits
- **shields** — absorb hits; toggled on/off, consumed from inventory
- **doorways** — portals from one page to another; chainable, charge-limited
- **signposts** — branch points that build guided tours across pages

Three player classes — **giver**, **guardian**, **guide** — indexed positionally as
`[?, giver, guardian, guide]` in most `config.js` arrays and by name in the doorway/signpost
blocks. Players have levels and XP per class, sg (currency), karma, inventory counts, and
an armor sub-document.

`config.js` is the most complete and considered part of the repo. It reads as a finished
design document: XP awards keyed by object age, per-class level gates for every ability,
expert-trap karma thresholds, doorway transport probabilities. Whoever wrote it knew the
game well. The code that would consume it mostly doesn't exist.

Schemas: `Barrel`, `Class`, `Domain`, `Doorway`, `Message`, `Page`, `Signpost`, `Spider`,
`Tool`, `Trap`, `User` (+ `TemplateModel.js`, a copy-paste template, not loaded).
`Page` and `Domain` are the spatial index — a page holds arrays of the tools placed on it
and the users currently there.

## The two dead architectures

The repo contains **two incompatible server designs**, and the live one is the smaller.

**Design A — `controllers/` (dead).** A layered CRUD framework: each verb directory has a
generic `Controller.js` taking a write function and a `{before, after}` validator, returning
a jQuery-Deferred-based service. Resource files (`put/Traps.js`, `get/Signposts.js`, …)
supply the collection, query, and inventory-decrement logic. It targets the raw
node-mongodb-native driver via `App.mongodb.Collection`, `App.db.client`, and `App.Data`.

**None of those three properties exist on `App`.** `config.js` exports `mongoose`, not
`mongodb`, and no `db.client`. Nothing anywhere requires `controllers/` — confirmed by grep
across the repo. This layer has never executed.

**Design B — `app.js` (live but broken).** Mongoose models called directly from inline
Express route handlers. Seven routes: `GET /auth`, `POST /login`, `GET|PUT /signposts`,
`GET /signposts/:id`, `GET /users`, `GET /users/:id`, `GET /users/:id/toggleShield`.

This looks like an abandoned mid-flight migration: the 2012 "Mongoose Changes" commit began
replacing the driver-level controllers with Mongoose in `app.js` and stopped after two
resources.

**And a third, on the client.** The toolbar talks to a PHP-era API that neither design
implements — `/rf/remog/page/{urlhash}/{domainhash}/{toolid}.json`, `/rf/remog/doorway/…`,
`/rf/remog/gift/…`, `/login2.php`, `/getKey.php`, `/register.php`. The toolbar hashes the
current URL and domain client-side and posts tool placements against those hashes. The Node
server exposes none of these paths. Client and server in this repo cannot talk to each other.

## Client (`toolbar/`)

Firefox extension, XUL overlay style (`install.rdf` declares `maxVersion 4.0`). This is the
pre-WebExtensions architecture — it will not install in any Firefox from 2017 onward.

- `nova-initia_toolbar.js` (3640 lines) — the whole client: URL tracking, tool placement,
  panels, caching, hotkeys. `initialize_toolbar` passes ~180 XUL elements positionally into
  `loadToolbar` in a single call, twice (one branch commented out).
- `nova-initia_algorithms.js` — vendored SHA-256/MD5 from webtoolkit.info
- `nova-initia_json.js`, `nova-initia_jsoc.js` — json2 and the JSOC object cache
- `nova-initia_preferences.js` + `defaults/preferences/nova-initia.js` — prefs incl. hotkeys,
  saved username + `saved_password_hash`, NSFW filter, server URL
- `chrome/libs/` — jQuery 1.4.2 and 1.5.1, socket.io, msgpack, bigint, keycode
- `Services/UserModel.jsm` is two lines, one of which is the bare token `var` — a syntax error

## Concrete defects

Runtime-fatal, in code that would execute if the stack were fixed:

- `controllers/put/Location.js:19-20` — `var updateObj;` then `updateObj[property] = userRef;` → TypeError on undefined
- `controllers/put/Signposts.js:24` — queries `{_id: pageId}`; `pageId` is never defined in that scope → ReferenceError
- `models/SpiderModel.js:17` — reads `NI.tools.spiders.experience`; no `NI` global exists (should be the `config.js` export)

Logic errors:

- `controllers/get/Controller.js:19-22` — resolves the deferred *before* the async `toArray` callback fills the array; callers always get an empty result
- `controllers/put/Mail.js` — `validateParams` returns a hardcoded `true`; every real check is commented out. On a false return the deferred would never settle
- `controllers/put/Signposts.js` — validates `obj.user` but decrements inventory on `obj.from`
- `models/UserModel.js:89-114` — virtual setters call `UserSchema.update(...)`; `update` is a Model method, not a Schema method
- `models/*` virtuals are used as setters to *return* values (`SpiderModel` `awardableXP`); a setter's return value is discarded
- `models/BarrelModel.js:28-38` — virtuals are attached after `mongoose.model('Barrel', …)`, so they aren't on the compiled model
- `app.js:114-115` — `foundUser` is an implicit global, and `set("toogleShield", …)` misspells the `toggleShield` virtual
- `app.js:92` — `res.send(newSignpost.save())` sends the return of `save()`, not the saved doc

Security (this is a 2011 hobby project, but worth naming before any revival):

- `app.js:56` — `findOne({_id: data.user, pass: data.pass})` compares passwords as plaintext equality; the `User` schema stores `pass` as a plain `String`
- `app.js:58` — `doc` is used without a null check, so a wrong password crashes the handler
- `app.js:41-45` — `GET /auth` mints a session key to any unauthenticated caller and pushes it into an unbounded in-memory `validKeys` array with no expiry
- `app.js:52-67` — when `lastkey` is present but invalid, no response is ever sent; the request hangs
- Session keys come from `Math.random()` (`app.js:124`), not a CSPRNG — the comment in the function acknowledges it's V8 pseudo-random
- `config.js:8` hardcodes a public server IP; `GET /users` returns every user document including `pass` and `key`

## If you want to revive this

The honest assessment: the toolbar is unrecoverable as-is — XUL overlay extensions are a
dead platform, and porting means rewriting the 3640-line client against WebExtensions APIs.

What is worth keeping is `config.js`'s game design and `models/`' domain vocabulary. A
revival is a fresh server (the `controllers/` layer is unfinished and never ran — deleting
it loses nothing that isn't better rewritten) plus a new WebExtension client, with these
files as the spec.

Immediate cleanups regardless of direction: add a `.gitignore`, `git rm -r --cached
node_modules` (4370 of 4502 tracked files), and drop `old_modules/`, `include/`, and
`models/TemplateModel.js` — all unreferenced.
