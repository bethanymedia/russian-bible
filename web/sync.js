'use strict';
/**
 * Optional Google Drive appData sync for reading position (tabs/slots).
 * Config: set GOOGLE_CLIENT_ID below. Empty = feature inert.
 * Docs: ../docs/google-sync.md
 */
const GOOGLE_CLIENT_ID = '';

const RB_SYNC_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const RB_SYNC_NAME = 'rb_sync.json';
const RB_SYNC_DEBOUNCE = 3000;
const RB_SYNC_FILE_KEY = 'rb_sync_file_id';

const RBSync = (() => {
  let token = null;
  let tokenExp = 0;
  let fileId = null;
  try { fileId = localStorage.getItem(RB_SYNC_FILE_KEY) || null; } catch (e) {}
  let tokenClient = null;
  let gisLoading = null;
  let pushTimer = null;
  let applying = false;
  let hooks = { getSnapshot: null, applyRemote: null, onStatus: null, isEnabled: null, setEnabled: null };

  function configured() { return !!(GOOGLE_CLIENT_ID && String(GOOGLE_CLIENT_ID).trim()); }
  function enabled() {
    try { return !!(hooks.isEnabled && hooks.isEnabled()); } catch (e) { return false; }
  }
  function notify() {
    try { if (hooks.onStatus) hooks.onStatus(status()); } catch (e) {}
  }
  function status() {
    const cfg = configured();
    return {
      configured: cfg,
      enabled: enabled(),
      signedIn: !!(token && Date.now() < tokenExp - 5000),
      note: cfg ? '' : 'Не настроено'
    };
  }

  function loadGis() {
    if (!configured()) return Promise.reject(new Error('not configured'));
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('gis load failed')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    if (!window.google || !google.accounts || !google.accounts.oauth2) return null;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID.trim(),
      scope: RB_SYNC_SCOPE,
      callback: () => {}
    });
    return tokenClient;
  }

  function requestToken(prompt) {
    return loadGis().then(() => new Promise((resolve, reject) => {
      const tc = ensureTokenClient();
      if (!tc) return reject(new Error('no token client'));
      tc.callback = (resp) => {
        if (resp && resp.access_token) {
          token = resp.access_token;
          const sec = parseInt(resp.expires_in, 10);
          tokenExp = Date.now() + (isFinite(sec) ? sec * 1000 : 3500 * 1000);
          notify();
          resolve(token);
        } else {
          token = null;
          tokenExp = 0;
          notify();
          reject(new Error((resp && resp.error) || 'auth denied'));
        }
      };
      try {
        tc.requestAccessToken({ prompt: prompt || '' });
      } catch (e) {
        reject(e);
      }
    }));
  }

  async function authHeader(interactive) {
    if (token && Date.now() < tokenExp - 5000) return 'Bearer ' + token;
    await requestToken(interactive ? 'consent' : '');
    return 'Bearer ' + token;
  }

  async function driveFetch(url, opts, interactive) {
    const headers = Object.assign({}, (opts && opts.headers) || {});
    headers.Authorization = await authHeader(interactive);
    const r = await fetch(url, Object.assign({}, opts, { headers }));
    if (r.status === 401 || r.status === 403) {
      token = null; tokenExp = 0;
      if (!interactive) {
        headers.Authorization = await authHeader(true);
        return fetch(url, Object.assign({}, opts, { headers }));
      }
    }
    return r;
  }

  async function resolveFileId(interactive) {
    if (fileId) return fileId;
    const q = encodeURIComponent("name='" + RB_SYNC_NAME + "'");
    const r = await driveFetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id,name)',
      { method: 'GET' },
      interactive
    );
    if (!r.ok) return null;
    const j = await r.json();
    const id = j.files && j.files[0] && j.files[0].id;
    if (id) {
      fileId = id;
      try { localStorage.setItem(RB_SYNC_FILE_KEY, fileId); } catch (e) {}
    }
    return fileId;
  }

  async function createFile(content, interactive) {
    const meta = { name: RB_SYNC_NAME, parents: ['appDataFolder'] };
    const boundary = 'rb_' + Date.now();
    const body =
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      content + '\r\n' +
      '--' + boundary + '--';
    const r = await driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body },
      interactive
    );
    if (!r.ok) return null;
    const j = await r.json();
    fileId = j.id || null;
    if (fileId) {
      try { localStorage.setItem(RB_SYNC_FILE_KEY, fileId); } catch (e) {}
    }
    return fileId;
  }

  async function readRemote(interactive) {
    const id = await resolveFileId(interactive);
    if (!id) return null;
    const r = await driveFetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media',
      { method: 'GET' },
      interactive
    );
    if (r.status === 404) {
      fileId = null;
      try { localStorage.removeItem(RB_SYNC_FILE_KEY); } catch (e) {}
      return null;
    }
    if (!r.ok) return null;
    try { return await r.json(); } catch (e) { return null; }
  }

  async function writeRemote(payload, interactive) {
    const raw = JSON.stringify(payload);
    let id = await resolveFileId(interactive);
    if (!id) {
      id = await createFile(raw, interactive);
      return !!id;
    }
    const r = await driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(id) + '?uploadType=media',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: raw },
      interactive
    );
    if (r.status === 404) {
      fileId = null;
      try { localStorage.removeItem(RB_SYNC_FILE_KEY); } catch (e) {}
      id = await createFile(raw, interactive);
      return !!id;
    }
    return r.ok;
  }

  function validPayload(p) {
    return !!(p && Array.isArray(p.slots) && p.slots.length === 3 &&
      typeof p.active === 'number' && p.active >= 0 && p.active < 3 &&
      typeof p.updatedAt === 'number');
  }

  async function pull(interactive) {
    if (!configured() || !enabled()) return;
    try {
      const remote = await readRemote(!!interactive);
      if (!validPayload(remote)) return;
      const localAt = (hooks.getSnapshot && hooks.getSnapshot().updatedAt) || 0;
      if (remote.updatedAt <= localAt) return;
      applying = true;
      try {
        if (hooks.applyRemote) hooks.applyRemote(remote);
      } finally {
        applying = false;
      }
    } catch (e) {
      /* silent */
    } finally {
      notify();
    }
  }

  function schedulePush() {
    if (!configured() || !enabled() || applying) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push(false); }, RB_SYNC_DEBOUNCE);
  }

  async function push(interactive) {
    if (!configured() || !enabled() || applying) return;
    try {
      const snap = hooks.getSnapshot && hooks.getSnapshot();
      if (!snap || !validPayload(snap)) return;
      await writeRemote({
        v: 1,
        updatedAt: snap.updatedAt || Date.now(),
        active: snap.active,
        slots: snap.slots
      }, !!interactive);
    } catch (e) {
      /* silent */
    } finally {
      notify();
    }
  }

  async function enableInteractive() {
    if (!configured()) {
      notify();
      return false;
    }
    try {
      await requestToken('consent');
      if (hooks.setEnabled) hooks.setEnabled(true);
      await pull(true);
      await push(true);
      notify();
      return true;
    } catch (e) {
      if (hooks.setEnabled) hooks.setEnabled(false);
      token = null; tokenExp = 0;
      notify();
      return false;
    }
  }

  function signOut() {
    try {
      if (token && window.google && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(token, () => {});
      }
    } catch (e) {}
    token = null;
    tokenExp = 0;
    if (hooks.setEnabled) hooks.setEnabled(false);
    notify();
  }

  function init(h) {
    hooks = Object.assign(hooks, h || {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pull(false);
    });
    window.addEventListener('pageshow', () => { pull(false); });
    notify();
    if (configured() && enabled()) {
      pull(false).catch(() => {});
    }
  }

  return {
    GOOGLE_CLIENT_ID_PLACEHOLDER: true, /* docs point at GOOGLE_CLIENT_ID above */
    isConfigured: configured,
    status,
    init,
    schedulePush,
    pullNow: () => pull(false),
    enable: enableInteractive,
    signOut,
    /* for tests / UI */
    _configuredClientId: () => GOOGLE_CLIENT_ID
  };
})();

window.RBSync = RBSync;
