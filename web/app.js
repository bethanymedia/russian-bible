'use strict';
const $ = s => document.querySelector(s);
const KEY = 'rb_state_v1';
const DEF = { active: 0, slots: [{b:0,c:0,y:0},{b:18,c:22,y:0},{b:42,c:0,y:0}], fs: 20, theme: 'system', reader: 'kozlov', cont: true, rate: 1, follow: true };
let S = load(), BIBLE = null, TIMES = {}, timesOK = false;

function load(){ try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.slots && s.slots.length === 3) return Object.assign({}, DEF, s); } catch(e){} return JSON.parse(JSON.stringify(DEF)); }
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
const slot = () => S.slots[S.active];
const book = i => BIBLE.books[i];

function applyPrefs(){
  document.documentElement.dataset.theme = S.theme;
  document.documentElement.style.setProperty('--fs', S.fs + 'px');
  $('#fsRange').value = S.fs;
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === S.theme));
  $('#readerSel').value = S.reader;
  $('#contChk').checked = S.cont; $('#followChk').checked = S.follow;
  document.querySelectorAll('#rateSeg button').forEach(b => b.classList.toggle('on', +b.dataset.r === S.rate));
  document.querySelectorAll('#sleepSeg button').forEach(b => b.classList.toggle('on', +b.dataset.s === sleepMode));
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#000000' : '#ffffff';
}

function chapTitle(b, c){ return (b === 18 ? 'Псалом ' : 'Глава ') + (c + 1); }

function render(keepScroll){
  const {b, c, y} = slot(), bk = book(b), verses = bk.c[c];
  $('#loading').hidden = true;
  $('#title').innerHTML = `${bk.n}<br><span style="font-weight:400;font-size:.75em;color:var(--muted)">${chapTitle(b,c)}</span>`;
  const frag = document.createDocumentFragment();
  verses.forEach((t, i) => { const p = document.createElement('p'); p.id = 'v' + (i+1); const n = document.createElement('span'); n.className = 'n'; n.textContent = i+1; const v = document.createElement('span'); v.textContent = t; p.append(n, v); frag.appendChild(p); });
  const tx = $('#text'); tx.innerHTML = ''; tx.appendChild(frag);
  const en = $('#endnav'); en.innerHTML = '';
  if (c < bk.c.length - 1) {
    en.appendChild(btn(`${chapTitle(b, c+1)} →`, () => go(b, c+1)));
  } else {
    if (b < 65) en.appendChild(btn(`Далее: ${book(b+1).n} →`, () => go(b+1, 0)));
    en.appendChild(btn('Список книг', () => openBooks()));
  }
  renderBar();
  const r = $('#reader');
  requestAnimationFrame(() => { r.scrollTop = keepScroll ? y : 0; });
  if (!keepScroll) { slot().y = 0; save(); }
  syncAudioToChapter();
}

function btn(label, fn, cls){ const e = document.createElement('button'); e.textContent = label; e.onclick = fn; if (cls) e.className = cls; return e; }

function renderBar(){
  const sl = $('#slots'); sl.innerHTML = '';
  S.slots.forEach((s, i) => sl.appendChild(btn(`${book(s.b).a} ${s.c+1}`, () => switchSlot(i), i === S.active ? 'on' : '')));
  const {b, c} = slot();
  $('#current').textContent = `${book(b).n} ${c+1}`;
}

function go(b, c){ const s = slot(); s.b = b; s.c = c; s.y = 0; save(); closeSheet(); render(false); }
function switchSlot(i){ if (i === S.active) return; saveScroll(); S.active = i; save(); stopAudio(); render(true); }

let scrollT = 0;
function saveScroll(){ slot().y = Math.round($('#reader').scrollTop); save(); }
$('#reader').addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(saveScroll, 250); }, {passive:true});
window.addEventListener('pagehide', saveScroll);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveScroll(); });

/* Book and chapter picker */
function openSheet(title, back){ $('#sheet').hidden = false; $('#sheetTitle').textContent = title; $('#sheetBack').hidden = !back; $('#sheetBack').onclick = back || null; $('#sheetBody').scrollTop = 0; closePop(); }
function closeSheet(){ $('#sheet').hidden = true; }
$('#sheetClose').onclick = closeSheet;

function openBooks(){
  openSheet('Книги');
  const body = $('#sheetBody'); body.innerHTML = '';
  [['Ветхий Завет', 0, 39], ['Новый Завет', 39, 66]].forEach(([name, a, z]) => {
    const h = document.createElement('div'); h.className = 'sec'; h.textContent = name; body.appendChild(h);
    const g = document.createElement('div'); g.className = 'books';
    for (let i = a; i < z; i++) g.appendChild(btn(book(i).n, () => book(i).c.length === 1 ? go(i, 0) : openChapters(i), i === slot().b ? 'cur' : ''));
    body.appendChild(g);
  });
  const cur = body.querySelector('.cur'); if (cur) cur.scrollIntoView({block:'center'});
}
function openChapters(b){
  openSheet(book(b).n, openBooks);
  const body = $('#sheetBody'); body.innerHTML = '';
  const g = document.createElement('div'); g.className = 'chaps';
  book(b).c.forEach((_, c) => g.appendChild(btn(String(c+1), () => go(b, c), (b === slot().b && c === slot().c) ? 'cur' : '')));
  body.appendChild(g);
}
$('#current').onclick = openBooks;

