'use strict';
const $ = s => document.querySelector(s);
const KEY = 'rb_state_v1';
const RATES = [0.9, 1, 1.1, 1.2];
function snapRate(r){
  r = +r;
  if (!isFinite(r)) return 1;
  let best = RATES[0], bd = Math.abs(r - best);
  for (const x of RATES) { const d = Math.abs(r - x); if (d < bd) { best = x; bd = d; } }
  return best;
}
const DEF = { active: 0, slots: [{b:0,c:0,y:0,vi:0,vo:0},{b:18,c:21,y:0,vi:0,vo:0},{b:42,c:0,y:0,vi:0,vo:0}], fs: 24, theme: 'dark', reader: 'kozlov', cont: true, rate: 1, follow: true, lang: 'ru', tr: 'web', trAll: false, mode: '', num: 'syn', tabsV: 2, haWebhook: '', adv: false, fsUser: false, driveSync: false, syncAt: 0 };
/* KJV chapter → Synodal chapter for Psalms (1-based). Built from inline markers. */
const PS_KJV_TO_SYN = {"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":9,"11":10,"12":11,"13":12,"14":13,"15":14,"16":15,"17":16,"18":17,"19":18,"20":19,"21":20,"22":21,"23":22,"24":23,"25":24,"26":25,"27":26,"28":27,"29":28,"30":29,"31":30,"32":31,"33":32,"34":33,"35":34,"36":35,"37":36,"38":37,"39":38,"40":39,"41":40,"42":41,"43":42,"44":43,"45":44,"46":45,"47":46,"48":47,"49":48,"50":49,"51":50,"52":51,"53":52,"54":53,"55":54,"56":55,"57":56,"58":57,"59":58,"60":59,"61":60,"62":61,"63":62,"64":63,"65":64,"66":65,"67":66,"68":67,"69":68,"70":69,"71":70,"72":71,"73":72,"74":73,"75":74,"76":75,"77":76,"78":77,"79":78,"80":79,"81":80,"82":81,"83":82,"84":83,"85":84,"86":85,"87":86,"88":87,"89":88,"90":89,"91":90,"92":91,"93":92,"94":93,"95":94,"96":95,"97":96,"98":97,"99":98,"100":99,"101":100,"102":101,"103":102,"104":103,"105":104,"106":105,"107":106,"108":107,"109":108,"110":109,"111":110,"112":111,"113":112,"114":113,"115":113,"116":114,"117":116,"118":117,"119":118,"120":119,"121":120,"122":121,"123":122,"124":123,"125":124,"126":125,"127":126,"128":127,"129":128,"130":129,"131":130,"132":131,"133":132,"134":133,"135":134,"136":135,"137":136,"138":137,"139":138,"140":139,"141":140,"142":141,"143":142,"144":143,"145":144,"146":145,"147":146,"148":148,"149":149,"150":150};

function migrateState(s){
  if (!s || !s.slots) return s;
  if (s.num !== 'syn') {
    s.slots.forEach(slot => {
      if (slot.b === 18) {
        const kjv = (slot.c|0) + 1;
        const syn = PS_KJV_TO_SYN[String(kjv)] || kjv;
        slot.c = Math.max(0, syn - 1);
      }
    });
    s.num = 'syn';
  }
  /* Old trAll-only → mode */
  if (!('mode' in s)) s.mode = s.trAll ? 'en' : '';
  /* Ensure each slot has verse scroll fields */
  s.slots.forEach(slot => {
    if (slot.vi == null) slot.vi = 0;
    if (slot.vo == null) slot.vo = 0;
  });
  /* One-time reset to Gen 1 / Ps 22 / Jn 1 (fixes dual Ps 22 from early deep-link tests) */
  if ((s.tabsV|0) < 2) {
    s.slots = JSON.parse(JSON.stringify(DEF.slots));
    s.active = 0;
    s.tabsV = 2;
  }
  /* Text size: 18–64 step 2 (was 14–40) */
  let fs = +s.fs || DEF.fs;
  if (fs < 18) fs = 18;
  if (fs > 64) fs = 64;
  s.fs = Math.round(fs / 2) * 2;
  s.rate = snapRate(s.rate);
  return s;
}
function isPhone(){ return !!(window.matchMedia && (window.matchMedia('(max-width:600px)').matches || window.matchMedia('(max-height:500px) and (max-width:1000px)').matches)); }
function load(){
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.slots && s.slots.length === 3) {
      const m = migrateState(Object.assign({}, DEF, s));
      /* Existing installs keep their font; only brand-new phone users get 20 */
      if (!('fsUser' in m)) m.fsUser = true;
      localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
  } catch(e){}
  const d = JSON.parse(JSON.stringify(DEF));
  d.fsUser = false;
  if (isPhone()) d.fs = 20;
  return d;
}
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
function bumpSyncAt(){
  S.syncAt = Date.now();
  try { if (window.RBSync) RBSync.schedulePush(); } catch(e){}
}
let S = load(), BIBLE = null, TIMES = {}, COMM = {}, SIMF = null;

const T = {
 ru:{size:'Размер текста',theme:'Тема',light:'Светлая',dark:'Тёмная',auto:'Авто',reader:'Чтец (аудио)',speed:'Скорость',sleep:'Таймер сна',off:'Выкл',m15:'15 м',m30:'30 м',m60:'60 м',chEnd:'Глава',cont:'Продолжать со следующей главы',follow:'Следить за стихом (Козлов)',trl:'Перевод (English)',about:'О приложении',back:'‹ Назад',done:'Готово',books:'Книги',list:'Список книг',noaudio:'нет аудио',voice:'🎤 Голосовая команда',adv:'Дополнительно',sync:'Синхронизация (Google)',syncOn:'Вкл',syncOut:'Выйти',syncOff:'Не настроено',syncSigned:'Вход выполнен',readerKozlov:'Козлов',readerEfimov:'Ефимов',
  credits:'<p><b>Текст:</b> Синодальный перевод (1876), общественное достояние. Источник: The Unbound Bible (Biola University). Нумерация глав и стихов — синодальная.</p><p><b>Аудио:</b> Игорь Козлов, издательство «Благовестник» (распространяется свободно); файлы: Hugging Face, enochlev/russian-synodal-bible-kozlov.</p><p><b>Аудио:</b> А. Ф. Ефимов, «Благовестник»; файлы: The Audio Power (theaudiopower.org).</p><p>Аудио воспроизводится через интернет.</p><p><b>Перевод:</b> World English Bible, общественное достояние (ebible.org). Английский сопоставлен с синодальной нумерацией.</p><p><b>Толкование:</b> Толковая Библия под ред. А. П. Лопухина и преемников (1904–1913), общественное достояние (OCR).</p>'},
 en:{size:'Text size',theme:'Theme',light:'Light',dark:'Dark',auto:'Auto',reader:'Reader (audio)',speed:'Speed',sleep:'Sleep timer',off:'Off',m15:'15 m',m30:'30 m',m60:'60 m',chEnd:'Chapter',cont:'Continue to next chapter',follow:'Follow the verse (Kozlov)',trl:'Translation (English)',about:'About',back:'‹ Back',done:'Done',books:'Books',list:'Book list',noaudio:'no audio',voice:'🎤 Voice command',adv:'Extra options',sync:'Sync (Google)',syncOn:'On',syncOut:'Sign out',syncOff:'Not configured',syncSigned:'Signed in',readerKozlov:'Kozlov',readerEfimov:'Efimov',
  credits:'<p><b>Text:</b> Russian Synodal Translation (1876), public domain. Source: The Unbound Bible (Biola University). Chapter and verse numbering follows the Synodal (Russian) tradition.</p><p><b>Audio:</b> Igor Kozlov, Blagovestnik publishers (freely distributed); files: Hugging Face, enochlev/russian-synodal-bible-kozlov.</p><p><b>Audio:</b> A. F. Efimov, Blagovestnik; files: The Audio Power (theaudiopower.org).</p><p>Audio streams over the internet.</p><p><b>Translation:</b> World English Bible, public domain (ebible.org), aligned to Synodal numbering.</p><p><b>Commentary:</b> Lopukhin Explanatory Bible (1904–1913), public domain (OCR).</p>'}};
