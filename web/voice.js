'use strict';
/**
 * Voice command parser for the Synodal Bible PWA.
 * Pure functions — unit-testable in Node. Recognition UI lives in app.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BibleVoice = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const RU_NUM = {
    ноль:0, нуль:0,
    один:1, одна:1, одно:1, первого:1, первый:1, первая:1, первое:1,
    два:2, две:2, второго:2, второй:2, вторая:2, второе:2,
    три:3, трех:3, трёх:3, третьего:3, третий:3, третья:3, третье:3,
    четыре:4, четырех:4, четырёх:4, четвертого:4, четвертый:4, четвертая:4,
    пять:5, пятого:5, пятый:5, пятая:5,
    шесть:6, шестого:6, шестой:6, шестая:6,
    семь:7, седьмого:7, седьмой:7, седьмая:7,
    восемь:8, восьмого:8, восьмой:8, восьмая:8,
    девять:9, девятого:9, девятый:9, девятая:9,
    десять:10, десятого:10, десятый:10, десятая:10,
    одиннадцать:11, двенадцать:12, тринадцать:13, четырнадцать:14, четырнадцать:14,
    пятнадцать:15, шестнадцать:16, семнадцать:17, восемнадцать:18, девятнадцать:19,
    двадцать:20, тридцать:30, сорок:40, пятьдесят:50, шестьдесят:60,
    семьдесят:70, восемьдесят:80, девяносто:90, сто:100, двести:200
  };
  const EN_NUM = {
    zero:0, one:1, first:1, two:2, second:2, three:3, third:3, four:4, fourth:4,
    five:5, fifth:5, six:6, sixth:6, seven:7, seventh:7, eight:8, eighth:8,
    nine:9, ninth:9, ten:10, tenth:10, eleven:11, twelve:12, thirteen:13,
    fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
    twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100
  };

  function parseNumberWords(tokens, i) {
    /* Parse digit or number-words starting at tokens[i]; return {n, next} or null */
    if (i >= tokens.length) return null;
    const t = tokens[i];
    if (/^\d{1,3}$/.test(t)) return { n: +t, next: i + 1 };
    const ru = RU_NUM[t], en = EN_NUM[t];
    if (ru == null && en == null) return null;
    let n = ru != null ? ru : en;
    let j = i + 1;
    /* compound: twenty three / двадцать три */
    if (j < tokens.length) {
      const t2 = tokens[j];
      const ru2 = RU_NUM[t2], en2 = EN_NUM[t2];
      if ((n >= 20 && n % 10 === 0 && n < 100) && ((ru2 != null && ru2 < 10) || (en2 != null && en2 < 10))) {
        n += (ru2 != null ? ru2 : en2);
        j++;
      }
    }
    return { n, next: j };
  }

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[«»""„]/g, '')
      .replace(/[.,!?;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bookAliases(books) {
    /* books: [{n,a,e,o, en?}] — build searchable list */
    const list = [];
    books.forEach((bk, i) => {
      const names = new Set();
      [bk.n, bk.a, bk.e, bk.o, bk.en].forEach(x => { if (x) names.add(norm(x)); });
      /* common spoken variants */
      const extras = EXTRA[bk.o] || [];
      extras.forEach(x => names.add(norm(x)));
      list.push({ i, names: [...names], n: bk.n });
    });
    return list;
  }

  const EXTRA = {
    Gen: ['бытие', 'genesis'],
    Exod: ['исход', 'exodus'],
    Lev: ['левит', 'leviticus'],
    Num: ['числа', 'numbers'],
    Deut: ['второзаконие', 'deuteronomy'],
    Josh: ['исус навин', 'навин', 'joshua'],
    Judg: ['судьи', 'книга судей', 'judges'],
    Ruth: ['руфь', 'ruth'],
    '1Sam': ['1 царств', 'первая царств', '1 samuel', 'first samuel'],
    '2Sam': ['2 царств', 'вторая царств', '2 samuel'],
    '1Kgs': ['3 царств', '1 kings', '3-я царств'],
    '2Kgs': ['4 царств', '2 kings'],
    '1Chr': ['1 паралипоменон', '1 chronicles'],
    '2Chr': ['2 паралипоменон', '2 chronicles'],
    Ezra: ['ездра', 'ezra'],
    Neh: ['неемия', 'nehemiah'],
    Esth: ['есфирь', 'esther'],
    Job: ['иов', 'job'],
    Ps: ['псалтирь', 'псалом', 'псалмы', 'psalm', 'psalms'],
    Prov: ['притчи', 'proverbs'],
    Eccl: ['екклесиаст', 'ecclesiastes'],
    Song: ['песнь песней', 'песни песней', 'song of solomon', 'song of songs'],
    Isa: ['исаия', 'isaiah'],
    Jer: ['иеремия', 'jeremiah'],
    Lam: ['плач иеремии', 'плач', 'lamentations'],
    Ezek: ['иезекииль', 'ezekiel'],
    Dan: ['даниил', 'daniel'],
    Hos: ['осия', 'hosea'],
    Joel: ['иоиль', 'joel'],
    Amos: ['амос', 'amos'],
    Obad: ['авдия', 'obadiah'],
    Jonah: ['иона', 'jonah'],
    Mic: ['михей', 'micah'],
    Nah: ['наум', 'nahum'],
    Hab: ['аваакум', 'аввакум', 'habakkuk'],
    Zeph: ['софония', 'zephaniah'],
    Hag: ['аггей', 'haggai'],
    Zech: ['захария', 'zechariah'],
    Mal: ['малахия', 'malachi'],
    Matt: ['матфея', 'от матфея', 'матфей', 'matthew'],
    Mark: ['марка', 'от марка', 'марке', 'mark'],
    Luke: ['луки', 'от луки', 'лука', 'luke'],
    John: ['иоанна', 'от иоанна', 'иоанн', 'john'],
    Acts: ['деяния', 'acts'],
    Rom: ['римлянам', 'к римлянам', 'romans'],
    '1Cor': ['1 коринфянам', '1-е коринфянам', '1 corinthians'],
    '2Cor': ['2 коринфянам', '2 corinthians'],
    Gal: ['галатам', 'galatians'],
    Eph: ['ефесянам', 'ephesians'],
    Phil: ['филиппийцам', 'philippians'],
    Col: ['колоссянам', 'colossians'],
    '1Thess': ['1 фессалоникийцам', '1 thessalonians'],
    '2Thess': ['2 фессалоникийцам', '2 thessalonians'],
    '1Tim': ['1 тимофею', '1 timothy'],
    '2Tim': ['2 тимофею', '2 timothy'],
    Titus: ['титу', 'titus'],
    Phlm: ['филимону', 'philemon'],
    Heb: ['евреям', 'hebrews'],
    Jas: ['иакова', 'james'],
    '1Pet': ['1 петра', '1 peter'],
    '2Pet': ['2 петра', '2 peter'],
    '1John': ['1 иоанна', '1 john'],
    '2John': ['2 иоанна', '2 john'],
    '3John': ['3 иоанна', '3 john'],
    Jude: ['иуда', 'иуды', 'jude'],
    Rev: ['откровение', 'апокалипсис', 'revelation']
  };

  function fuzzyBook(text, aliases) {
    /* Find best book whose alias is contained in text or vice versa */
    const t = norm(text);
    let best = null, bestScore = 0;
    for (const bk of aliases) {
      for (const name of bk.names) {
        if (!name) continue;
        if (t === name) return { i: bk.i, score: 100, name };
        if (t.startsWith(name + ' ') || t.includes(' ' + name + ' ') || t.endsWith(' ' + name)) {
          const score = name.length;
          if (score > bestScore) { bestScore = score; best = { i: bk.i, score, name }; }
        }
        /* fuzzy: alias contained as prefix of a token sequence */
        if (name.length >= 4 && t.includes(name)) {
          const score = name.length;
          if (score > bestScore) { bestScore = score; best = { i: bk.i, score, name }; }
        }
      }
    }
    return best;
  }

  /** Command table — easy to extend */
  const COMMANDS = [
    { id: 'next', re: /^(следующ\w*(\s+\w+)?|дальше|вперед|вперёд|next(\s+chapter)?)$/i, action: 'next' },
    { id: 'prev', re: /^(предыдущ\w*(\s+\w+)?|назад|прежде|previous(\s+chapter)?|back|prev)$/i, action: 'prev' },
    { id: 'play', re: /^(читай|читать|играй|играть|плей|play|start|продолж\w*)$/i, action: 'play' },
    { id: 'stop', re: /^(стоп|пауза|останови|остановить|stop|pause)$/i, action: 'stop' },
    { id: 'books', re: /^(книги|книга|список(\s+книг)?|books?|picker)$/i, action: 'books' }
  ];

  function parseNavPhrase(text, aliases) {
    /* «Иоанна 3», «от Иоанна глава три», «Псалом 22 стих 4», "John 3:16" */
    let t = norm(text);
    /* Avoid \\b with Cyrillic — JS word boundaries are ASCII-only. */
    t = t.replace(/(^|\s)(глава|главу|главе|chapter)(?=\s|$)/g, ' ')
         .replace(/(^|\s)(псалом|psalm)(?=\s|$)/g, ' псалтирь ')
         .replace(/(^|\s)(стих\w*|verse)(?=\s|$)/g, ' verse ')
         .replace(/:/g, ' verse ')
         .replace(/\s+/g, ' ').trim();

    const hit = fuzzyBook(t, aliases);
    if (!hit) return null;
    /* strip book name from start-ish */
    let rest = t;
    const ni = rest.indexOf(hit.name);
    if (ni >= 0) rest = (rest.slice(0, ni) + ' ' + rest.slice(ni + hit.name.length)).trim();
    rest = rest.replace(/^(от|from)\s+/, '');
    const tokens = rest.split(/\s+/).filter(Boolean);
    let i = 0;
    /* skip filler */
    while (i < tokens.length && /^(от|глава|главу|chapter)$/.test(tokens[i])) i++;
    const ch = parseNumberWords(tokens, i);
    if (!ch) return null;
    i = ch.next;
    let verse = null;
    while (i < tokens.length && tokens[i] === 'verse') i++;
    const vs = parseNumberWords(tokens, i);
    if (vs) verse = vs.n;
    return { action: 'go', book: hit.i, chapter: ch.n, verse: verse };
  }

  /**
   * @param {string} utterance
   * @param {{books: Array<{n,a,e,o,en?}>}} ctx
   * @returns {{action:string, book?:number, chapter?:number, verse?:number|null, raw:string} | {action:'unknown', raw:string}}
   */
  function parse(utterance, ctx) {
    const raw = String(utterance || '').trim();
    const t = norm(raw);
    if (!t) return { action: 'unknown', raw };

    for (const cmd of COMMANDS) {
      if (cmd.re.test(t)) return { action: cmd.action, raw };
    }
    /* Cyrillic-friendly fallbacks (\\b is ASCII-only in JS) */
    if (/^следующ/.test(t) || t === 'дальше' || t === 'вперед' || t === 'вперёд') return { action: 'next', raw };
    if (/^предыдущ/.test(t) || t === 'назад' || t === 'прежде') return { action: 'prev', raw };
    if (/^(читай|читать|играй|играть)/.test(t)) return { action: 'play', raw };
    if (/^(стоп|пауза|останови)/.test(t)) return { action: 'stop', raw };
    if (/^(книги|книга)\b/.test(t) || t === 'книги' || t.startsWith('список')) return { action: 'books', raw };

    const aliases = bookAliases(ctx.books || []);
    const nav = parseNavPhrase(raw, aliases);
    if (nav) return Object.assign({ raw }, nav);

    return { action: 'unknown', raw };
  }

  return { parse, parseNumberWords, norm, COMMANDS, EXTRA, bookAliases, fuzzyBook };
});
