#!/usr/bin/env node
'use strict';
/*
 * End-to-end QA suite for the web app (headless Chrome, mocked audio / wake lock).
 *   node tests/qa.js                 # all groups
 *   ONLY=audio,layout node tests/qa.js
 * Env: PUPPETEER_CORE (module path), CHROME (binary), SHOTS (dir for screenshots, optional)
 */
const path = require('path'), fs = require('fs'), http = require('http');
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const installMocks = require('./mocks');
const WEB = path.resolve(process.env.WEB_DIR || path.join(__dirname, '..', 'web'));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SHOTS = process.env.SHOTS || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const wait = ms => new Promise(r => setTimeout(r, ms));

const VIEWPORTS = {
  ipadL: { width: 1180, height: 820 }, ipadP: { width: 820, height: 1180 },
  ph360: { width: 360, height: 740 }, ph390: { width: 390, height: 844 },
  ph412: { width: 412, height: 915 }, phL: { width: 844, height: 390 },
};
const PHONES = ['ph360', 'ph390', 'ph412', 'phL'];

/* ---------- static server (optionally rewrites sw.js version) ---------- */
let swOverride = null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>blank</title>'); }
  let p = path.join(WEB, decodeURIComponent(u.pathname));
  if (!p.startsWith(WEB)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  let body = fs.readFileSync(p);
  if (swOverride && u.pathname.endsWith('/sw.js')) body = Buffer.from(String(body).replace(/const V = '[^']+'/, `const V = '${swOverride}'`));
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
});

/* ---------- reporting ---------- */
const results = [];
let group = '';
function check(name, ok, detail){
  results.push({ group, name, ok: !!ok, detail });
  if (!ok || process.env.VERBOSE) console.log((ok ? '  ok   ' : '  FAIL ') + group + ' › ' + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : ''));
}

let browser, BASE;
const DEF_STATE = { active: 0, slots: [{b:0,c:0,y:0,vi:0,vo:0},{b:18,c:21,y:0,vi:0,vo:0},{b:42,c:0,y:0,vi:0,vo:0}], fs: 24, theme: 'dark', reader: 'kozlov', cont: true, rate: 1, follow: true, lang: 'ru', tr: 'web', trAll: false, mode: '', num: 'syn', tabsV: 2, haWebhook: '', adv: false, driveSync: false, syncAt: 0 };

async function newPage(vp){
  const page = await browser.newPage();
  page.__errs = [];
  page.on('pageerror', e => page.__errs.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) page.__errs.push('console:' + m.text()); });
  await page.evaluateOnNewDocument(installMocks);
  await page.setViewport(Object.assign({ deviceScaleFactor: 1, hasTouch: true, isMobile: false }, VIEWPORTS[vp] || vp));
  return page;
}
/* raw: string stored verbatim (corrupt JSON tests); state: merged onto defaults */
async function open(page, { state, raw, hash = '', query = '', clear = false } = {}){
  await page.goto(BASE + '/__blank');
  await page.evaluate((st, raw, clear) => {
    if (clear) localStorage.clear();
    if (raw != null) localStorage.setItem('rb_state_v1', raw);
    else if (st) localStorage.setItem('rb_state_v1', JSON.stringify(st));
  }, state ? Object.assign({}, DEF_STATE, state) : (raw == null && !clear ? DEF_STATE : null), raw == null ? null : raw, clear);
  await page.goto(BASE + '/index.html' + query + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof BIBLE !== 'undefined' && BIBLE && document.querySelector('#text p') && deepReady, { timeout: 30000 });
  await page.waitForFunction(() => Object.keys(TIMES).length > 100, { timeout: 15000 });
  await wait(520); /* past the post-scroll tap guard */
}
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const st = page => ev(page, () => ({
  b: slot().b, c: slot().c, active: S.active, mode: S.mode, reader: S.reader, rate: S.rate,
  playing: !audio.paused, playerShown: !$('#player').hidden, bodyPlaying: document.body.classList.contains('playing'),
  audioBook, audioChap, src: audio.src, t: audio.currentTime, sel: selectedVerse, hl: hlIdx,
  hlEl: (document.querySelector('#text p.hl') || {}).id || null,
  selEl: (document.querySelector('#text p.sel') || {}).id || null,
  inline: !!document.querySelector('.verseInlinePlay'),
  icon: $('#audioBtn .icPause').hasAttribute('hidden') ? 'play' : 'pause', jump: $('#audioBtn').classList.contains('jump'),
  chip: $('#pRef').hidden ? null : $('#pRef').textContent, chipVisible: (() => { const e = $('#pRef'); const r = e.getBoundingClientRect(); return !e.hidden && getComputedStyle(e).display !== 'none' && r.width > 0; })(),
  sheet: $('#sheet').hidden ? null : $('#sheetBody').className || 'other', pop: !$('#pop').hidden,
  current: $('#current').textContent, title: $('#title').textContent, tabs: [...document.querySelectorAll('#slots button')].map(b => b.textContent),
}));
async function clickSel(page, sel){ await page.$eval(sel, e => e.click()); await wait(30); }
/* real pointer tap at an element's centre (goes through hit-testing → catches overlap bugs) */
async function tap(page, sel){
  const off = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); const cy = b.top + b.height / 2; const out = cy < 130 || cy > innerHeight - 90; if (out && e.closest('#text')) e.closest('p').scrollIntoView({ block: 'center' }); return out; });
  if (off) await wait(500); /* finger-scroll guard */
  const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.click(r.x, r.y); await wait(40);
}
async function waitPlaying(page, on = true, ms = 2000){ await page.waitForFunction(on => !audio.paused === on, { timeout: ms }, on).catch(() => {}); await wait(30); }
async function play(page){ await tap(page, '#audioBtn'); await waitPlaying(page, true); }