const t = k => (T[S.lang] || T.ru)[k];
const TRS = [{id:'web', file:'data/web.json', label:'English (WEB)'}];
const TRD = {};
function trData(){ const d = TRD[S.tr]; if (d) return Promise.resolve(d); const m = TRS.find(x => x.id === S.tr) || TRS[0]; return fetch(m.file).then(r => r.json()).then(j => (TRD[m.id] = j)); }
const slot = () => S.slots[S.active];
const book = i => BIBLE.books[i];

function applyPrefs(){
  document.documentElement.dataset.theme = S.theme;
  document.documentElement.style.setProperty('--fs', S.fs + 'px');
  $('#fsRange').value = S.fs;
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === S.theme));
  document.querySelectorAll('#readerSeg button').forEach(b => b.classList.toggle('on', b.dataset.r === S.reader)); if ($('#trSel').options.length) $('#trSel').value = S.tr;
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  document.querySelectorAll('#langSeg button').forEach(b => b.classList.toggle('on', b.dataset.l === S.lang));
  $('#contChk').checked = S.cont; $('#followChk').checked = S.follow;
  if ($('#advChk')) $('#advChk').checked = !!S.adv;
  syncAdvPanel();
  if ($('#haWebhook')) $('#haWebhook').value = S.haWebhook || '';
  document.querySelectorAll('#rateSeg button').forEach(b => b.classList.toggle('on', +b.dataset.r === S.rate));
  document.querySelectorAll('#sleepSeg button').forEach(b => b.classList.toggle('on', +b.dataset.s === sleepMode));
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#000000' : '#ffffff';
  syncModeButtons();
}



function syncDriveUi(){
  const chk = $('#syncChk');
  const hint = $('#syncHint');
  const st = $('#syncStatus');
  const who = $('#syncWho');
  if (!chk) return;
  const cfg = !!(window.RBSync && RBSync.isConfigured());
  chk.disabled = !cfg;
  chk.checked = !!(cfg && S.driveSync);
  if (hint) {
    if (!cfg) hint.textContent = t('syncOff') || 'Не настроено';
    else if (!S.driveSync) hint.textContent = '';
    else {
      const s = RBSync.status();
      hint.textContent = s.signedIn ? (t('syncSigned') || 'Вход выполнен') : '';
    }
  }
  if (st) {
    const show = cfg && S.driveSync;
    st.hidden = !show;
    if (who && show) {
      const s = RBSync.status();
      who.textContent = s.signedIn ? (t('syncSigned') || 'Вход выполнен') : '';
    }
  }
}
function syncAdvPanel(){
  const panel = $('#advPanel');
  if (!panel) return;
  panel.hidden = !S.adv;
  /* Voice row stays gated on SpeechRecognition + adv (initVoiceUi sets hidden=false when supported) */
  const vbtn = $('#voiceBtn');
  if (vbtn && S.adv) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    vbtn.hidden = !SR;
  } else if (vbtn) {
    vbtn.hidden = true;
  }
  syncDriveUi();
}
function syncModeButtons(){
  document.querySelectorAll('.modeBtn').forEach(btn => {
    const on = S.mode === btn.dataset.mode;
    btn.classList.toggle('on', on);
    /* Phone: short labels; iPad/desktop: full words */
    if (btn.dataset.full) {
      btn.textContent = (isPhone() && btn.dataset.short) ? btn.dataset.short : btn.dataset.full;
    }
  });
  S.trAll = S.mode === 'en';
  document.body.classList.toggle('modeOn', !!S.mode);
  document.body.classList.toggle('phone', isPhone());
  updateStickyHdrVar();
}
function stickyHdrOffset(){
  /* Phone: header always sticky; iPad/desktop: only while a mode is on */
  if (!S.mode && !isPhone()) return 0;
  const row = $('#titleRow');
  return row ? Math.ceil(row.getBoundingClientRect().height) + 6 : 0;
}
function updateStickyHdrVar(){
  const px = stickyHdrOffset();
  document.documentElement.style.setProperty('--sticky-hdr', px + 'px');
}
function scrollVerseIntoPlace(p, opts){
  opts = opts || {};
  if (!p) return;
  const r = $('#reader');
  const pad = stickyHdrOffset();
  if (opts.exact != null) {
    r.scrollTop = Math.max(0, p.offsetTop + (opts.exact|0) - pad);
    return;
  }
  if (opts.block === 'center') {
    const top = Math.max(0, p.offsetTop - pad - r.clientHeight / 3);
    r.scrollTo({ top, behavior: opts.behavior || 'smooth' });
    return;
  }
  /* default: ensure visible below sticky header */
  const top = Math.max(0, p.offsetTop - pad - 8);
  r.scrollTo({ top, behavior: opts.behavior || 'smooth' });
}

function setMode(m){
  S.mode = (S.mode === m) ? '' : m;
  S.trAll = S.mode === 'en';
  save();
  syncModeButtons();
  if (S.mode === 'en') showAll(); else hideAll();
  if (S.mode !== 'tolk' && S.mode !== 'simf') {
    if (!$('#sheet').hidden && $('#sheetBody').classList.contains('feat')) closeSheet();
  }
  /* Re-bind verse clicks for word mode */
  if (BIBLE) render(true);
}

function addTr(p, i, d){ if (p.querySelector('.tr')) return; const {b, c} = slot(); const s = (d.c[b] && d.c[b][c] && d.c[b][c][i]) || '—'; const e = document.createElement('span'); e.className = 'tr'; e.textContent = s; p.appendChild(e); }
function showAll(){ trData().then(d => { if (S.mode !== 'en') return; document.querySelectorAll('#text p').forEach((p, i) => addTr(p, i, d)); }).catch(() => {}); }
function hideAll(){ document.querySelectorAll('#text .tr').forEach(e => e.remove()); }

/* Verse selection + ▶ bubble (no per-verse English). Ignore taps right after scroll. */
let selectedVerse = -1, suppressVerseTapUntil = 0;
function clearVerseSelection(){
  document.querySelectorAll('#text p.sel').forEach(el => el.classList.remove('sel'));
  selectedVerse = -1;
  syncVerseInlinePlay();
  syncAudioBtn();
}
function selectVerse(p, i){
  if (selectedVerse === i && p.classList.contains('sel')) { clearVerseSelection(); return; }
  clearVerseSelection();
  selectedVerse = i;
  p.classList.add('sel');
  syncVerseInlinePlay();
  syncAudioBtn();
}
function isAudioPlaying(){ return !audio.paused; }
function hasAudioSession(){ return audioBook >= 0 && !!(audio && audio.src); }
function showPlayerChrome(){
  $('#player').hidden = false;
  document.body.classList.add('playing');
  updateAudioRefChip();
  if (BIBLE) renderBar();
  else scheduleLayoutAudioBtn();
}
function hidePlayerChrome(){
  $('#player').hidden = true;
  document.body.classList.remove('playing');
  if (BIBLE) renderBar();
  else scheduleLayoutAudioBtn();
}
let stoppingAudio = false;
function setHiddenAttr(el, hide){
  if (!el) return;
  if (hide) el.setAttribute('hidden', '');
  else el.removeAttribute('hidden');
}
function syncAudioBtn(){
  const playing = isAudioPlaying();
  const btn = $('#audioBtn');
  const playIc = btn && btn.querySelector('.icPlay');
  const pauseIc = btn && btn.querySelector('.icPause');
  if (playing && selectedVerse >= 0) {
    setHiddenAttr(playIc, false);
    setHiddenAttr(pauseIc, true);
    btn.classList.add('jump');
    btn.setAttribute('aria-label', 'С этой стиха');
  } else if (playing) {
    setHiddenAttr(playIc, true);
    setHiddenAttr(pauseIc, false);
    btn.classList.remove('jump');
    btn.setAttribute('aria-label', 'Пауза');
  } else {
    setHiddenAttr(playIc, false);
    setHiddenAttr(pauseIc, true);
    btn.classList.remove('jump');
    btn.setAttribute('aria-label', 'Слушать');
  }
  syncVerseInlinePlay();
  layoutAudioBtn();
}
function onVerseTap(p, i){
  if (Date.now() < suppressVerseTapUntil) return;
  if (window.getSelection && String(getSelection()).length) return;
  if (S.mode === 'tolk') { clearVerseSelection(); openCommentary(i); return; }
  if (S.mode === 'simf') return; /* word spans handle taps */
  /* no mode, or EN mode: select + play bubble */
  selectVerse(p, i);
}
$('#reader').addEventListener('scroll', () => {
  suppressVerseTapUntil = Date.now() + 450;
  /* keep selection while scrolling; only suppress accidental tap */
}, {passive:true});
function chapTitle(b, c){ return (b === 18 ? 'Псалом ' : 'Глава ') + (c + 1); }

