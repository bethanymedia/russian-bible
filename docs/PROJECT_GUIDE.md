# Russian Synodal Bible PWA: Project Guide (handoff)

This is the single place to start for anyone, human or assistant, who picks up this project. Everything here was taken from the repo, its git history and Rey's stated preferences as of **Nov 9, 2026 (rb-v39, commit `7ae842d`)**. When you change behavior, update this file too.

## Contents

1. [Overview and goals](#1-overview-and-goals)
2. [Links](#2-links)
3. [Hosting, deploy and cache gotchas](#3-hosting-deploy-and-cache-gotchas)
4. [File and architecture map](#4-file-and-architecture-map)
5. [Data formats and sources](#5-data-formats-and-sources)
6. [Features and Rey's design decisions](#6-features-and-reys-design-decisions)
   - [6.1 Shared (tablet and phone)](#61-shared-tablet-and-phone)
   - [6.2 Tablet (iPad) layout](#62-tablet-ipad-layout)
   - [6.3 Phone layout](#63-phone-layout)
   - [6.4 Colors and themes](#64-colors-and-themes)
7. [State and localStorage schema](#7-state-and-localstorage-schema)
8. [Audio sources](#8-audio-sources)
9. [Content licensing](#9-content-licensing)
10. [Testing](#10-testing)
11. [Known issues](#11-known-issues)
12. [Pending and later work](#12-pending-and-later-work)
13. [Working with Rey (workflow preferences)](#13-working-with-rey-workflow-preferences)
14. [Change log](#14-change-log)

---

## 1. Overview and goals

- A minimal **Russian Synodal Bible (1876)** reader, built as a static **PWA** (no build step, no framework, no server). Rey mainly uses it on his **iPad**, added to the Home Screen from Safari, and also on an **Android phone in Chrome**.
- Goals:
  - Fast, calm reading.
  - Three reading tabs, each remembering its own place.
  - Chapter audio (Kozlov or Efimov), with verse-level start and follow-along for Kozlov.
  - Optional Толкование (Lopukhin commentary), Симфония (in-app concordance) and an English (WEB) line under each verse.
- **The UI is in Russian by default.** An English UI option exists (menu → Язык · Language), but the Bible text is always Russian.
- **Numbering is Synodal everywhere.** For example, Ps 22 = «Господь – Пастырь мой» (English Ps 23). Deep links, the HA data and the timings all use Synodal numbering.
- Rey **dropped the Swift Playgrounds version**; the web app is the product. README still mentions `RussianBible.swiftpm` ("coming"), but that line is out of date.
- Everything is **free and public domain** (see [§9](#9-content-licensing)).

## 2. Links

| What | Where |
| --- | --- |
| Live app | https://bethanymedia.github.io/russian-bible/ |
| Repo (public, branch `main`) | https://github.com/bethanymedia/russian-bible |
| Deploy workflow | [.github/workflows/pages.yml](../.github/workflows/pages.yml) · [Actions runs](https://github.com/bethanymedia/russian-bible/actions) |
| Example deep link | https://bethanymedia.github.io/russian-bible/#Ps.22 (also `#John.3.16`, `#Иоанна.3`, `?play=1#Ps.22`) |
| Per-chapter JSON (for HA) | https://bethanymedia.github.io/russian-bible/data/verses/Ps.22.json · index: `data/verses/index.json` |
| Google Drive sync setup | [docs/google-sync.md](./google-sync.md) |
| Home Assistant guide | [docs/home-assistant/README.md](./home-assistant/README.md) |
| Tailscale (private HA access) | [docs/home-assistant/tailscale.md](./home-assistant/tailscale.md) |
| Kozlov audio (Hugging Face) | https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov |
| Efimov audio | https://theaudiopower.org/RUSV/Recordings/ |
| Text source | The Unbound Bible (Biola University), Synodal 1876 |
| English | World English Bible, public domain (ebible.org) |

## 3. Hosting, deploy and cache gotchas

**Deploy**
- GitHub Pages, deployed by GitHub Actions ([pages.yml](../.github/workflows/pages.yml)). It runs on every push to `main` that touches `web/**` or the workflow file, and can also be run by hand (`workflow_dispatch`). The `web/` folder is uploaded as-is.
- **Docs-only commits do not deploy.** That's expected.
- To push from the box: `git -c user.name=bethanymedia -c user.email=media@bethanysc.com commit …`, then `git push origin HEAD:main` (`gh` is authenticated).
- To check a deploy:
  - `gh run list -L 1`
  - `curl -s https://bethanymedia.github.io/russian-bible/sw.js | head -1` should show the new `V`.

**Service worker (`web/sw.js`), the part people get wrong**
- **`const V = 'rb-vNN'`** is the cache name. **Bump it on every change to `web/`.** Activating a new version deletes the old caches. History: rb-v34 (QA pass 2) → v35 (tablet bar v9) → v36 (fonts) → v37 (e-Sword dark) → v38 (picker / light selection / SW fix) → **v39 (current, bigger ▶)**.
- Precache list `FILES`: the app shell, the icons, `data/bible.json`, `data/kozlov_timings.json` and `data/web.json`. Install uses `new Request(f, {cache:'reload'})`, so the precache never picks up stale copies from the HTTP cache.
- **App files are network-first** with `fetch(e.request, {cache:'no-cache'})`, falling back to the cache when offline.
  - Why: GitHub Pages sends **`cache-control: max-age=600`**. A plain `fetch(e.request)` can be answered from the browser's HTTP cache, so a deploy showed up **as much as 10 minutes late**. That caused Rey's "selection still green" report. Fixed in `3ea991a`, with a regression test in `GROUPS.sw`.
- **`/data/` and `/fonts/` are cache-first**, cached on first use (fonts are **not** precached; a test checks this).
- After a deploy, a device needs one or two reloads or app opens before the new SW takes control.

## 4. File and architecture map

```
web/
  index.html            markup: header (title, Толкование/Симфония/English toggles), #reader/#text,
                        bottom #bar (☰ #menuBtn, ▶ #audioBtn, #player {#pL: #pRef chip, #pBack ↺15 |
                        #pR: #pTime, #pStop ■}, #chNav ‹ #current ›, #slots tabs), #pop menu, #sheet
  app.js   (~1490 ln)   all app logic (see below)
  style.css (~340 ln)   lines 1–3 = theme variables (light :root, dark, auto-dark media query)
  sw.js                 service worker (see §3)
  sync.js               optional Google Drive appData sync; inert while GOOGLE_CLIENT_ID = '' (line 7)
  voice.js              Russian/English voice-command parser (pure functions, UMD; BibleVoice)
  manifest.webmanifest, icon-180/192/512.png
  fonts/<id>/{cyrillic,latin}-{400,700}.woff2 + OFL.txt   (pt-serif, literata, noto-serif, pt-sans, noto-sans)
  data/ bible.json, web.json, kozlov_timings.json, commentary/<OSIS>.json, verses/<OSIS>.<ch>.json + index.json
docs/  PROJECT_GUIDE.md (this file), google-sync.md, home-assistant/*, examples/play_verse_clip.sh
tests/ qa.js (end-to-end suite), mocks.js (fake audio, wake lock, sendBeacon)
```

**Key pieces of `app.js`** (search for these names):
- **State:** `KEY='rb_state_v1'`, `DEF`, `load()` → `migrateState()` → `sanitizeState()`, `save()`.
- **Fonts:** `FONTS` and `FONT_RANGES` are defined near the top, **before** `let S = load()`, because `sanitizeState` uses `FONTS` and moving them later causes a temporal-dead-zone (TDZ) crash. Also `loadFont`, `applyFont`, `setFont`, `buildFontMenu`, `previewFonts`.
- **Layout:**
  - `isPhone()` is `(max-width:600px)` or `(max-height:500px) and (max-width:1000px)`. `layoutPhoneChrome()` toggles `body.phone` and moves `#slots` into the header on phone.
  - Tablet-only CSS is scoped with `body:not(.phone)`.
- **Bar:**
  - `layoutAudioBtn()` places ▶ at `--audio-x`, the midpoint between ☰ and ‹.
  - `fitPlayerControls()` adds `noTime` or `noBack` only on a collision.
  - `showPlayerChrome`, `updateAudioRefChip`.
- **Audio:**
  - A single `playAt(b,c,verse,opts)` with an `audioGen` token, so stale callbacks never fire.
  - Also `whenAudioReady`, `pauseAudio`, `stopAudio`, `audioURL()`, `playFromVerse()` and `setSleep()`.
- **Reading place:** `captureAnchor()` → `{vi,vo,vf,y}` (measured under the sticky header), plus `applyAnchor`, `keepPlace(fn, anchor)`, `liveAnchor` and `readerScrollTo` (`progScrollUntil` marks scrolls the app makes itself).
- **Selection and inline ▶:** `selectedVerse`, `clearVerseSelection()`, `syncVerseInlinePlay()`.
- **Panels:**
  - Commentary is loaded per book from `data/commentary/<OSIS>.json`.
  - `buildSimf()` builds the Симфония concordance in memory from `bible.json`: a word-stem index with at most 80 hits per stem.
  - Also `openSheet`, `closeSheet` and `openBooks()` (the picker).
- **Other:**
  - Wake lock: `bumpActivity()`, `requestWakeLock()`, released after 10 minutes idle unless audio is playing.
  - Swipe: horizontal swipe on `#reader` changes chapter.
  - HA webhook: `postHaPosition()`, https only, posted as `text/plain` with `no-cors` via sendBeacon or fetch.
  - Strings: `T.ru` / `T.en` (UI strings plus the `credits` HTML shown in О приложении).

## 5. Data formats and sources

| File | Format | Source |
| --- | --- | --- |
| `data/bible.json` (5.9 MB) | `{books:[{n:name, a:abbr, o:OSIS, e:Efimov file name, c:[[verse,…],…]}]}`, 66 books, Synodal order/numbering | Synodal 1876, The Unbound Bible; glued words split against a reference (commits `bf8f88c`, `3034641`) |
| `data/web.json` (4 MB) | `{name, full, license, source, c:[[chapters of verses] per book]}` in the same book order as bible.json | World English Bible (Classic), public domain, ebible.org, aligned to Synodal numbering |
| `data/kozlov_timings.json` | `"Gen.1": [startMs, …]` per chapter (verse start times in ms) | derived for the Kozlov recordings |
| `data/commentary/<OSIS>.json` (17 MB total) | `{osis, source:'lopukhin', chapters:{"1":[{s,e,t}]}}` (verse range s–e, text t) | Lopukhin Explanatory Bible (1904–1913), public domain, **OCR** |
| `data/verses/<OSIS>.<ch>.json` (1190 files) + `index.json` | `{osis, book, abbr, ch, verses:[…]}`; verse 1 = `verses[0]` | generated from bible.json for Home Assistant / external use |

OSIS codes (`Gen`, `Ps`, `John`, `1Chr` …) are used in deep links, timings, commentary and verse files.

## 6. Features and Rey's design decisions

**Don't change behaviors Rey asked for** unless he asks. Anything in this section is deliberate.

### 6.1 Shared (tablet and phone)

- **Three reading tabs** (`#slots`), default Быт 1 / Пс 22 / Ин 1. Each tab keeps its own place (book, chapter, verse anchor and offset). Tapping a tab closes any open sheet and clears the selection.
- **Navigation:**
  - ‹ › chapter arrows beside the bottom label (rapid taps are debounced; the arrow is disabled at Быт 1 and Откр 22).
  - Horizontal **swipe** changes chapter (ignored while the picker is open).
  - At the end of a chapter, a button shows the next chapter's name (e.g. «Псалом 24 →»).
- **Book picker** (tap the bottom label `#current`):
  - OT, NT and a chapter strip on one screen; books sit in bordered group boxes and read top to bottom by column. OT is gold and NT is green.
  - **No «Книги» title row** (removed per Rey so the lists sit higher). Closing works three ways:
    - a small ✕ at the right end of the top-right testament heading (NT heading in landscape, OT heading in portrait);
    - tapping the label again;
    - tapping a tab.
  - The headings stay pinned while their lists scroll.
  - Swipe-down-to-close was lost along with the title row.
- **Verse tap:**
  - With nothing on, a tap **selects** the verse and shows the inline ▶. Tapping it again deselects.
  - English is shown only when the English toggle is on, and then for the whole chapter. Tapping a verse never reveals English.
- **Inline verse ▶ ("option E"):**
  - An **outlined triangle**: no circle or background, stroke ≈2.5 with round joins, ~24 px tall.
  - Sits in the left gutter of the selected verse, with a ≥44 px tap target (phone: 28×40 gutter).
  - Plays from that verse.
  - Shown only while audio is paused or stopped. Once audio plays it doesn't reappear on selected verses until playback is paused.
  - Colors: #CFCFCF in dark, #555 in light.
- **Playback rules:**
  - Selected verse + nothing playing → the bar ▶ starts from that verse. This works for Kozlov, which has timings; Efimov always starts at the chapter beginning.
  - While playing, tapping a verse only highlights or selects it, and ▶ jumps playback to it without stopping.
  - **Audio keeps playing across chapter and book navigation** unless it is paused or stopped. With "continue", the next chapter starts automatically when one ends.
  - With "follow" (Kozlov only), the current verse is highlighted and kept in view.
- **Toggles:** Толкование, Симфония and English (`S.mode` = `tolk` / `simf` / `en`, one at a time; `''` = off).
  - While any toggle is on, the title and toggles row **stays pinned at the top**.
  - Inactive toggles are faint and match the header title type. Tablet uses full words; phone uses short ones (Толк/Симф/Eng).
  - **Толкование:** tap a verse to open the Lopukhin commentary panel.
  - **Симфония:** tap a word to open the concordance hits.
  - Panel text follows the Bible text size and the chosen font.
- **Menu (☰):**
  - Язык · Language; text size (18–64, step 2; default 24, new phone installs 20); **Шрифт** (font).
  - Тема: Светлая / Тёмная / Авто (default **dark**).
  - Чтец: **Козлов | Ефимов** (a two-way toggle, not a dropdown).
  - English translation selector.
  - **Скорость** 0.9× / 1× / 1.1× / 1.2× (pitch preserved; saved rates snap to these).
  - Sleep timer: Выкл / 15 / 30 / 60 min / end of chapter.
  - Continue to next chapter; Follow verse (Kozlov).
  - О приложении (credits).
  - **Дополнительно** (off by default): reveals the voice command 🎤, the Home Assistant webhook URL and Google sync. Rey wants these hidden but the code kept.
- **Fonts** (Bible text, English lines and the Толкование/Симфония panel text; the UI chrome keeps the system font):
  - Georgia (default), PT Serif, Literata, Noto Serif, PT Sans and Noto Sans.
  - Self-hosted OFL woff2 files (Cyrillic + Latin, 400 and 700). Nothing loads until the menu opens; opening it loads only the 400 weights for previews, and the chosen font also loads 700.
  - Each option shows «Аа Name» in its own face. Switching fonts keeps the reading place.
- **Screen wake lock** while reading or listening, released after 10 minutes idle unless audio is playing.
- **Zoom:** pinch and double-tap zoom are disabled.
- **Deep links:** `#Ps.22`, `#John.3.16`, `#Иоанна.3`, `#Пс.50` (separators `.` `:` `/`) and `?play=1` (see README). A `hashchange` updates the active tab.
- **Optional HA position webhook:** only when a URL is pasted (Дополнительно); **https only** (mixed content). See the HA docs.
- **Optional Google Drive sync** of the last place read: hidden, off by default, and inert until a client ID is set.

### 6.2 Tablet (iPad) layout

Tested at 1180×820 and 820×1180.

- **Bottom bar** (64 px): ☰ on the left, then ▶/❚❚, then ‹ label › and the three tabs on the right.
- **▶/❚❚:**
  - **Final size: a 46 px glyph in a 58 px button** (rb-v39). Rey later said it is **fine as is**, so don't enlarge it again.
  - It sits at **one fixed spot, centered halfway between ☰ and ‹**, in both states, with no shift when toggled.
  - Icons are muted gray (`--bar-icon`), which Rey asked for ("less bright, grayer").
- **While playing:**
  - `[chip ↺15] ❚❚ [time ■]` hang off either side of ❚❚. The chip shows which chapter is playing when you're viewing a different one.
  - **There is no seek slider.**
  - The ‹ label › stays visible.
  - If space runs out, the time hides first, then ↺15. Currently everything fits in both orientations.
  - When paused, all player controls hide except ▶.
- **Tabs:** 20 px **bold**. The **active tab is gray** and inactive tabs match the page background (black, or #121212 in dark).
- **Header:** large type (~50% larger than at first), full-word toggles «Толкование», «Симфония», «English».

### 6.3 Phone layout

Tested at 360/390/412 portrait and 844×390 landscape, on Android Chrome.

- The **top part is always frozen**. The tabs sit in the top row, there's no chapter title, and the toggles are short (Толк/Симф/Eng).
- **Bottom bar** (56 px; 52 px in short landscape): ☰ ▶ on the left, ‹ book chapter › on the right. **Pause/play only, with no slider or other player controls.**
- Sheets (picker, panels) open **under the frozen header**, so the tabs stay usable.
- The menu is full width, opens from the bottom and stops below the header.
- **Phone changes must not leak from tablet-only work.** Earlier, a tablet-only ▶ size change leaked into the phone bar until it was scoped with `body:not(.phone)`. Verify this with the pixel compare in [§10](#10-testing).

### 6.4 Colors and themes

Theme variables are on `style.css` lines 1–3: light `:root`, then `:root[data-theme=dark]`, then the same dark set inside `@media (prefers-color-scheme:dark){:root[data-theme=system]…}`. **Edit both dark blocks together.**

| Token | Light | Dark (e-Sword style) |
| --- | --- | --- |
| Page `--bg` | #fff | **#121212** |
| Bars / menus `--bar` | #f9f9f9 | **#1b1b1d** |
| Bible and panel text `--text` | `--fg` #1c1c1e | **#CFCFCF** |
| Panel headings `--head` (featRef, simfBook) | `--num` green | **#CFCFCF** |
| UI text `--fg` | #1c1c1e | #e5e5e7 |
| Selected verse `--sel-bg` (and `.hl.sel`) | **#D6E4F2**, no ring | **navy #19334D**, no ring |
| Inline ▶ `--ip-color` | #555 outline | #CFCFCF outline |
| Verse numbers `--num` | #00875A | #34D399 (green stays for numbers and active toggles) |
| Playing highlight `--hl` | #fff3b0 | #3a3410 (+ accent inset bar) |

- **Rule: no green selection in any theme or state.** The `selcolor` test enforces it.
- Contrast in dark: text on page 12.0:1, text on navy 8.3:1, green numbers on navy 6.7:1.

## 7. State and localStorage schema

- **Key `rb_state_v1`** (JSON), defaults in `DEF`:

```js
{ active: 0,                                   // tab 0–2
  slots: [{b,c,y,vi,vo} ×3],                   // book idx 0–65, chapter idx, scrollTop, anchor verse idx, offset px
  fs: 24, theme: 'dark'|'light'|'system', reader: 'kozlov'|'efimov',
  cont: true, rate: 1 (0.9–1.2), follow: true, lang: 'ru'|'en',
  tr: 'web', trAll: false (legacy → mode), mode: ''|'tolk'|'simf'|'en',
  num: 'syn', tabsV: 2,                        // migration markers
  haWebhook: '', adv: false, driveSync: false, syncAt: 0,
  font: 'default'|'pt-serif'|'literata'|'noto-serif'|'pt-sans'|'noto-sans' }
```

- `migrateState`:
  - Fills in new keys from `DEF`, converts old Psalm numbering to `num:'syn'`, and resets the tabs once (`tabsV<2`).
  - Clamps `fs` to 18–64 in steps of 2 and snaps `rate`.
- `sanitizeState` repairs bad values: slots, theme, reader, lang, mode, font, booleans. **Any new setting needs a `DEF` default, a sanitize rule and a test** in `GROUPS.state`.
- `sync.js` also uses `rb_sync_file_id` (the Drive file id). The Drive file `rb_sync.json` holds `{active, slots, updatedAt}`, and the last writer wins.

## 8. Audio sources

| Reader | URL pattern | Notes |
| --- | --- | --- |
| **Igor Kozlov** (default) | `https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov/resolve/main/a1/kozlov/<OSIS>/<ch>.m4a` | Blagovestnik, freely distributed. Has **verse timings** (start from a verse, follow-along). |
| **A. F. Efimov** | `https://theaudiopower.org/RUSV/Recordings/<book.e>[ <ch>].mp3` | Blagovestnik. **No verse timings**, so it always starts at the beginning of the chapter. |
| Bondarenko, Wordproject | none | **Dropped by Rey** (copyright or unclear license). Don't re-add them. |
| Faith Comes By Hearing **Bible Brain** | none | **Pending.** Rey will look into an API key himself. |

Audio streams over the internet; it isn't cached offline. The ↺15 button rewinds 15 s.

## 9. Content licensing

**Only public-domain or freely distributed content.** Before adding any text, audio or font, check its license.
- Text: Synodal 1876 (public domain).
- English: WEB (public domain).
- Commentary: Lopukhin 1904–1913 (public domain).
- Audio: Kozlov and Efimov via Blagovestnik (freely distributed).
- Fonts: SIL OFL 1.1, with license files in `web/fonts/*/OFL.txt`.

Credits appear in О приложении (`T.ru.credits` / `T.en.credits`); keep them in sync.

## 10. Testing

- **`tests/qa.js`** is an end-to-end suite: puppeteer-core drives headless Chrome against a built-in static server (which can rewrite the `sw.js` version and imitate GitHub Pages' `max-age=600` caching).
- **`tests/mocks.js`** fakes HTMLMediaElement (following Chrome's event order), the Wake Lock API and sendBeacon.
- Groups:

  `state deeplink verse audio reader modes nav combo adv wakelock sw tablet fonts esword picker selcolor layout`

  `layout` probes every viewport (iPad 1180×820 / 820×1180, phones 360/390/412, 844×390) for elements that are offscreen, overlapping or clipped, tap targets that are too small, and the pinned header's position.
- Run it (about 4 minutes; **run it in the background with a log**, because long foreground shells get cut off):

```bash
cd /workspace/russian-bible/repo
PUPPETEER_CORE=/workspace/shots/node_modules/puppeteer-core node tests/qa.js > /tmp/qa.log 2>&1 &
grep -E "FAIL|passed" /tmp/qa.log
# options: ONLY=audio,layout  SHOTS=/dir (layout screenshots)  WEB_DIR=/other/web  REPORT=file  VERBOSE=1
```

- **Last result: 579/579 passed** (commit `7ae842d`, rb-v39).
- **Phone pixel compare** (to prove a tablet-only change left the phone untouched):
  1. `git worktree add -f /tmp/oldweb HEAD`
  2. Run `ONLY=layout WEB_DIR=/tmp/oldweb/web SHOTS=/tmp/cmpA`, then the new code with `SHOTS=/tmp/cmpB`.
  3. Diff the `ph*` images (PIL ImageChops).
  4. `git worktree remove --force /tmp/oldweb`.
- Test pitfalls:
  - Tapping offscreen elements: the `tap` helper scrolls into view and waits 500 ms.
  - Use `span:nth-child(2)` for verse text, not `:last-child`, because the inline ▶ is appended to the verse.
  - Elements inside a flex container report `display:block`.

## 11. Known issues

- **Commentary OCR errors:** the Lopukhin text in `data/commentary/` comes from OCR and contains page numbers and other artifacts. For example, `John.json` chapter 1 begins with "987 принадлежащее…". Clean it up in the data, not in code.
- **No swipe-down-to-close in the book picker** since the «Книги» title row was removed. Close it with ✕, a label tap or a tab tap.
- **Efimov has no verse timings**, so starting from a verse and follow-along work with Kozlov only.
- **Updates need reloads:** after a deploy, devices pick up the new SW within one or two loads (see [§3](#3-hosting-deploy-and-cache-gotchas)).
- README is partly out of date (it mentions `RussianBible.swiftpm`).

## 12. Pending and later work

- [ ] **Google Drive sync:** create a Web OAuth client ID and paste it into `GOOGLE_CLIENT_ID` in `web/sync.js` (steps in [docs/google-sync.md](./google-sync.md)). Then enable it under Дополнительно → Синхронизация.
- [ ] **Home Assistant:** follow the plan in [docs/home-assistant/README.md](./home-assistant/README.md).
  - Rey ordered a **Voice Preview Edition** (backordered).
  - Use HA Assist (Russian) to play chapter audio on speakers and open chapters on the iPad through deep links, using local Piper TTS.
  - Rey uses **Alexa rather than Siri**; Alexa routines would trigger HA scripts.
- [ ] **Private remote access:** keep HA local only and switch to Tailscale after the Nabu Casa trial ([tailscale.md](./home-assistant/tailscale.md), with a checklist). No router port forwarding; DuckDNS is not recommended. Cloudflare Tunnel + Access only if something external, like an Alexa skill, must reach HA.
- [ ] **Nabu Casa trial reminder:** cancel before it bills (README → "Cancel before it bills").
- [ ] **Voice commands (🎤)** were started but **not finished.** The parser is in `voice.js`, and the UI is behind Дополнительно. They need real-device testing (mic permissions).
- [ ] **Siri shortcut** (deep link `#Ps.22` / `?play=1`): listed as later work. This is low priority, since Rey prefers Alexa.
- [ ] **Bible Brain audio:** waiting on Rey's API key.

## 13. Working with Rey (workflow preferences)

- **Keep behavior he asked for.** Don't "improve" a requested behavior on your own; ask first.
- **Russian UI text.** New labels need `T.ru`, plus `T.en` for the English UI.
- **Tablet-only requests must not change the phone**, and vice versa. Scope tablet CSS with `body:not(.phone)` and confirm with the pixel compare.
- **Screenshots only for visible changes.** Save them under `/workspace/shots/` with **new, versioned file names** (e.g. `play-v10.png`, `picker-v2.png`). iPad shots are 1180×820, plus 820×1180 when portrait matters.
- **Reports are concise lists:** commit hash, SW version, what changed, what was kept or dropped, and screenshot paths.
- **Each change goes through the same steps:**
  1. Update `tests/qa.js`.
  2. Run the full suite until green.
  3. Bump `V` in `sw.js`.
  4. Commit and push.
  5. Confirm the Pages deploy.
- **Hidden ≠ deleted:** keep the code for hidden features (HA, voice) so they can return.
- Free, private and public-domain options come first: no paid services, no public exposure of HA.

## 14. Change log

All commits on `main`, oldest first. Times are Eastern (UTC−5).

| Commit | When (2026) | Summary |
| --- | --- | --- |
| `4a9513f` | Nov 08 22:52 | Web app: reader, three slots, themes, audio |
| `a97bdda` | Nov 08 22:53 | Deploy web app to GitHub Pages |
| `a916fba` | Nov 08 22:55 | Player in bottom bar; stop, rewind, speed, sleep timer, continue and follow options |
| `7bdec0d` | Nov 08 22:57 | Dark by default; 50% larger bottom bar |
| `778beed` | Nov 08 22:59 | Menu and player on left, tabs on right, full-width text |
| `a722446` | Nov 08 23:00 | Russian/English interface option; Bible text stays Russian |
| `fc41bdf` | Nov 08 23:06 | English (WEB) toggle per verse and chapter; fix service worker; expandable translations list |
| `4ea429b` | Nov 08 23:08 | Tighter spacing, small top title, larger default text |
| `0fa8aba` | Nov 08 23:11 | More space between menu and play buttons |
| `e1d8196` | Nov 08 23:12 | English same size as Russian |
| `77b58c9` | Nov 08 23:14 | Subtler EN button |
| `ebf4d17` | Nov 08 23:19 | Book list: Old and New Testament side by side with color distinction |
| `3983db9` | Nov 08 23:30 | End of chapter: next book name only, Книги, 2x buttons |
| `6b16517` | Nov 08 23:31 | Picker 1D: OT, NT and chapter strip in one screen; close with ✕, label tap or swipe |
| `1f225b1` | Nov 08 23:34 | Book list font auto-fits screen size |
| `603c36b` | Nov 08 23:37 | Book list reads top to bottom by column |
| `7aa66a6` | Nov 08 23:38 | Bigger close button |
| `bf8f88c` | Nov 08 23:48 | Fix missing spaces in Synodal text; bump SW cache |
| `bd61deb` | Nov 08 23:48 | Keep inline audio player from overflowing the bottom bar |
| `bbf8d31` | Nov 08 23:59 | Book list: books grouped in bordered boxes, column order |
| `3034641` | Nov 09 00:04 | Split remaining glued Synodal words against reference text |
| `ead5352` | Nov 09 00:29 | Synodal numbering, chapter arrows, commentary/simf/voice, deep links |
| `3a8a188` | Nov 09 00:41 | Swipe, wake lock, scroll restore, HA Cloudflare webhook, fainter toggles |
| `bd4fff8` | Nov 09 00:43 | docs(HA): Nabu Casa trial first, then Cloudflare / DuckDNS |
| `8e10d90` | Nov 09 01:30 | Bar: move ▶ right, voice in menu; tap verse to play from there |
| `8e1eb55` | Nov 09 01:32 | While playing, verse tap only selects; ▶ jumps to it |
| `e88bcad` | Nov 09 01:34 | Update follow-verse highlight while seeking (and while paused) |
| `19f7961` | Nov 09 01:36 | Disable pinch and double-tap zoom on iPad Safari/PWA |
| `9dadc4d` | Nov 09 01:37 | Thicker 56px SVG chapter arrows in the bottom bar |
| `870b941` | Nov 09 01:38 | Match inactive mode toggles to header title type |
| `d7f8021` | Nov 09 01:41 | Text size 18–64 (step 2); Kozlov\|Efimov reader segment |
| `f1422f0` | Nov 09 01:44 | Hide HA and voice behind Extra options menu toggle |
| `eacc210` | Nov 09 01:52 | Keep audio playing across chapter/book navigation |
| `a4bb6c7` | Nov 09 01:56 | Larger header labels; tabs close sheet and clear selection |
| `27bf6f2` | Nov 09 01:58 | Speed options 0.9×–1.2×; snap saved rate; keep pitch |
| `4e5e868` | Nov 09 02:12 | Center bar ▶; inline verse ▶; mute player chrome |
| `153727b` | Nov 09 02:18 | Roomier playing bar; sticky mode header; panels track text size |
| `e3900d2` | Nov 09 02:21 | Redo playing bar as in-flow flex row (v8) |
| `1f5e573` | Nov 09 02:30 | Phone layout: sticky header with tabs, short toggles, compact bar |
| `6eb2e06` | Nov 09 02:38 | Add optional Google Drive reading-position sync scaffold |
| `6c13058` | Nov 09 02:41 | Fix book picker when a mode panel is open (QA) |
| `280cc37` | Nov 09 03:16 | QA pass 2: audio races, scroll place, state hardening, tests |
| `c75d129` | Nov 09 09:16 | Tablet bar v9: 20px bold tabs (active gray), larger fixed ▶/❚❚, no seek slider |
| `048f7da` | Nov 09 09:26 | docs(ha): Tailscale private-access guide; mark DuckDNS+port forwarding not recommended |
| `73fd534` | Nov 09 09:30 | Bible text font choice (Georgia, PT Serif, Literata, Noto Serif, PT Sans, Noto Sans; self-hosted OFL woff2, lazy-loaded, SW runtime cache); phone menu stays under header; rb-v36 |
| `94f417a` | Nov 09 09:36 | Dark theme: e-Sword colours (#CFCFCF on #121212, navy #19334D selection, outlined-triangle inline ▶); light unchanged; rb-v37 |
| `3ea991a` | Nov 09 09:50 | Picker: drop «Книги» title row (✕ in testament heading); light selection light-blue #D6E4F2 + #555 outlined ▶, no green selection in any theme; SW revalidates app files past HTTP cache (no-cache fetch, reload precache); rb-v38 |
| `7ae842d` | Nov 09 10:01 | Tablet: ▶/❚❚ glyph 1.5x (46px in 58px box), same centred spot, controls spaced clear; phone unchanged; rb-v39 |

After `7ae842d`: this guide (`docs/PROJECT_GUIDE.md`).
