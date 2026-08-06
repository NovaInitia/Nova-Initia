# Nova Initia — recovered lore

**Recovered 2026-08-06** from the v1 `Folios` table, in the MySQL dumps at
`/mnt/sdb1/ni2/root/All.sql` and `/mnt/sdb1/ni2/root/backup/nibkp.sql`.

`Folios` was the in-game manual: `id`, `Title`, `Body` (HTML), `FolioCategoryID`. Both dumps
hold the **same 18 entries**, ids 6–15 and 17–24. Ids 1–5 and 16 were deleted before either
dump and are **not recoverable** from these sources.

Bodies were HTML. They have been converted to readable Markdown here, and the original
UTF-8-stored-in-latin1 mojibake (`â€œ` for a quote mark, and similar) has been repaired.

---

## The Charter — the stories

**Source:** `rf/apps/remog/public/includes/charter.txt`, included by the site's Charter page.
40KB, ten stories, ~35KB of prose. Recovered separately from the database — this file lived on
disk and appears in no dump.

The Charter page introduced them like this:

> When we realized this barren wasteland had become our home it became important to establish
> laws, or at least some semblance of such. Chaotic beginnings never bode well for the orderly
> of us. **The stories you'll read here will speak to that. Call them history, myths, even flat
> out lies if you like, but learn them well.** The collection of writings found here before you
> make up our charter, our understanding of and goals for the world around is.

| Story | |
|---|---|
| [Tools](charter-01-tools.md) | |
| [**The Fall**](charter-02-the-fall.md) | The founding myth, told by an old woman to a crowd. **The best single piece of writing recovered.** |
| [The Nameless One](charter-03-the-nameless-one.md) | A stranger stumbles into one of the first camps after the Fall. |
| [Of Tools](charter-04-of-tools.md) | |
| [Story](charter-05-story.md) | A Guide's troop waits for a doorway to align. |
| [Marshal](charter-06-marshal.md) | Marshal Singer, law in the town of Nova, and an underage jaunter's tagging offence. |
| [Spider](charter-07-spider.md) | A boy, a cave, and the thing inside it. |
| [Doorways](charter-08-doorways.md) | |
| [Guide](charter-09-guide.md) | How the Guides made doorways stable. |
| [Traps and Trappers](charter-10-traps-and-trappers.md) | |

### The Fall, in brief

Before the crash the net was glorious — all servers joined in one web, the **Users** wise in the
paths through the **webway**, raising themselves to the status of gods. Then a schism: *those
who sought freedom through choice, and those who sought freedom through rules.* They settled on
one field of battle, **the great Google**, chosen through laziness as much as intent. One side
filled it with explosive devices; the other flooded in to disarm them.

> The weight of the tools alone would never have harmed the server… But the pressures of the
> tools weight, of the constant change, of the battle raging upon it's surface finally collapsed
> the great Google, sucking the surrounding pages, linked in by a multitude of paths and
> portals, deep into the depths of emptiness left in it's passing.

Everyone fighting there was lost. The survivors are those who stayed away — and their
descendants are the players. The game's tools are the same tools that destroyed the world.

---

## The manual — `Folios`

## Contents by category

Category names come from the `foliocategories` table. **Categories 6 and 8 no longer exist in
that table** — the folios reference them but the category rows were deleted, so the names below
are inferred from content.

### 1 — General

| | |
|---|---|
| [13 — Gaining SG in Nova Initia](13-gaining-sg-in-nova-initia.md) | **How the economy works.** Primary source, and it corrects the reverse-engineered account — see §"Why this matters" below. |
| [18 — SG (Money)](18-sg-money.md) | The currency's in-fiction history. Sigourn Grotenfelt, "slugs", the Fall. The richest single piece of worldbuilding recovered. |
| [22 — Creating a Tour](22-creating-a-tour.md) | |
| [23 — Taking a Tour](23-taking-a-tour.md) | |

### 2 — Tool Instructions

How to use each tool, from the player's side.

[6 — Barrels](06-barrels.md) · [7 — Traps](07-traps.md) · [8 — Shields](08-shields.md) ·
[9 — Spiders](09-spiders.md) · [19 — Doorways](19-doorways.md) · [21 — Signposts](21-signposts.md)

### 3 — Tool Descriptions

The in-fiction account of each tool — where they came from and what they are.

[15 — Spiders](15-spiders.md) · [17 — Traps](17-traps.md) · [20 — Doorways](20-doorways.md) ·
[24 — Shields](24-shields.md)

### 6 — The castes *(category row deleted; name inferred)*

[10 — Guides](10-guides.md) · [11 — Guardians](11-guardians.md) · [12 — Givers](12-givers.md)

### 8 — Conduct *(category row deleted; name inferred)*

[14 — Cheating](14-cheating.md)

---

## Glossary of the world

Assembled from across the folios and the surviving site copy.