/* ---------- layout probe (runs in page) ---------- */
function layoutProbe(){
  const W = innerWidth, H = innerHeight, issues = [];
  const shown = el => {
    if (!el || el.closest('[hidden]')) return false;
    for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const R = el => el.getBoundingClientRect();
  const name = el => el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ')[0] : el.tagName) + (el.textContent ? '[' + el.textContent.trim().slice(0, 8) + ']' : '');
  const inView = (el, tol = 1) => { const r = R(el); if (r.left < -tol || r.top < -tol || r.right > W + tol || r.bottom > H + tol) issues.push('offscreen ' + name(el) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); };
  const overlap = (a, b) => { const r = R(a), s = R(b); const x = Math.min(r.right, s.right) - Math.max(r.left, s.left), y = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top); return x > 1.5 && y > 1.5; };
  const clipped = el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2;
  const barCtl = [...document.querySelectorAll('#bar button, #bar input, #bar #pTime')].filter(shown);
  const hdrCtl = [...document.querySelectorAll('#titleRow button, #title')].filter(shown);
  /* in the sticky header the tabs belong to titleRow on phone */
  const hdrPinned = getComputedStyle(document.querySelector('#titleRow')).position === 'sticky';
  [...barCtl, ...(hdrPinned ? hdrCtl : [])].forEach(el => inView(el));
  if (hdrPinned && Math.abs(R(document.querySelector('#titleRow')).top) > 1 && document.querySelector('#reader').scrollTop > 200) issues.push('pinned header not at top');
  const pairs = (list) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.contains(b) || b.contains(a)) continue; if (overlap(a, b)) issues.push('overlap ' + name(a) + ' × ' + name(b)); } };
  pairs(barCtl); pairs(hdrCtl);
  /* labels must not be cut off (chapter label + title are allowed to ellipsize) */
  [...barCtl, ...hdrCtl].forEach(el => { if (el.tagName === 'INPUT' || el.id === 'current' || el.id === 'title' || el.id === 'pRef') return; if (clipped(el)) issues.push('clipped ' + name(el) + ' ' + el.scrollWidth + '>' + el.clientWidth); });
  const cur = document.querySelector('#current'); if (shown(cur) && cur.scrollWidth > cur.clientWidth + 1) issues.push('note: #current ellipsized "' + cur.textContent + '"');
  /* tap targets */
  barCtl.forEach(el => { if (el.id === 'pTime' || el.id === 'pRef') return; const r = R(el); if (r.height < 36 || (el.tagName === 'BUTTON' && r.width < 36)) issues.push('small ' + name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  hdrCtl.forEach(el => { if (el.id === 'title') return; const r = R(el); if (r.height < 34) issues.push('small ' + name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  const bar = R(document.querySelector('#bar')), rd = R(document.querySelector('#reader'));
  if (rd.bottom > bar.top + 1) issues.push('reader under bar');
  if (bar.bottom > H + 1 || bar.top < H - 200) issues.push('bar position ' + Math.round(bar.top) + '-' + Math.round(bar.bottom));
  const pop = document.querySelector('#pop');
  if (shown(pop)) { const r = R(pop); if (r.top < -1 || r.left < -1 || r.right > W + 1) issues.push('pop offscreen'); if (r.bottom > bar.top + 1) issues.push('pop over bar'); }
  const sh = document.querySelector('#sheet');
  if (shown(sh)) {
    const r = R(sh); if (r.bottom > bar.top + 1) issues.push('sheet over bar');
    ['#sheetClose', '#sheetTitle'].forEach(s => { const e = document.querySelector(s); if (shown(e)) inView(e); });
    const body = document.querySelector('#sheetBody'); if (body.scrollWidth > body.clientWidth + 1) issues.push('sheet body h-overflow ' + body.scrollWidth + '>' + body.clientWidth);
    document.querySelectorAll('.pk .tst, .pk .chc').forEach(e => { const q = R(e); if (q.width < 60 || q.height < 60) issues.push('picker pane tiny ' + name(e)); if (q.right > W + 1 || q.bottom > bar.top + 1) issues.push('picker pane out ' + name(e)); });
  }
  const ip = document.querySelector('.verseInlinePlay'); if (ip && shown(ip)) { const r = R(ip); if (r.left < -1) issues.push('inline ▶ offscreen'); const n = ip.parentElement.querySelector('.n'); }
  /* text column must not overflow horizontally */
  const rdEl = document.querySelector('#reader'); if (rdEl.scrollWidth > rdEl.clientWidth + 1) issues.push('reader h-overflow ' + rdEl.scrollWidth + '>' + rdEl.clientWidth);
  return issues;
}
async function layout(page, label, allowNotes = true){
  const iss = (await ev(page, layoutProbe)).filter(x => allowNotes ? !x.startsWith('note:') : true);
  check('layout ' + label, iss.length === 0, iss);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, label.replace(/[^\w.-]+/g, '_') + '.png') });
  return iss;
}
const noErrors = async (page, label) => {
  const e = page.__errs.concat(await ev(page, () => window.__errors || []).catch(() => []));
  check('no JS errors ' + label, e.length === 0, e);
  page.__errs = [];
};

/* ======================= groups ======================= */
const GROUPS = {};

GROUPS.state = async () => {
  const page = await newPage('ipadL');
  await open(page, { raw: '{not json' });
  let s = await st(page);
  check('corrupt JSON → defaults', s.tabs.join('|') === 'Быт 1|Пс 22|Ин 1', s.tabs);
  await open(page, { raw: JSON.stringify({ slots: [{ b: 99, c: -5 }, { b: 'x' }, null], active: 7, reader: 'bogus', theme: 'neon', mode: 'zzz', fs: 'abc', rate: 'fast', tabsV: 2, num: 'syn' }) });
  s = await st(page);
  check('partial/bad state renders', s.active >= 0 && s.active <= 2 && s.tabs.length === 3, s.tabs);
  check('bad reader → kozlov lit', await ev(page, () => S.reader === 'kozlov' && !!document.querySelector('#readerSeg button.on')));
  check('bad theme → a theme lit', await ev(page, () => !!document.querySelector('#themeSeg button.on')));
  check('bad mode → none', await ev(page, () => S.mode === '' && !document.querySelector('.modeBtn.on')));
  check('bad fs → 18..64', await ev(page, () => S.fs >= 18 && S.fs <= 64 && S.fs % 2 === 0), await ev(page, () => S.fs));
  check('bad rate → 1', await ev(page, () => S.rate === 1));
  await noErrors(page, 'bad state');
  await open(page, { state: { slots: [{ b: 0, c: 200, y: 0, vi: 5000, vo: 0 }, DEF_STATE.slots[1], DEF_STATE.slots[2]] } });
  s = await st(page);
  check('chapter out of range clamped', s.b === 0 && s.c === 49 && /50/.test(s.title), s.title);
  await noErrors(page, 'clamped chapter');
  await open(page, { raw: JSON.stringify({ slots: DEF_STATE.slots.map(x => Object.assign({}, x, { b: 18, c: 21 })), active: 1, fs: 30 }) });
  s = await st(page);
  check('old install (no tabsV) resets tabs', s.tabs.join('|') === 'Быт 1|Пс 22|Ин 1', s.tabs);
  check('old install keeps font', await ev(page, () => S.fs === 30));
  /* old KJV-numbered install migrates Psalms */
  await open(page, { raw: JSON.stringify({ slots: [{ b: 18, c: 22 }, { b: 18, c: 0 }, { b: 0, c: 0 }], active: 0, tabsV: 2, num: 'kjv' }) });
  s = await st(page);
  check('KJV Ps 23 → Synodal Ps 22', s.b === 18 && s.c === 21, s);
  await open(page, { raw: JSON.stringify({ slots: DEF_STATE.slots, active: 0, tabsV: 2, num: 'syn', trAll: true }) });
  check('legacy trAll → English mode', await ev(page, () => S.mode === 'en'));
  /* storage that throws (private mode / quota) */
  await page.goto(BASE + '/__blank');
  await page.evaluate(() => localStorage.clear());
  await page.evaluateOnNewDocument(() => { Storage.prototype.setItem = function(){ throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof BIBLE !== 'undefined' && BIBLE && document.querySelector('#text p'), { timeout: 30000 });
  await clickSel(page, '#nextCh'); await wait(450); await clickSel(page, '#trBtn');
  s = await st(page);
  check('throwing localStorage: app still navigates', s.c === 1 && s.mode === 'en', s);
  await noErrors(page, 'throwing storage');
  await page.close();
  /* new phone install starts at 20 */
  const ph = await newPage('ph390');
  await open(ph, { clear: true });
  check('new phone install fs 20', await ev(ph, () => S.fs === 20));
  await ph.close();
};

GROUPS.deeplink = async () => {
  const page = await newPage('ipadL');
  const cases = [
    ['#Ps.22', 18, 21], ['#John.3.16', 42, 2], ['#Иоанна.3', 42, 2], ['#Ps.0', 18, 0], ['#Jude', 64, 0],
    ['#Foo.1', null], ['#Ps.999', null], ['#John.3.999', 42, 2], ['#%%%', null], ['#Gen.abc', null], ['#', null], ['#Rev.22.21', 65, 21],
    ['#псалом.22', 18, 21], ['#1Cor.13', 45, 12],
  ];
  for (const [h, b, c] of cases) {
    await open(page, { hash: h });
    const s = await st(page);
    if (b == null) check('bad link ' + h + ' → saved place', s.b === 0 && s.c === 0, [s.b, s.c]);
    else check('link ' + h, s.b === b && s.c === c, [s.b, s.c]);
    await noErrors(page, h);
  }
  await open(page, { hash: '#John.3.16' });
  await wait(200);
  check('verse link scrolls verse into view', await ev(page, () => { const r = $('#v16').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }));
  await page.evaluate(() => { location.hash = '#Ps.22.3'; }); await wait(300);
  let s = await st(page);
  check('hashchange after load', s.b === 18 && s.c === 21, s);
  await page.evaluate(() => { location.hash = '#nonsense.5'; }); await wait(200);
  s = await st(page); check('bad hashchange ignored', s.b === 18 && s.c === 21);
  await open(page, { hash: '#John.3.16', query: '?play=1' });
  await waitPlaying(page, true, 3000);
  s = await st(page);
  check('?play=1 with verse plays from that verse', s.playing && s.audioBook === 42 && s.audioChap === 2 && Math.abs(s.t - 0) > 1 && s.hlEl === 'v16', s);
  await noErrors(page, 'play link');
  await page.close();
};

GROUPS.verse = async () => {
  for (const vp of ['ipadL', 'ph390']) {
    const page = await newPage(vp);
    await open(page, { state: { slots: [{ b: 42, c: 2, y: 0, vi: 0, vo: 0 }, DEF_STATE.slots[1], DEF_STATE.slots[2]] } });
    await tap(page, '#v3 span:nth-child(2)');
    let s = await st(page);
    check(vp + ' tap selects + inline ▶', s.selEl === 'v3' && s.inline && s.icon === 'play', s);
    await layout(page, vp + '-selected');
    await tap(page, '#v3 span:nth-child(2)');
    s = await st(page); check(vp + ' tap again deselects', s.sel === -1 && !s.inline, s);
    await tap(page, '#v5 span:nth-child(2)');
    await ev(page, () => $('#text').click()); /* gap between verses: still inside text */
    await page.evaluate(() => document.body.click()); /* tap outside text */
    s = await st(page); check(vp + ' tap outside clears selection', s.sel === -1, s);
    await tap(page, '#v5 span:nth-child(2)');
    await tap(page, '.verseInlinePlay');
    await waitPlaying(page, true);
    s = await st(page);
    const t5 = await ev(page, () => TIMES['John.3'][4] / 1000);
    check(vp + ' inline ▶ plays from verse', s.playing && Math.abs(s.t - t5) < 1 && s.hlEl === 'v5' && s.sel === -1 && !s.inline, { s, t5 });
    await tap(page, '#v9 span:nth-child(2)');
    s = await st(page);
    check(vp + ' tap while playing: select only, no inline ▶, accent ▶', s.playing && s.selEl === 'v9' && !s.inline && s.icon === 'play' && s.jump, s);
    const pauses = await ev(page, () => __AM.pauses);
    await tap(page, '#audioBtn'); await wait(500);
    s = await st(page);
    const t9 = await ev(page, () => TIMES['John.3'][8] / 1000);
    check(vp + ' accent ▶ jumps without stop', s.playing && Math.abs(s.t - t9) < 1 && s.hlEl === 'v9' && s.sel === -1 && (await ev(page, () => __AM.pauses)) === pauses, s);
    check(vp + ' playing shows ❚❚', s.icon === 'pause' && !s.jump);
    await layout(page, vp + '-playing');
    await tap(page, '#audioBtn'); await waitPlaying(page, false);
    s = await st(page);
    check(vp + ' paused: only ▶ (player hidden)', !s.playing && !s.playerShown && !s.bodyPlaying && s.icon === 'play', s);
    await layout(page, vp + '-paused');
    await tap(page, '#v2 span:nth-child(2)');
    s = await st(page); check(vp + ' paused: inline ▶ returns on select', s.inline, s);
    await tap(page, '#audioBtn'); await waitPlaying(page, true); await wait(450);
    const t2 = await ev(page, () => TIMES['John.3'][1] / 1000);
    s = await st(page); check(vp + ' bar ▶ with selection plays from it', s.playing && Math.abs(s.t - t2) < 1, s);
    /* play then pause then plain ▶ resumes where it was */
    await tap(page, '#audioBtn'); await waitPlaying(page, false);
    const tp = (await st(page)).t;
    await tap(page, '#audioBtn'); await waitPlaying(page, true);
    s = await st(page); check(vp + ' resume continues from pause point', s.playing && Math.abs(s.t - tp) < 1, { tp, t: s.t });
    /* modes vs tap */
    await clickSel(page, '#tolkBtn'); await wait(60);
    await tap(page, '#v4 span:nth-child(2)'); await wait(300);
    s = await st(page); check(vp + ' Толкование: tap opens panel, no selection', s.sheet === 'feat' && s.sel === -1, s);
    await page.waitForFunction(() => !/Загрузка/.test($('#featBody').textContent), { timeout: 5000 }).catch(() => {});
    check(vp + ' commentary text loaded', await ev(page, () => /Ин|3:/.test($('#featBody').textContent)), await ev(page, () => $('#featBody').textContent.slice(0, 60)));
    await layout(page, vp + '-tolk-panel');
    await clickSel(page, '#sheetClose');
    await clickSel(page, '#simfBtn'); await wait(60);
    await page.$eval('#v16 .w', e => e.click()); await wait(400);
    s = await st(page); check(vp + ' Симфония: word opens concordance', s.sheet === 'feat' && await ev(page, () => document.querySelectorAll('.simfHit').length > 0), s);
    await layout(page, vp + '-simf-panel');
    await page.$eval('.simfHit', e => e.click()); await wait(400);
    s = await st(page); check(vp + ' Симфония hit navigates + closes', s.sheet === null, s);
    await clickSel(page, '#trBtn'); await wait(300);
    await tap(page, '#v2 span:nth-child(2)');
    s = await st(page); check(vp + ' English: tap selects', s.selEl === 'v2', s);
    check(vp + ' English lines on every verse', await ev(page, () => document.querySelectorAll('#text p').length === document.querySelectorAll('#text .tr').length));
    await layout(page, vp + '-en-selected');
    await noErrors(page, vp + ' verse');
    await page.close();
  }
};

GROUPS.audio = async () => {
  const page = await newPage('ipadL');
  await open(page, { state: { active: 1 } }); /* Пс 22 */
  await play(page);
  let s = await st(page);
  check('fresh ▶ starts viewed chapter at 0', s.playing && s.audioBook === 18 && s.audioChap === 21 && s.t < 2, s);
  await ev(page, () => { audio.currentTime = TIMES['Ps.22'][2] / 1000 + 0.5; }); await wait(300);
  await clickSel(page, '#nextCh'); await wait(100);
  s = await st(page);
  check('navigation keeps audio playing', s.playing && s.audioBook === 18 && s.audioChap === 21 && s.c === 22, s);
  check('chip shows audio chapter when viewing elsewhere', s.chipVisible && s.chip === 'Пс 22', s);
  check('no follow highlight in other chapter', s.hlEl === null, s);
  await layout(page, 'ipadL-playing-chip');
  await tap(page, '#pRef'); await wait(200);
  s = await st(page);
  check('chip jumps back to playing verse', s.b === 18 && s.c === 21 && !s.chipVisible && s.hlEl !== null && s.playing, s);
  /* auto-next while viewing another chapter */
  await wait(450); await clickSel(page, '#prevCh'); await wait(100);
  await ev(page, () => __AM.toEnd(0.05)); await wait(400);
  s = await st(page);
  check('auto-next moves audio only (view elsewhere)', s.playing && s.audioChap === 22 && s.c === 20 && s.chip === 'Пс 23', s);
  /* auto-next while viewing the audio chapter */
  await tap(page, '#pRef'); await wait(150);
  await ev(page, () => __AM.toEnd(0.05)); await wait(400);
  s = await st(page);
  check('auto-next view follows when viewing audio chapter', s.playing && s.audioChap === 23 && s.c === 23 && s.title.includes('24'), s);
  const tb = await ev(page, () => { audio.currentTime = TIMES['Ps.24'][7] / 1000 + 2; return audio.currentTime; }); await wait(200);
  await tap(page, '#pBack'); await wait(200);
  s = await st(page);
  const want = await ev(page, t => verseIndexAtTime(t), tb - 15);
  check('↺15 rewinds and moves highlight', Math.abs(s.t - (tb - 15)) < 1 && s.hl === want && s.hl < 7, { s, want, tb });
  /* stop */
  await tap(page, '#pStop'); await wait(100);
  s = await st(page);
  check('■ stops and resets', !s.playing && !s.playerShown && s.audioBook === -1 && s.hlEl === null && s.icon === 'play', s);
  /* cont off */
  await ev(page, () => { $('#contChk').click(); });
  await play(page); await ev(page, () => __AM.toEnd(0.05)); await wait(400);
  s = await st(page); check('continue off: stops at chapter end', !s.playing && !s.playerShown, s);
  await ev(page, () => { $('#contChk').click(); });
  /* sleep 'Глава' */
  await tap(page, '#pStop').catch(() => {}); await ev(page, () => stopAudio());
  await play(page);
  await ev(page, () => document.querySelector('#sleepSeg button[data-s="-1"]').click());
  await ev(page, () => __AM.toEnd(0.05)); await wait(400);
  s = await st(page); check('sleep «Глава»: stops at end, timer resets', !s.playing && await ev(page, () => sleepMode === 0), s);
  /* stop during pending auto-next load must not restart */
  await ev(page, () => stopAudio()); await play(page);
  await ev(page, () => { __AM.loadDelay = 400; __AM.toEnd(0.05); });
  await wait(150); await ev(page, () => $('#pStop').click());
  await wait(700);
  s = await st(page); check('■ during auto-next load stays stopped', !s.playing && s.audioBook === -1, s);
  await ev(page, () => { __AM.loadDelay = 40; });
  /* stale loadedmetadata callbacks: switch reader then tap a verse quickly */
  await ev(page, () => { __AM.loadDelay = 300; });
  await play(page);
  await ev(page, () => document.querySelector('#readerSeg button[data-r="efimov"]').click());
  await ev(page, () => document.querySelector('#readerSeg button[data-r="kozlov"]').click());
  await wait(800);
  s = await st(page);
  check('rapid reader flip ends on Kozlov, playing', s.playing && /huggingface/.test(s.src) && s.reader === 'kozlov', s);
  await ev(page, () => { __AM.loadDelay = 40; });
  /* rapid tapping ▶ */
  await ev(page, () => stopAudio());
  for (let i = 0; i < 7; i++) { await page.$eval('#audioBtn', e => e.click()); await wait(15); }
  await wait(600);
  s = await st(page);
  check('rapid ▶ taps: icon matches state', (s.playing ? 'pause' : 'play') === s.icon && s.playerShown === s.playing, s);
  /* error → toast + reset */
  await ev(page, () => { stopAudio(); __AM.failRe = /huggingface/; });
  await tap(page, '#audioBtn'); await wait(400);
  s = await st(page);
  check('missing audio: toast + reset', !s.playing && !s.playerShown && s.audioBook === -1 && await ev(page, () => !$('#toast').hidden && /аудио/.test($('#toast').textContent)), s);
  await ev(page, () => { __AM.failRe = null; });
  await play(page);
  s = await st(page); check('▶ works again after an error', s.playing, s);
  await noErrors(page, 'audio');
  await page.close();
};

GROUPS.reader = async () => {
  const page = await newPage('ipadL');
  await open(page, { state: { slots: [{ b: 42, c: 2, y: 0, vi: 0, vo: 0 }, DEF_STATE.slots[1], DEF_STATE.slots[2]] } });
  await tap(page, '#v6 span:nth-child(2)'); await tap(page, '.verseInlinePlay'); await waitPlaying(page); await wait(450);
  const pausesBefore = await ev(page, () => __AM.pauses);
  await ev(page, () => document.querySelector('#readerSeg button[data-r="efimov"]').click()); await wait(300);
  let s = await st(page);
  check('reader → Ефимов mid-play continues', s.playing && /theaudiopower/.test(s.src) && s.playerShown, s);
  await ev(page, () => document.querySelector('#readerSeg button[data-r="kozlov"]').click()); await wait(500);
  s = await st(page);
  const t6 = await ev(page, () => TIMES['John.3'][5] / 1000);
  check('back to Козлов resumes at the verse', s.playing && /huggingface/.test(s.src) && Math.abs(s.t - t6) < 1.5, { s, t6 });
  check('no pause flashes during switch', (await ev(page, () => __AM.pauses)) === pausesBefore);
  /* paused switch must not start playback */
  await tap(page, '#audioBtn'); await waitPlaying(page, false);
  await ev(page, () => document.querySelector('#readerSeg button[data-r="efimov"]').click()); await wait(300);
  s = await st(page);
  check('reader switch while paused stays paused', !s.playing && !s.playerShown && /theaudiopower/.test(s.src), s);
  await ev(page, () => document.querySelector('#readerSeg button[data-r="kozlov"]').click()); await wait(300);
  await tap(page, '#audioBtn'); await waitPlaying(page); await wait(450);
  s = await st(page);
  check('▶ after paused switch plays new voice at the verse', s.playing && /huggingface/.test(s.src) && Math.abs(s.t - t6) < 3, { s, t6 });
  /* speed */
  await ev(page, () => document.querySelector('#rateSeg button[data-r="1.2"]').click());
  check('speed while playing applies now', await ev(page, () => audio.playbackRate === 1.2 && S.rate === 1.2));
  await tap(page, '#audioBtn'); await waitPlaying(page, false);
  await ev(page, () => document.querySelector('#rateSeg button[data-r="0.9"]').click());
  await tap(page, '#audioBtn'); await waitPlaying(page);
  check('speed set while paused applies on play', await ev(page, () => audio.playbackRate === 0.9));
  check('speed button lit', await ev(page, () => document.querySelector('#rateSeg button.on').dataset.r === '0.9'));
  await ev(page, () => stopAudio());
  await open(page, { state: { rate: 1.1 } }); await play(page);
  check('saved speed applies after reload', await ev(page, () => audio.playbackRate === 1.1));
  await clickSel(page, '#nextCh'); await wait(100);
  await ev(page, () => __AM.toEnd(0.05)); await wait(400);
  check('speed kept across auto-next', await ev(page, () => audio.playbackRate === 1.1 && !audio.paused));
  await noErrors(page, 'reader');
  await page.close();
};

GROUPS.modes = async () => {
  for (const vp of ['ipadL', 'ipadP', 'ph360', 'phL']) {
    const page = await newPage(vp);
    await open(page, { state: { slots: [{ b: 18, c: 117, y: 0, vi: 0, vo: 0 }, DEF_STATE.slots[1], DEF_STATE.slots[2]] } }); /* Synodal Ps 118 (176 verses) */
    const phone = await ev(page, () => isPhone());
    const labels = await ev(page, () => [...document.querySelectorAll('.modeBtn')].map(b => b.textContent).join('|'));
    check(vp + ' toggle labels', labels === (phone ? 'Толк|Симф|Eng' : 'Толкование|Симфония|English'), labels);
    await ev(page, () => { $('#v40').scrollIntoView(); });
    await wait(350);
    const top0 = await ev(page, () => captureAnchor().vi);
    const want = ['en', 'tolk', 'simf', 'en', ''];
    for (const [k, m] of ['#trBtn', '#tolkBtn', '#simfBtn', '#trBtn', '#trBtn'].entries()) {
      await clickSel(page, m); await wait(400);
      const a = await ev(page, () => [captureAnchor().vi, S.mode]);
      check(vp + ' place kept toggling ' + m + ' → ' + want[k], a[0] === top0 && a[1] === want[k], { a, top0 });
    }
    const on = await ev(page, () => [...document.querySelectorAll('.modeBtn.on')].length);
    check(vp + ' modes exclusive', on === 0, on);
    await clickSel(page, '#tolkBtn'); await wait(100); await clickSel(page, '#simfBtn'); await wait(100);
    check(vp + ' only one mode on', await ev(page, () => document.querySelectorAll('.modeBtn.on').length === 1 && S.mode === 'simf'));
    /* sticky header */
    await ev(page, () => { $('#reader').scrollTop = 2000; }); await wait(100);
    const hdrTop = await ev(page, () => $('#titleRow').getBoundingClientRect().top);
    check(vp + ' header frozen while a mode is on', Math.abs(hdrTop) < 2, hdrTop);
    await clickSel(page, '#simfBtn'); await wait(100);
    await ev(page, () => { $('#reader').scrollTop = 2400; }); await wait(100);
    const hdrTop2 = await ev(page, () => $('#titleRow').getBoundingClientRect().top);
    check(vp + (phone ? ' phone header always frozen' : ' header scrolls away with no mode'), phone ? Math.abs(hdrTop2) < 2 : hdrTop2 < -20, hdrTop2);
    /* text resize keeps place, and panels follow */
    await wait(300);
    const before = await ev(page, () => captureAnchor().vi);
    await ev(page, () => { const r = $('#fsRange'); r.value = 40; r.dispatchEvent(new Event('input')); }); await wait(100);
    const after = await ev(page, () => captureAnchor().vi);
    check(vp + ' text resize keeps the top verse', before === after, { before, after });
    await clickSel(page, '#tolkBtn'); await wait(500);
    await tap(page, '#v' + (after + 2) + ' span:nth-child(2)'); await wait(400);
    const f1 = await ev(page, () => getComputedStyle($('#featBody')).fontSize);
    await ev(page, () => { const r = $('#fsRange'); r.value = 22; r.dispatchEvent(new Event('input')); });
    const f2 = await ev(page, () => getComputedStyle($('#featBody')).fontSize);
    check(vp + ' Толкование text follows size live', f1 === '40px' && f2 === '22px', [f1, f2]);
    if (phone) {
      /* phone: panel sits under the header, so the toggles and tabs stay usable */
      const hdrVisible = await ev(page, () => { const h = $('#titleRow').getBoundingClientRect(), sh = $('#sheet').getBoundingClientRect(); return sh.top >= h.bottom - 1; });
      check(vp + ' panel opens under the frozen header', hdrVisible);
      await tap(page, '#simfBtn'); await wait(150);
      let s = await st(page);
      check(vp + ' switching mode closes the old panel', s.sheet === null && s.mode === 'simf', s);
      await tap(page, '#current'); await wait(150);
      await tap(page, '#slots button:nth-child(3)'); await wait(150);
      s = await st(page);
      check(vp + ' tab tap closes the book picker (tabs at top)', s.sheet === null && s.active === 2, s);
      await layout(page, vp + '-simf-on');
    }
    await noErrors(page, vp + ' modes');
    await page.close();
  }
};

GROUPS.nav = async () => {
  for (const vp of ['ipadL', 'ph390']) {
    const page = await newPage(vp);
    await open(page, {});
    const phone = vp !== 'ipadL';
    /* picker */
    await tap(page, '#current'); await wait(100);
    let s = await st(page); check(vp + ' Книги opens picker', s.sheet === 'pkb', s);
    await layout(page, vp + '-picker');
    await page.evaluate(() => [...document.querySelectorAll('.pk .books button')].find(b => b.textContent === 'Исход').click()); await wait(80);
    check(vp + ' book shows chapter list', await ev(page, () => document.querySelectorAll('.pk .chc .cg button').length === 40));
    await page.evaluate(() => document.querySelectorAll('.pk .chc .cg button')[4].click()); await wait(100);
    s = await st(page); check(vp + ' chapter pick navigates + closes', s.b === 1 && s.c === 4 && s.sheet === null, s);
    await tap(page, '#current'); await wait(80);
    await page.evaluate(() => [...document.querySelectorAll('.pk .books button')].find(b => b.textContent === 'Иуды').click()); await wait(100);
    s = await st(page); check(vp + ' one-chapter book goes direct', s.b === 64 && s.c === 0 && s.sheet === null, s);
    await tap(page, '#current'); await wait(80); await tap(page, '#current').catch(() => {});
    /* picker + arrow */
    await ev(page, () => { closeSheet(); openBooks(); }); await wait(50);
    if (!phone) { await tap(page, '#prevCh'); await wait(80); s = await st(page); check(vp + ' arrow under picker navigates + closes', s.sheet === null && s.b === 63, s); }
    else { await ev(page, () => $('#prevCh').click()); await wait(80); s = await st(page); check(vp + ' arrow with picker open navigates + closes', s.sheet === null && s.b === 63, s); }
    /* picker + tab */
    await wait(450); await ev(page, () => openBooks()); await wait(50);
    await tap(page, '#slots button:nth-child(2)'); await wait(100);
    s = await st(page); check(vp + ' tab under picker closes it + switches', s.sheet === null && s.active === 1, s);
    /* menu + tab */
    await tap(page, '#menuBtn'); await wait(50);
    s = await st(page); check(vp + ' ☰ opens menu', s.pop, s);
    await layout(page, vp + '-menu');
    await ev(page, () => $('#advChk').click()); await wait(50);
    await layout(page, vp + '-menu-adv');
    await ev(page, () => $('#advChk').click());
    await tap(page, '#slots button:nth-child(1)'); await wait(80);
    s = await st(page); check(vp + ' tab with menu open closes menu', !s.pop && s.active === 0, s);
    await tap(page, '#menuBtn'); await wait(50); await tap(page, '#current'); await wait(80);
    s = await st(page); check(vp + ' Книги with menu open: menu closes, picker opens', !s.pop && s.sheet === 'pkb', s);
    await clickSel(page, '#sheetClose');
    await tap(page, '#menuBtn'); await wait(30); await tap(page, '#menuBtn'); await wait(30);
    s = await st(page); check(vp + ' ☰ toggles menu closed', !s.pop, s);
    /* arrows: rapid taps advance one chapter per 400ms, edges disabled */
    await ev(page, () => go(0, 0)); await wait(450);
    check(vp + ' ‹ disabled at Быт 1', await ev(page, () => $('#prevCh').disabled));
    for (let i = 0; i < 5; i++) { await ev(page, () => $('#nextCh').click()); await wait(20); }
    s = await st(page); check(vp + ' rapid › taps debounced', s.c === 1, s.c);
    await ev(page, () => go(65, 21)); await wait(50);
    check(vp + ' › disabled at Откр 22', await ev(page, () => $('#nextCh').disabled));
    /* swipe */
    await ev(page, () => go(42, 2)); await wait(450);
    const sw = async (x0, x1, y0 = 400, y1 = 400) => {
      await page.touchscreen.touchStart(x0, y0); await page.touchscreen.touchMove((x0 + x1) / 2, (y0 + y1) / 2); await page.touchscreen.touchMove(x1, y1); await page.touchscreen.touchEnd(); await wait(80);
    };
    const W = (VIEWPORTS[vp]).width;
    await sw(W * 0.7, W * 0.2); s = await st(page); check(vp + ' swipe left → next chapter', s.c === 3, s.c);
    await wait(450); await sw(W * 0.2, W * 0.7); s = await st(page); check(vp + ' swipe right → previous', s.c === 2, s.c);
    await wait(450); await sw(W * 0.5, W * 0.55, 200, 500); s = await st(page); check(vp + ' vertical drag no nav', s.c === 2, s.c);
    await wait(450); await sw(5, W * 0.6); s = await st(page); check(vp + ' edge swipe ignored', s.c === 2, s.c);
    await ev(page, () => openBooks()); await wait(50);
    await wait(450); await sw(W * 0.7, W * 0.2, 300, 300); s = await st(page); check(vp + ' swipe ignored with picker open', s.c === 2 && s.sheet === 'pkb', s);
    await ev(page, () => closeSheet());
    /* tab round-trips keep the place (no drift under the sticky header) */
    await clickSel(page, phone ? '#simfBtn' : '#trBtn'); await wait(300);
    await ev(page, () => { $('#v20').scrollIntoView(); $('#reader').scrollTop -= 0; }); await wait(400);
    const a0 = await ev(page, () => captureAnchor());
    for (let i = 0; i < 4; i++) { await tap(page, '#slots button:nth-child(2)'); await wait(120); await tap(page, '#slots button:nth-child(1)'); await wait(120); }
    const a1 = await ev(page, () => captureAnchor());
    check(vp + ' tab round-trips keep the place', a0.vi === a1.vi && Math.abs(a0.vo - a1.vo) <= 2, { a0, a1 });
    await noErrors(page, vp + ' nav');
    await page.close();
  }
};

GROUPS.combo = async () => {
  /* mode + playing + selection + tab switch + rotation */
  const pairs = [['ipadL', 'ipadP'], ['ph390', { width: 844, height: 390 }]];
  for (const [a, b] of pairs) {
    const page = await newPage(a);
    await open(page, { state: { active: 1 } });
    await play(page);
    await clickSel(page, '#trBtn'); await wait(300);
    await tap(page, '#v3 span:nth-child(2)');
    let s = await st(page);
    check(a + ' EN + playing + selection', s.playing && s.mode === 'en' && s.selEl === 'v3' && s.jump, s);
    await layout(page, a + '-en-playing-sel');
    await tap(page, '#slots button:nth-child(3)'); await wait(150);
    s = await st(page);
    check(a + ' tab switch keeps audio, clears selection', s.playing && s.sel === -1 && s.active === 2 && s.audioBook === 18, s);
    await ev(page, () => { $('#v10').scrollIntoView(); }); await wait(350);
    const before = await ev(page, () => captureAnchor().vi);
    await page.setViewport(Object.assign({ hasTouch: true }, typeof b === 'string' ? VIEWPORTS[b] : b)); await wait(400);
    s = await st(page);
    const after = await ev(page, () => captureAnchor().vi);
    check(a + ' rotation mid-play: still playing, place kept', s.playing && before === after, { before, after });
    await layout(page, a + '-rotated-playing');
    await tap(page, '#audioBtn'); await waitPlaying(page, false);
    await layout(page, a + '-rotated-paused');
    await page.setViewport(Object.assign({ hasTouch: true }, VIEWPORTS[a])); await wait(300);
    await layout(page, a + '-rotated-back');
    await noErrors(page, a + ' combo');
    await page.close();
  }
};

GROUPS.adv = async () => {
  const page = await newPage('ipadL');
  await open(page, {});
  await tap(page, '#menuBtn');
  check('Дополнительно hidden by default', await ev(page, () => $('#advPanel').hidden && $('#voiceBtn').hidden));
  await ev(page, () => $('#advChk').click());
  check('Дополнительно reveals HA + sync', await ev(page, () => !$('#advPanel').hidden));
  check('sync disabled when not configured', await ev(page, () => $('#syncChk').disabled && /Не настроено/.test($('#syncHint').textContent)));
  await ev(page, () => { $('#syncChk').disabled = false; $('#syncChk').click(); });
  check('forcing sync on without config is refused', await ev(page, () => !S.driveSync && !$('#syncChk').checked));
  await ev(page, () => { const i = $('#haWebhook'); i.value = '  http://ha.local/api/webhook/x '; i.dispatchEvent(new Event('change')); });
  await ev(page, () => go(0, 1)); await wait(50);
  check('HA: plain http is never posted', await ev(page, () => __beacons.length === 0));
  await ev(page, () => { const i = $('#haWebhook'); i.value = 'https://ha.example/api/webhook/x'; i.dispatchEvent(new Event('change')); });
  await wait(450); await ev(page, () => $('#nextCh').click()); await wait(50);
  check('HA: https webhook gets position', await ev(page, () => __beacons.length === 1 && __beacons[0].startsWith('https://ha.example')));
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof BIBLE !== 'undefined' && BIBLE && deepReady); /* reload keeps adv */
  check('Дополнительно persists', await ev(page, () => S.adv === true && !$('#advPanel').hidden));
  await ev(page, () => $('#advChk').click());
  check('Дополнительно hides again', await ev(page, () => $('#advPanel').hidden && $('#voiceBtn').hidden));
  /* language */
  await ev(page, () => document.querySelector('#langSeg button[data-l="en"]').click());
  check('English UI labels', await ev(page, () => document.querySelector('[data-i="size"]').textContent === 'Text size'));
  await ev(page, () => document.querySelector('#langSeg button[data-l="ru"]').click());
  /* theme */
  await ev(page, () => document.querySelector('#themeSeg button[data-t="light"]').click());
  check('theme light applies', await ev(page, () => document.documentElement.dataset.theme === 'light' && document.querySelector('meta[name=theme-color]').content === '#ffffff'));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'ipadL-light-menu.png') });
  await ev(page, () => document.querySelector('#themeSeg button[data-t="dark"]').click());
  /* about */
  await ev(page, () => $('#aboutBtn').click());
  check('about opens credits', await ev(page, () => !$('#sheet').hidden && !!document.querySelector('.credits')));
  await tap(page, '#current');
  check('Книги replaces About', await ev(page, () => $('#sheetBody').classList.contains('pkb')));
  await noErrors(page, 'adv');
  await page.close();
};