function wrapWords(text){
  /* Split into words for Симфония taps; keep punctuation attached lightly */
  return text.replace(/([А-Яа-яЁёA-Za-zʹ᾽\-]+)/g, '<span class="w">$1</span>');
}

function render(keepScroll){
  const {b, c} = slot(), bk = book(b), verses = bk.c[c];
  $('#loading').hidden = true;
  $('#title').textContent = bk.n + ' · ' + chapTitle(b, c);
  const frag = document.createDocumentFragment();
  const simf = S.mode === 'simf';
  verses.forEach((txt, i) => {
    const p = document.createElement('p'); p.id = 'v' + (i+1);
    const n = document.createElement('span'); n.className = 'n'; n.textContent = i+1;
    const v = document.createElement('span');
    if (simf) { v.innerHTML = wrapWords(txt); v.querySelectorAll('.w').forEach(w => { w.onclick = e => { e.stopPropagation(); openSimfonia(w.textContent); }; }); }
    else v.textContent = txt;
    p.append(n, v);
    p.onclick = () => onVerseTap(p, i);
    frag.appendChild(p);
  });
  const tx = $('#text'); tx.innerHTML = ''; tx.appendChild(frag);
  selectedVerse = -1; hideVersePlayBubble();
  syncModeButtons();
  if (S.mode === 'en') showAll(); else hideAll();
  const en = $('#endnav'); en.innerHTML = '';
  if (c < bk.c.length - 1) {
    en.appendChild(btn(`${chapTitle(b, c+1)} →`, () => go(b, c+1)));
  } else {
    if (b < 65) en.appendChild(btn(`${book(b+1).n} →`, () => go(b+1, 0)));
    en.appendChild(btn(t('books'), () => openBooks()));
  }
  renderBar();
  const r = $('#reader');
  requestAnimationFrame(() => {
    if (!keepScroll) { r.scrollTop = 0; return; }
    restoreScroll();
  });
  if (!keepScroll) { const s = slot(); s.y = 0; s.vi = 0; s.vo = 0; save(); }
  /* Navigation never reloads audio — only refresh chrome / follow when view matches */
  updateAudioRefChip();
  if (viewMatchesAudio() && !$('#player').hidden && S.follow && S.reader === 'kozlov') {
    highlight({ force: true, scroll: false });
  } else {
    clearHL();
  }
  syncAudioBtn();
  updateStickyHdrVar();
  bumpActivity();
}

function btn(label, fn, cls){ const e = document.createElement('button'); e.textContent = label; e.onclick = fn; if (cls) e.className = cls; return e; }

function renderBar(){
  const sl = $('#slots'); sl.innerHTML = '';
  S.slots.forEach((s, i) => sl.appendChild(btn(`${book(s.b).a} ${s.c+1}`, () => switchSlot(i), i === S.active ? 'on' : '')));
  const {b, c} = slot();
  /* While playing, use short abbr so the seek slider keeps room (no «Псалтирь…») */
  const playing = document.body.classList.contains('playing');
  $('#current').textContent = (playing && !isPhone()) ? `${book(b).a} ${c+1}` : `${book(b).n} ${c+1}`;
  const atStart = b === 0 && c === 0;
  const atEnd = b === 65 && c === book(65).c.length - 1;
  $('#prevCh').disabled = atStart;
  $('#nextCh').disabled = atEnd;
  scheduleLayoutAudioBtn();
}

let chNavLock = 0;
function chapterNavReady(){ return Date.now() >= chNavLock; }
function lockChapterNav(){ chNavLock = Date.now() + 400; }

function prevChapter(){
  if (!chapterNavReady()) return;
  const {b, c} = slot();
  if (b === 0 && c === 0) return;
  lockChapterNav();
  if (c > 0) go(b, c - 1);
  else go(b - 1, book(b - 1).c.length - 1);
}
function nextChapter(){
  if (!chapterNavReady()) return;
  const {b, c} = slot();
  const last = book(b).c.length - 1;
  if (b === 65 && c === last) return;
  lockChapterNav();
  if (c < last) go(b, c + 1);
  else go(b + 1, 0);
}

function go(b, c){
  const s = slot(); s.b = b; s.c = c; s.y = 0; s.vi = 0; s.vo = 0; bumpSyncAt(); save();
  closeSheet(); closePop();
  /* View-only navigation — audio keeps its own chapter */
  render(false);
  bumpActivity();
  postHaPosition(true);
}
function switchSlot(i){
  /* Bottom tabs stay usable under sheet/menu: close overlay, then switch */
  closeSheet();
  closePop();
  clearVerseSelection();
  if (i === S.active) { bumpActivity(); return; }
  saveScroll();
  S.active = i;
  bumpSyncAt();
  save();
  render(true); /* keepScroll → restoreScroll for that tab */
  bumpActivity();
}

let scrollT = 0;
function saveScroll(){
  const r = $('#reader');
  const s = slot();
  s.y = Math.round(r.scrollTop);
  /* Prefer verse index + offset within that verse */
  const paras = [...document.querySelectorAll('#text p')];
  let vi = 0, vo = 0;
  const top = r.scrollTop;
  for (let i = 0; i < paras.length; i++) {
    const el = paras[i];
    const bot = el.offsetTop + el.offsetHeight;
    if (bot > top + 4) {
      vi = i;
      vo = Math.max(0, Math.round(top - el.offsetTop));
      break;
    }
    vi = i; vo = 0;
  }
  s.vi = vi; s.vo = vo;
  bumpSyncAt();
  save();
}
function restoreScroll(){
  const r = $('#reader');
  const s = slot();
  updateStickyHdrVar();
  const p = document.querySelector('#v' + ((s.vi|0) + 1));
  if (p) scrollVerseIntoPlace(p, { exact: s.vo|0, behavior: 'auto' });
  else r.scrollTop = Math.max(0, (s.y|0) - stickyHdrOffset());
}
$('#reader').addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(saveScroll, 250); bumpActivity(); }, {passive:true});
window.addEventListener('pagehide', saveScroll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveScroll();
  else { requestWakeLock(); bumpActivity(); }
});

/* Book and chapter picker */
function openSheet(title, back){ $('#sheet').hidden = false; $('#sheetTitle').textContent = title; $('#sheetBack').hidden = !back; $('#sheetBack').onclick = back || null; $('#sheetBody').scrollTop = 0; $('#sheetBody').className = ''; closePop(); }
function closeSheet(){ $('#sheet').hidden = true; $('#sheetBody').className = ''; }
$('#sheetClose').onclick = closeSheet;