/* Quick settings panel */
function closePop(){ $('#pop').hidden = true; }
$('#menuBtn').onclick = e => { e.stopPropagation(); $('#pop').hidden = !$('#pop').hidden; };
document.addEventListener('click', e => { if (!$('#pop').hidden && !$('#pop').contains(e.target) && e.target !== $('#menuBtn')) closePop(); });
$('#fsRange').oninput = e => { S.fs = +e.target.value; save(); applyPrefs(); };
document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => { S.theme = b.dataset.t; save(); applyPrefs(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);
$('#readerSel').onchange = e => { const was = !audio.paused; S.reader = e.target.value; save(); loadAudio(); if (was) audio.play().catch(()=>{}); };
$('#aboutBtn').onclick = () => {
  openSheet('О приложении');
  $('#sheetBody').innerHTML = `<div class="credits"><p><b>Текст:</b> Синодальный перевод (1876), общественное достояние. Источник: The Unbound Bible (Biola University).</p>
  <p><b>Аудио:</b> Игорь Козлов, издательство «Благовестник» (распространяется свободно); файлы: Hugging Face, enochlev/russian-synodal-bible-kozlov.</p>
  <p><b>Аудио:</b> А. Ф. Ефимов, «Благовестник»; файлы: The Audio Power (theaudiopower.org).</p>
  <p>Аудио воспроизводится через интернет.</p></div>`;
};

/* Audio */
const audio = $('#audio');
let audioKey = '';
function audioURL(b, c){
  const bk = book(b);
  if (S.reader === 'efimov') {
    const name = bk.c.length === 1 ? bk.e : `${bk.e} ${c+1}`;
    return 'https://theaudiopower.org/RUSV/Recordings/' + encodeURIComponent(name) + '.mp3';
  }
  return `https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov/resolve/main/a1/kozlov/${bk.o}/${c+1}.m4a`;
}
function loadAudio(){ const {b, c} = slot(); audioKey = S.reader + ':' + b + ':' + c; audio.src = audioURL(b, c); audio.load(); clearHL(); }
function stopAudio(){ audio.pause(); $('#audioBtn').textContent = '▶'; document.body.classList.remove('playing'); $('#player').hidden = true; clearHL(); }
function syncAudioToChapter(){ const {b, c} = slot(); if (!$('#player').hidden && audioKey !== S.reader + ':' + b + ':' + c) { const was = !audio.paused || autoNext; autoNext = false; loadAudio(); if (was) audio.play().catch(()=>{}); } }
let autoNext = false;
$('#audioBtn').onclick = () => {
  closePop();
  if (!$('#player').hidden && !audio.paused) { audio.pause(); return; }
  $('#player').hidden = false; document.body.classList.add('playing');
  const {b, c} = slot();
  if (audioKey !== S.reader + ':' + b + ':' + c) loadAudio();
  audio.play().catch(()=>{});
};
$('#pStop').onclick = stopAudio;
$('#pBack').onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 15); };
let sleepMode = 0, sleepT = null;
function setSleep(m){ sleepMode = m; clearTimeout(sleepT); if (m > 0) sleepT = setTimeout(() => { audio.pause(); sleepMode = 0; applyPrefs(); }, m * 60000); applyPrefs(); }
document.querySelectorAll('#sleepSeg button').forEach(b => b.onclick = () => setSleep(+b.dataset.s));
document.querySelectorAll('#rateSeg button').forEach(b => b.onclick = () => { S.rate = +b.dataset.r; audio.defaultPlaybackRate = audio.playbackRate = S.rate; save(); applyPrefs(); });
$('#contChk').onchange = e => { S.cont = e.target.checked; save(); };
$('#followChk').onchange = e => { S.follow = e.target.checked; save(); if (!S.follow) clearHL(); };
audio.onplay = () => { audio.playbackRate = S.rate; $('#audioBtn').textContent = '❚❚'; };
audio.onpause = () => { $('#audioBtn').textContent = '▶'; };
audio.onerror = () => { $('#pTime').textContent = 'нет аудио'; };
const fmt = t => isFinite(t) ? Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0') : '0:00';
let seeking = false;
$('#pSeek').oninput = () => { seeking = true; };
$('#pSeek').onchange = e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; seeking = false; };
audio.ontimeupdate = () => {
  if (!seeking && audio.duration) $('#pSeek').value = Math.round(audio.currentTime / audio.duration * 1000);
  $('#pTime').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
  highlight();
};
audio.onended = () => {
  const {b, c} = slot();
  if (sleepMode === -1) { setSleep(0); $('#audioBtn').textContent = '▶'; return; }
  if (!S.cont) return;
  if (c < book(b).c.length - 1) { autoNext = true; go(b, c+1); }
  else if (b < 65) { autoNext = true; go(b+1, 0); }
};
let hlIdx = -1;
function clearHL(){ const p = document.querySelector('#text p.hl'); if (p) p.classList.remove('hl'); hlIdx = -1; }
function highlight(){
  if (!S.follow || S.reader !== 'kozlov' || audio.paused) return;
  const {b, c} = slot(), k = book(b).o + '.' + (c+1), st = TIMES[k];
  if (!st || st.length !== book(b).c[c].length) return;
  const ms = audio.currentTime * 1000; let i = -1;
  for (let j = 0; j < st.length; j++) { if (st[j] <= ms) i = j; else break; }
  if (i === hlIdx) return;
  clearHL(); hlIdx = i;
  if (i >= 0) { const p = $('#v' + (i+1)); p.classList.add('hl'); const r = $('#reader'), top = p.offsetTop - r.clientHeight / 3; if (Math.abs(r.scrollTop - top) > r.clientHeight / 3) r.scrollTo({top, behavior:'smooth'}); }
}

/* Start */
applyPrefs();
fetch('data/bible.json').then(r => r.json()).then(d => { BIBLE = d; render(true); });
fetch('data/kozlov_timings.json').then(r => r.json()).then(d => { TIMES = d; }).catch(()=>{});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
