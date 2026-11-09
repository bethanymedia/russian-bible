# Home Assistant + Russian Synodal Bible

Examples for an HA **Voice Preview Edition** (and any Assist pipeline). Copy what you need into your own config — **nothing is sent from the PWA unless you paste a webhook URL** in the app menu (empty by default).

Live PWA: https://bethanymedia.github.io/russian-bible/

Numbering is **Synodal**. Psalm 22 = «Господь – Пастырь мой» (English Psalm 23).

## Contents

| File | Purpose |
| --- | --- |
| [README.md](./README.md) | This guide |
| [rest_commands.yaml](./rest_commands.yaml) | Fetch chapter JSON |
| [webhook_position.yaml](./webhook_position.yaml) | Receive “where I left off” from the PWA |
| [scripts.yaml](./scripts.yaml) | TTS verse (local Piper), Kozlov clip, resume, open iPad |
| [intent_script.yaml](./intent_script.yaml) | Wire Assist intents → scripts |
| [custom_sentences/ru/bible.yaml](./custom_sentences/ru/bible.yaml) | Russian Assist sentences (extensible) |
| [../examples/play_verse_clip.sh](../examples/play_verse_clip.sh) | Optional ffmpeg verse clip helper |

---

## Cloudflare Tunnel (HTTPS for the webhook)

The Bible PWA is served from **HTTPS** (`bethanymedia.github.io`). Browsers block mixed content, so the Home Assistant webhook URL must also be **HTTPS**. This setup uses a **free Cloudflare Tunnel** (not Nabu Casa).

### 1. Domain on Cloudflare