const GROUPS = [[0,5],[5,17],[17,22],[22,27],[27,39],[39,43],[43,44],[44,58],[58,65],[65,66]];
function openBooks(){
  if (!$('#sheet').hidden) { closeSheet(); return; }
  openSheet(t('books'));
  const body = $('#sheetBody'); body.innerHTML = ''; body.className = 'pkb';
  const pk = document.createElement('div'); pk.className = 'pk'; body.appendChild(pk);
  const ch = document.createElement('div'); ch.className = 'chc';
  const fill = (b) => {
    pk.querySelectorAll('.books button').forEach((x, i) => x.classList.toggle('cur', i === b));
    ch.style.setProperty('--c', b >= 39 ? 'var(--nt)' : 'var(--ot)');
    ch.innerHTML = '<div class="sec">' + book(b).n + '</div>';
    const g = document.createElement('div'); g.className = 'cg';
    book(b).c.forEach((_, c) => g.appendChild(btn(String(c+1), () => go(b, c), (b === slot().b && c === slot().c) ? 'cur' : '')));
    ch.appendChild(g);
    const cur = g.querySelector('.cur'); if (cur) cur.scrollIntoView({block:'center'});
  };
  [['Ветхий Завет', 0, 39, 'ot'], ['Новый Завет', 39, 66, 'nt']].forEach(([name, a, z, k]) => {
    const box = document.createElement('div'); box.className = 'tst ' + k;
    const h = document.createElement('div'); h.className = 'sec'; h.textContent = name; box.appendChild(h);
    const cols = document.createElement('div'); cols.className = 'books';
    GROUPS.filter(([ga]) => ga >= a && ga < z).forEach(([ga, gz]) => {
      const g = document.createElement('div'); g.className = 'grp';
      for (let i = ga; i < gz; i++) g.appendChild(btn(book(i).n, () => book(i).c.length === 1 ? go(i, 0) : fill(i)));
      cols.appendChild(g);
    });
    box.appendChild(cols); pk.appendChild(box);
  });
  pk.appendChild(ch);
  fill(slot().b);
}
(() => { let y0 = null; const h = $('#sheetHead');
  h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, {passive:true});
  h.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 50) closeSheet(); y0 = null; });
})();
$('#current').onclick = openBooks;
$('#prevCh').onclick = () => { closePop(); prevChapter(); };
$('#nextCh').onclick = () => { closePop(); nextChapter(); };