GROUPS.wakelock = async () => {
  const page = await newPage('ipadL');
  await open(page, {});
  await ev(page, () => { for (let i = 0; i < 40; i++) $('#reader').dispatchEvent(new Event('scroll')); });
  await wait(200);
  await ev(page, () => { for (let i = 0; i < 40; i++) $('#reader').dispatchEvent(new Event('scroll')); });
  await wait(200);
  const n = await ev(page, () => __WL.active.size);
  check('bursts of activity hold one wake lock', n === 1, n);
  await ev(page, () => releaseWakeLock()); await wait(100);
  check('release frees every lock', await ev(page, () => __WL.active.size === 0));
  /* burst right after a release (no lock held): requests overlap while pending */
  await ev(page, () => { releaseWakeLock(); for (let i = 0; i < 30; i++) bumpActivity(); }); await wait(150);
  check('burst with no lock held acquires exactly one', await ev(page, () => __WL.active.size === 1), await ev(page, () => __WL.active.size));
  await ev(page, () => releaseWakeLock()); await wait(50);
  /* release while a request is still in flight */
  await ev(page, () => { __WL.delay = 200; requestWakeLock(); releaseWakeLock(); }); await wait(350);
  check('release during pending request leaves none', await ev(page, () => __WL.active.size === 0));
  await ev(page, () => { __WL.delay = 30; bumpActivity(); }); await wait(100);
  check('activity re-acquires', await ev(page, () => __WL.active.size === 1));
  /* the OS dropping the lock (tab hidden) clears our handle */
  await ev(page, () => [...__WL.active][0].release()); await wait(20);
  await ev(page, () => bumpActivity()); await wait(100);
  check('re-acquired after system release', await ev(page, () => __WL.active.size === 1));
  await noErrors(page, 'wakelock');
  await page.close();
};

