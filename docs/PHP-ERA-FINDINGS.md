# PHP-era findings — recovered game rules

**Source:** the v1 server backup, at `ni2/opt/vol/var/www/html` within the archive.
**Recovered:** 2026-08-06
**Status:** Evidence. Feeds the amendment to [BRD-01](BRD-01-core-game-loop.md) §7.

The v1 server is a [Recess](https://www.recessframework.org/) PHP application under `rf/`,
with the game exposed as `rf/apps/remog`. Crucially, **a large part of the game logic is not
in PHP at all** — it lives in MySQL stored procedures. That is why the questions left open by
`config.js` had no answer in either codebase: the answers were in the database.

Level table data was recovered from two independent dumps, `/root/All.sql` and
`/root/backup/nibkp.sql`, which agree exactly. `sqlbkp/novainitia.sql` (Nov 2009) predates the
`Levels` table and does not contain it.

---

## 1. The Levels table — resolves OPEN-10

`Levels` is a single shared progression table used by all three classes. 25 levels.

| ID | Name | Experience | Cost (sg) | Stipend | Tools |
|---:|---|---:|---:|---:|---:|
| 1 | Novice | 0 | 0 | 140 | 10 |
| 2 | Novice | 630 | 120 | 165 | 12 |
| 3 | Novice | 945 | 180 | 190 | 14 |
| 4 | Novice | 1323 | 252 | 220 | 16 |
| 5 | Apprentice | 1764 | 336 | 250 | 18 |
| 6 | Apprentice | 2268 | 432 | 275 | 20 |
| 7 | Apprentice | 2835 | 540 | 300 | 22 |
| 8 | Apprentice | 3465 | 660 | 330 | 24 |
| 9 | Apprentice | 4158 | 792 | 355 | 26 |
| 10 | Experienced | 4914 | 936 | 385 | 28 |
| 11 | Experienced | 5733 | 1092 | 410 | 30 |
| 12 | Experienced | 6615 | 1260 | 440 | 32 |
| 13 | Experienced | 7560 | 1440 | 465 | 34 |
| 14 | Experienced | 8568 | 1632 | 495 | 36 |
| 15 | Master | 9639 | 1836 | 520 | 38 |
| 16 | Master | 10773 | 2052 | 550 | 40 |
| 17 | Master | 11970 | 2280 | 575 | 42 |
| 18 | Master | 13230 | 2520 | 600 | 44 |
| 19 | Master | 14553 | 2772 | 630 | 46 |
| 20 | Legendary | 15939 | 3036 | 685 | 50 |
| 21 | Legendary | 24413 | 4650 | 820 | 60 |
| 22 | Legendary | 38273 | 7290 | 955 | 70 |
| 23 | Legendary | 55676 | 10605 | 1095 | 80 |
| 24 | Legendary | 76230 | 14520 | 1230 | 90 |
| 25 | Taco | 99934 | 19035 | 1365 | 100 |

Semantics, from `views/user/details.part.php` and `UpdateLevel_sp`:

- **`Experience` is the threshold to advance *from* that level**, not to reach it. A level-12
  player needs 6615 XP in that class to reach 13.
- **`Cost` is an sg price paid to level up.** Levelling is a purchase, not an automatic
  promotion. Consistently `Cost ≈ Experience × 0.1905` across all 25 rows.
- **`Stipend` and `Tools`** feed the periodic grant in §2. Note `Tools` is absent from the
  Recess `Level` model — that PHP class was out of date with its own table.
- Level cap is 25. `Taco` at level 25 is evidently a joke tier.

**Levelling up** — `UpdateLevel_sp(lkey)`, reached via `/levelup.php?lastkey=…`:

```sql
UPDATE Users u
  SET u.LevelClass1 = u.LevelClass1 + 1,
      u.Sg = u.Sg - (SELECT l.Cost FROM Levels l WHERE l.ID = u.LevelClass1)
  WHERE u.LastKey = lkey AND u.Class = 1;
-- identical blocks for Class 2 / LevelClass2 and Class 3 / LevelClass3
```

**Experience is never deducted.** XP accumulates permanently; only sg is spent.

The UI gates the call on `Experience >= threshold AND Sg >= Cost`; the procedure itself checks
neither. **Per the Project Owner, `/levelup.php` was a testing and debug tool, not the shipped
player path** — consistent with the view rendering its link only when `$user->privileged`.
So the *mechanic* below is authoritative, recovered from the `Levels` table and the view's
precondition, but the unvalidated endpoint is a debug artifact and not evidence of how the
production flow worked. A v3 implementation must enforce both preconditions server-side.

---

## 2. The stipend — resolves OPEN-4 and OPEN-3

`AwardStipend_sp` (`/root/stipend.sql`) is the **only** source of sg income other than looting
and tours. It grants to players whose `LastLogin` is within the past hour, and writes a row to
`StipendLog` per run — so it ran on a schedule, hourly.

### sg grant

```
sg += MAX( ROUND(Stipend × (1 − |1 − Karma/50|)),
           ROUND(Stipend × 0.25) )
```

Karma runs 0–100 and the multiplier is a triangle peaking at the midpoint:

| Karma | 0 | 25 | 50 | 75 | 100 |
|---|---|---|---|---|---|
| Multiplier | 0 → floor | 0.5 | **1.0** | 0.5 | 0 → floor |

**Neutral karma pays best.** Both extremes fall to the 25% floor. At level 1 that is 140 sg
per hour at karma 50, versus 35 at karma 0 or 100.

### Tool grant

The same procedure grants tools, and **karma selects which of your class's two tools you
receive**:

| Class | Karma < 50 → | Karma > 50 → |
|---|---|---|
| 1 giver | `Tool0` traps, × `(1 − Karma/50)` | `Tool1` barrels, × `((Karma−50)/50)` |
| 2 guardian | `Tool2` spiders, × `(1 − Karma/50)` | `Tool3` shields, × `((Karma−50)/50)` |
| 3 guide | `Tool4` doorways, × `(1 − Karma/50)` | `Tool5` signposts, × `((Karma−50)/50)` |

Each is multiplied by the level's `Tools` value. So low karma yields the **aggressive** tool of
your class and high karma the **benevolent** one, while the sg stipend pushes back toward the
middle. That tension is the core economic design, and it appears nowhere in `config.js`.

This also **resolves OPEN-3**: spiders are not bought, they are the low-karma guardian
stipend tool.

---

## 3. Buying tools

`ToolController::buy`. Base price is `Tools.COST`, which is **1 for all six tools**:

```
INSERT INTO `Tools` VALUES (0,'Trap',1),(1,'Barrel',1),(2,'Spider',1),
                           (3,'Shield',1),(4,'Doorway',1),(5,'Signpost',1)
```

Cost is then **tripled if the tool falls outside your class's pair** — giver owns tools 0–1,
guardian 2–3, guide 4–5. Effective price is therefore **1 sg in-class, 3 sg out-of-class**,
which is exactly what `config.js` records in its `cost` arrays. The two sources agree.

**Inventory cap**, absent from `config.js` entirely:

```php
$maxLevel = max($user->LevelClass1, $user->LevelClass2, $user->LevelClass3);
$maxCount = $maxLevel * 250;
```

Per tool type, capped by the player's *highest* class level × 250.

---

## 4. Damage is sg — a correction to BRD-01

`PageController::__destruct` resolves traps and spiders. **There is no health pool. "Damage"
is a loss of sg.**

### Trap

- Placer gains **+5 XP class 1**. If the placer trips their own trap, they *lose* 5 XP instead.
- Trap is deleted; victim's `hitTool0` increments.
- **Shielded:** victim gains +5 XP class 2 and the shield decrements. When it reaches zero,
  `hitTool3` increments and a **class-2 victim gains a further +15 XP class 2**.
- **Unshielded**, by trap age:

| Trap age | sg lost |
|---|---|
| under 30 days | 15 |
| 30–90 days | 20 |
| 90–150 days | 25 |
| over 150 days | 50 |

### Spider

- Placer XP by age: **5 / 10 / 15 / 25 / 50 class 2** at under 7d, 7–30d, 30–90d, 90–150d,
  over 150d. Self-trigger loses 5 XP. These match `config.js` exactly.
- **Shielded:** +5 XP class 2, +10 more if the victim is class 2; shield zeroed outright
  rather than decremented.
- **Unshielded:** flat **15 sg**, regardless of age.

---

## 4a. Karma — resolves OPEN-2 and OPEN-13

**Correction.** An earlier pass of this document claimed karma was never written in v1. That
was wrong: the search pattern tested for `+=` and `-=` but the code uses the `++` and `--`
operators. Karma is awarded in `User::useTool($toolID, $fail)` — the single method every tool
placement runs through.

There are exactly six stored routines in the database (`AwardStipend_sp`, `MoveSpiders_sp`,
`UpdateLevel_sp`, `Tools_CountToolsLaidByUrlAndUserID_sp`, `Test_Multiply`, `NewID_fn`), and
none touches karma. All of it is in PHP.

| Tool | ID | Class | Base XP on use | Karma | Bonus |
|---|---:|---|---|---:|---|
| Trap | 0 | 1 giver | `Experience1 += 5` | **−1** | +5 XP if Karma < 5 |
| Barrel | 1 | 1 giver | `Experience1 += 5` | **+1** | +5 XP if Karma > 95 |
| Spider | 2 | 2 guardian | `Experience2 += 5` | **−1** | +5 XP if Karma < 5 |
| Shield | 3 | 2 guardian | *none* | **+1** | +5 XP if Karma > 95 |
| Doorway | 4 | 3 guide | `Experience3 += 10` | **−1** | +5 XP if Karma < 5 |
| Signpost | 5 | 3 guide | `Experience3 += 10` | **+1** | +5 XP if Karma > 95 |

Rules that fall out of the code:

- **Karma moves by exactly ±1 per use**, clamped to `[0, 100]`. There is no decay.
- **Karma only moves when the player's active `Class` matches the tool's class.** A guide who
  places a trap gains the trap's XP but their karma does not move. This corroborates D11.
- **The extremity bonus doubles XP.** At karma below 5 an aggressive tool pays 10 XP instead
  of 5; at karma above 95 a benevolent one does the same. Also class-gated.
- **Shields award no XP on use** — consistent with `config.js` having no experience curve for
  shields.
- **Signposts award 10 XP on use, not 0.** `config.js` sets `signposts.initialXP: 0`. A
  direct conflict; under D1, `config.js` wins, but this one looks like an oversight in the
  rewrite rather than a decision.
- **Failure still costs you.** For traps, barrels, doorways, and signposts the inventory
  decrement and the base XP award both sit *outside* the `!$fail` check — a failed placement
  consumes the tool and still pays XP. Spiders and shields guard on `&& !$fail` and are not
  consumed on failure.

### What this does to the economy

The trade-off is sharper than the stipend alone suggested. Karma extremes give you **double XP
and a plentiful supply of your signature tool**, but drop sg income to the 25% floor. Karma 50
gives **full sg income** but single XP and no bulk supply.

Levelling requires *both* XP and sg. So neither pole is a winning strategy on its own, and a
player must move between them — grinding XP at an extreme, then returning toward neutral to
earn the sg the next level costs. That oscillation is the game's economic engine, and it is
visible only once the stipend procedure and `useTool` are read together.

---

## 4b. Is sg awarded per page visited? — an exhaustive answer

Asked directly, and worth answering exhaustively because an earlier grep in this project missed
karma by using too narrow a pattern.

**Every write to `Sg` in the entire system:**

| Where | Direction | Cause |
|---|---|---|
| `AwardStipend_sp` | **+** | hourly stipend |
| `UpdateLevel_sp` | **−** | level purchase |
| `ToolController:175` | **−** | buying tools |
| `PageController:704` | **−** | stashing sg in a barrel |
| `PageController:1130–1142` | **−** | trap damage, by age |
| `PageController:1198` | **−** | spider damage |
| `GiftController:114` | **+** | looting a barrel |
| `GroupController:463,468` | **+** | tour completion, 50 to each side |

Searched across the whole web tree for `+=`, `++`, and bare assignment, and across every SQL
dump for `SET`/`UPDATE` touching `Sg`. There are no other writers, and no cron entries survive
in the backup. **There is no per-page sg award anywhere in v1.**

### But browsing is what keeps you earning

The intuition is nonetheless correct, and the mechanism is indirect:

```sql
`LastLogin` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

`LastLogin` refreshes on **any** write to the user row, and `PageController` writes that row
repeatedly during ordinary page activity. The stipend then pays only players whose `LastLogin`
falls inside the past hour — and deliberately self-assigns `SET s.LastLogin = s.LastLogin` so
that paying a player does not itself reset their activity clock.

So the felt experience is *"browsing earns sg"*, delivered as an hourly grant gated on having
been active. Stop browsing and the income stops within the hour.

### The documented rule is narrower than the implemented one

**Correction.** An earlier revision of this section proposed that v3 set `lastActiveAt` on page
entry. The in-game manual — recovered later, in [LORE folio 13](../LORE/13-gaining-sg-in-nova-initia.md) —
states the rule directly, and it is not about page visits:

> The Union and Guilds encourage people to use their tools by providing SG when tools are used.
> **Every hour that a tool is used will be an hour that a stipend will be awarded for.** The
> Union checks every hour and if a tool was used the previous hour SG will be deposited into the
> account of the person who deployed a tool.

So the designed rule is **"you used a tool in the past hour"**, not "you browsed in the past
hour". Three accounts exist and they do not agree:

| Source | Eligibility rule |
|---|---|
| **Folio 13** — the design | A **tool was used** in the previous hour |
| **The implementation** | `LastLogin` refreshed, which happens on **any** write to the user row |
| Earlier revision of this document | Page entry |

The implementation is the loosest of the three. Because `LastLogin` is
`ON UPDATE CURRENT_TIMESTAMP`, it also refreshes when a player is *trapped by someone else*, or
when the level-up procedure writes their row — neither of which is the player using a tool.
That is a storage-layer side effect, not a decision.

**v3 should follow folio 13**: set `lastActiveAt` when the player **uses a tool** — placement
(WF-5), stashing (WF-9), and equipping a shield (WF-8) — and nowhere else.

This also makes the economy coherent with itself. The stipend's purpose, in the Union's own
words, is to *encourage people to use their tools*. Paying it for passive browsing rewards the
opposite. And it aligns the stipend with karma, which under **D10** also moves only on tool use:
one action, both consequences.

Folio 13 further confirms, in prose, three rules recovered independently from the code — that
the stipend rises with class level, that karma leaning determines which tool type is granted,
and that **at least 25% of the stipend is always paid as sg**.

## 5. Other income

- **Looting a barrel** — `GiftController:114`, `$this->user->addSg($this->gift->Sg)`. The
  looter receives whatever sg the barrel held.
- **Completing a tour** — `GroupController:463,468`. **50 sg to the player who completes it
  and 50 sg to the tour's owner.** Both sides paid; the owner's payout is not capped in the
  code read.

---

## 6. Wandering spiders — resolves OPEN-5

`MoveSpiders_sp` relocates every laid spider (`TOOLID = 2`) to a different page **within the
same domain**, selected from the `Track` table of known pages. Movement is domain-bounded, and
runs on a schedule like the stipend.

---

## 6a. The Nova Initia calendar — `includes/nitime.php`

The game had its own calendar. **It is presentational, not mechanical** — every value is derived
from the real timestamp via `date("z")`, and no controller gates behaviour on it. Confirmed by
searching the whole tree: it appears only in `index.php`, `events.php`, the IRC topic script,
and the Recess app's `Date` model. **The age brackets in trap damage, spider XP, and barrel XP
are real time and are unaffected by it.**

It is recorded here because it is good world-building that a revival should keep, and because
it encodes the same structure as the karma axis.

### Structure

- **A 6-day week**, each day named for a tool: `dayofyear % 6`.
- **Six seasons of 60 days**, each named `Class:Aspect`: `floor(dayofyear / 60)`.
- **Ten weeks per season**: `floor((dayofyear % 60) / 10) + 1`, rendered "1st".."10th".
- **Five intercalary days** at year end, days 360–364, standing outside the week cycle:
  **Pride, Fall, Terror, Faith, Salvation**.
- **Year = Gregorian year − 1796.** 2011 was year 215; 2026 is year 230. The epoch's
  significance is unrecorded.

6 × 60 = 360, plus 5 named days = 365.

### Nothing mechanical depends on it — verified

Asked directly and checked exhaustively. `AwardStipend_sp` contains **no date logic** beyond
`LastLogin > date_sub(NOW(), interval 1 hour)`. No procedure, function, or trigger references
a date part.

Three false positives are worth naming so the search is not repeated:

- `DAYOFYEAR`, `WEEKOFYEAR`, `QUARTER(` in `All.sql` are **MySQL's own documentation** — the
  dump includes the server's `help_topic` table.
- `season` matches in `All.sql` are **domain names** recorded by the game: `homeandseason.com`,
  `seasonsecurity.com`.
- One match is genuine, and is **lore**: *"…to the Council of Guardians on The day of the
  Doorway, 6th week in the season of Guardian:Protect, 75 ATF…"* — narrative content using the
  calendar for flavour, which is exactly the presentational use described above. Note the era
  marker **ATF**, which appears nowhere in the calendar code.

A seasonal bonus would have been a natural fit — `Giver:Gift` season favouring givers, and so
on — but it was never built. Recorded as an idea the calendar's structure invites, not as a
recovered rule.

### The days and the seasons share one ordering

| Index | Day | Season | Tool | Karma |
|---:|---|---|---|---:|
| 0 | Barrel | Giver:Gift | Barrel | **+1** |
| 1 | Trap | Giver:Warn | Trap | **−1** |
| 2 | Signpost | Guide:Lead | Signpost | **+1** |
| 3 | Doorway | Guide:Leap | Doorway | **−1** |
| 4 | Shield | Guardian:Protect | Shield | **+1** |
| 5 | Spider | Guardian:Disarm | Spider | **−1** |

The six seasons are the six tools, grouped in class pairs, **benevolent first and aggressive
second** — and that alternation is exactly the karma polarity of D10. Gift/Warn, Lead/Leap,
Protect/Disarm. The calendar encodes the game's moral axis in its structure: every six-day week
passes through all six tools, and every year passes through all six aspects.

⚠️ **Calendar index is not tool ID.** The database numbers tools Trap 0, Barrel 1, Spider 2,
Shield 3, Doorway 4, Signpost 5 — a different class order *and* the opposite polarity order
within each pair. The two sequences must never be used interchangeably.

## 6b. Tool parts — deferred, not abandoned

`User.Parts` exists on the v1 model, and `UserController` returns it as a **hardcoded empty
array**. The v2 Node rewrite carried the idea forward with `parts` arrays on both `UserModel`
and `PageModel`, and the toolbar shipped a `parts.jpg` overlay image — so the feature was
scoped across client, server, and both data models, and implemented in none of them.

**The design intent, from the Project Owner, 2026-08-06:**

> When a tool is used, or used up, it leaves behind some of its parts. Parts can be assembled
> into new things later — including tools outside the common six — or traded and sold.

**This corrects an earlier revision of this document**, which classed parts as a deliberate
exclusion alongside random events, stamps, and forums on the grounds that no rule survived
describing it. That was true of the code and false of the project: the concept exists, it was
simply never written down anywhere the code could show it.

### Why parts existed — the economic rationale

Per the Project Owner, 2026-08-06:

> Instead of constantly balancing the stipend, parts were our next solution.

This is the important part, and it is not recoverable from any code. **Parts were not conceived
as collectibles. They were the intended fix for a structural problem in the economy.**

The stipend is a **faucet with a fixed rate**. It is the only meaningful supply of tools and
currency, which makes it the economy's single dial — every adjustment is global, affects every
player at once, and has to be re-tuned as behaviour shifts. v1's team was doing that tuning
continuously, which is the characteristic maintenance burden of an economy with one lever and
no feedback.

Parts change the shape rather than the setting:

| | Stipend | Parts |
|---|---|---|
| Supply is proportional to | a configured rate | **actual play** |
| Adjusting it affects | every player globally | nobody — it self-regulates |
| Feedback loop | none | consumption → parts → tools → consumption |
| Used tools are | a pure sink | **a source** |

More play means more tools consumed, which means more parts, which means more tools. The loop
closes, and supply tracks activity without anyone turning a dial.

**This raises the priority of parts considerably.** It is not a nice-to-have deferred feature —
it is the intended answer to the thing that was generating continuous maintenance work. It
should be the first BRD written after the core loop runs.

### Design constraints that follow

For whoever specifies it:

- **Parts are produced at consumption**, which is why the single consumption seam (below) is
  load-bearing. The economy's second loop attaches at exactly that point.
- **The yield rate is the new dial**, but a self-regulating one — it scales with play instead of
  with wall-clock time. Too generous and the stipend becomes irrelevant and supply inflates; too
  stingy and nothing changes. That is a balance question, but a *one-time* one rather than a
  recurring one.
- **Parts will circulate through barrels**, since barrels are the game's only player-to-player
  transfer mechanism — so parts inherit the existing distribution channel rather than needing a
  new one.

**Status: deferred, and explicitly out of scope** for BRD-01, BRD-05, and BRD-06. It needs a
parts taxonomy — what parts exist, which tools yield which, and at what rate — that does not
exist yet and must be designed rather than recovered. It should get its own BRD as the **next**
piece of work after the core loop is running.

### What the current design must not foreclose

Not built now. Recorded so that adding parts later is additive rather than structural.

1. **Tool consumption should be one named concept, not six inline deletions.** Parts are
   produced *at the moment a tool is consumed*, and BRD-01 already consumes tools in six
   places: trap trigger (WF-6), spider trigger (WF-7), shield charge use (WF-8), barrel
   exhaustion (WF-10), doorway charge depletion (WF-11), and failed placement (WF-5, where
   traps, barrels, doorways, and signposts are consumed even on failure). If each of those
   deletes a row inline, parts must later be threaded through six unrelated code paths. If they
   all raise one consumption event, parts attaches at one seam. **This is worth doing for
   BRD-01's own sake** — six duplicated deletion paths is already a defect — with parts as the
   beneficiary.

2. **Inventory should be a keyed collection, not six fixed columns.** Parts are items a player
   holds that are not one of the six tools. An inventory shaped as exactly six counts makes
   that a migration; one keyed by item type makes it a new key.

3. **`ToolType` must stay extensible.** "Tools outside the common six" means the type set grows.
   The TRD already routes every rule through `IBalanceTable` lookups keyed by tool type, which
   accommodates new types — provided nothing hard-codes the number six.

4. **Be aware the six-tool symmetry is load-bearing elsewhere.** Three classes × two karma
   polarities = six tools, and that structure is baked into the karma axis (D10), the stipend's
   class-and-karma branching (WF-16), and the calendar's six seasons and six-day week (§6a). A
   seventh tool does not fit that symmetry. That is a design problem to solve when parts is
   specified — not a reason to avoid it, but not something to discover late either.

5. **Trading is a separate subsystem that does not exist yet.** Nothing in the current model
   transfers anything directly between players; barrels are the only transfer mechanism, and
   they are indirect and asynchronous. "Traded or sold" implies direct exchange, an offer
   lifecycle, and a fraud surface. That is its own BRD, not a footnote to parts.

## 6c. Custom DNS (pdns) — page identity as a subdomain

PowerDNS artefacts are present in the backups (`pdns.sql`, `poweradmin`). Per the Project
Owner, the mechanism was:

> A hashed URL became a subdomain on the nova-initia domain. Using the subdomain gave the calls
> context.

So the client hashed the page it was on, and addressed the server at
`<urlhash>.nova-initia.com`. A wildcard DNS zone resolved any such name, and the server read
page context from the `Host` header rather than from the request path. This is why the game ran
its own DNS: no conventional zone file can enumerate a subdomain per page on the web.

It is a **transport** mechanism, not a game rule. Nothing in the domain model depends on how
page identity reaches the server — only that it does.

### ⚠️ It leaks browsing history to third parties, which D6 does not cover

BRD-01 **RISK-2** records an accepted risk: page identity is a reversible URL hash, so *the
server* can reconstruct where a player browsed. The Project Owner accepted that.

Carrying the hash in a **hostname** is a materially larger exposure, because a DNS query is
made before any connection and, in 2011 universally and often still today, travels
unencrypted:

- Every page a player visits emits a DNS query containing that page's URL hash.
- The player's resolver, their ISP, and any observer on the path sees the **sequence of
  hashes** — that is the browsing history, in order, with timestamps.
- Combined with hash reversibility, reversing a candidate list of popular URLs recovers the
  actual pages. No access to the server is required.
- TLS does not help. The query precedes the connection, and the hostname also appears in SNI.
- DNS caching blunts repeat visits slightly. It does not change the shape of the problem.

**This is a different risk from RISK-2, not a restatement of it.** RISK-2 is "we hold data we
could misuse." This is "everyone between the player and us gets the data for free." The Project
Owner's acceptance of the former is not an acceptance of the latter, and it should be an
explicit decision rather than an inherited default.

**Recommendation: do not reproduce the subdomain transport in v3.** Carry the page hash in the
request path or body over HTTPS, as the v1 toolbar's `/rf/remog/page/{urlhash}/{domainhash}/…`
routes already did in parallel. That keeps page identity inside the encrypted channel, removes
the need to run DNS at all, and costs nothing — the server reads the same value from a
different place. If the subdomain scheme is wanted back for some benefit not captured here,
it should be revisited knowing this.

## 6d. What defines a "place on the board" — URL normalisation

Recovered from the v2 toolbar, `chrome/content/nova-initia_algorithms.js:354`, `ni.UrlToHash`:

```js
url = /^[a-z]+:\/\/([a-z0-9][-a-z0-9]+(\.[a-z0-9][-a-z0-9]+)+)[^_]($|\/|\?)?[^#]*/.exec(url);
var domain = url[1];   // domain name only
url = url[0];          // protocol + domain + path + query, up to but excluding '#'
return { domain: ni.base32md5(domain), url: ni.base32md5(url) };
```

**This — not the transport — is what makes two URLs the same place.** It is the single most
load-bearing rule in the game's geography, it lives in the *client*, and it is specified nowhere
in `config.js`, BRD-01, or TRD-01.

### What it decides

| Rule | Effect on the board |
|---|---|
| Fragment `#…` stripped | `page#intro` and `page` are the **same** place. Good. |
| **Query string retained** | `page?utm_source=x` is a **different** place from `page`. |
| **Lower-casing explicitly disabled** — the code comments *"To Lowercase causes problems"* | `Example.com/Page` and `example.com/page` are **different** places. |
| **No `www` folding** | `www.example.com` and `example.com` differ, in **both** the URL and the domain hash — so they are different places *and* different domains. |
| **Protocol included in the URL hash** | `http://…` and `https://…` are **different** places. |
| Hash is `base32(md5(…))` | Fast and compact. Also trivially reversible by dictionary — this is the mechanism behind RISK-2. |

### Two consequences worth deciding deliberately

**1. Tracking parameters fragment the board.** Every `?utm_source=`, `?fbclid=`, and session id
mints a fresh, empty square. A trap laid on the canonical article is never found by anyone who
arrives via a shared link — and in practice most people arrive via shared links. This was
already true in 2011 and is far worse now. Folding query strings, or stripping a known
parameter denylist, would materially increase the chance that two players meet on the same
page — which is the entire game.

**2. The v1 board is stranded regardless.** Every one of the 24,193 surviving placements was
hashed from an `http://` URL. The modern web is `https://`, so under v1's own rules those
placements sit at coordinates no current browser will ever generate. The old board cannot be
carried forward whatever we do.

That is worth stating plainly because it **removes the main argument for preserving v1's
normalisation**. Fidelity would buy back an archive that is already unreachable. This is
therefore a free moment to choose normalisation on its merits.

### Recommendation

Treat normalisation as a **domain rule owned by the server**, not a client implementation
detail — and version it. The client may compute the hash for privacy, but the algorithm is a
shared contract, and if it ever changes, every existing placement moves. A version tag stored
alongside each placement makes that a migration rather than a silent board reset.

Suggested rules, for the Project Owner to accept or amend:

- Strip the fragment — as v1.
- **Fold the scheme**, so `http` and `https` are the same place.
- **Fold `www.`**, and lower-case the host — hostnames are case-insensitive by specification, so
  v1's "lower-casing causes problems" was over-broad; it should apply to the host and not to
  the path.
- **Strip a denylist of tracking parameters**, keeping other query parameters, since some
  genuinely identify distinct pages.
- Keep path case-sensitive — paths genuinely are on many servers.

## 7. Where v1 and `config.js` disagree

`config.js` is a **redesign**, not a transcription. Where they conflict, BRD-01 D1 makes
`config.js` authoritative — but these are the places a deliberate decision was made, and are
worth revisiting:

| Rule | v1 PHP | `config.js` |
|---|---|---|
| Trap damage | 15/20/25/50 sg over 4 age brackets | 10/15/15/25/50 over 5 brackets, adds a 7-day tier |
| Trap XP to placer | flat 5 | flat 5 — agrees |
| Spider XP | 5/10/15/25/50 | identical — agrees |
| Spider purchasable | yes, 1 sg for a guardian | `cost`/`rate` both 0 — evidently unfinished |
| Barrel message | 512 chars, HTML allowed; 114-char outside label at giver L5 | 155 internal / 128 external, HTML never allowed |
| Barrel capacity | 1000 sg for givers, 10 sg per tool ⇒ 100 tools; non-givers 10 of one kind | `toolCapacity [10,100,10,10]` — agrees on the numbers |
| Inventory cap | max class level × 250 | absent |
| Level progression | shared 25-row table, paid in sg | absent |
| Stipend | karma-weighted hourly sg and tools | absent |

The in-game manual survives in the `Folios` table of the dumps and is the best prose
description of intended v1 behaviour.