/* Quick settings panel */
function closePop(){ $('#pop').hidden = true; }
$('#menuBtn').onclick = e => { e.stopPropagation(); $('#pop').hidden = !$('#pop').hidden; };
document.addEventListener('click', e => { if (!$('#pop').hidden && !$('#pop').contains(e.target) && e.target !== $('#menuBtn')) closePop(); });
document.addEventListener('click', e => {
  if (selectedVerse < 0) return;
  const p = e.target.closest && e.target.closest('#text p');
  if (p) return; /* verse handler manages toggle */
  if (e.target.closest && (e.target.closest('#bar') || e.target.closest('#pop') || e.target.closest('#sheet') || e.target.closest('.versePlay') || e.target.closest('.verseInlinePlay'))) return;
  clearVerseSelection();
});
document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => { S.lang = b.dataset.l; save(); applyPrefs(); if (BIBLE) render(true); });
document.querySelectorAll('.modeBtn').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#trSel').innerHTML = TRS.map(x => `<option value="${x.id}">${x.label}</option>`).join('');
$('#trSel').onchange = e => { S.tr = e.target.value; save(); hideAll(); if (S.mode === 'en') showAll(); };
$('#fsRange').oninput = e => { S.fs = Math.min(64, Math.max(18, +e.target.value)); S.fsUser = true; save(); applyPrefs(); };
document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => { S.theme = b.dataset.t; save(); applyPrefs(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);
function switchReader(next){
  if (!next || next === S.reader) return;
  const wasPlaying = !audio.paused;
  const playerOpen = hasAudioSession() || !$('#player').hidden;
  const b = audioBook >= 0 ? audioBook : slot().b;
  const c = audioChap >= 0 ? audioChap : slot().c;
  let verseIdx = selectedVerse >= 0 && viewMatchesAudio() ? selectedVerse
    : (hlIdx >= 0 ? hlIdx
    : (verseIndexAtTime() >= 0 ? verseIndexAtTime() : lastFollowVerse));
  if (verseIdx < 0) verseIdx = 0;
  lastFollowVerse = verseIdx;
  S.reader = next;
  save();
  applyPrefs();
  if (!playerOpen && !wasPlaying) return;
  showPlayerChrome();
  loadAudio(b, c);
  const start = () => {
    let seek = 0;
    if (S.reader === 'kozlov') {
      const st = TIMES[book(b).o + '.' + (c + 1)];
      if (st && st.length === book(b).c[c].length && verseIdx < st.length)
        seek = st[verseIdx] / 1000;
    }
    try { audio.currentTime = seek; } catch(e){}
    if (wasPlaying || playerOpen) audio.play().catch(()=>{});
    if (S.follow && S.reader === 'kozlov') highlight({ force: true, time: seek, scroll: true, instant: true });
    syncAudioBtn();
    bumpActivity();
  };
  if (audio.readyState >= 1) start();
  else audio.addEventListener('loadedmetadata', start, { once: true });
}
document.querySelectorAll('#readerSeg button').forEach(b => b.onclick = () => switchReader(b.dataset.r));
$('#aboutBtn').onclick = () => {
  openSheet(t('about'));
  $('#sheetBody').innerHTML = '<div class="credits">' + t('credits') + '</div>';
};

/* Commentary (Lopukhin) — Synodal numbering */
function loadCommentary(osis){
  if (COMM[osis]) return Promise.resolve(COMM[osis]);
  return fetch('data/commentary/' + osis + '.json').then(r => {
    if (!r.ok) throw new Error('no commentary');
    return r.json();
  }).then(j => (COMM[osis] = j));
}
function openCommentary(verseIdx){
  const {b, c} = slot(), bk = book(b), v = verseIdx + 1;
  openSheet('Толкование');
  const body = $('#sheetBody'); body.className = 'feat';
  body.innerHTML = '<div id="featBody"><p class="featMuted">Загрузка…</p></div>';
  const ref = `${bk.n} ${c+1}:${v}`;
  loadCommentary(bk.o).then(data => {
    const ch = (data.chapters && (data.chapters[String(c+1)] || data.chapters[c+1])) || [];
    let hit = ch.find(x => v >= x.s && v <= x.e);
    if (!hit && ch.length) {
      /* nearest passage */
      hit = ch.reduce((best, x) => {
        const d = v < x.s ? x.s - v : (v > x.e ? v - x.e : 0);
        if (!best || d < best.d) return {d, x};
        return best;
      }, null).x;
    }
    const fb = $('#featBody');
    if (!hit) {
      fb.innerHTML = `<div class="featRef">${ref}</div><p class="featMuted">Нет толкования для этого места.</p><p class="featSrc">${data.source || ''}</p>`;
      return;
    }
    const ee = (hit.e >= 200 ? hit.s : hit.e); const range = hit.s === ee ? `${c+1}:${hit.s}` : `${c+1}:${hit.s}–${ee}`;
    fb.innerHTML = `<div class="featRef">${bk.n} ${range}</div><div class="featText"></div><p class="featSrc">${data.source || 'Лопухин'}</p>`;
    fb.querySelector('.featText').textContent = hit.t;
  }).catch(() => {
    $('#featBody').innerHTML = `<div class="featRef">${ref}</div><p class="featMuted">Толкование для этой книги пока недоступно.</p>`;
  });
}

/* Симфония — simple prefix/stem concordance */
function normWord(w){
  return w.toLowerCase().replace(/ё/g,'е').replace(/ъ/g,'').replace(/[^а-яa-z]/g,'');
}
function stemOf(w){
  const s = normWord(w);
  if (s.length <= 4) return s;
  /* light Russian stem: drop common endings */
  return s.replace(/(иями|ями|ами|иях|ях|ием|ем|ов|ев|ей|ой|ий|ый|ая|ое|ые|ие|ию|ью|ью|ам|ям|ах|ях|ом|ем|ую|юю|ии|ы|и|а|я|у|ю|е|о|ь)$/,'');
}
function buildSimf(){
  if (SIMF) return SIMF;
  const idx = new Map(); /* stem -> [{b,c,v,word,snippet}] */
  BIBLE.books.forEach((bk, bi) => {
    bk.c.forEach((ch, ci) => {
      ch.forEach((txt, vi) => {
        const words = txt.match(/[А-Яа-яЁёA-Za-zʹ᾽\-]+/g) || [];
        words.forEach(w => {
          const st = stemOf(w);
          if (st.length < 3) return;
          if (!idx.has(st)) idx.set(st, []);
          const arr = idx.get(st);
          if (arr.length < 80) arr.push({b:bi, c:ci, v:vi, w, t: txt.length > 110 ? txt.slice(0,110)+'…' : txt});
        });
      });
    });
  });
  SIMF = idx;
  return SIMF;
}
function openSimfonia(word, query){
  const q = (query != null ? query : word) || '';
  const st = stemOf(q);
  openSheet('Симфония');
  const body = $('#sheetBody'); body.className = 'feat';
  const head = document.createElement('div'); head.className = 'simfHead';
  const inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = 'Поиск слова…'; inp.value = q;
  const count = document.createElement('div'); count.className = 'simfCount';
  head.append(inp, count);
  const list = document.createElement('div'); list.id = 'featBody';
  body.innerHTML = ''; body.append(head, list);
  const run = () => {
    const qq = inp.value.trim();
    const stem = stemOf(qq);
    list.innerHTML = '';
    if (stem.length < 2) { count.textContent = 'Введите не менее 2 букв'; return; }
    const idx = buildSimf();
    let hits = idx.get(stem) || [];
    /* also prefix match other stems */
    if (hits.length < 20) {
      for (const [k, arr] of idx) {
        if (k !== stem && (k.startsWith(stem) || stem.startsWith(k))) {
          hits = hits.concat(arr);
          if (hits.length > 120) break;
        }
      }
    }
    /* dedupe by ref */
    const seen = new Set();
    hits = hits.filter(h => { const k = h.b+':'+h.c+':'+h.v; if (seen.has(k)) return false; seen.add(k); return true; });
    count.textContent = hits.length ? `${hits.length} мест` : 'Ничего не найдено';
    let lastBook = -1;
    hits.slice(0, 100).forEach(h => {
      if (h.b !== lastBook) {
        lastBook = h.b;
        const hb = document.createElement('div'); hb.className = 'simfBook'; hb.textContent = book(h.b).n;
        list.appendChild(hb);
      }
      const btnEl = document.createElement('button'); btnEl.className = 'simfHit';
      const re = new RegExp('('+qq.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i');
      const snip = h.t.replace(re, '<b>$1</b>');
      btnEl.innerHTML = `<span class="ref">${book(h.b).a} ${h.c+1}:${h.v+1}</span> ${snip}`;
      btnEl.onclick = () => {
        go(h.b, h.c);
        requestAnimationFrame(() => {
          const p = $('#v'+(h.v+1));
          if (p) { p.classList.add('flash'); scrollVerseIntoPlace(p, { block: 'center', behavior: 'smooth' }); setTimeout(() => p.classList.remove('flash'), 1200); }
        });
      };
      list.appendChild(btnEl);
    });
  };
  let tmr = 0;
  inp.oninput = () => { clearTimeout(tmr); tmr = setTimeout(run, 180); };
  inp.onkeydown = e => { if (e.key === 'Enter') run(); };
  run();
  setTimeout(() => inp.focus(), 50);
}


/* Inline ▶ on selected verse when audio is not playing */
function hideVersePlayBubble(){ syncVerseInlinePlay(true); }
function syncVerseInlinePlay(forceHide){
  document.querySelectorAll('.verseInlinePlay').forEach(el => el.remove());
  if (forceHide) return;
  if (selectedVerse < 0) return;
  if (isAudioPlaying()) return;
  const p = $('#v' + (selectedVerse + 1));
  if (!p) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'verseInlinePlay';
  b.setAttribute('aria-label', 'С этой стиха');
  b.textContent = '▶';
  b.onclick = e => {
    e.stopPropagation();
    playFromVerse(selectedVerse);
  };
  p.appendChild(b);
}
function playFromVerse(verseIdx){
  const {b, c} = slot();
  const key = book(b).o + '.' + (c + 1);
  const st = TIMES[key];
  const nVerses = book(b).c[c].length;
  let seekSec = 0;
  let note = '';
  if (S.reader === 'kozlov' && st && st.length === nVerses && verseIdx >= 0 && verseIdx < st.length) {
    seekSec = st[verseIdx] / 1000;
  } else if (S.reader === 'kozlov') {
    note = 'Нет тайминга — с начала главы';
  } else {
    if (verseIdx > 0) note = 'С начала главы';
  }
  const sameChapter = audioBook === b && audioChap === c && audioKey === S.reader + ':' + b + ':' + c;
  const alreadyOpen = !$('#player').hidden;
  showPlayerChrome();
  const startAt = () => {
    const apply = () => {
      clearVerseSelection();
      lastFollowVerse = verseIdx;
      hlIdx = -1;
      clearHL();
      const p = $('#v' + (verseIdx + 1));
      if (p) {
        p.classList.add('hl');
        hlIdx = verseIdx;
        scrollVerseIntoPlace(p, { block: 'center', behavior: 'smooth' });
      }
      let started = false;
      const go = () => {
        if (started) return; started = true;
        audio.play().catch(()=>{});
        if (note) showToast(note, 2200);
        bumpActivity();
        syncAudioBtn();
        updateAudioRefChip();
      };
      try { audio.currentTime = seekSec; } catch(e){}
      if (Math.abs((audio.currentTime || 0) - seekSec) > 0.35) {
        const onSeek = () => { audio.removeEventListener('seeked', onSeek); go(); };
        audio.addEventListener('seeked', onSeek);
        try { audio.currentTime = seekSec; } catch(e){ go(); }
        setTimeout(() => { audio.removeEventListener('seeked', onSeek); go(); }, 400);
      } else go();
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, {once: true});
  };
  if (sameChapter && alreadyOpen && audio.src) {
    startAt();
  } else {
    loadAudio(b, c);
    startAt();
  }
}


/* Center ▶ halfway between ☰ and ‹ (prevCh); pad player so it doesn't overlap */

function syncSeekFill(){
  const el = $('#pSeek');
  if (!el) return;
  const max = +el.max || 1000;
  const pct = max ? (100 * (+el.value || 0) / max) : 0;
  el.style.setProperty('--seek-pct', pct + '%');
}
function layoutPhoneChrome(){
  const slots = $('#slots');
  const titleRow = $('#titleRow');
  const bar = $('#bar');
  if (!slots || !titleRow || !bar) return;
  const phone = isPhone();
  document.body.classList.toggle('phone', phone);
  if (phone) {
    if (slots.parentElement !== titleRow) titleRow.appendChild(slots);
  } else {
    if (slots.parentElement !== bar) {
      const ch = $('#chNav');
      if (ch && ch.parentElement === bar) bar.insertBefore(slots, ch.nextSibling);
      else bar.appendChild(slots);
    }
  }
  syncModeButtons();
  updateStickyHdrVar();
}
function layoutAudioBtn(){
  const bar = $('#bar'), btn = $('#audioBtn'), menu = $('#menuBtn'), prev = $('#prevCh');
  if (!bar || !btn || !menu || !prev) return;
  /* Playing or phone two-row bar: in-flow after ☰ */
  if (!$('#player').hidden || isPhone()) {
    bar.style.setProperty('--audio-pad', '0px');
    btn.style.minWidth = '';
    btn.style.width = '';
    return;
  }
  const br = bar.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  const pr = prev.getBoundingClientRect();
  const gap = pr.left - mr.right;
  const ideal = 44;
  if (gap < ideal + 10) {
    const size = Math.max(28, Math.floor(gap - 8));
    btn.style.width = size + 'px';
    btn.style.minWidth = size + 'px';
  } else {
    btn.style.width = '';
    btn.style.minWidth = '';
  }
  const btnW = btn.offsetWidth || 44;
  const half = btnW / 2 + 2;
  const mid = (mr.left + mr.width / 2 + pr.left + pr.width / 2) / 2;
  const lo = mr.right + half;
  const hi = pr.left - half;
  const clamped = hi >= lo ? Math.min(hi, Math.max(lo, mid)) : (mr.right + pr.left) / 2;
  bar.style.setProperty('--audio-x', (clamped - br.left) + 'px');
  bar.style.setProperty('--audio-pad', '0px');
}
let layoutAudioT = 0;
function scheduleLayoutAudioBtn(){
  clearTimeout(layoutAudioT);
  layoutAudioT = setTimeout(layoutAudioBtn, 30);
}
window.addEventListener('resize', () => { layoutPhoneChrome(); scheduleLayoutAudioBtn(); updateStickyHdrVar(); });
window.addEventListener('orientationchange', () => setTimeout(() => { layoutPhoneChrome(); layoutAudioBtn(); updateStickyHdrVar(); }, 120));

/* Audio — session (audioBook/audioChap) is independent of the viewed slot */
const audio = $('#audio');
let audioKey = '';
let audioBook = -1, audioChap = -1;
function viewMatchesAudio(){
  if (audioBook < 0) return false;
  const {b, c} = slot();
  return audioBook === b && audioChap === c;
}
function updateAudioRefChip(){
  const el = $('#pRef');
  if (!el) return;
  if (audioBook >= 0) el.textContent = book(audioBook).a + ' ' + (audioChap + 1);
  else el.textContent = '';
  const show = !$('#player').hidden && audioBook >= 0 && !viewMatchesAudio();
  el.hidden = !show;
}
function jumpToAudioChapter(){
  if (audioBook < 0) return;
  const v = Math.max(0, lastFollowVerse);
  const s = slot();
  s.b = audioBook; s.c = audioChap; s.y = 0; s.vi = v; s.vo = 0; bumpSyncAt(); save();
  closeSheet(); closePop();
  render(false);
  requestAnimationFrame(() => {
    const p = $('#v' + (v + 1));
    if (p) {
      clearHL();
      p.classList.add('hl');
      hlIdx = v;
      scrollVerseIntoPlace(p, { block: 'center', behavior: 'auto' });
    }
    updateAudioRefChip();
    syncAudioBtn();
  });
}
function audioURL(b, c){
  const bk = book(b);
  if (S.reader === 'efimov') {
    const name = bk.c.length === 1 ? bk.e : `${bk.e} ${c+1}`;
    return 'https://theaudiopower.org/RUSV/Recordings/' + encodeURIComponent(name) + '.mp3';
  }
  return `https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov/resolve/main/a1/kozlov/${bk.o}/${c+1}.m4a`;
}
function loadAudio(b, c){
  if (b == null || c == null) { const s = slot(); b = s.b; c = s.c; }
  audioBook = b; audioChap = c;
  audioKey = S.reader + ':' + b + ':' + c;
  audio.src = audioURL(b, c);
  audio.load();
  clearHL();
  updateAudioRefChip();
}
function stopAudio(){
  stoppingAudio = true;
  try { audio.pause(); } catch(e){}
  clearHL();
  audioBook = -1; audioChap = -1; audioKey = '';
  hidePlayerChrome();
  updateAudioRefChip();
  syncAudioBtn();
  stoppingAudio = false;
}
$('#audioBtn').onclick = () => {
  closePop();
  /* Playing + selected verse → jump. Playing + none → pause (chrome collapses). */
  if (!audio.paused) {
    if (selectedVerse >= 0) { playFromVerse(selectedVerse); return; }
    audio.pause();
    return;
  }
  if (selectedVerse >= 0) {
    playFromVerse(selectedVerse);
    return;
  }
  /* Paused session → resume (player chrome returns on play) */
  if (hasAudioSession()) {
    showPlayerChrome();
    audio.play().catch(()=>{});
    bumpActivity();
    syncAudioBtn();
    return;
  }
  /* Fresh start: viewed chapter from beginning */
  showPlayerChrome();
  const {b, c} = slot();
  loadAudio(b, c);
  const start = () => {
    try { audio.currentTime = 0; } catch(e){}
    clearHL(); hlIdx = -1; lastFollowVerse = 0;
    audio.play().catch(()=>{});
    bumpActivity();
    syncAudioBtn();
  };
  if (audio.readyState >= 1) start();
  else audio.addEventListener('loadedmetadata', start, {once:true});
};
$('#pStop').onclick = stopAudio;
if ($('#pRef')) $('#pRef').onclick = e => { e.stopPropagation(); jumpToAudioChapter(); };
$('#pBack').onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 15); highlight({ force: true, scroll: true, instant: true }); };
let sleepMode = 0, sleepT = null;
function setSleep(m){ sleepMode = m; clearTimeout(sleepT); if (m > 0) sleepT = setTimeout(() => { audio.pause(); sleepMode = 0; applyPrefs(); }, m * 60000); applyPrefs(); }
document.querySelectorAll('#sleepSeg button').forEach(b => b.onclick = () => setSleep(+b.dataset.s));
document.querySelectorAll('#rateSeg button').forEach(b => b.onclick = () => { S.rate = snapRate(b.dataset.r); audio.defaultPlaybackRate = audio.playbackRate = S.rate; try { audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; } catch(e){} save(); applyPrefs(); });
$('#contChk').onchange = e => { S.cont = e.target.checked; save(); };
$('#followChk').onchange = e => { S.follow = e.target.checked; save(); if (!S.follow) clearHL(); };
if ($('#advChk')) $('#advChk').onchange = e => { S.adv = !!e.target.checked; save(); syncAdvPanel(); };
if ($('#syncChk')) $('#syncChk').onchange = async e => {
  if (!(window.RBSync && RBSync.isConfigured())) {
    e.target.checked = false;
    S.driveSync = false;
    save();
    syncDriveUi();
    return;
  }
  if (e.target.checked) {
    const ok = await RBSync.enable();
    S.driveSync = !!ok;
    if (!ok) e.target.checked = false;
    save();
    syncDriveUi();
  } else {
    RBSync.signOut();
    S.driveSync = false;
    save();
    syncDriveUi();
  }
};
if ($('#syncOutBtn')) $('#syncOutBtn').onclick = () => {
  if (window.RBSync) RBSync.signOut();
  S.driveSync = false;
  if ($('#syncChk')) $('#syncChk').checked = false;
  save();
  syncDriveUi();
};
if ($('#haWebhook')) $('#haWebhook').onchange = e => { S.haWebhook = String(e.target.value || '').trim(); save(); };
if ($('#haWebhook')) $('#haWebhook').onkeydown = e => { if (e.key === 'Enter') { e.target.blur(); } };