1. Add your domain to [Cloudflare](https://dash.cloudflare.com/) (free plan is enough).
2. Point the nameservers as Cloudflare instructs.

### 2. Cloudflared add-on

In Home Assistant:

1. Settings → Add-ons → Add-on store → search **Cloudflared** (usually the community “Cloudflared” add-on by brenner-tobias, or install via the official Cloudflare docs).
2. Install, set your domain, create a tunnel, and expose Home Assistant (typically `http://homeassistant.local:8123` or `http://172.30.32.1:8123` as the service URL — follow the add-on README).
3. Start the add-on and confirm `https://ha.example.com` (your hostname) opens the HA UI.

### 3. `trusted_proxies` in `configuration.yaml`

Cloudflare (and the add-on) terminate TLS; HA must trust the proxy so client IPs and HTTPS redirects work:

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.30.33.0/24          # Home Assistant supervisor / add-on network (adjust if needed)
    - 127.0.0.1
    # Optional: Cloudflare IP ranges if you terminate elsewhere —
    # https://www.cloudflare.com/ips/
```

Restart Home Assistant after changing this.

### 4. Webhook URL to paste in the Bible app

1. Create an automation from [webhook_position.yaml](./webhook_position.yaml) (or UI → webhook trigger).
2. Note the webhook id, e.g. `bible_pwa_position`.
3. Public HTTPS URL shape:

```text
https://ha.example.com/api/webhook/bible_pwa_position
```

Paste that into the PWA menu field **Home Assistant**. Leave empty to disable (default — nothing is sent).

---

## Webhook CORS / how the app posts

Home Assistant’s webhook endpoint normally **does not** send `Access-Control-Allow-Origin` for `https://bethanymedia.github.io`. A browser `fetch` with `Content-Type: application/json` would trigger a CORS preflight and fail.

**Approach used by the app (works without changing HA CORS):**

- `navigator.sendBeacon` / `fetch` with **`mode: 'no-cors'`**
- Body = JSON string as **`text/plain`** (a “simple” content type — no preflight)
- HA still receives the raw body; in automations use `trigger.json` if HA parses JSON, or `trigger.data` / `| from_json` depending on version

Optional alternative (not required): add Cloudflare Transform Rules or a reverse-proxy header  
`Access-Control-Allow-Origin: https://bethanymedia.github.io` on `/api/webhook/*`. The app does **not** depend on that.

Payload example:

```json
{
  "osis": "Ps",
  "book": "Псалтирь",
  "abbr": "Пс",
  "chapter": 22,
  "verse": 3,
  "reader": "kozlov",
  "position": 26.5,
  "playing": true,
  "timestamp": "2026-11-09T05:30:00.000Z",
  "deep_link": "#Ps.22.3"
}
```

Posted (throttled) on chapter change, on pause, and every ~30s while audio is playing.

---

## Data the PWA exposes

### Per-chapter verses (best for HA)

```
https://bethanymedia.github.io/russian-bible/data/verses/<OSIS>.<chapter>.json
```

Example: `…/data/verses/Ps.22.json` → `{ "osis","book","abbr","ch","verses":[...] }`  
Verse **1** → `verses[0]`. Index: `data/verses/index.json`.

### Full bible / English

- `data/bible.json` — `books[i].c[ch0][v0]` Synodal Russian  
- `data/web.json` — same indexes, World English Bible  

### Kozlov audio + timings

```
https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov/resolve/main/a1/kozlov/<OSIS>/<chapter>.m4a
```

Timings: `data/kozlov_timings.json` → `"Ps.22": [startMs, …]`.  
End of verse *n* ≈ start of *n+1*.

### Deep links (iPad)

```
https://bethanymedia.github.io/russian-bible/#Ps.22
https://bethanymedia.github.io/russian-bible/#John.3.16
https://bethanymedia.github.io/russian-bible/?play=1#Ps.22
```

---

## (a) Two ways to hear a verse

### 1. Local Piper TTS (`ru_RU`) — no Bible audio player

Use **local Piper** on Home Assistant (Voice Preview Edition / Piper add-on), not a cloud TTS and not Nabu Casa cloud voices.

1. GET `data/verses/Ps.22.json`
2. Take `verses[verse-1]`
3. `tts.speak` with your local Piper entity (e.g. `tts.piper`) and a Russian voice such as `ru_RU-irina-medium` / `ru_RU-dmitri-medium` on the Voice PE satellite or any `media_player`

See `scripts.yaml` → `bible_tts_verse`.

### 2. Real Kozlov voice clip (start/end times)

Clip chapter `.m4a` between timing marks; play on a `media_player`.  
See `scripts.yaml` → `bible_play_verse_clip` and `../examples/play_verse_clip.sh`.

---

## (b) «Где я остановился?»

1. Cloudflare Tunnel HTTPS webhook URL in the PWA menu (above).  
2. [webhook_position.yaml](./webhook_position.yaml) stores OSIS, chapter, verse, position, deep_link in `input_text` helpers.  
3. Assist: «Где я остановился?» → [scripts.yaml](./scripts.yaml) `bible_where_i_was` (Piper reads the verse / next verse) or `bible_resume` (seek Kozlov), or open `deep_link` on the iPad.

---

## (c) Extensible Assist sentences

All custom Russian phrases: **`custom_sentences/ru/bible.yaml`**.

1. Add sentences under a new intent in that file  
2. Matching entry in `intent_script.yaml`  
3. Script in `scripts.yaml`  

Intents included: play chapter, play verse (clip), read verse (TTS), next/previous chapter, stop, where was I, resume, open tablet, daily verse.

---

## Wire-up sketch (`configuration.yaml`)

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.30.33.0/24
    - 127.0.0.1

rest_command: !include ha_bible/rest_commands.yaml

input_text:
  bible_osis: { name: Bible OSIS, max: 16 }
  bible_chapter: { name: Bible chapter, max: 8 }
  bible_verse: { name: Bible verse, max: 8 }
  bible_position: { name: Bible position sec, max: 16 }
  bible_deeplink: { name: Bible deep link, max: 64 }
  bible_reader: { name: Bible reader, max: 16 }

automation: !include ha_bible/webhook_position.yaml
script: !include ha_bible/scripts.yaml
intent_script: !include ha_bible/intent_script.yaml
# Copy custom_sentences/ru/bible.yaml into <config>/custom_sentences/ru/
```

Adjust entity ids (`media_player.*`, `tts.piper`, `notify.mobile_app_ipad`) to your system.

