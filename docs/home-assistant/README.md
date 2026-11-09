# Home Assistant + Russian Synodal Bible

Examples for an HA **Voice Preview Edition** (and any Assist pipeline). Copy what you need into your own config — **nothing is sent from the PWA unless you paste a webhook URL** in the app menu (empty by default).

Live PWA: https://bethanymedia.github.io/russian-bible/

Numbering is **Synodal**. Psalm 22 = «Господь – Пастырь мой» (English Psalm 23).

## Contents

| File | Purpose |
| --- | --- |
| [README.md](./README.md) | This guide |
| [tailscale.md](./tailscale.md) | **Recommended:** keep HA private with free Tailscale (to finish later) |
| [rest_commands.yaml](./rest_commands.yaml) | Fetch chapter JSON |
| [webhook_position.yaml](./webhook_position.yaml) | Receive “where I left off” from the PWA |
| [scripts.yaml](./scripts.yaml) | TTS verse (local Piper), Kozlov clip, resume, open iPad |
| [intent_script.yaml](./intent_script.yaml) | Wire Assist intents → scripts |
| [custom_sentences/ru/bible.yaml](./custom_sentences/ru/bible.yaml) | Russian Assist sentences (extensible) |
| [../examples/play_verse_clip.sh](../examples/play_verse_clip.sh) | Optional ffmpeg verse clip helper |

---

## Getting HTTPS for the webhook (start here)

The Bible PWA is on **HTTPS** (`bethanymedia.github.io`), so the Home Assistant webhook must also be **HTTPS** (browsers block mixed content).

**Recommended path:** start with the **Nabu Casa 1‑month free trial** (fastest), then switch to **free Tailscale** before the trial bills: HA stays private, with no port forwarding. See **[tailscale.md](./tailscale.md)**. Cancel the trial so it does not renew. Cloudflare Tunnel (option A) is only needed for things that require a public endpoint, such as Alexa cloud skills. DuckDNS + port forwarding (option B) is **not recommended**.

When you switch hosts, only the URL in the PWA menu field **Home Assistant** needs to change — the automation id and payload stay the same.

---

## Nabu Casa (1‑month free trial — start here)

1. In Home Assistant: **Settings → Home Assistant Cloud** (Nabu Casa) → create / sign in to an account and **start the free trial**.
2. Enable **Remote control** so your instance is reachable at:
   ```text
   https://<id>.ui.nabu.casa
   ```
3. Create the position automation from [webhook_position.yaml](./webhook_position.yaml) (webhook id e.g. `bible_pwa_position`).
4. Prefer the **Cloud** / **cloudhook** URL for the webhook (Settings → Automations → your automation → webhook, or Home Assistant Cloud → Webhooks). It looks like:
   ```text
   https://hooks.nabu.casa/<long-token>
   ```
   or the remote form:
   ```text
   https://<id>.ui.nabu.casa/api/webhook/bible_pwa_position
   ```
   Paste that into the Bible app menu → **Home Assistant**. Leave empty to disable (default — nothing is sent).
5. **TTS during the trial (optional):** you can use Nabu Casa’s cloud Russian TTS voice with Assist for quick tests.
6. **TTS that keeps working after the trial:** set up **local Piper** (`ru_RU`, e.g. `ru_RU-irina-medium`) on the Voice Preview Edition / Piper add-on and point the scripts at `tts.piper` (see `scripts.yaml`). Piper does not depend on the Cloud subscription.

### Cancel before it bills

Put a calendar reminder before the trial ends. In the Nabu Casa account / HA Cloud UI, **cancel the subscription** (or do not add a paid plan) so you are not charged. Then switch the app’s webhook URL to Cloudflare Tunnel or DuckDNS (below).

---

## Free long-term option A: Cloudflare Tunnel

No port forwarding; works behind CGNAT.

### 1. Domain on Cloudflare

1. Add your domain to [Cloudflare](https://dash.cloudflare.com/) (free plan is enough).
2. Point the nameservers as Cloudflare instructs.

### 2. Cloudflared add-on

1. Settings → Add-ons → Add-on store → search **Cloudflared** (community add-on by brenner-tobias, or follow Cloudflare’s docs).
2. Install, set your domain, create a tunnel, expose Home Assistant (often `http://homeassistant.local:8123` or `http://172.30.32.1:8123` — follow the add-on README).
3. Confirm `https://ha.example.com` opens the HA UI.

### 3. `trusted_proxies` in `configuration.yaml`

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.30.33.0/24          # Supervisor / add-on network (adjust if needed)
    - 127.0.0.1
    # Optional: Cloudflare IP ranges — https://www.cloudflare.com/ips/
```

Restart Home Assistant after changing this.

### 4. Webhook URL in the Bible app

```text
https://ha.example.com/api/webhook/bible_pwa_position
```

Paste into the PWA menu (replaces the Nabu Casa / cloudhook URL when you leave the trial).

---

## Free long-term option B: DuckDNS + Let’s Encrypt (not recommended)

> ⚠️ **Not recommended.** Port forwarding exposes HA directly to the internet. Use [Tailscale](./tailscale.md) instead. This section is kept for reference only.

Uses your public IP with a free HTTPS certificate. Needs **port forwarding of TCP 443** (and usually 80 for issuance) to your HA host.

1. Install the **DuckDNS** add-on; create a `something.duckdns.org` subdomain and set your token.
2. Install **Let’s Encrypt** (or the **Nginx Proxy Manager** / **Duck DNS** combo your install docs recommend) so `https://something.duckdns.org` serves HA with a valid cert.
3. On your router, forward **443** (and **80** if required for HTTP‑01) to the machine running HA.
4. **CGNAT caveat:** if your ISP uses carrier-grade NAT, inbound port forwarding will not work. Use **Cloudflare Tunnel** instead (option A).
5. Webhook URL to paste in the app:
   ```text
   https://something.duckdns.org/api/webhook/bible_pwa_position
   ```
6. You may still need `http.use_x_forwarded_for` / `trusted_proxies` if a reverse proxy sits in front of HA.

---

## Swapping the webhook URL when you leave the trial

1. Cancel Nabu Casa billing (above).
2. Bring up Cloudflare Tunnel or DuckDNS HTTPS.
3. Open the Bible PWA → menu → **Home Assistant** → replace the cloudhook / `ui.nabu.casa` URL with the new HTTPS webhook URL → done.
4. Keep using **local Piper** for Russian TTS so Assist still speaks verses after Cloud TTS goes away.

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

### 1. TTS in Russian — no Bible audio player

**During the Nabu Casa trial (optional):** cloud Russian TTS is fine for quick Assist tests.

**Keep using after the trial:** **local Piper** (`ru_RU`, e.g. `ru_RU-irina-medium` / `ru_RU-dmitri-medium`) on the Voice Preview Edition / Piper add-on. Point scripts at `tts.piper`.

1. GET `data/verses/Ps.22.json`
2. Take `verses[verse-1]`
3. `tts.speak` on the Voice PE satellite or any `media_player`

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

