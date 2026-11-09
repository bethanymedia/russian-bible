'use strict';
const $ = s => document.querySelector(s);
const KEY = 'rb_state_v1';
const DEF = { active: 0, slots: [{b:0,c:0,y:0},{b:18,c:22,y:0},{b:42,c:0,y:0}], fs: 20, theme: 'dark', reader: 'kozlov', cont: true, rate: 1, follow: true, lang: 'ru', tr: 'web', trAll: false };
let S = load(), BIBLE = null, TIMES = {}, timesOK = false;

function load(){ try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.slots && s.slots.length === 3) return Object.assign({}, DEF, s); } catch(e){} return JSON.parse(JSON.stringify(DEF)); }
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
const T = {
 ru:{size:'Размер текста',theme:'Тема',light:'Светлая',dark:'Тёмная',auto:'Авто',reader:'Чтец (аудио)',speed:'Скорость',sleep:'Таймер сна',off:'Выкл',m15:'15 м',m30:'30 м',m60:'60 м',chEnd:'Глава',cont:'Продолжать со следующей главы',follow:'Следить за стихом (Козлов)',trl:'Перевод (нажмите на стих)',about:'О приложении',back:'‹ Назад',done:'Готово',books:'Книги',list:'Список книг',noaudio:'нет аудио',
  credits:'<p><b>Текст:</b> Синодальный перевод (1876), общественное достояние. Источник: The Unbound Bible (Biola University).</p><p><b>Аудио:</b> Игорь Козлов, издательство «Благовестник» (распространяется свободно); файлы: Hugging Face, enochlev/russian-synodal-bible-kozlov.</p><p><b>Аудио:</b> А. Ф. Ефимов, «Благовестник»; файлы: The Audio Power (theaudiopower.org).</p><p>Аудио воспроизводится через интернет.</p><p><b>Перевод:</b> World English Bible, общественное достояние (ebible.org).</p>'},
 en:{size:'Text size',theme:'Theme',light:'Light',dark:'Dark',auto:'Auto',reader:'Reader (audio)',speed:'Speed',sleep:'Sleep timer',off:'Off',m15:'15 m',m30:'30 m',m60:'60 m',chEnd:'Chapter',cont:'Continue to next chapter',follow:'Follow the verse (Kozlov)',trl:'Translation (tap a verse)',about:'About',back:'‹ Back',done:'Done',books:'Books',list:'Book list',noaudio:'no audio',
  credits:'<p><b>Text:</b> Russian Synodal Translation (1876), public domain. Source: The Unbound Bible (Biola University).</p><p><b>Audio:</b> Igor Kozlov, Blagovestnik publishers (freely distributed); files: Hugging Face, enochlev/russian-synodal-bible-kozlov.</p><p><b>Audio:</b> A. F. Efimov, Blagovestnik; files: The Audio Power (theaudiopower.org).</p><p>Audio streams over the internet.</p><p><b>Translation:</b> World English Bible, public domain (ebible.org).</p>'}};
const t = k => (T[S.lang] || T.ru)[k];
const TRS = [{id:'web', file:'data/web.json', label:'English (WEB)'}]; // add more translations here later
const TRD = {};
function trData(){ const d = TRD[S.tr]; if (d) return Promise.resolve(d); const m = TRS.find(x => x.id === S.tr) || TRS[0]; return fetch(m.file).then(r => r.json()).then(j => (TRD[m.id] = j)); }
const slot = () => S.slots[S.active];
const book = i => BIBLE.books[i];

function applyPrefs(){
  document.documentElement.dataset.theme = S.theme;
  document.documentElement.style.setProperty('--fs', S.fs + 'px');
  $('#fsRange').value = S.fs;
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === S.theme));
  $('#readerSel').value = S.reader; if ($('#trSel').options.length) $('#trSel').value = S.tr;
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  document.querySelectorAll('#langSeg button').forEach(b => b.classList.toggle('on', b.dataset.l === S.lang));
  $('#contChk').checked = S.cont; $('#followChk').checked = S.follow;
  document.querySelectorAll('#rateSeg button').forEach(b => b.classList.toggle('on', +b.dataset.r === S.rate));
  document.querySelectorAll('#sleepSeg button').forEach(b => b.classList.toggle('on', +b.dataset.s === sleepMode));
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#000000' : '#ffffff';
}

function addTr(p, i, d){ if (p.querySelector('.tr')) return; const {b, c} = slot(); const s = (d.c[b] && d.c[b][c] && d.c[b][c][i]) || '—'; const e = document.createElement('span'); e.className = 'tr'; e.textContent = s; p.appendChild(e); }
function toggleVerse(p, i){ if (window.getSelection && String(getSelection()).length) return; const ex = p.querySelector('.tr'); if (ex) { ex.remove(); return; } trData().then(d => addTr(p, i, d)).catch(() => {}); }
function showAll(){ trData().then(d => { if (!S.trAll) return; document.querySelectorAll('#text p').forEach((p, i) => addTr(p, i, d)); }).catch(() => {}); }
function hideAll(){ document.querySelectorAll('#text .tr').forEach(e => e.remove()); }
function chapTitle(b, c){ return (b === 18 ? 'Псалом ' : 'Глава ') + (c + 1); }

function render(keepScroll){
  const {b, c, y} = slot(), bk = book(b), verses = bk.c[c];
  $('#loading').hidden = true;
  $('#title').innerHTML = `${bk.n}<br><span style="font-weight:400;font-size:.75em;color:var(--muted)">${chapTitle(b,c)}</span>`;
  const frag = document.createDocumentFragment();
  verses.forEach((t, i) => { const p = document.createElement('p'); p.id = 'v' + (i+1); const n = document.createElement('span'); n.className = 'n'; n.textContent = i+1; const v = document.createElement('span'); v.textContent = t; p.append(n, v); p.onclick = () => toggleVerse(p, i); frag.appendChild(p); });
  const tx = $('#text'); tx.innerHTML = ''; tx.appendChild(frag);
  $('#trBtn').classList.toggle('on', S.trAll); if (S.trAll) showAll();
  const en = $('#endnav'); en.innerHTML = '';
  if (c < bk.c.length - 1) {
    en.appendChild(btn(`${chapTitle(b, c+1)} →`, () => go(b, c+1)));
  } else {
    if (b < 65) en.appendChild(btn(`Далее: ${book(b+1).n} →`, () => go(b+1, 0)));
    en.appendChild(btn(t('list'), () => openBooks()));
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
  openSheet(t('books'));
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
document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => { S.lang = b.dataset.l; save(); applyPrefs(); if (BIBLE) render(true); });
$('#trBtn').onclick = () => { S.trAll = !S.trAll; save(); $('#trBtn').classList.toggle('on', S.trAll); S.trAll ? showAll() : hideAll(); };
$('#trSel').innerHTML = TRS.map(x => `<option value="${x.id}">${x.label}</option>`).join('');
$('#trSel').onchange = e => { S.tr = e.target.value; save(); hideAll(); if (S.trAll) showAll(); };
$('#fsRange').oninput = e => { S.fs = +e.target.value; save(); applyPrefs(); };
document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => { S.theme = b.dataset.t; save(); applyPrefs(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);
$('#readerSel').onchange = e => { const was = !audio.paused; S.reader = e.target.value; save(); loadAudio(); if (was) audio.play().catch(()=>{}); };
$('#aboutBtn').onclick = () => {
  openSheet(t('about'));
  $('#sheetBody').innerHTML = '<div class="credits">' + t('credits') + '</div>';
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
audio.onerror = () => { $('#pTime').textContent = t('noaudio'); };
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
