/* ============================================================
 * HALLUCINATION HUNT — Hallucination Mutation Engine
 *
 * 职责：把**真实事实**（canonical claim）自动改造成一条看起来合理、但事实上
 * 错误的 claim。不手写错误答案 —— 所有 hallucination 都是程序从正确文本里造出来的。
 *
 * 每个 mutator 都是纯函数：apply(claim, rng, lang) -> { text, meta } | null
 * 返回 null = 这条 claim 不适用（Validator 会跳过）。
 *
 * meta 统一带：{ type, original, replacement }，供 UI 展示与测试断言。
 * ============================================================ */
(function (global) {
  'use strict';

  function assign(base, extra) {
    var o = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) o[k] = base[k];
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }
  function render(tpl, slots) {
    return String(tpl).replace(/\{([A-Za-z0-9_]+)\}/g, function (m, k) {
      return (slots && slots[k] !== undefined && slots[k] !== null) ? String(slots[k]) : m;
    });
  }
  function placeholders(tpl) {
    var out = [], m, re = /\{([A-Za-z0-9_]+)\}/g;
    while ((m = re.exec(String(tpl)))) out.push(m[1]);
    return out;
  }
  /* 「可被替换的那个槽」：优先叫 value，否则取模板里最后一个有值的占位符 */
  function valueSlot(claim) {
    var names = placeholders(claim.t);
    if (names.indexOf('value') >= 0) return 'value';
    for (var i = names.length - 1; i >= 0; i--) {
      if (claim.s && claim.s[names[i]] !== undefined) return names[i];
    }
    return null;
  }
  function hasAlt(claim) {
    return !!(claim && claim.alt && claim.alt.length && valueSlot(claim));
  }

  /* ---------------- 1) 语义替换族：ENTITY / LOCATION / ATTRIBUTE / RELATION ---------------- */
  /* 四种标签共用一套机制（换掉同类实体），按事实的语义决定具体标签 —— 这样
   * metadata 对玩家有意义，又不需要为每种写一遍代码。 */
  function semanticSwapLabel(fact) {
    if (!fact) return 'ENTITY_SWAP';
    if (fact.category === 'geography') return 'LOCATION_SWAP';
    if (fact.type === 'relation') return 'RELATION_SWAP';
    if (fact.type === 'attribute') return 'ATTRIBUTE_SWAP';
    return 'ENTITY_SWAP';
  }
  function swapApply(claim, rng, lang, wantType) {
    if (!hasAlt(claim)) return null;
    var slot = valueSlot(claim);
    var pool = (claim.alt || []).filter(function (v) {
      return v !== undefined && v !== null && String(v) !== String(claim.s[slot]);
    });
    if (!pool.length) return null;
    var repl = rng.pick(pool);
    if (repl === undefined || repl === null) return null;
    var slots = assign(claim.s, {});
    slots[slot] = repl;
    var text = render(claim.t, slots);
    if (!text || text === render(claim.t, claim.s)) return null;
    return {
      text: text,
      meta: {
        type: wantType, original: String(claim.s[slot]), replacement: String(repl), slot: slot
      }
    };
  }

  /* ---------------- 2) 数字族：NUMBER_DRIFT / MAGNITUDE_ERROR ---------------- */
  function numberApply(claim, rng, lang, kind) {
    if (!claim || !claim.num || !claim.s || claim.s.n === undefined) return null;
    var cur = parseInt(claim.s.n, 10);
    if (!isFinite(cur)) return null;
    var lo = Number(claim.num.min), hi = Number(claim.num.max);
    if (!isFinite(lo) || !isFinite(hi)) { lo = 1; hi = cur * 10; }
    var next = cur;
    if (kind === 'MAGNITUDE_ERROR') {
      next = rng.bool() ? cur * 10 : Math.max(1, Math.round(cur / 10));
      if (next === cur) next = cur * 100;
    } else {
      for (var i = 0; i < 16 && next === cur; i++) next = rng.int(lo, hi);
    }
    if (!isFinite(next) || next === cur || next < 0) return null;
    var slots = assign(claim.s, { n: String(next) });
    var text = render(claim.t, slots);
    if (!text || text === render(claim.t, claim.s)) return null;
    return { text: text, meta: { type: kind, original: String(cur), replacement: String(next), slot: 'n' } };
  }

  /* ---------------- 3) DATE_SHIFT ---------------- */
  var YEAR_RE = /(?:^|[^0-9])(1[0-9]{3}|20[0-9]{2})(?![0-9])/;
  function dateApply(claim, rng, lang) {
    var base = render(claim.t, claim.s);
    var m = YEAR_RE.exec(base);
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var delta = rng.int(1, 40) * (rng.bool() ? 1 : -1);
    var ny = y + delta;
    if (ny < 1000 || ny > 2099) ny = y - delta;
    if (ny < 1000 || ny > 2099 || ny === y) return null;
    var text = base.replace(m[1], String(ny));
    if (text === base) return null;
    return { text: text, meta: { type: 'DATE_SHIFT', original: m[1], replacement: String(ny) } };
  }

  /* ---------------- 4) UNIT_ERROR ---------------- */
  var UNITS_ASCII = [['kilometres', 'miles'], ['kilometers', 'miles'], ['kilometre', 'mile'],
    ['meters', 'feet'], ['metres', 'feet'], ['kilogram', 'pound'], ['Celsius', 'Fahrenheit'],
    ['million', 'billion'], ['kilometres per hour', 'miles per hour']];
  var UNITS_CJK = [['公里', '英里'], ['千米', '英里'], ['摄氏度', '华氏度'], ['千克', '磅'], ['公斤', '磅']];

  function wordSwap(text, a, b) {
    var esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(^|[^A-Za-z])' + esc + '($|[^A-Za-z])');
    if (!re.test(text)) return null;
    return text.replace(re, function (m, p1, p2) { return p1 + b + p2; });
  }
  function unitApply(claim, rng, lang) {
    var base = render(claim.t, claim.s);
    var pairs = rng.shuffle(UNITS_ASCII);
    for (var i = 0; i < pairs.length; i++) {
      var t = wordSwap(base, pairs[i][0], pairs[i][1]) || wordSwap(base, pairs[i][1], pairs[i][0]);
      if (t && t !== base) {
        return { text: t, meta: { type: 'UNIT_ERROR', original: pairs[i][0], replacement: pairs[i][1] } };
      }
    }
    var cjk = rng.shuffle(UNITS_CJK);
    for (var j = 0; j < cjk.length; j++) {
      if (base.indexOf(cjk[j][0]) >= 0) {
        return { text: base.split(cjk[j][0]).join(cjk[j][1]),
          meta: { type: 'UNIT_ERROR', original: cjk[j][0], replacement: cjk[j][1] } };
      }
      if (base.indexOf(cjk[j][1]) >= 0) {
        return { text: base.split(cjk[j][1]).join(cjk[j][0]),
          meta: { type: 'UNIT_ERROR', original: cjk[j][1], replacement: cjk[j][0] } };
      }
    }
    return null;
  }

  /* ---------------- 5) NEGATION ---------------- */
  var NEG = {
    zh: [['位于', '不位于'], ['是', '不是'], ['有', '没有'], ['能够', '不能够'], ['可以', '不可以'], ['属于', '不属于']],
    en: [[' is ', ' is not '], [' are ', ' are not '], [' was ', ' was not '], [' were ', ' were not '],
      [' has ', ' has no '], [' have ', ' have no '], [' can ', ' cannot '], [' orbits ', ' does not orbit ']]
  };
  function negationApply(claim, rng, lang) {
    var base = render(claim.t, claim.s);
    var pairs = rng.shuffle(NEG[lang] || NEG.en);
    for (var i = 0; i < pairs.length; i++) {
      var from = pairs[i][0], to = pairs[i][1];
      if (base.indexOf(from) >= 0) {
        var text = base.replace(from, to);
        if (text !== base && text.length > 2) {
          return { text: text, meta: { type: 'NEGATION', original: from, replacement: to } };
        }
      }
    }
    return null;
  }

  /* ---------------- 6) FABRICATED_DETAIL ----------------
   * 追加一条**凭空捏造的出处/精度细节**。这一类 mutation 很容易变成“固定坏人
   * 后缀”，所以只允许出现在语义能承受这种附加说明的 claim 上：
   *   - 显式数值 claim -> measurement
   *   - 带明确年份的历史 claim -> archival
   * 其它普通身份/关系陈述一律不硬贴“测量项目/误差范围”之类来源。 */
  var FABRICATED = {
    zh: {
      measurement: [
        '，后续的一次独立复测给出了相同的数值。',
        '，一份技术附录还声称其误差范围低于 0.2%。',
        '，该数值据称在另一组仪器复核中保持不变。',
        '，一份跨机构复核记录也列出了这一结果。'
      ],
      archival: [
        '，一份后来整理的档案抄本也记载了这一事件。',
        '，该说法据称还能在一份未署名的同期记录中找到。',
        '，后来的编年材料也重复了这一记载。',
        '，一份馆藏目录将这一细节列为已经确认的记录。'
      ]
    },
    en: {
      measurement: [
        ', and a later independent remeasurement reportedly produced the same figure.',
        ', with a technical appendix claiming an uncertainty below 0.2%.',
        ', and the value was reportedly unchanged in a separate instrument check.',
        ', with a cross-institution review also listing the same result.'
      ],
      archival: [
        ', and a later archival copy reportedly records the same event.',
        ', with the same claim supposedly appearing in an unsigned contemporary record.',
        ', and a later chronicle reportedly repeats the same account.',
        ', with a collection catalogue treating this detail as a confirmed record.'
      ]
    }
  };
  function fabricatedKind(fact, claim, lang) {
    if (!claim) return null;
    if (claim.num && claim.s && claim.s.n !== undefined) return 'measurement';
    if (fact && fact.category === 'history' && YEAR_RE.test(render(claim.t, claim.s))) return 'archival';
    return null;
  }
  function stripTerminalPunctuation(text, lang) {
    var base = String(text || '').replace(/\s+$/, '');
    return lang === 'zh'
      ? base.replace(/[。！？!?]+$/, '')
      : base.replace(/[.!?]+$/, '');
  }
  function fabricatedApply(claim, rng, lang, fact) {
    var kind = fabricatedKind(fact, claim, lang);
    if (!kind) return null;
    var groups = FABRICATED[lang] || FABRICATED.en;
    var pool = groups[kind] || [];
    var add = rng.pick(pool);
    if (!add) return null;
    var base = render(claim.t, claim.s);
    var text = stripTerminalPunctuation(base, lang) + add;
    if (text === base) return null;
    return { text: text, meta: {
      type: 'FABRICATED_DETAIL', original: '', replacement: add.trim(), detailKind: kind
    } };
  }

  /* ---------------- 7) CONTRADICTION ----------------
   * 让同一段回答里出现两条互相冲突的陈述：把某条 claim 复制一份、换成另一个同类值。
   * 复制出来的那条是 hallucination，原文仍然与 canonical 事实一致 —— 所以这一轮
   * 仍然是**可判定**的，不靠模糊性制造难度。 */
  function contradictionApply(claim, rng, lang) {
    if (!hasAlt(claim)) return null;
    var slot = valueSlot(claim);
    var pool = (claim.alt || []).filter(function (v) {
      return v !== undefined && v !== null && String(v) !== String(claim.s[slot]);
    });
    if (!pool.length) return null;
    var repl = rng.pick(pool);
    var swapped = render(claim.t, assign(claim.s, (function () { var o = {}; o[slot] = repl; return o; })()));
    if (!swapped || swapped === render(claim.t, claim.s)) return null;
    return {
      text: swapped,
      meta: {
        type: 'CONTRADICTION', original: String(claim.s[slot]), replacement: String(repl), slot: slot,
        extraClaim: { text: render(claim.t, claim.s), isHallucination: false }
      }
    };
  }

  /* ---------------- mutator 表 ----------------
   * minLoad = 这个 mutator 从第几档 LOAD 开始出现（与 difficulty 章节对应）。 */
  function swapMutator(type, matchFn, minLoad) {
    return {
      type: type,
      minLoad: minLoad,
      canApply: function (fact, claim) {
        return hasAlt(claim) && (!matchFn || matchFn(fact));
      },
      apply: function (claim, rng, lang) { return swapApply(claim, rng, lang, type); }
    };
  }

  var MUTATORS = [
    swapMutator('ENTITY_SWAP', function (f) { return semanticSwapLabel(f) === 'ENTITY_SWAP'; }, 1),
    swapMutator('LOCATION_SWAP', function (f) { return semanticSwapLabel(f) === 'LOCATION_SWAP'; }, 1),
    swapMutator('ATTRIBUTE_SWAP', function (f) { return semanticSwapLabel(f) === 'ATTRIBUTE_SWAP'; }, 2),
    swapMutator('RELATION_SWAP', function (f) { return semanticSwapLabel(f) === 'RELATION_SWAP'; }, 3),
    { type: 'NUMBER_DRIFT', minLoad: 2,
      canApply: function (f, c) { return !!(c && c.num && c.s && c.s.n !== undefined); },
      apply: function (c, r, l) { return numberApply(c, r, l, 'NUMBER_DRIFT'); } },
    { type: 'MAGNITUDE_ERROR', minLoad: 4,
      canApply: function (f, c) { return !!(c && c.num && c.s && c.s.n !== undefined); },
      apply: function (c, r, l) { return numberApply(c, r, l, 'MAGNITUDE_ERROR'); } },
    { type: 'DATE_SHIFT', minLoad: 3,
      canApply: function (f, c) { return YEAR_RE.test(render(c.t, c.s)); },
      apply: dateApply },
    { type: 'UNIT_ERROR', minLoad: 4,
      canApply: function (f, c) {
        var t = render(c.t, c.s);
        var i;
        for (i = 0; i < UNITS_ASCII.length; i++) if (wordSwap(t, UNITS_ASCII[i][0], UNITS_ASCII[i][1]) || wordSwap(t, UNITS_ASCII[i][1], UNITS_ASCII[i][0])) return true;
        for (i = 0; i < UNITS_CJK.length; i++) if (t.indexOf(UNITS_CJK[i][0]) >= 0 || t.indexOf(UNITS_CJK[i][1]) >= 0) return true;
        return false;
      },
      apply: unitApply },
    { type: 'NEGATION', minLoad: 3,
      canApply: function (f, c) {
        var t = render(c.t, c.s), pairs = NEG.en;
        for (var i = 0; i < pairs.length; i++) if (t.indexOf(pairs[i][0]) >= 0) return true;
        return false;
      },
      apply: negationApply },
    { type: 'FABRICATED_DETAIL', minLoad: 4,
      canApply: function (f, c, l) { return fabricatedKind(f, c, l) !== null; },
      apply: fabricatedApply },
    { type: 'CONTRADICTION', minLoad: 5,
      canApply: function (f, c) { return hasAlt(c); },
      apply: contradictionApply }
  ];

  global.HuntMutators = {
    MUTATORS: MUTATORS,
    render: render,
    placeholders: placeholders,
    valueSlot: valueSlot,
    semanticSwapLabel: semanticSwapLabel,
    types: function () { return MUTATORS.map(function (m) { return m.type; }); }
  };
})(window);
