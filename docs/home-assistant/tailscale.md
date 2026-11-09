# Keeping Home Assistant private with Tailscale (to finish later)

Goal: reach Home Assistant from the iPad and the phone **without exposing it to the internet**. Use free **Tailscale (Personal plan)** instead of DuckDNS and port forwarding.

## The plan

- **HA OS on the i5mac**, LAN only. **No port forwarding** on the router: nothing listens on the public internet.
- **Nabu Casa only during the free trial.** It's the quickest way to test remote access and cloud TTS. Cancel before it bills (see [README](./README.md#cancel-before-it-bills)).
- **After the trial, use Tailscale.** It's a private WireGuard network ("tailnet") between your own devices, free on the Personal plan. Only devices signed in to your account can reach HA.

## 1. Tailscale add-on in Home Assistant

1. In HA, go to **Settings → Add-ons → Add-on Store**, search for **Tailscale** (the official add-on in the Home Assistant community add-ons repository), then **Install**.
2. Turn on **Start on boot** and **Watchdog**, then **Start** it.
3. Open the add-on **Log**. It shows a login URL. Open it and sign in with the Tailscale account you'll use on every device (one account for everything).
4. In the [Tailscale admin console](https://login.tailscale.com/admin/machines), find the HA machine (usually `homeassistant`), open **⋯**, and choose **Disable key expiry**. Without this, the node drops off the tailnet after about 180 days until you sign in again.

## 2. MagicDNS and the HA tailnet name

1. Admin console → **DNS**: check that **MagicDNS** is on (the default on new tailnets).
2. HA now has two names:
   - Short name: `homeassistant` (works on any device with Tailscale on)
   - Full name: `homeassistant.<tailnet>.ts.net` (shown on the DNS page as your "tailnet name", e.g. `tail1234.ts.net`)
3. Test from a device with Tailscale on: `http://homeassistant:8123`.

### Optional: HTTPS on the tailnet (needed for the Bible app webhook)

1. Admin console → **DNS** → **HTTPS Certificates** → **Enable**. This puts the machine name in the public certificate log, but the address only resolves inside your tailnet.
2. Pick one way to serve HA over HTTPS:
   - **Add-on proxy (easiest).** In the Tailscale add-on **Configuration**, turn on the **proxy** option (Tailscale Serve) and restart the add-on. HA is then served at `https://homeassistant.<tailnet>.ts.net` (port 443, valid certificate). HA must trust the local proxy, so add this to `configuration.yaml` and restart HA:
     ```yaml
     http:
       use_x_forwarded_for: true
       trusted_proxies:
         - 127.0.0.1
     ```
   - **`tailscale cert` (manual).** Run `tailscale cert homeassistant.<tailnet>.ts.net` to get a `.crt`/`.key` pair. Point HA's `http: ssl_certificate` / `ssl_key` at them, so HA serves `https://homeassistant.<tailnet>.ts.net:8123`. You have to renew it yourself about every 90 days, so the proxy option is better.

## 3. iPad and Android phone

1. Install **Tailscale** from the App Store (iPad) and Google Play (Android).
2. Sign in with **the same account** as the HA add-on. Allow the VPN profile when asked.
3. Leave Tailscale connected. (On Android, you can turn on "Always-on VPN" in system settings.)
4. Check: `http://homeassistant:8123` opens in the browser.

## 4. HA Companion app

In the Companion app: **Settings → Companion App → (your server) → Connection**:
- **Internal URL:** `http://homeassistant.local:8123`, or the LAN IP, for when you're on home Wi-Fi.
- **External URL:** `http://homeassistant:8123`, or `https://homeassistant.<tailnet>.ts.net` if you turned on HTTPS above.

Once Nabu Casa is cancelled, clear any `ui.nabu.casa` remote URL.

## 5. Russian Bible app webhook (optional)

The app is served over **https** (`bethanymedia.github.io`). Browsers block **mixed content**, so an `http://…` webhook is blocked, and the app also ignores any URL that isn't `https://`. Because of that:

- You **need Tailscale HTTPS** from step 2. Set the menu → **Home Assistant** field to:
  ```text
  https://homeassistant.<tailnet>.ts.net/api/webhook/bible_pwa_position
  ```
  (With `tailscale cert` and no proxy, add `:8123` after `.ts.net`.)
- It **only works while Tailscale is connected** on that device. When it's off, position updates fail silently and reading is unaffected.
- The webhook automation itself doesn't change ([webhook_position.yaml](./webhook_position.yaml)). Set `local_only: false`, because tailnet traffic doesn't count as "local" to HA.
- If a browser still blocks the request (some Chromium versions restrict public sites from calling private addresses), it's the browser and not HA. Test in Safari on the iPad first.

## 6. What does NOT work over Tailscale

- **Alexa (and Google Assistant) cloud skills** call your HA from Amazon's or Google's servers, which aren't on your tailnet. They need a **public HTTPS endpoint**. Your options:
  - **emulated_hue** (local): exposes HA entities to an Echo on the same LAN as "Hue lights" for simple on/off Alexa routines. No cloud and no public endpoint, but it's limited to on/off and dim.
  - A **Cloudflare Tunnel + Cloudflare Access**, used only for that skill's endpoint (see [README option A](./README.md#free-long-term-option-a-cloudflare-tunnel)). Keep everything else on Tailscale.
- Guests' devices can't reach HA unless you share the node with them (admin console → Share).

## Checklist (finish later)

- [ ] Nabu Casa trial: test remote access, then **cancel before it bills**
- [ ] Router: confirm **no port forwards** to the i5mac (remove any 443/80/8123 rules)
- [ ] Install and start the **Tailscale add-on** in HA (Start on boot + Watchdog)
- [ ] Sign in to the add-on with the shared Tailscale account
- [ ] Admin console: **Disable key expiry** for `homeassistant`
- [ ] Admin console: **MagicDNS** on; write down the tailnet name `____.ts.net`
- [ ] Admin console: enable **HTTPS Certificates**; turn on the add-on **proxy** option; add `trusted_proxies: 127.0.0.1`; restart HA
- [ ] Install Tailscale on the **iPad** and sign in (same account)
- [ ] Install Tailscale on the **Android phone** and sign in (same account)
- [ ] Companion app external URL → `https://homeassistant.<tailnet>.ts.net` (or `http://homeassistant:8123`)
- [ ] Bible app menu → Home Assistant → `https://homeassistant.<tailnet>.ts.net/api/webhook/bible_pwa_position`; read a chapter and check that the automation fired
- [ ] Alexa: decide between emulated_hue (local) or a Cloudflare Tunnel just for the skill, or skip it