GROUPS.sw = async () => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.__errs = []; page.on('pageerror', e => page.__errs.push(String(e.message)));
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await wait(1500);
  const V = String(fs.readFileSync(path.join(WEB, 'sw.js'))).match(/const V = '([^']+)'/)[1];
  let keys = await page.evaluate(() => caches.keys());
  check('SW caches current version', keys.includes(V), keys);
  swOverride = V + '-next';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()));
  await page.waitForFunction(v => caches.keys().then(k => k.includes(v) && k.length === 1), { timeout: 20000, polling: 300 }, swOverride).catch(() => {});
  keys = await page.evaluate(() => caches.keys());
  check('SW update replaces old cache', keys.length === 1 && keys[0] === swOverride, keys);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#text p'), { timeout: 20000 });
  check('app loads under updated SW', true);
  check('no JS errors sw', page.__errs.length === 0, page.__errs);
  swOverride = null;
  await ctx.close();
};

GROUPS.tablet = async () => {
  for (const vp of ['ipadL', 'ipadP']) {
    const page = await newPage(vp);
    await open(page, { state: { active: 1 } });
    const pos = () => ev(page, () => { const r = $('#audioBtn').getBoundingClientRect(); return [Math.round(r.left * 2) / 2, Math.round(r.top * 2) / 2, Math.round(r.width)]; });
    const tabs = await ev(page, () => [...document.querySelectorAll('#slots button')].map(b => { const cs = getComputedStyle(b); return [cs.fontSize, cs.fontWeight, cs.backgroundColor, b.classList.contains('on')]; }));
    check(vp + ' tabs 20px bold', tabs.every(t => t[0] === '20px' && +t[1] >= 700), tabs);
    const act = tabs.find(t => t[3]), ina = tabs.filter(t => !t[3]);
    check(vp + ' active tab gray, inactive black', ina.every(t => t[2] === 'rgb(0, 0, 0)') && act[2] !== 'rgb(0, 0, 0)' && /rgb/.test(act[2]), tabs);
    check(vp + ' ▶ icon ~1.4x (31px)', await ev(page, () => Math.round($('#audioBtn svg').getBoundingClientRect().width) === 31));
    check(vp + ' no seek slider', await ev(page, () => !document.querySelector('#pSeek, #bar input[type=range]')));
    const p0 = await pos();
    const mid = await ev(page, () => { const m = $('#menuBtn').getBoundingClientRect(), p = $('#prevCh').getBoundingClientRect(), a = $('#audioBtn').getBoundingClientRect(); return Math.abs((a.left + a.width / 2) - (m.left + m.width / 2 + p.left + p.width / 2) / 2); });
    check(vp + ' ▶ centred between ☰ and ‹', mid < 1, mid);
    await play(page); await wait(100);
    const p1 = await pos();
    check(vp + ' ❚❚ in the same spot as ▶', JSON.stringify(p0) === JSON.stringify(p1), [p0, p1]);
    check(vp + ' label shown while playing', await ev(page, () => { const e = $('#current'); return getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 40 && /Псалтирь 22/.test(e.textContent); }));
    const kept = () => ev(page, () => ['#pRef', '#pBack', '#pTime', '#pStop'].filter(s => { const e = $(s); return !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }));
    let k = await kept();
    check(vp + ' ↺15 and ■ kept', k.includes('#pBack') && k.includes('#pStop'), k);
    await layout(page, vp + '-tabv9-playing');
    if (vp === 'ipadL') await page.screenshot({ path: '/workspace/shots/tab-v9-playing.png' });
    else await page.screenshot({ path: '/workspace/shots/tab-v9-playing-portrait.png' });
    await clickSel(page, '#nextCh'); await wait(150);
    const p2 = await pos();
    k = await kept();
    check(vp + ' chip appears, ▶ unmoved', k.includes('#pRef') && JSON.stringify(p1) === JSON.stringify(p2), { k, p1, p2 });
    await layout(page, vp + '-tabv9-playing-chip');
    for (let i = 0; i < 20; i++) { await wait(420); await clickSel(page, '#nextCh'); } /* long and short labels */
    await layout(page, vp + '-tabv9-playing-later');
    await tap(page, '#audioBtn'); await waitPlaying(page, false); await wait(60);
    await ev(page, () => go(18, 21)); await wait(100);
    check(vp + ' paused ▶ same spot', JSON.stringify(await pos()) === JSON.stringify(p0), [await pos(), p0]);
    if (vp === 'ipadL') { await ev(page, () => go(0, 0)); await wait(100); await page.screenshot({ path: '/workspace/shots/tab-v9-read.png' }); }
    await noErrors(page, vp + ' tablet');
    await page.close();
  }
  /* phones untouched */
  const ph = await newPage('ph390');
  await open(ph, {});
  const pt = await ev(ph, () => [...document.querySelectorAll('#slots button')].map(b => getComputedStyle(b).fontSize + '/' + getComputedStyle(b).fontWeight));
  check('phone tabs unchanged (14px regular)', pt.every(x => x === '14px/400'), pt);
  check('phone ▶ in-flow', await ev(ph, () => getComputedStyle($('#audioBtn')).position === 'static'));
  await ph.close();
};

