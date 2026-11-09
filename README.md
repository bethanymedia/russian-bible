# Библия — Russian Synodal Bible for iPad

Minimal Russian Synodal Bible reader with three reading slots, light/dark/auto themes, adjustable text size, and chapter audio (Igor Kozlov, A. F. Efimov).

- `web/` – web app (add to the iPad Home Screen from Safari: Share → Add to Home Screen).
- `RussianBible.swiftpm` – Swift Playgrounds app (coming).

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