| Term | Meaning |
|---|---|
| **The Fall** | The catastrophe the setting follows. Years are counted from it. |
| **ATF** | *After The Fall.* The era marker. **`ATF` is canonical**, confirmed by the Project Owner 2026-08-06. Folio 24 has it right; folio 18's two instances of `AFT` are typos in the original. The folio files preserve the source text verbatim — they are a recovered artifact and are not silently corrected — so expect to see both spellings there. |
| **The Interwebs** | The world. The web itself, as the game's geography. |
| **The wastes** | The dangerous, unexplored parts of it. |
| **Union Alliance** | The governing body. Signs the events feed as `ua@nova-initia.com`, publishes the **Union Alliance Crier**, and thanks you for your custom when you buy tools. |
| **The Guilds** | Named alongside the Union as encouraging tool use through the stipend. |
| **Council of Guardians** | The Guardian caste's governing body. |
| **Caste** | The three factions: **Guide**, **Giver**, **Guardian**. The site calls them factions; the lore calls them castes. |
| **Sg** | The currency. Commonly "slug", affectionately "sluggers". Physically a high-energy cell. |
| **Sigourn Grotenfelt** | Of the Guides' caste. Invented the prototype energy cell in **25 ATF**, casing inscribed with her initials **SG** — the currency's etymology. |
| **Unobtainium** | The metal of her trademark casing. |
| **Slug heaps** | Early privately-owned workshops that produced cells by hand, sited away from camps because the materials were unstable. |
| **Firefly roof** | Very light roofing used with thick walls in the mass-production installations of **150 ATF**, so an explosion vented upward. |
| **"Pieces of eight" slug pouch** | The oldest surviving denomination. Fitted the PMSK090 "paint-it-yourself" signpost and lasted fifty uses. |
| **Sergeant Major Haddock** | Addressed the Council of Guardians on *the day of the Doorway, 6th week in the season of Guardian:Protect, 75 ATF*, arguing that traps and spiders had to be stopped. The in-fiction origin of shields. |
| **The Users** | The pre-Fall ancestors. Wise in the paths through the webway, they "lifted themselves to the status of Gods" — and the players are descended from the ones who stayed away from the battle. |
| **The webway** | The pre-Fall net, when all servers were joined. |
| **The great Google** | The field of battle chosen for the final schism, and the server whose collapse caused the Fall. |
| **The camps** | Where survivors first gathered afterwards. |
| **Nova** | A town. The higher-ups renamed it for the newcomers. |
| **Marshal Singer** | Law in Nova. Dismisses minor tagging offences by underage jaunters. |
| **Jaunter** | Someone who travels by doorway. |
| **Trappers** | Those who lay traps, as a calling. |
| **The Nameless One** | A stranger who stumbled into one of the first camps after the Fall. |

## The calendar is part of the fiction

Sergeant Major Haddock's address is dated *"The day of the Doorway, 6th week in the season of
Guardian:Protect"* — and that is a **valid date** under `includes/nitime.php`: day 3 of the
six-day week, week 6 of 10, season 4 of 6. The calendar was not decoration bolted on; in-world
documents are dated with it.

Its structure is described in [PHP-ERA-FINDINGS §6a](../docs/PHP-ERA-FINDINGS.md). In short: a
six-day week whose days are the six tools; six seasons of sixty days named `Caste:Aspect`
(Giver:Gift, Giver:Warn, Guide:Lead, Guide:Leap, Guardian:Protect, Guardian:Disarm); and five
days outside the week cycle at year's end — **Pride, Fall, Terror, Faith, Salvation**.

Note that **Fall** is one of those five days. The calendar's structure and the setting's founding
catastrophe share a name, and the seasons' benevolent/aggressive pairing is the same axis the
karma system runs on.

## Why this matters beyond flavour

Folio 13 is not only lore — it is the **design document for the sg economy**, and it is more
precise than anything recoverable from the code. It states the stipend's eligibility rule in
terms the implementation only approximated. That correction is recorded in
[PHP-ERA-FINDINGS §4b](../docs/PHP-ERA-FINDINGS.md).

## What is not here

- **Folios 1–5 and 16** — deleted before both dumps.
- **Other site prose** — `whatis.html.php` (the public pitch), `art.html.php`, `tour.html.php`
  and `trade.html.php` (the *Trading Post*) hold copy rather than fiction, so they are not
  reproduced here. Worth noting the Trading Post existed as a **shop**, not player-to-player
  trade — relevant to any future trading design.
- **Category names for 6 and 8** — the rows are gone; the headings above are inferred.
- **`Events_sp`** — the Union Alliance Crier's feed is generated by a stored procedure that does
  not appear in either dump's `proc` table.
- **Forums, random events, stamps** — all scaffolded, all empty. `Stamps` has eight rows, but
  they are labels ("I haz traps", "Pork Wrangler"), not lore.
