# Библия — Russian Synodal Bible for iPad

> **Working on this project? Start with [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).** It covers architecture, deploy and cache gotchas, Rey's design decisions, tests, pending work and the change log.

Minimal Russian Synodal Bible reader with three reading slots, light/dark/auto themes, adjustable text size, and chapter audio (Igor Kozlov, A. F. Efimov).

- `web/` – web app (add to the iPad Home Screen from Safari: Share → Add to Home Screen).

Text: Russian Synodal Translation (1876), public domain, via The Unbound Bible.
Audio: Igor Kozlov and A. F. Efimov (Blagovestnik, freely distributed), streamed from Hugging Face and The Audio Power.


## Deep links

Open a passage with a URL hash (OSIS book code, or English / Russian short names):

| Example | Goes to |
| --- | --- |
| `#Ps.22` | Psalm 22 (Synodal numbering — «Господь – Пастырь мой») |
| `#John.3` | John chapter 3 |
| `#John.3.16` | John 3:16 (scrolls to the verse) |
| `#Иоанна.3` | same, Russian short name |
| `#Пс.50` | Psalm 50 (repentance) |

Separators `.` `:` `/` are accepted (`#John.3.16`, `#John:3:16`).

Optional query: `?play=1` starts chapter audio when the browser allows autoplay, e.g. `index.html?play=1#Ps.22`.

Hash changes (`hashchange`) update the active reading tab.

## Voice commands

Tap 🎤 (menu or bar, shown when `SpeechRecognition` / `webkitSpeechRecognition` is available). Speaks `ru-RU` or `en-US` from the UI language. Parser lives in `voice.js` for easy extension. Mic permission and live recognition need a real device (e.g. iPad).

## Home Assistant

Voice Preview / Assist examples (TTS, Kozlov clips, «где я остановился?» webhook): see [docs/home-assistant/](docs/home-assistant/).

## Tests

`tests/qa.js` is a headless-Chrome end-to-end suite (audio, wake lock and beacons are mocked
by `tests/mocks.js`). It covers reading, selection, playback, modes, picker, menu, deep links,
saved-state edge cases, the service worker update, and a layout check at iPad and phone sizes.

    npm i puppeteer-core            # or set PUPPETEER_CORE=/path/to/puppeteer-core
    CHROME=/usr/bin/google-chrome node tests/qa.js
    ONLY=audio,layout SHOTS=/tmp/shots node tests/qa.js   # subset + screenshots
