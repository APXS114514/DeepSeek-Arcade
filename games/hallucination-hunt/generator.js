/* ============================================================
 * HALLUCINATION HUNT — Round Generator + Content Validator
 *
 *   Generator -> Mutator -> Validator -> Valid Round
 *
 * 关键约定：
 *   - 同一个 seed（+ load + lang）必须产出**完全相同**的 Round；
 *   - Validator 不合格就 reject，然后用**同一条 RNG stream** 继续生成；
 *   - 重试有上限，超过就用安全 fallback round，绝不进入死循环；
 *   - 核心生成路径不碰 Math.random()。
 * ============================================================ */
(function (global) {
  'use strict';

  var RNG = global.HuntRNG;
  var MUT = global.HuntMutators;

  /* ---------------- LOAD 规则（难度定义，与文档一致） ---------------- */
  var LOAD_RULES = {
    1: { claims: [2, 3], hall: [1, 1], scanMs: 22000, allowNone: false, noneChance: 0 },
    2: { claims: [3, 3], hall: [1, 1], scanMs: 19000, allowNone: false, noneChance: 0 },
    3: { claims: [3, 4], hall: [1, 1], scanMs: 16000, allowNone: true, noneChance: 0.18 },
    4: { claims: [4, 5], hall: [1, 2], scanMs: 13500, allowNone: true, noneChance: 0.22 },
    5: { claims: [5, 6], hall: [1, 2], scanMs: 11000, allowNone: true, noneChance: 0.25 }
  };
  var MAX_ATTEMPTS = 24;
  var RECENT_LIMIT = 12;
  var MAX_CLAIMS = 6;

  var QUERIES = {
    zh: ['介绍一下 {topic}。', '关于 {topic}，说几个关键事实。', '用几句话讲讲 {topic}。'],
    en: ['Tell me about {topic}.', 'Give me a few key facts about {topic}.', 'Summarise {topic} in a few sentences.']
  };

  /* 内容库缺失或不可用时的安全兜底（保证游戏永远能开起来） */
  var FALLBACK_FACTS = [
    {
      id: 'fallback-geo-canada', category: 'geography', type: 'relation', baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica', sourceUrl: 'https://www.britannica.com/place/Ottawa',
      checked: '2026-10-01',
      zh: { topic: '加拿大', claims: [
        { t: '{subject}的首都是{value}。', s: { subject: '加拿大', value: '渥太华' }, alt: ['多伦多', '温哥华'] },
        { t: '{subject}位于北美洲北部。', s: { subject: '加拿大' } },
        { t: '{subject}是世界上面积第二大的国家。', s: { subject: '加拿大' } },
        { t: '{subject}的国旗上有一片枫叶。', s: { subject: '加拿大' } },
        { t: '{subject}濒临大西洋、太平洋和北冰洋。', s: { subject: '加拿大' } }
      ], explanation: '渥太华是加拿大的首都。' },
      en: { topic: 'Canada', claims: [
        { t: 'The capital of {subject} is {value}.', s: { subject: 'Canada', value: 'Ottawa' }, alt: ['Toronto', 'Vancouver'] },
        { t: '{subject} is located in the northern part of North America.', s: { subject: 'Canada' } },
        { t: '{subject} is the second-largest country in the world by area.', s: { subject: 'Canada' } },
        { t: 'The flag of {subject} features a maple leaf.', s: { subject: 'Canada' } },
        { t: '{subject} borders the Atlantic, Pacific and Arctic oceans.', s: { subject: 'Canada' } }
      ], explanation: 'Ottawa is the capital of Canada.' }
    },
    {
      id: 'fallback-space-mars', category: 'space', type: 'attribute', baseDifficulty: 1,
      sourceName: 'NASA', sourceUrl: 'https://science.nasa.gov/mars/',
      checked: '2026-10-01',
      zh: { topic: '火星', claims: [
        { t: '{subject}常被称为{value}。', s: { subject: '火星', value: '红色星球' }, alt: ['蓝色星球', '绿色星球'] },
        { t: '{subject}是离太阳第四近的行星。', s: { subject: '火星' } },
        { t: '{subject}有两颗天然卫星。', s: { subject: '火星' } },
        { t: '{subject}上的一天比地球上的一天略长。', s: { subject: '火星' } },
        { t: '{subject}拥有太阳系中最高的火山。', s: { subject: '火星' } }
      ], explanation: '火星因表面富含氧化铁而呈红色，被称为红色星球。' },
      en: { topic: 'Mars', claims: [
        { t: '{subject} is commonly called the {value}.', s: { subject: 'Mars', value: 'Red Planet' }, alt: ['Blue Planet', 'Green Planet'] },
        { t: '{subject} is the fourth planet from the Sun.', s: { subject: 'Mars' } },
        { t: '{subject} has two natural satellites.', s: { subject: 'Mars' } },
        { t: 'A day on {subject} is slightly longer than a day on Earth.', s: { subject: 'Mars' } },
        { t: '{subject} is home to the tallest volcano in the solar system.', s: { subject: 'Mars' } }
      ], explanation: 'Iron oxides on the surface give Mars its red colour.' }
    }
  ];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clampLoad(v) { var n = Math.round(Number(v)); return (!isFinite(n) || n < 1) ? 1 : (n > 5 ? 5 : n); }
  function normLang(l) { return l === 'en' ? 'en' : 'zh'; }
  function toSeed(s) { return (typeof s === 'number' && isFinite(s)) ? (s >>> 0) : RNG.hashString(String(s)); }

  /* ---------------- 内容库访问 ---------------- */
  function allFacts() {
    var c = global.HuntContent;
    var f = c && c.facts;
    return (f && f.length) ? f : FALLBACK_FACTS;
  }
  function sideOf(fact, lang) {
    if (!fact) return null;
    return fact[lang] || fact.en || fact.zh || null;
  }
  function usable(fact) {
    if (!fact || !fact.id) return false;
    var zh = sideOf(fact, 'zh'), en = sideOf(fact, 'en');
    if (!zh || !en || !zh.claims || !en.claims) return false;
    if (zh.claims.length < 2 || en.claims.length < 2) return false;
    /* 至少要有一条能造 hallucination 的 claim */
    var ok = false;
    for (var i = 0; i < zh.claims.length; i++) {
      var c = zh.claims[i];
      if (!c || !c.t || !c.s) continue;
      if (MUT.valueSlot(c) && c.alt && c.alt.length) ok = true;
      if (c.num && c.s.n !== undefined) ok = true;
    }
    return ok;
  }
  function claimCount(f) {
    var zh = sideOf(f, 'zh'), en = sideOf(f, 'en');
    var a = (zh && zh.claims) ? zh.claims.length : 0;
    var b = (en && en.claims) ? en.claims.length : 0;
    return Math.min(a, b);
  }
  /* minClaims：LOAD 越高要求的 claim 越多，必须挑一条撑得住的 Fact */
  function pickFact(rng, recent, minClaims) {
    var pool = allFacts().filter(usable);
    if (!pool.length) pool = FALLBACK_FACTS.slice();
    var need = Math.max(2, minClaims || 2);
    var big = pool.filter(function (f) { return claimCount(f) >= need; });
    if (big.length) pool = big;
    var rec = recent || [];
    var fresh = pool.filter(function (f) { return rec.indexOf(f.id) < 0; });
    return rng.pick(fresh.length ? fresh : pool);
  }

  /* ---------------- 单次尝试 ---------------- */
  function mutateClaim(rng, fact, claim, load, lang) {
    /* CONTRADICTION 会往回答里追加一条没有 src 的 claim，这里必须挡住 */
    if (!claim || !claim.src) return null;
    var pool = MUT.MUTATORS.filter(function (m) {
      if (m.minLoad > load) return false;
      try { return !!m.canApply(fact, claim.src, lang); } catch (e) { return false; }
    });
    if (!pool.length) return null;
    var order = rng.shuffle(pool);
    for (var i = 0; i < order.length; i++) {
      var r = null;
      try { r = order[i].apply(claim.src, rng, lang); } catch (e) { r = null; }
      if (r && typeof r.text === 'string' && r.text && r.text !== claim.canonical) return r;
    }
    return null;
  }

  function attemptRound(rng, seed, load, lang, opts) {
    opts = opts || {};
    var rules = LOAD_RULES[load] || LOAD_RULES[1];
    var fact = pickFact(rng, opts.recent, rules.claims[0]);
    var L = sideOf(fact, lang);
    if (!fact || !L || !L.claims || L.claims.length < 2) return null;

    var want = rng.int(rules.claims[0], rules.claims[1]);
    var take = Math.min(want, L.claims.length);
    var idx = rng.shuffle(L.claims.map(function (_, i) { return i; })).slice(0, take)
      .sort(function (a, b) { return a - b; });

    var claims = idx.map(function (i) {
      var c = L.claims[i];
      var text = MUT.render(c.t, c.s);
      return { src: c, text: text, canonical: text, isHallucination: false,
        mutationType: null, original: null, replacement: null };
    });

    var wantNone = rules.allowNone && rng.next() < rules.noneChance;
    var hallCount = wantNone ? 0 : rng.int(rules.hall[0], rules.hall[1]);
    hallCount = Math.min(hallCount, claims.length);
    if (!rules.allowNone) hallCount = Math.max(1, hallCount);

    var used = [];
    var contradictory = false;
    for (var h = 0; h < hallCount; h++) {
      var order = rng.shuffle(claims.map(function (_, i) { return i; }));
      var done = false;
      for (var oi = 0; oi < order.length && !done; oi++) {
        var ci = order[oi];
        if (used.indexOf(ci) >= 0) continue;
        if (claims.length >= MAX_CLAIMS) continue;
        var res = mutateClaim(rng, fact, claims[ci], load, lang);
        if (!res) continue;
        claims[ci].text = res.text;
        claims[ci].isHallucination = true;
        claims[ci].mutationType = res.meta.type;
        claims[ci].original = res.meta.original;
        claims[ci].replacement = res.meta.replacement;
        used.push(ci);
        if (res.meta.extraClaim && claims.length < MAX_CLAIMS) {
          contradictory = true;
          claims.push({ src: null, text: res.meta.extraClaim.text,
            canonical: res.meta.extraClaim.text, isHallucination: false,
            mutationType: null, original: null, replacement: null });
        }
        done = true;
      }
      if (!done) return null;         // 达不到要求的幻觉数量 -> 交给上层重试
    }

    var hallIdx = [];
    for (var q = 0; q < claims.length; q++) if (claims[q].isHallucination) hallIdx.push(q);

    var topic = L.topic || (fact.en && fact.en.topic) || fact.id;
    var query = MUT.render(rng.pick(QUERIES[lang] || QUERIES.en), { topic: topic });

    return {
      id: 'hunt-' + load + '-' + seed + '-' + (opts.attempt || 0),
      seed: seed, load: load, lang: lang,
      factId: fact.id, category: fact.category, type: fact.type || '',
      topic: topic,
      query: query,
      claims: claims,
      hallucinationIndexes: hallIdx,
      hallucinationCount: hallIdx.length,
      confidence: hallCount > 0 ? rng.int(45, 99) : rng.int(65, 99),
      scanMs: rules.scanMs,
      contradiction: contradictory,
      explanation: L.explanation || '',
      source: { name: fact.sourceName || '', url: fact.sourceUrl || '' }
    };
  }

  /* ---------------- Validator ----------------
   * 这是本游戏最重要的质量闸门：Mutation 完不能直接显示，必须先过这里。 */
  function validate(round, load) {
    var errors = [];
    if (!round || typeof round !== 'object') return { ok: false, errors: ['round 不存在'] };
    var l = clampLoad(load === undefined ? round.load : load);
    var rules = LOAD_RULES[l];

    if (typeof round.id !== 'string' || !round.id) errors.push('id 缺失');
    if (round.load !== l) errors.push('load 不一致');
    if (typeof round.query !== 'string' || !round.query.trim()) errors.push('query 为空');
    if (!(round.confidence >= 0 && round.confidence <= 100)) errors.push('confidence 越界');
    if (!(round.scanMs > 0)) errors.push('scanMs 非法');

    var claims = round.claims;
    if (!claims || !claims.length) {
      errors.push('claims 为空');
      return { ok: false, errors: errors };
    }
    if (claims.length < rules.claims[0]) errors.push('claims 太少：' + claims.length);
    if (claims.length > rules.claims[1] + 1) errors.push('claims 太多：' + claims.length);

    var seen = Object.create(null);
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!c || typeof c.text !== 'string' || !c.text.trim()) { errors.push('claim ' + i + ' 文本为空'); continue; }
      if (c.text.indexOf('undefined') >= 0) errors.push('claim ' + i + ' 含 undefined');
      if (/\{[A-Za-z0-9_]+\}/.test(c.text)) errors.push('claim ' + i + ' 有未替换的占位符');
      if (seen[c.text]) errors.push('claim ' + i + ' 与前面重复');
      seen[c.text] = true;
      if (c.isHallucination) {
        if (!c.mutationType) errors.push('claim ' + i + ' 是幻觉但没有 mutationType');
        if (!c.replacement) errors.push('claim ' + i + ' 缺少 replacement');
        if (typeof c.canonical !== 'string' || c.canonical === c.text) errors.push('claim ' + i + ' 的 mutation 与原文相同');
        if (String(c.canonical).trim() === String(c.text).trim()) errors.push('claim ' + i + ' 的 mutation 无法判定');
        if (c.mutationType !== 'FABRICATED_DETAIL' && !c.original) errors.push('claim ' + i + ' 缺少 original');
      }
    }

    var idx = round.hallucinationIndexes || [];
    if (idx.length !== round.hallucinationCount) errors.push('index 与 count 不一致');
    for (var k = 0; k < idx.length; k++) {
      /* 校验器只报告问题，**任何输入都不允许抛异常** */
      if (!(idx[k] >= 0 && idx[k] < claims.length)) { errors.push('hallucination index 越界：' + idx[k]); continue; }
      var pointed = claims[idx[k]];
      if (!pointed || !pointed.isHallucination) errors.push('index ' + idx[k] + ' 指向的不是幻觉');
    }
    if (round.hallucinationCount < (rules.allowNone ? 0 : rules.hall[0])) errors.push('幻觉太少');
    if (round.hallucinationCount > rules.hall[1]) errors.push('幻觉太多');

    return { ok: errors.length === 0, errors: errors };
  }

  /* ---------------- 安全 fallback ---------------- */
  function fallbackRound(seed, load, lang) {
    var rng = RNG.create(RNG.hashString('fallback:' + seed + ':' + load + ':' + lang));
    var fact = FALLBACK_FACTS[0];
    var L = sideOf(fact, lang) || sideOf(fact, 'en');
    var want = LOAD_RULES[load].claims[0];
    var claims = L.claims.slice(0, Math.max(2, Math.min(want, L.claims.length))).map(function (c) {
      var text = MUT.render(c.t, c.s);
      return { src: c, text: text, canonical: text, isHallucination: false,
        mutationType: null, original: null, replacement: null };
    });
    var target = claims[0];
    var res = MUT.MUTATORS[0].apply(target.src, rng, lang) ||
      { text: target.canonical + ' ', meta: { type: 'ENTITY_SWAP', original: '?', replacement: '?' } };
    target.text = res.text;
    target.isHallucination = true;
    target.mutationType = res.meta.type;
    target.original = res.meta.original;
    target.replacement = res.meta.replacement;
    return {
      id: 'hunt-' + load + '-' + seed + '-fallback',
      seed: seed, load: load, lang: lang,
      factId: fact.id, category: fact.category, type: fact.type,
      topic: L.topic || fact.id,
      query: MUT.render(QUERIES[lang][0], { topic: L.topic || fact.id }),
      claims: claims,
      hallucinationIndexes: [0], hallucinationCount: 1,
      confidence: 70, scanMs: LOAD_RULES[load].scanMs,
      contradiction: false, fallback: true,
      explanation: L.explanation || '',
      source: { name: fact.sourceName, url: fact.sourceUrl }
    };
  }

  /* ---------------- 对外主入口 ---------------- */
  function generateRound(seed, load, lang, opts) {
    opts = opts || {};
    var l = clampLoad(load);
    var lg = normLang(lang);
    var s = toSeed(seed);
    var rng = RNG.create(s);
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var r = attemptRound(rng, s, l, lg, { recent: opts.recent, attempt: attempt });
      if (r && validate(r, l).ok) { r.attempts = attempt + 1; return r; }
    }
    var fb = fallbackRound(s, l, lg);
    fb.attempts = MAX_ATTEMPTS;
    return fb;
  }

  /* 会话：一条长 RNG stream + 最近使用过的 fact 去重（避免连着几题同一个主题） */
  function createSession(seed, lang) {
    var s = toSeed(seed);
    var lg = normLang(lang);
    var rng = RNG.create(s);
    var recent = [];
    var index = 0;
    return {
      seed: s,
      lang: lg,
      next: function (load) {
        var l = clampLoad(load);
        for (var a = 0; a < MAX_ATTEMPTS; a++) {
          var r = attemptRound(rng, s, l, lg, { recent: recent, attempt: index });
          if (r && validate(r, l).ok) {
            recent.push(r.factId);
            if (recent.length > RECENT_LIMIT) recent.shift();
            index++;
            r.sessionIndex = index;
            r.attempts = a + 1;
            return r;
          }
        }
        index++;
        return fallbackRound(s, l, lg);
      },
      setLang: function (next) { lg = normLang(next); },
      recent: function () { return recent.slice(); },
      index: function () { return index; }
    };
  }

  global.HuntGenerator = {
    LOAD_RULES: LOAD_RULES,
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    MAX_CLAIMS: MAX_CLAIMS,
    QUERIES: QUERIES,
    FALLBACK_FACTS: FALLBACK_FACTS,
    generateRound: generateRound,
    createSession: createSession,
    validate: validate,
    fallbackRound: fallbackRound,
    allFacts: allFacts,
    usable: usable,
    clampLoad: clampLoad
  };
})(window);