audio.onplay = () => {
  try { audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; } catch(e){}
  audio.playbackRate = S.rate;
  showPlayerChrome();
  bumpActivity();
  syncAudioBtn();
};
audio.onpause = () => {
  if (!stoppingAudio) hidePlayerChrome();
  syncAudioBtn();
  postHaPosition(true);
};
audio.onerror = () => { $('#pTime').textContent = t('noaudio'); };
const fmt = t => isFinite(t) ? Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0') : '0:00';
let seeking = false;
$('#pSeek').oninput = e => {
  seeking = true;
  syncSeekFill();
  if (!audio.duration) return;
  const sec = e.target.value / 1000 * audio.duration;
  $('#pTime').textContent = fmt(sec);
  highlightFromSeek(sec);
};
$('#pSeek').onchange = e => {
  if (audio.duration) {
    const sec = e.target.value / 1000 * audio.duration;
    audio.currentTime = sec;
    highlight({ force: true, time: sec, scroll: true, instant: true });
  }
  seeking = false;
};
audio.ontimeupdate = () => {
  if (!seeking && audio.duration) $('#pSeek').value = Math.round(audio.currentTime / audio.duration * 1000);
  $('#pTime').textContent = fmt(audio.currentTime);
  syncSeekFill();
  highlight();
};
let audioEnding = false;
audio.onended = () => {
  if (audioEnding) return;
  if (sleepMode === -1) { setSleep(0); syncAudioBtn(); return; }
  if (!S.cont) { syncAudioBtn(); return; }
  const b = audioBook, c = audioChap;
  if (b < 0) { syncAudioBtn(); return; }
  const viewFollows = viewMatchesAudio();
  let nb = b, nc = c;
  if (c < book(b).c.length - 1) nc = c + 1;
  else if (b < 65) { nb = b + 1; nc = 0; }
  else { syncAudioBtn(); return; }
  audioEnding = true;
  showPlayerChrome();
  loadAudio(nb, nc);
  const start = () => {
    audioEnding = false;
    audio.play().catch(()=>{});
    syncAudioBtn();
    updateAudioRefChip();
    bumpActivity();
  };
  if (audio.readyState >= 1) start();
  else audio.addEventListener('loadedmetadata', start, { once: true });
  if (viewFollows) {
    const s = slot(); s.b = nb; s.c = nc; s.y = 0; s.vi = 0; s.vo = 0; bumpSyncAt(); save();
    render(false);
  } else {
    updateAudioRefChip();
  }
};
let hlIdx = -1, hlSeekT = 0, lastFollowVerse = 0;
function clearHL(){ const p = document.querySelector('#text p.hl'); if (p) p.classList.remove('hl'); hlIdx = -1; }
function verseIndexAtTime(sec){
  if (S.reader !== 'kozlov') return -1;
  const b = audioBook >= 0 ? audioBook : slot().b;
  const c = audioChap >= 0 ? audioChap : slot().c;
  if (b < 0 || !book(b) || c >= book(b).c.length) return -1;
  const k = book(b).o + '.' + (c+1), st = TIMES[k];
  if (!st || st.length !== book(b).c[c].length) return -1;
  const ms = (sec != null ? sec : audio.currentTime) * 1000;
  let i = -1;
  for (let j = 0; j < st.length; j++) { if (st[j] <= ms) i = j; else break; }
  return i;
}
/* force: update even while paused (seek / ↺15). scroll: scroll into view.
   Follow highlight only when the viewed chapter is the audio chapter. */