GROUPS.layout = async () => {
  for (const vp of Object.keys(VIEWPORTS)) {
    const page = await newPage(vp);
    await open(page, { state: { active: 1, fs: vp.startsWith('ph') ? 20 : 24 } });
    await layout(page, vp + '-reading');
    await tap(page, '#v2 span:nth-child(2)'); await layout(page, vp + '-selection');
    await tap(page, '.verseInlinePlay'); await waitPlaying(page); await layout(page, vp + '-playing');
    await clickSel(page, '#nextCh'); await wait(100); await layout(page, vp + '-playing-other-chapter');
    await tap(page, '#v2 span:nth-child(2)'); await layout(page, vp + '-playing-selected');
    for (const m of ['#tolkBtn', '#simfBtn', '#trBtn']) { await clickSel(page, m); await wait(300); await layout(page, vp + '-playing-mode' + m.slice(0, 5)); }
    await clickSel(page, '#trBtn');
    await tap(page, '#audioBtn'); await waitPlaying(page, false); await layout(page, vp + '-paused');
    await tap(page, '#menuBtn'); await layout(page, vp + '-menu');
    await ev(page, () => $('#advChk').click()); await ev(page, () => { $('#pop').scrollTop = 9999; }); await layout(page, vp + '-menu-adv');
    await ev(page, () => $('#advChk').click()); await ev(page, () => closePop());
    await tap(page, '#current'); await wait(100); await layout(page, vp + '-picker');
    const pk = await ev(page, () => { const b = [...document.querySelectorAll('.pk .books button')].find(b => b.textContent === 'Псалтирь'); if (b) b.click(); return b ? 'ok' : [$('#sheet').hidden, $('#sheetBody').className, document.querySelectorAll('.pk .books button').length]; }); await wait(100);
    check(vp + ' picker has Псалтирь', pk === 'ok', pk);
    await layout(page, vp + '-picker-psalms');
    await ev(page, () => closeSheet());
    /* largest text: nothing should overflow sideways */
    await ev(page, () => { const r = $('#fsRange'); r.value = 64; r.dispatchEvent(new Event('input')); });
    await clickSel(page, '#trBtn'); await wait(300);
    await layout(page, vp + '-fs64-en');
    await clickSel(page, '#tolkBtn'); await tap(page, '#v1 span:nth-child(2)'); await wait(400); await layout(page, vp + '-fs64-tolk');
    await ev(page, () => { const r = $('#fsRange'); r.value = 18; r.dispatchEvent(new Event('input')); }); await layout(page, vp + '-fs18-tolk');
    /* end-of-book nav buttons */
    await ev(page, () => { closeSheet(); if (S.mode !== 'tolk') setMode('tolk'); go(65, 21); $('#reader').scrollTop = 1e6; }); await wait(100);
    await layout(page, vp + '-end-of-bible');
    await noErrors(page, vp + ' layout');
    await page.close();
  }
};

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  BASE = 'http://127.0.0.1:' + server.address().port;
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--disable-features=OverscrollHistoryNavigation'] });
  const t0 = Date.now();
  for (const [g, fn] of Object.entries(GROUPS)) {
    if (ONLY.length && !ONLY.includes(g)) continue;
    group = g;
    try { await fn(); } catch (e) { check('group crashed', false, String(e && e.stack || e)); }
  }
  await browser.close(); server.close();
  const fail = results.filter(r => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed in ${Math.round((Date.now() - t0) / 1000)}s`);
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(results, null, 1));
  process.exit(fail.length ? 1 : 0);
})();
