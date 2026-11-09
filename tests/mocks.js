/* Injected before app scripts (evaluateOnNewDocument). Replaces the media element with a
   deterministic fake that follows Chrome's event order, and fakes Wake Lock + sendBeacon. */
module.exports = function installMocks(){
  const AM = window.__AM = { loadDelay: 40, duration: 300, tick: 50, scale: 1, failRe: null, log: [], plays: 0, pauses: 0 };
  const P = HTMLMediaElement.prototype;
  const st = el => el.__m || (el.__m = { src: '', paused: true, t: 0, dur: NaN, rs: 0, rate: 1, drate: 1, gen: 0, timer: null, pendingT: null, waiters: [] });
  const fire = (el, n) => { AM.log.push(n); el.dispatchEvent(new Event(n)); };
  const stopTick = m => { clearInterval(m.timer); m.timer = null; };
  function startTick(el){
    const m = st(el); stopTick(m);
    m.timer = setInterval(() => {
      if (m.paused) { stopTick(m); return; }
      m.t = Math.min(m.dur, m.t + AM.tick / 1000 * m.rate * AM.scale);
      fire(el, 'timeupdate');
      if (m.t >= m.dur) { stopTick(m); m.paused = true; AM.pauses++; fire(el, 'pause'); fire(el, 'ended'); }
    }, AM.tick);
  }
  function doLoad(el){
    const m = st(el);
    m.gen++; stopTick(m);
    m.waiters.forEach(w => w.reject(new DOMException('aborted', 'AbortError'))); m.waiters = [];
    m.paused = true; m.rs = 0; m.t = 0; m.dur = NaN; el.__err = null;
    const g = m.gen;
    setTimeout(() => fire(el, 'emptied'), 0);
    if (!m.src) return;
    setTimeout(() => {
      if (g !== m.gen) return;
      if (AM.failRe && AM.failRe.test(m.src)) { el.__err = { code: 4 }; fire(el, 'error'); return; }
      m.dur = AM.duration; m.rs = 4;
      if (m.pendingT != null) { m.t = Math.min(m.dur, m.pendingT); m.pendingT = null; }
      fire(el, 'loadedmetadata'); fire(el, 'canplay');
      const ws = m.waiters; m.waiters = [];
      ws.forEach(w => { if (!m.paused) { startTick(el); fire(el, 'playing'); } w.resolve(); });
    }, AM.loadDelay);
  }
  const def = (k, get, set) => Object.defineProperty(P, k, { configurable: true, get, set });
  def('src', function(){ return st(this).src; }, function(v){ st(this).src = v ? new URL(v, location.href).href : ''; this.setAttribute('src', v || ''); doLoad(this); });
  P.load = function(){ doLoad(this); };
  def('paused', function(){ return st(this).paused; });
  def('readyState', function(){ return st(this).rs; });
  def('duration', function(){ return st(this).dur; });
  def('error', function(){ return this.__err || null; });
  def('playbackRate', function(){ return st(this).rate; }, function(v){ st(this).rate = +v; });
  def('defaultPlaybackRate', function(){ return st(this).drate; }, function(v){ st(this).drate = +v; });
  def('currentTime', function(){ return st(this).t; }, function(v){
    const m = st(this); v = Math.max(0, +v || 0);
    if (m.rs === 0) { m.pendingT = v; return; }
    m.t = Math.min(m.dur, v);
    fire(this, 'seeking');
    setTimeout(() => { fire(this, 'seeked'); fire(this, 'timeupdate'); }, 10);
  });
  P.play = function(){
    const m = st(this), el = this;
    if (!m.src) return Promise.reject(new DOMException('no src', 'NotSupportedError'));
    if (m.rs >= 1 && m.t >= m.dur) m.t = 0;
    const was = m.paused;
    if (was) { m.paused = false; AM.plays++; setTimeout(() => fire(el, 'play'), 0); }
    if (m.rs >= 1) { if (was) { startTick(el); setTimeout(() => fire(el, 'playing'), 0); } return Promise.resolve(); }
    return new Promise((resolve, reject) => m.waiters.push({ resolve, reject }));
  };
  P.pause = function(){
    const m = st(this);
    if (m.paused) return;
    m.paused = true; stopTick(m); AM.pauses++;
    setTimeout(() => fire(this, 'pause'), 0);
  };
  AM.toEnd = (left) => { const a = document.querySelector('#audio'), m = st(a); m.t = Math.max(0, m.dur - (left || 0.1)); };

  /* Wake Lock: resolves after a delay so a burst of requests overlaps */
  const WL = window.__WL = { active: new Set(), requests: 0, delay: 30 };
  const wl = { request: () => { WL.requests++; return new Promise(r => setTimeout(() => {
    const s = new EventTarget(); s.released = false; s.type = 'screen';
    s.release = () => { if (!s.released) { s.released = true; WL.active.delete(s); s.dispatchEvent(new Event('release')); } return Promise.resolve(); };
    WL.active.add(s); r(s);
  }, WL.delay)); } };
  Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => wl });

  window.__beacons = [];
  navigator.sendBeacon = (url, body) => { window.__beacons.push(String(url)); return true; };
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => window.__errors.push('rej:' + String(e.reason && e.reason.message || e.reason)));
};