function highlight(opts){
  opts = opts || {};
  if (!S.follow || S.reader !== 'kozlov') return;
  if (audio.paused && !opts.force) return;
  const i = verseIndexAtTime(opts.time);
  if (i >= 0) lastFollowVerse = i;
  if (!viewMatchesAudio()) {
    clearHL();
    updateAudioRefChip();
    return;
  }
  if (i === hlIdx && !opts.force) return;
  clearHL(); hlIdx = i;
  if (i < 0) return;
  const p = $('#v' + (i+1));
  if (!p) return;
  p.classList.add('hl');
  const doScroll = opts.scroll !== false;
  if (!doScroll) return;
  if (selectedVerse >= 0 && selectedVerse !== i && !opts.force) return;
  const r = $('#reader'), pad = stickyHdrOffset();
  const top = Math.max(0, p.offsetTop - pad - r.clientHeight / 3);
  if (Math.abs(r.scrollTop - top) > r.clientHeight / 3) r.scrollTo({top, behavior: opts.instant ? 'auto' : 'smooth'});
}
function highlightFromSeek(sec){
  if (!S.follow || S.reader !== 'kozlov') return;
  clearTimeout(hlSeekT);
  hlSeekT = setTimeout(() => {
    highlight({ force: true, time: sec, scroll: true, instant: true });
  }, 80);
}

/* Voice commands (webkitSpeechRecognition) */
function showToast(msg, ms){
  const el = $('#toast'); if (!el) return;
  el.hidden = false; el.textContent = msg;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, ms || 2200);
}
function applyVoiceCmd(cmd){
  if (!cmd || cmd.action === 'unknown') {
    showToast('Не понял: ' + (cmd && cmd.raw ? cmd.raw : ''));
    return;
  }
  if (cmd.action === 'next') { nextChapter(); showToast('→'); return; }
  if (cmd.action === 'prev') { prevChapter(); showToast('←'); return; }
  if (cmd.action === 'play') { if ($('#player').hidden || audio.paused) $('#audioBtn').click(); showToast('▶'); return; }
  if (cmd.action === 'stop') { if (!audio.paused) audio.pause(); else stopAudio(); showToast('■'); return; }
  if (cmd.action === 'books') { openBooks(); showToast('Книги'); return; }
  if (cmd.action === 'go') {
    const b = cmd.book, c = Math.max(0, (cmd.chapter|0) - 1);
    if (b == null || !book(b) || c >= book(b).c.length) { showToast('Не понял: ' + cmd.raw); return; }
    go(b, c);
    if (cmd.verse) {
      requestAnimationFrame(() => {
        const p = $('#v' + cmd.verse);
        if (p) { p.classList.add('flash'); scrollVerseIntoPlace(p, { block: 'center', behavior: 'smooth' }); setTimeout(() => p.classList.remove('flash'), 1200); }
      });
    }
    showToast(book(b).n + ' ' + (c+1) + (cmd.verse ? ':' + cmd.verse : ''));
  }
}
let rec = null, listening = false;
function voiceBooks(){
  return BIBLE ? BIBLE.books.map(b => ({n:b.n,a:b.a,e:b.e,o:b.o})) : [];
}
function startListen(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Голос не поддерживается'); return; }
  if (listening && rec) { try { rec.stop(); } catch(e){} return; }
  rec = new SR();
  rec.lang = S.lang === 'en' ? 'en-US' : 'ru-RU';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  listening = true;
  document.body.classList.add('listening');
  if ($('#voiceBtn')) $('#voiceBtn').classList.add('on');
  showToast('🎤 …', 6000);
  rec.onresult = e => {
    let best = '';
    for (let i = 0; i < e.results.length; i++) best += e.results[i][0].transcript;
    best = best.trim();
    showToast(best || '…', 1800);
    if (!window.BibleVoice || !BIBLE) return;
    const cmd = BibleVoice.parse(best, { books: voiceBooks() });
    applyVoiceCmd(cmd);
  };
  rec.onerror = () => { listening = false; document.body.classList.remove('listening'); if ($('#voiceBtn')) $('#voiceBtn').classList.remove('on'); };
  rec.onend = () => { listening = false; document.body.classList.remove('listening'); if ($('#voiceBtn')) $('#voiceBtn').classList.remove('on'); };
  try { rec.start(); } catch(e) { listening = false; document.body.classList.remove('listening'); }
}
function initVoiceUi(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const vbtn = $('#voiceBtn');
  if (!vbtn) return;
  vbtn.onclick = e => { e.stopPropagation(); closePop(); startListen(); };
  syncAdvPanel();
}

/* Deep links: #Ps.22 #John.3.16 #Иоанна.3  and ?play=1 */
const OSIS_I = {};
const NAME_I = {};
function buildDeepIndex(){
  if (!BIBLE) return;
  BIBLE.books.forEach((bk, i) => {
    OSIS_I[bk.o.toLowerCase()] = i;
    [bk.n, bk.a, bk.e, bk.o].forEach(x => { if (x) NAME_I[String(x).toLowerCase().replace(/ё/g,'е')] = i; });
    if (window.BibleVoice && BibleVoice.EXTRA[bk.o]) {
      BibleVoice.EXTRA[bk.o].forEach(x => { NAME_I[String(x).toLowerCase().replace(/ё/g,'е')] = i; });
    }
  });
}
function parseHash(h){
  h = String(h || '').replace(/^#/, '').trim();
  if (!h) return null;
  const m = h.match(/^([A-Za-zА-Яа-яЁё0-9\-]+)(?:[./:](\d+))?(?:[./:](\d+))?$/u);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/ё/g,'е');
  let bi = OSIS_I[key];
  if (bi == null) bi = NAME_I[key];
  if (bi == null) {
    if (window.BibleVoice && BIBLE) {
      const phrase = m[1] + (m[2] ? ' ' + m[2] : '') + (m[3] ? ' стих ' + m[3] : '');
      const cmd = BibleVoice.parse(phrase, { books: voiceBooks() });
      if (cmd.action === 'go') return { b: cmd.book, c: cmd.chapter - 1, v: cmd.verse || null };
    }
    return null;
  }
  const c = m[2] ? Math.max(0, (+m[2]) - 1) : 0;
  const v = m[3] ? +m[3] : null;
  return { b: bi, c, v };
}
function applyDeepLink(opts){
  if (!BIBLE) return false;
  buildDeepIndex();
  const loc = parseHash(location.hash);
  if (!loc) return false;
  if (loc.b < 0 || loc.b > 65) return false;
  if (loc.c < 0 || loc.c >= book(loc.b).c.length) return false;
  const s = slot(); s.b = loc.b; s.c = loc.c; s.y = 0; s.vi = Math.max(0, (loc.v|0) - 1); s.vo = 0; bumpSyncAt(); save();
  render(false);
  if (loc.v) {
    requestAnimationFrame(() => {
      const p = $('#v' + loc.v);
      if (p) { p.classList.add('flash'); scrollVerseIntoPlace(p, { block: 'center', behavior: 'smooth' }); setTimeout(() => p.classList.remove('flash'), 1400); }
    });
  }
  if (opts && opts.play) {
    setTimeout(() => {
      showPlayerChrome();
      loadAudio(); audio.play().catch(()=>{});
    }, 300);
  }
  return true;
}
function readPlayFlag(){
  try { return new URLSearchParams(location.search).get('play') === '1'; } catch(e){ return false; }
}
let deepReady = false;
window.addEventListener('hashchange', () => { if (deepReady) applyDeepLink({play:false}); });


