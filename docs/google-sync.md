# Google Drive sync (reading position)

Optional cross-device sync of the **last place read** (three tabs: book / chapter / verse / scroll) between iPad and phone. Uses Google Identity Services and the Drive **appDataFolder** (a hidden app folder — nothing appears in the user’s My Drive).

The feature is **off and inert** until you paste a Web OAuth client ID into the app. Normal users never see it unless they open **Дополнительно**.

Live PWA: https://bethanymedia.github.io/russian-bible/

---

## What gets synced

A small JSON file `rb_sync.json` in Drive appData:

- `active` — which tab is selected (0–2)
- `slots[]` — per tab: book index `b`, chapter `c`, scroll `y`, verse index `vi`, verse offset `vo`
- `updatedAt` — epoch ms; **last writer wins** on pull

Pull runs on app open / tab visibility. Push is debounced (~3s) after navigation or scroll. Failures (offline, no token) are silent and non-blocking.

---

## One-time Google Cloud setup

### 1. Create a project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. `russian-bible-sync`) or pick an existing one.

### 2. Enable the Drive API

1. **APIs & Services → Library**.
2. Search for **Google Drive API** → **Enable**.

### 3. OAuth consent screen (External, Testing)

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. App name: e.g. `Russian Bible` (or any label you like).
4. User support email / developer contact: your address.
5. Scopes: add  
   `https://www.googleapis.com/auth/drive.appdata`  
   (Drive app data only — not full Drive).
6. Publishing status: leave **Testing** (no Google verification needed).
7. **Test users**: add the owner’s Google account(s) that will sign in from the PWA.  
   Only listed accounts can use the app while it stays in Testing.

### 4. Create a Web OAuth client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. `Bible PWA`.
4. **Authorized JavaScript origins** (no path):
   - `https://bethanymedia.github.io`
   - Optional for local checks: `http://127.0.0.1:18791` (or whatever port you use)
5. Leave redirect URIs empty (GIS token client does not need them).
6. Create → copy the **Client ID**  
   (`….apps.googleusercontent.com`).

### 5. Paste the client ID into the app

Edit [`web/sync.js`](../web/sync.js) and set:

```js
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

Commit and push. The service worker caches `sync.js`; bump `web/sw.js` `V` when you change the ID so clients pick it up.

With the constant **empty** (default), the Дополнительно toggle shows **«Не настроено»** / **Not configured** and does nothing.

### 6. Turn it on in the PWA

1. Open the Bible menu → enable **Дополнительно**.
2. Turn on **Синхронизация (Google)**.
3. Complete the Google sign-in / consent prompt.
4. Repeat on the other device with the **same Google account**.

---

## “Google hasn’t verified this app”

While the OAuth app is in **Testing**, Google shows an unverified-app warning. That is expected.

- Click **Advanced** → **Go to Russian Bible (unsafe)** (wording varies).
- Only test users listed on the consent screen can proceed.
- You do **not** need to submit the app for verification for personal / Testing use.

If you later publish to **Production**, Google may require verification for sensitive scopes — unnecessary for a private Testing setup with a few test users.

---

## Privacy notes

- Scope is **appDataFolder only** — the app cannot list or read other Drive files.
- Tokens are kept in memory for the session; enabling sync again may prompt or silently refresh via GIS.
- Sign out: **Выйти** in Дополнительно (revokes the token and turns the toggle off).

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Toggle says «Не настроено» | `GOOGLE_CLIENT_ID` still empty, or SW serving old `sync.js` — hard refresh / bump SW. |
| Sign-in popup blocked | Allow popups for `bethanymedia.github.io`. |
| 403 / access denied | Account not on the Test users list; or Drive API not enabled. |
| Origin mismatch | JS origin must be exactly `https://bethanymedia.github.io` (no trailing slash / path). |
| Devices disagree | Last `updatedAt` wins — navigate or scroll on the device that should “win”, wait ~3s, then open the other. |