/* Horizontal swipe → chapter (same as arrows) */
(function(){
  const edge = 20, minX = 56, maxY = 48;
  let x0 = 0, y0 = 0, t0 = 0, tracking = false;
  const reader = $('#reader');
  reader.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    if (!$('#sheet').hidden || !$('#pop').hidden) { tracking = false; return; }
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    if (x < edge || x > window.innerWidth - edge) { tracking = false; return; }
    x0 = x; y0 = y; t0 = Date.now(); tracking = true;
  }, {passive:true});
  reader.addEventListener('touchmove', e => {
    if (!tracking) return;
    if (window.getSelection && String(getSelection()).length) { tracking = false; return; }
  }, {passive:true});
  reader.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    if (!$('#sheet').hidden || !$('#pop').hidden) return;
    if (window.getSelection && String(getSelection()).length) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < minX) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return; /* require clear horizontal */
    if (Math.abs(dy) > maxY && Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx < 0) nextChapter(); else prevChapter();
  }, {passive:true});
})();

/* Screen wake lock while reading / listening */
let wakeLock = null, idleT = null, lastAct = Date.now();
function bumpActivity(){
  lastAct = Date.now();
  requestWakeLock();
  clearTimeout(idleT);
  idleT = setTimeout(() => {
    if (!audio.paused) { bumpActivity(); return; }
    releaseWakeLock();
  }, 10 * 60 * 1000);
}
async function requestWakeLock(){
  try {
    if (!('wakeLock' in navigator)) return;
    if (document.hidden) return;
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch(e) { wakeLock = null; }
}
function releaseWakeLock(){
  try { if (wakeLock) wakeLock.release(); } catch(e){}
  wakeLock = null;
}
document.addEventListener('pointerdown', bumpActivity, {passive:true});
document.addEventListener('keydown', bumpActivity);


/* Home Assistant position webhook — off unless S.haWebhook is set (HTTPS) */
let haLast = 0, haTimer = null;
function haPayload(){
  if (!BIBLE) return null;
  const b = audioBook >= 0 ? audioBook : slot().b;
  const c = audioChap >= 0 ? audioChap : slot().c;
  const bk = book(b);
  let verse = lastFollowVerse >= 0 ? lastFollowVerse + 1 : 1;
  const vi = verseIndexAtTime();
  if (vi >= 0) verse = vi + 1;
  else if (hlIdx >= 0) verse = hlIdx + 1;
  return {
    osis: bk.o,
    book: bk.n,
    abbr: bk.a,
    chapter: c + 1,
    verse,
    reader: S.reader,
    position: Math.round((audio && !isNaN(audio.currentTime) ? audio.currentTime : 0) * 10) / 10,
    playing: !!(audio && !audio.paused),
    timestamp: new Date().toISOString(),
    deep_link: '#' + bk.o + '.' + (c + 1) + '.' + verse
  };
}
function postHaPosition(force){
  const url = (S.haWebhook || '').trim();
  if (!url) return;
  if (!/^https:\/\//i.test(url)) return; /* mixed content / require HTTPS */
  const now = Date.now();
  if (!force && now - haLast < 8000) return;
  const body = haPayload();
  if (!body) return;
  haLast = now;
  /* text/plain + no-cors: HA webhooks accept the body without CORS headers
     (application/json from github.io would be blocked preflight). */
  const raw = JSON.stringify(body);
  try {
    const blob = new Blob([raw], {type: 'text/plain'});
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {method:'POST', body: raw, mode:'no-cors', keepalive:true,
        headers: {'Content-Type': 'text/plain'}}).catch(()=>{});
    }
  } catch(e){
    try {
      fetch(url, {method:'POST', body: raw, mode:'no-cors', keepalive:true,
        headers: {'Content-Type': 'text/plain'}}).catch(()=>{});
    } catch(e2){}
  }
}
function startHaTicker(){
  clearInterval(haTimer);
  haTimer = setInterval(() => {
    if (!S.haWebhook) return;
    if (audio && !audio.paused) postHaPosition(false);
  }, 30000);
}
startHaTicker();


/* iPad / iOS: block pinch-zoom and double-tap zoom (viewport alone is ignored) */
(function () {
  const stop = e => { e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
    document.addEventListener(type, stop, { passive: false });
  });
  document.addEventListener('touchmove', e => {
    if (e.touches && e.touches.length > 1) { e.preventDefault(); return; }
    if (typeof e.scale === 'number' && e.scale !== 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  /* Short double-tap guard: block zoom-ish double taps, not UI taps */
  let lastTap = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', e => {
    const t0 = e.changedTouches && e.changedTouches[0];
    if (!t0) return;
    const now = Date.now();
    const x = t0.clientX, y = t0.clientY;
    const dt = now - lastTap;
    const near = Math.abs(x - lastX) < 24 && Math.abs(y - lastY) < 24;
    lastTap = now; lastX = x; lastY = y;
    if (dt > 0 && dt < 280 && near) {
      const interactive = e.target.closest && e.target.closest(
        'button, input, select, textarea, a, label, #text p, #text .w, #bar, #pop, #sheet, #modeToggles, #chNav, #slots'
      );
      if (!interactive) e.preventDefault();
    }
  }, { passive: false });
})();


/* Google Drive reading-position sync (optional; inert without GOOGLE_CLIENT_ID) */
if (window.RBSync) {
  RBSync.init({
    isEnabled: () => !!S.driveSync,
    setEnabled: (on) => { S.driveSync = !!on; save(); },
    getSnapshot: () => ({
      updatedAt: S.syncAt || 0,
      active: S.active|0,
      slots: JSON.parse(JSON.stringify(S.slots))
    }),
    applyRemote: (remote) => {
      if (!remote || !Array.isArray(remote.slots) || remote.slots.length !== 3) return;
      S.slots = remote.slots.map(x => ({
        b: x.b|0, c: x.c|0, y: x.y|0, vi: x.vi|0, vo: x.vo|0
      }));
      S.active = Math.max(0, Math.min(2, remote.active|0));
      S.syncAt = remote.updatedAt|0;
      save(); /* schedulePush no-ops while applying via RBSync flag */
      if (BIBLE) render(true);
    },
    onStatus: () => syncDriveUi()
  });
}

/* Start */
applyPrefs();
initVoiceUi();
layoutPhoneChrome();
layoutAudioBtn();
bumpActivity();
fetch('data/bible.json').then(r => r.json()).then(d => {
  BIBLE = d;
  const played = applyDeepLink({ play: readPlayFlag() });
  if (!played) render(true);
  deepReady = true;
});
fetch('data/kozlov_timings.json').then(r => r.json()).then(d => { TIMES = d; }).catch(()=>{});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
