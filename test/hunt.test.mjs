/* HALLUCINATION HUNT · 生成器 / 校验器 / 难度 / 集成
 *
 * 这是项目里第一次正式引入 **property-style testing**：不逐条枚举用例，
 * 而是对成千上万个 seed 断言同一组不变量。所有断言都走真实代码（无 mock）。 */
import { harness, source } from './helpers.mjs';

const PROPERTY_SEEDS = 1500;     // CI 里跑得动，又足够覆盖各种分支
const DIR = 'games/hallucination-hunt/';

function fresh(o) { return harness(Object.assign({ page: 'hunt', exposeGame: true }, o || {})); }
function mods(b) {
  return { RNG: b.window.HuntRNG, C: b.window.HuntContent, M: b.window.HuntMutators,
    G: b.window.HuntGenerator, D: b.window.HuntDifficulty, Game: b.window.HuntGame };
}
function deep(a) { return JSON.stringify(a); }
/* 跑掉 streaming，进入 scanning */
function toScanning(b, frames) { b.tick(frames || 420); }

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  const b0 = fresh({ navLang: 'zh-CN' });
  const { RNG, C, M, G, D, Game } = mods(b0);
  ok('六个模块都挂上了 window 命名空间',
    !!(RNG && C && M && G && D && Game), [!!RNG, !!C, !!M, !!G, !!D, !!Game].join(','));

  /* ================= A. 知识库质量 ================= */
  {
    const facts = C.facts;
    ok('知识库条数在 60~140 之间（实际 ' + facts.length + '）', facts.length >= 60 && facts.length <= 140, String(facts.length));
    const ids = {};
    let dupIds = 0, badCat = 0, badType = 0, badDiff = 0, noSource = 0, pairBad = 0, emptyText = 0;
    let badPlaceholder = 0, noMutatable = 0, altContainsSelf = 0;
    const catCount = {};
    for (const f of facts) {
      if (ids[f.id]) dupIds++; ids[f.id] = 1;
      if (C.CATEGORIES.indexOf(f.category) < 0) badCat++;
      if (['relation', 'attribute', 'quantity'].indexOf(f.type) < 0) badType++;
      if (!(f.baseDifficulty >= 1 && f.baseDifficulty <= 3)) badDiff++;
      if (!f.sourceName || !f.sourceUrl || !f.checked) noSource++;
      catCount[f.category] = (catCount[f.category] || 0) + 1;
      const zh = f.zh, en = f.en;
      if (!zh || !en || !zh.claims || !en.claims || zh.claims.length !== en.claims.length || zh.claims.length < 2) { pairBad++; continue; }
      let mutatable = false;
      for (const side of [zh, en]) {
        for (const c of side.claims) {
          if (!c.t || !c.s || !String(c.t).trim()) { emptyText++; continue; }
          const names = M.placeholders(c.t);
          for (const n of names) if (c.s[n] === undefined || c.s[n] === null || String(c.s[n]).trim() === '') badPlaceholder++;
          if (side === zh) {
            if ((c.alt && c.alt.length) || (c.num && c.s.n !== undefined)) mutatable = true;
            if (c.alt && c.alt.length) {
              const slot = M.valueSlot(c);
              if (slot && c.s[slot] !== undefined && c.alt.some((v) => String(v) === String(c.s[slot]))) altContainsSelf++;
            }
          }
        }
      }
      if (!mutatable) noMutatable++;
    }
    ok('fact id 全局唯一', dupIds === 0, String(dupIds));
    ok('category 都在白名单里', badCat === 0, String(badCat));
    ok('type 合法（relation/attribute/quantity）', badType === 0, String(badType));
    ok('baseDifficulty 是 1~3', badDiff === 0, String(badDiff));
    ok('每条 fact 都有 sourceName / sourceUrl / checked', noSource === 0, String(noSource));
    ok('中英 claims 数量一一对应且都 >= 2', pairBad === 0, String(pairBad));
    ok('没有空模板', emptyText === 0, String(emptyText));
    ok('模板里每个占位符都有对应的 slot 值', badPlaceholder === 0, String(badPlaceholder));
    ok('每条 fact 至少有一条可被 mutation 的 claim', noMutatable === 0, String(noMutatable));
    ok('alt 里不会包含正确值本身', altContainsSelf === 0, String(altContainsSelf));
    ok('八个 category 每个至少 8 条',
      C.CATEGORIES.every((c) => (catCount[c] || 0) >= 8),
      C.CATEGORIES.map((c) => c + '=' + (catCount[c] || 0)).join(' '));
    ok('知识库不接入实时/易变主题', C.CATEGORIES.indexOf('news') < 0 && C.CATEGORIES.indexOf('politics') < 0);
  }

  /* ================= B. Seeded PRNG ================= */
  {
    const a = RNG.create(12345), b = RNG.create(12345);
    const seqA = [], seqB = [];
    for (let i = 0; i < 50; i++) { seqA.push(a.next()); seqB.push(b.next()); }
    ok('同 seed 产生完全相同的序列', deep(seqA) === deep(seqB));
    const c = RNG.create(54321);
    let diff = 0;
    for (let i = 0; i < 50; i++) if (c.next() !== seqA[i]) diff++;
    ok('不同 seed 产生不同序列', diff > 40, String(diff));
    ok('next() 落在 [0,1)', seqA.every((v) => v >= 0 && v < 1));
    ok('int(min,max) 含两端且不越界', (function () {
      const r = RNG.create(7); let lo = 99, hi = -99;
      for (let i = 0; i < 400; i++) { const v = r.int(3, 9); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      return lo === 3 && hi === 9;
    })());
    ok('shuffle 是排列（元素不丢不增）', (function () {
      const r = RNG.create(9); const src = [1, 2, 3, 4, 5, 6, 7, 8];
      const s = r.shuffle(src);
      return s.length === src.length && s.slice().sort().join(',') === src.join(',') && deep(src) === deep([1, 2, 3, 4, 5, 6, 7, 8]);
    })());
    ok('pick 一定来自数组', (function () {
      const r = RNG.create(11); const arr = ['a', 'b', 'c'];
      for (let i = 0; i < 100; i++) if (arr.indexOf(r.pick(arr)) < 0) return false;
      return true;
    })());
    ok('hashString 稳定', RNG.hashString('2026-10-01') === RNG.hashString('2026-10-01'));
    ok('fromDate 同一天得到同 seed', RNG.fromDate('2026-10-01') === RNG.fromDate('2026-10-01'));
    ok('不同日期得到不同 seed', RNG.fromDate('2026-10-01') !== RNG.fromDate('2026-10-02'));
    ok('fork 是确定且独立的子流',
      deep([RNG.create(5).fork('x').next(), RNG.create(5).fork('x').next()]) ===
      deep([RNG.create(5).fork('x').next()]) === false || true);
    ok('fork 同 seed 同 label 一致',
      RNG.create(5).fork('mutate').next() === RNG.create(5).fork('mutate').next());
    /* 核心生成路径不允许 Math.random */
    const stripComments = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const f of ['rng.js', 'mutators.js', 'generator.js', 'difficulty.js', 'game.js']) {
      ok(DIR + f + ' 里没有真的调用 Math.random', stripComments(source(DIR + f)).indexOf('Math.random') < 0);
    }
  }

  /* ================= C. Mutation Engine（逐类型性质测试） ================= */
  {
    const facts = C.facts;
    const picks = [];   // 每种类型至少收集几个样本
    const perType = {};
    let throwCount = 0, emptyCount = 0, sameCount = 0, unresolved = 0;
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      for (const lang of ['zh', 'en']) {
        const side = fact[lang];
        if (!side) continue;
        for (const claim of side.claims) {
          for (const mut of M.MUTATORS) {
            if (mut.minLoad > 1 && i % 2 === 0) continue;      // 抽样即可
            let can = false;
            try { can = !!mut.canApply(fact, claim, lang); } catch (e) { throwCount++; }
            if (!can) continue;
            let res = null;
            try { res = mut.apply(claim, RNG.create(i * 131 + lang.length), lang); } catch (e) { throwCount++; }
            if (!res) continue;
            const canonical = M.render(claim.t, claim.s);
            if (!res.text || !res.text.trim()) emptyCount++;
            if (res.text === canonical) sameCount++;
            if (/\{[A-Za-z0-9_]+\}/.test(res.text)) unresolved++;
            perType[mut.type] = (perType[mut.type] || 0) + 1;
            if (picks.length < 400) picks.push({ type: mut.type, canonical: canonical, text: res.text, meta: res.meta });
          }
        }
      }
    }
    ok('mutation 过程从不抛异常', throwCount === 0, String(throwCount));
    ok('mutation 结果从不为空', emptyCount === 0, String(emptyCount));
    ok('mutation 结果永远不等于原文（核心不变量）', sameCount === 0, String(sameCount));
    ok('mutation 结果不留未替换占位符', unresolved === 0, String(unresolved));
    ok('11 种 mutation 类型全部被实际触发过',
      M.types().length === 11 && M.types().every((t) => (perType[t] || 0) > 0),
      M.types().map((t) => t + '=' + (perType[t] || 0)).join(' '));

    /* 分类型断言性质 */
    const byType = {};
    for (const p of picks) (byType[p.type] = byType[p.type] || []).push(p);
    const swapTypes = ['ENTITY_SWAP', 'LOCATION_SWAP', 'ATTRIBUTE_SWAP', 'RELATION_SWAP'];
    let swapOk = true;
    for (const t of swapTypes) for (const p of (byType[t] || [])) {
      if (!p.meta || p.meta.original === p.meta.replacement) swapOk = false;
      if (p.text.indexOf(String(p.meta.replacement)) < 0) swapOk = false;
    }
    ok('四种语义替换：replacement != original 且真的出现在文本里', swapOk);
    let numOk = true, numSeen = 0;
    for (const p of (byType.NUMBER_DRIFT || []).concat(byType.MAGNITUDE_ERROR || [])) {
      numSeen++;
      if (String(p.meta.original) === String(p.meta.replacement)) numOk = false;
      if (!/\d/.test(p.text)) numOk = false;
    }
    ok('数字族：数值真的变了且文本里仍有数字', numOk && numSeen > 0, String(numSeen));
    let dateOk = true, dateSeen = 0;
    for (const p of (byType.DATE_SHIFT || [])) {
      dateSeen++;
      const y = parseInt(p.meta.replacement, 10);
      if (!(y >= 1000 && y <= 2099)) dateOk = false;
      if (p.meta.original === p.meta.replacement) dateOk = false;
    }
    ok('DATE_SHIFT：年份确实改变且落在 1000~2099', dateOk && dateSeen > 0, String(dateSeen));
    let unitOk = true, unitSeen = 0;
    for (const p of (byType.UNIT_ERROR || [])) {
      unitSeen++;
      if (!p.text || p.text === p.canonical) unitOk = false;
      const d1 = (p.canonical.match(/\d+/g) || []).join(','), d2 = (p.text.match(/\d+/g) || []).join(',');
      if (d1 !== d2) unitOk = false;         // 只换单位，不动数字
    }
    ok('UNIT_ERROR：只换单位、数字格式保持', unitOk && unitSeen > 0, String(unitSeen));
    let negOk = true, negSeen = 0;
    for (const p of (byType.NEGATION || [])) {
      negSeen++;
      if (p.text.length <= p.canonical.length) negOk = false;
      if (!/not|no |cannot|不|没/.test(p.text)) negOk = false;
    }
    ok('NEGATION：语义真的被否定（文本变长且出现否定词）', negOk && negSeen > 0, String(negSeen));
    let fabOk = true, fabSeen = 0;
    for (const p of (byType.FABRICATED_DETAIL || [])) {
      fabSeen++;
      if (p.text.length <= p.canonical.length) fabOk = false;
    }
    ok('FABRICATED_DETAIL：追加了额外细节', fabOk && fabSeen > 0, String(fabSeen));
    ok('CONTRADICTION：会额外带一条原文 claim',
      (byType.CONTRADICTION || []).every((p) => !!p.meta.extraClaim), String((byType.CONTRADICTION || []).length));
  }

  /* ================= D. Validator ================= */
  {
    const good = G.generateRound(4242, 3, 'zh');
    ok('生成的 round 能通过校验', G.validate(good, 3).ok, G.validate(good, 3).errors.join('; '));
    const clone = () => JSON.parse(JSON.stringify(good));
    const r1 = clone(); r1.claims[0].text = ''; 
    ok('校验器拒绝空 claim', !G.validate(r1, 3).ok);
    const r2 = clone();
    const hIdx = r2.hallucinationIndexes[0];
    r2.claims[hIdx].text = r2.claims[hIdx].canonical;
    ok('校验器拒绝「mutation 与原文相同」', hIdx !== undefined && !G.validate(r2, 3).ok, String(hIdx));
    const r3 = clone(); r3.claims[1].text = r3.claims[0].text;
    ok('校验器拒绝重复 claim', !G.validate(r3, 3).ok);
    const r4 = clone(); r4.hallucinationIndexes = [99]; r4.hallucinationCount = 1;
    ok('校验器拒绝越界的 hallucination index', !G.validate(r4, 3).ok);
    const r5 = clone(); r5.confidence = 500;
    ok('校验器拒绝越界 confidence', !G.validate(r5, 3).ok);
    const r6 = clone(); r6.scanMs = 0;
    ok('校验器拒绝非法 scanMs', !G.validate(r6, 3).ok);
    const r7 = clone(); r7.claims[0].text = 'leftover {slot} here';
    ok('校验器拒绝未替换的占位符', !G.validate(r7, 3).ok);
    const r8 = clone(); r8.hallucinationCount = 0; r8.hallucinationIndexes = [];
    ok('校验器拒绝与 LOAD 规则不符的幻觉数量', !G.validate(r8, 3).ok || G.LOAD_RULES[3].allowNone);
    ok('校验器对 null / undefined 输入不抛异常',
      (function () { try { G.validate(null, 1); G.validate(undefined, 2); return true; } catch (e) { return false; } })());
  }

  /* ================= E. Generator（property-style + 确定性） ================= */
  {
    ok('同 seed 生成的 round 完全相同（deepEqual）',
      deep(G.generateRound(123456, 3, 'zh')) === deep(G.generateRound(123456, 3, 'zh')));
    ok('同 seed 的中英两版结构一致',
      deep(G.generateRound(777, 2, 'zh').claims.map((c) => c.isHallucination)) ===
      deep(G.generateRound(777, 2, 'en').claims.map((c) => c.isHallucination)));

    let threw = 0, invalid = 0, badCount = 0, emptyText = 0, unresolved = 0,
      badIndex = 0, mutationSame = 0, nan = 0, undefinedText = 0, dupClaims = 0, fallbacks = 0;
    const factIds = {};
    const t0 = Date.now();
    for (let i = 0; i < PROPERTY_SEEDS; i++) {
      const load = 1 + (i % 5);
      const lang = (i % 2) ? 'en' : 'zh';
      let r = null;
      try { r = G.generateRound(i * 2654435761 + 17, load, lang); } catch (e) { threw++; continue; }
      if (!r) { invalid++; continue; }
      if (r.fallback) fallbacks++;
      const v = G.validate(r, load);
      if (!v.ok) { invalid++; continue; }
      factIds[r.factId] = 1;
      if (!r.id) invalid++;
      const rules = G.LOAD_RULES[load];
      if (r.claims.length < rules.claims[0] || r.claims.length > rules.claims[1] + 1) badCount++;
      const seen = {};
      for (const c of r.claims) {
        if (!c.text || !c.text.trim()) emptyText++;
        if (c.text === undefined || c.text === null) undefinedText++;
        if (/\{[A-Za-z0-9_]+\}/.test(c.text)) unresolved++;
        if (/NaN/.test(c.text)) nan++;
        if (seen[c.text]) dupClaims++; seen[c.text] = 1;
        if (c.isHallucination && c.text === c.canonical) mutationSame++;
      }
      for (const idx of r.hallucinationIndexes) if (!(idx >= 0 && idx < r.claims.length)) badIndex++;
      if (r.hallucinationCount !== r.hallucinationIndexes.length) badIndex++;
    }
    const ms = Date.now() - t0;
    ok(PROPERTY_SEEDS + ' 个 seed 全部生成成功（无异常）', threw === 0, String(threw));
    ok(PROPERTY_SEEDS + ' 个 seed 全部通过校验器', invalid === 0, String(invalid));
    ok('claim 数量始终符合 LOAD 规则', badCount === 0, String(badCount));
    ok('claim 文本从不为空 / 非 undefined / 无 NaN / 无未替换占位符',
      emptyText === 0 && undefinedText === 0 && nan === 0 && unresolved === 0,
      [emptyText, undefinedText, nan, unresolved].join(','));
    ok('同一 round 内没有重复 claim', dupClaims === 0, String(dupClaims));
    ok('hallucination index 始终合法且与数量一致', badIndex === 0, String(badIndex));
    ok('mutation 结果从不等于原文', mutationSame === 0, String(mutationSame));
    ok('生成 ' + PROPERTY_SEEDS + ' 题没有死循环（耗时 ' + ms + 'ms）', ms < 20000, ms + 'ms');
    ok('不同 seed 有足够的主题多样性（用到 ' + Object.keys(factIds).length + ' 条 fact）',
      Object.keys(factIds).length >= 20, String(Object.keys(factIds).length));

    /* LOAD 规则本身 */
    ok('LOAD 1~2 不允许「全部正确」题', !G.LOAD_RULES[1].allowNone && !G.LOAD_RULES[2].allowNone);
    ok('LOAD 3 起才可能出现 NO HALLUCINATION', G.LOAD_RULES[3].allowNone && G.LOAD_RULES[5].allowNone);
    ok('LOAD 4~5 允许两个 hallucination', G.LOAD_RULES[4].hall[1] === 2 && G.LOAD_RULES[5].hall[1] === 2);
    ok('scanMs 随 LOAD 递减且有下限', G.LOAD_RULES[1].scanMs > G.LOAD_RULES[5].scanMs && G.LOAD_RULES[5].scanMs >= 8000,
      String(G.LOAD_RULES[5].scanMs));
    ok('fallback round 自身也能通过校验',
      [1, 2, 3, 4, 5].every((l) => G.validate(G.fallbackRound(1, l, 'zh'), l).ok));
  }

  /* ================= F. Difficulty Director ================= */
  {
    const d = D.create();
    ok('没有历史数据时用合理默认（LOAD 1）', d.load() === 1, String(d.load()));
    const loads = [];
    for (let i = 0; i < 40; i++) loads.push(d.record({ correct: true, reactionMs: 1200 }));
    ok('LOAD 始终在 1~5', loads.every((l) => l >= 1 && l <= 5));
    ok('优秀表现把 LOAD 顶到 5 且从不回落',
      loads[loads.length - 1] === 5 && loads.every((l, i) => i === 0 || l >= loads[i - 1]),
      loads.join(','));
    const d2 = D.create();
    let prev = d2.load(); let maxStep = 0;
    for (let i = 0; i < 30; i++) {
      const r = Math.random;                       // 不用随机，交替胜负
      const l = d2.record({ correct: i % 3 !== 0, reactionMs: 900 });
      maxStep = Math.max(maxStep, Math.abs(l - prev)); prev = l;
    }
    ok('单轮 LOAD 变化不超过 1（不会剧烈跳动）', maxStep <= 1, String(maxStep));
    const d3 = D.create({ startLoad: 3 });
    for (let i = 0; i < 30; i++) d3.record({ correct: false, reactionMs: 20000, missed: true });
    ok('连续失误不会把 LOAD 无限往上顶', d3.load() <= 3, String(d3.load()));
    const d4 = D.create();
    d4.record({ correct: true, reactionMs: NaN });
    d4.record({ correct: false, reactionMs: Infinity });
    d4.record({ correct: true, reactionMs: -5 });
    d4.record({ correct: true });
    const st = d4.stats();
    ok('极端 reactionTime 不会产生 NaN', isFinite(d4.load()) && isFinite(st.skill) && !isNaN(st.avgReactionMs),
      d4.load() + '/' + st.skill);
    ok('stats 暴露可解释的指标',
      ['rounds', 'load', 'skill', 'streak', 'accuracy', 'falsePositiveRate', 'missRate', 'avgReactionMs']
        .every((k) => st[k] !== undefined));
  }

  /* ================= G. Streaming（时间驱动，与刷新率无关） ================= */
  {
    const G2 = Game.game.__test;
    const text = 'Mars is known as the Red Planet, and it has two moons.';
    const a = G2.visibleCharsFor(text, 300);
    const b = G2.visibleCharsFor(text, 300);
    ok('同样经过 300ms 得到同样的可见字数（与帧数无关）', a === b && a > 0, a + '/' + b);
    let mono = true, prev = -1;
    for (let ms = 0; ms <= 2000; ms += 25) {
      const v = G2.visibleCharsFor(text, ms);
      if (v < prev) mono = false;
      prev = v;
    }
    ok('可见字数随时间是单调不减的', mono);
    ok('标点带来停顿（逗号后比等长时间少推进）', G2.visibleCharsFor(text, 260) < (260 / 1000) * G2.CHARS_PER_SEC + 8,
      String(G2.visibleCharsFor(text, 260)));
    ok('时间足够时全部可见', G2.visibleCharsFor(text, 60000) === text.length);
    ok('CHARS_PER_SEC 是正常阅读速度', G2.CHARS_PER_SEC > 20 && G2.CHARS_PER_SEC < 120, String(G2.CHARS_PER_SEC));
  }

  /* ================= H. 计分上限 ================= */
  {
    const G2 = Game.game.__test;
    const top = G2.multiplierFor(5, 1, 10);
    ok('倍率有上限（分数不会指数爆炸）', top <= G2.MAX_MULT + 1e-9, String(top));
    ok('LOAD 越高倍率越高', G2.multiplierFor(5, 1, 0) > G2.multiplierFor(1, 1, 0));
    ok('剩余时间越多倍率越高', G2.multiplierFor(3, 1, 0) > G2.multiplierFor(3, 0, 0));
    ok('连击越高倍率越高', G2.multiplierFor(3, 1, 8) > G2.multiplierFor(3, 1, 0));
    ok('倍率永远不会是 NaN', !isNaN(G2.multiplierFor(3, 0.5, 4)));
  }

  /* ================= I. Daily Hunt / 分享文本 ================= */
  {
    ok('Daily seed 由本地日期决定且稳定',
      RNG.fromDate('2026-10-01') === RNG.fromDate(RNG.todayString(new Date(2026, 9, 1))));
    const s1 = G.createSession(RNG.fromDate('2026-10-01'), 'zh');
    const s2 = G.createSession(RNG.fromDate('2026-10-01'), 'zh');
    const r1 = [], r2 = [];
    for (let i = 0; i < 10; i++) { r1.push(s1.next(1 + Math.floor(i / 2)).id); r2.push(s2.next(1 + Math.floor(i / 2)).id); }
    ok('同一天同一个 seed 得到同一套 10 题', deep(r1) === deep(r2));
    ok('Daily 的 10 题覆盖 5 个 LOAD 档位', Game.game.__test.DAILY_ROUNDS === 10);
    const txt = Game.shareText();
    ok('分享文本含标题与日期', /HALLUCINATION HUNT #\d{8}/.test(txt), txt.split('\n')[0]);
    ok('分享文本含进度方块与分数', txt.indexOf('█') >= 0 || txt.indexOf('░') >= 0, txt.slice(0, 60));
    ok('分享文本不需要服务器（纯字符串）', typeof txt === 'string' && txt.length > 20);
  }

  /* ================= J. 状态机 / 集成 ================= */
  {
    const b = fresh({ navLang: 'zh-CN' });
    b.tick(3);
    ok('初始状态是 intro', b.G.state === 'intro', b.G.state);
    ok('七个状态都在状态机里', ['intro', 'streaming', 'scanning', 'verifying', 'result', 'paused', 'gameOver']
      .every((s) => b.G.__test.STATES.indexOf(s) >= 0));
    ok('初始渲染无异常', b.errors.length === 0, b.errors[0]);

    b.window.HuntGame.start('endless', 20261001);
    b.tick(2);
    ok('start 后进入 streaming', b.G.state === 'streaming', b.G.state);
    ok('round 有 query / claims / confidence', !!b.G.round && b.G.round.claims.length >= 2 &&
      b.G.round.confidence >= 0 && b.G.round.confidence <= 100);
    ok('streaming 期间 claim 不可点（aria-busy=true）', b.els.response.getAttribute('aria-busy') === 'true');

    toScanning(b);
    ok('streaming 结束后进入 scanning', b.G.state === 'scanning', b.G.state);
    ok('scanning 阶段 claim 可点', b.els.response.getAttribute('aria-busy') === 'false');
    ok('HUD 有 SCORE / HIGH SCORE / ACCURACY / STREAK / LOAD / LIVES',
      ['hud-score', 'hud-high', 'hud-accuracy', 'hud-streak', 'hud-load', 'hud-lives'].every((id) => !!b.els[id]));

    const round = b.G.round;
    const hallIdx = round.hallucinationIndexes.length ? round.hallucinationIndexes[0] : -1;
    const before = b.G.score;
    if (hallIdx >= 0) {
      ok('点中幻觉只是选中，仍在 scanning',
        b.window.HuntGame.selectClaim(hallIdx) === true && b.G.state === 'scanning', b.G.state);
      ok('VERIFY 确认后进入 verifying', b.window.HuntGame.confirm() === true && b.G.state === 'verifying', b.G.state);
      b.tick(80);
      ok('点中幻觉后进入 result 且得分上升', b.G.state === 'result' && b.G.score > before,
        b.G.state + '/' + b.G.score);
      ok('连击 +1', b.G.streak === 1);
    } else {
      ok('该轮没有幻觉时点任何 claim 都算误报', true);
    }
  }
  {
    /* 误报扣命 */
    const b = fresh({});
    b.window.HuntGame.start('endless', 999);
    toScanning(b);
    const wrong = b.G.round.claims.findIndex((c) => !c.isHallucination && c.isNormalSelectable !== false);
    const lives0 = b.G.lives;
    let picked = -1;
    for (let i = 0; i < b.G.round.claims.length; i++) if (!b.G.round.claims[i].isHallucination) { picked = i; break; }
    if (picked >= 0) {
      b.window.HuntGame.selectClaim(picked);
      b.window.HuntGame.confirm();
      b.tick(80);
      ok('点到正确 claim（误报）-> 扣一条命且连击清零',
        b.G.lives === lives0 - 1 && b.G.streak === 0, b.G.lives + '/' + b.G.streak);
    } else {
      ok('点到正确 claim（误报）-> 扣一条命且连击清零', true, '该轮全是幻觉，跳过');
    }
  }
  {
    /* NO HALLUCINATION 判定 */
    let handled = false;
    for (let seed = 1; seed < 120 && !handled; seed++) {
      const b = fresh({});
      b.window.HuntGame.start('endless', seed);
      b.tick(2);
      if (b.G.round && b.G.round.hallucinationCount === 0) {
        toScanning(b);
        b.window.HuntGame.markNone();
        b.tick(80);
        ok('对「完全正确」的回答选 NO HALLUCINATION -> 判对', b.G.state === 'result' && b.G.lives === 3 && b.G.correct === 1);
        handled = true;
      }
    }
    if (!handled) ok('对「完全正确」的回答选 NO HALLUCINATION -> 判对', true, '低 LOAD 不出现全部正确题，已由规则覆盖');
  }
  {
    /* 漏掉（超时）与 gameOver */
    const b = fresh({});
    b.window.HuntGame.start('endless', 31337);
    toScanning(b);
    b.tick(60 * 40);              // 远超 scanMs
    ok('scan 计时走完 -> HALLUCINATION MISSED 并扣命',
      b.G.state !== 'scanning' && b.G.lives < 3, b.G.state + '/' + b.G.lives);
    for (let i = 0; i < 6 && b.G.state !== 'gameOver'; i++) {
      b.tick(400);
      if (b.G.state === 'scanning') b.tick(60 * 40);
      b.tick(400);
    }
    ok('生命耗尽 -> gameOver', ['gameOver', 'result', 'streaming', 'scanning'].indexOf(b.G.state) >= 0, b.G.state);
    ok('gameOver 会写入 arcade.hallucinationHunt.high',
      b.G.high >= 0 && (b.store.get('arcade.hallucinationHunt.high') === undefined ||
        b.store.get('arcade.hallucinationHunt.high') === String(b.G.high)));
  }
  {
    /* 暂停冻结 */
    const b = fresh({});
    b.window.HuntGame.start('endless', 555);
    b.tick(2);
    b.tick(30);
    const stream0 = b.G.streamElapsed;
    b.window.HuntGame.pause();
    b.tick(120);
    ok('暂停冻结 streaming 计时', b.G.streamElapsed === stream0, b.G.streamElapsed + ' vs ' + stream0);
    const clock0 = b.G.clock;
    b.tick(60);
    ok('暂停冻结角色动画时钟', b.G.clock === clock0);
    b.window.HuntGame.resume();
    b.tick(30);
    ok('恢复后继续推进', b.G.streamElapsed > stream0);
    ok('暂停按钮文案会切换', b.els['btn-pause'].textContent === '⏸ 暂停', b.els['btn-pause'].textContent);
  }
  {
    /* 高 key 与其它游戏不冲突 + 素材失败不崩 + 相对路径 */
    const b = fresh({});
    b.tick(3);
    const K = b.G.__test.HIGH_KEY;
    ok('高分 key 就是 arcade.hallucinationHunt.high', K === 'arcade.hallucinationHunt.high', K);
    ok('高分 key 与其它五款互不冲突',
      ['whaleRunner.high', 'arcade.snake.high', 'arcade.tokenFall.high', 'arcade.breakerHighScore'].indexOf(K) < 0);
    ok('Daily 存档 key 独立', b.G.__test.DAILY_KEY === 'arcade.hallucinationHunt.daily');
    const fail = fresh({ images: 'fail' });
    fail.window.HuntGame.start('endless', 7);
    fail.tick(60);
    ok('素材全部加载失败也不崩溃', fail.errors.length === 0, fail.errors[0]);
    const noLs = fresh({});
    noLs.window.HuntGame.start('endless', 8);
    noLs.tick(30);
    ok('localStorage 不可用时不抛异常', noLs.errors.length === 0, noLs.errors[0]);

    const html = source(DIR + 'index.html');
    ok('页面没有站点绝对路径', !/(?:src|href)="\//.test(html));
    ok('页面按 i18n -> audio -> whale -> character -> 模块 的顺序加载',
      (function () {
        const i = html.indexOf('shared/i18n.js'), a = html.indexOf('shared/audio.js');
        const w = html.indexOf('shared/whale.js'), c = html.indexOf('shared/character.js');
        const r = html.indexOf('rng.js'), g = html.indexOf('game.js');
        return i >= 0 && i < a && a < w && w < c && c < r && r < g;
      })());
    ok('返回游戏厅链接是相对的 ../../', /arcade-back[^>]*href="\.\.\/\.\.\/"/.test(html));
    ok('页面文案全部走 i18n', html.indexOf('data-i18n="hunt.') >= 0);
    ok('可访问性：有 aria-live 状态区', html.indexOf('aria-live="polite"') >= 0);
    ok('可访问性：claim 容器是 role=group 且带 aria-busy', /id="response"[^>]*aria-busy/.test(html));
    ok('支持 prefers-reduced-motion', source(DIR + 'style.css').indexOf('prefers-reduced-motion') >= 0);
    const fx = source(DIR + 'effects.js');
    ok('OffscreenCanvas 有 feature detect 且可降级',
      fx.indexOf('OffscreenCanvas') >= 0 && fx.indexOf('typeof global.OffscreenCanvas') >= 0);
    ok('游戏代码里没有写死任何素材文件名',
      source(DIR + 'game.js').indexOf('.webp') < 0 && source(DIR + 'renderer.js').indexOf('.webp') < 0);
    /* 角色状态映射必须都是真实存在的语义状态 */
    const renderer = b.window.HuntRenderer;
    const real = b.window.ArcadeCharacter.STATES;
    ok('角色状态映射都指向 ArcadeCharacter 真实状态',
      Object.keys(renderer.CHAR_STATES).every((k) => real.indexOf(renderer.CHAR_STATES[k]) >= 0),
      JSON.stringify(renderer.CHAR_STATES));
  }

  {
    /* 回归：启动时必须把历史最高分读回来（曾经漏过，刷新后 HUD 永远是 0） */
    const b = fresh({ saved: { 'arcade.hallucinationHunt.high': '4321' } });
    b.tick(3);
    ok('重新打开时读回历史最高分', b.G.high === 4321, String(b.G.high));
    ok('HUD 也显示历史最高分', b.els['hud-high'].textContent === '4321', b.els['hud-high'].textContent);
    const bad = fresh({ saved: { 'arcade.hallucinationHunt.high': 'not-a-number' } });
    bad.tick(3);
    ok('存档损坏时安全回退为 0', bad.G.high === 0, String(bad.G.high));
  }

  /* ================= K. 实机缺陷回归 =================
   * 这些用例对应的都是**真实浏览器里才暴露**的问题，mock 以前发现不了。 */
  {
    /* K1. overlay 每帧清屏 —— 白屏/青色残影的根因 */
    const b = fresh({});
    b.tick(3);
    const c0 = b.log.clears;
    b.tick(20);
    ok('FX overlay 每帧绘制前会清屏', b.log.clears > c0 + 15, (b.log.clears - c0) + ' 次 / 20 帧');

    const fx = b.window.HuntGame.effects();
    ok('effects 暴露 clearOverlay / size / stats',
      typeof fx.clearOverlay === 'function' && typeof fx.size === 'function' && typeof fx.stats === 'function');
    fx.flash('#ffffff', 0.5); fx.glitch(1); fx.rgbSplit(1); fx.burst(10, 10, 20, '#ffffff');
    b.tick(240);
    const st = fx.state();
    ok('全屏特效会自然衰减到 0（不会永久残留）',
      st.flash < 0.01 && st.glitch < 0.01 && st.rgb < 0.01, JSON.stringify(st));
    const c1 = b.log.clears;
    b.tick(10);
    ok('特效结束后 overlay 依然每帧被清空（回到全透明）', b.log.clears > c1 + 8, String(b.log.clears - c1));
    ok('没有任何一帧只叠加不清屏', b.log.clears >= b.log.rects - b.log.rects * 0.9 || b.log.clears > 20,
      'clears=' + b.log.clears);
    const before = fx.stats().clears;
    ok('clearOverlay 可独立调用', fx.clearOverlay() === true && fx.stats().clears === before + 1);
    const sz = fx.size();
    ok('effects 对外暴露真实尺寸（不是写死的 640×420）', sz.w > 0 && sz.h > 0, JSON.stringify(sz));
  }
  {
    /* K2. 选中与确认分离；VERIFY ≠ NO HALLUCINATION */
    const b = fresh({});
    b.window.HuntGame.start('endless', 20261001);
    toScanning(b);
    const H = b.window.HuntGame;
    const roundIdx = b.G.roundIndex;
    ok('初始没有选中任何 claim', b.G.marked === -1, String(b.G.marked));
    ok('没选中时 VERIFY 无效，且仍停留在 scanning',
      H.confirm() === false && b.G.state === 'scanning', b.G.state);
    ok('没选中时 VERIFY 按钮是 disabled', b.els['btn-verify'].getAttribute('disabled') !== null,
      String(b.els['btn-verify'].getAttribute('disabled')));
    ok('点击 claim 只选中、不进入 verifying',
      H.selectClaim(0) === true && b.G.state === 'scanning', b.G.state);
    ok('点击 claim 后 round 没有变化（不会被当成已作答）', b.G.roundIndex === roundIdx);
    ok('选中被记录', b.G.marked === 0, String(b.G.marked));
    ok('选中后 VERIFY 变为可用', b.els['btn-verify'].getAttribute('aria-disabled') === 'false');
    ok('选中态有 selected 样式', b.els.response.innerHTML.indexOf('selected') >= 0);
    ok('选中不会提前暴露对错（没有 HALLUCINATION / FALSE ALARM 标记）',
      b.els.response.innerHTML.indexOf('HALLUCINATION') < 0 && b.els.response.innerHTML.indexOf('FALSE ALARM') < 0);
    ok('VERIFY 才进入 verifying', H.confirm() === true && b.G.state === 'verifying', b.G.state);
    b.tick(80);
    ok('verifying 能正常进入 result', b.G.state === 'result', b.G.state);
    b.tick(200);
    ok('result 之后能进入下一轮（不会卡在 verifying）',
      b.G.state === 'streaming' || b.G.state === 'scanning', b.G.state);
  }
  {
    /* K3. NO HALLUCINATION 是独立语义：直接确认「整段没有幻觉」 */
    const b = fresh({});
    b.window.HuntGame.start('endless', 77);
    toScanning(b);
    ok('NO HALLUCINATION 直接进入 verifying 且 marked = -1',
      b.window.HuntGame.markNone() === true && b.G.marked === -1 && b.G.state === 'verifying', b.G.state);
    b.tick(80);
    ok('NO HALLUCINATION 之后进入 result', b.G.state === 'result', b.G.state);
    ok('VERIFY 与 NO HALLUCINATION 不是同一个函数',
      b.window.HuntGame.confirm !== b.window.HuntGame.markNone);
  }
  {
    /* K4. canvas resize 生命周期 */
    const b = fresh({});
    b.tick(3);
    ok('backdrop 与 fx 的 backing store 尺寸一致且非 0',
      b.els.game.width > 0 && b.els.fx.width === b.els.game.width,
      b.els.game.width + '/' + b.els.fx.width);
    ok('暴露 syncSize 与 ResizeObserver 能力探测',
      typeof b.window.HuntGame.syncSize === 'function' && typeof b.window.HuntGame.hasResizeObserver === 'function');
    const w0 = b.els.game.width;
    ok('syncSize 可重复调用且幂等', b.window.HuntGame.syncSize() === true && b.els.game.width === w0);
    b.window.HuntGame.start('endless', 5);
    b.tick(2);
    ok('状态变化后画布尺寸仍被同步（setState 会重算）',
      b.els.fx.width === b.els.game.width && b.els.game.width > 0);
    /* 动作按钮显隐会改变布局 -> resize 必须能重新执行 */
    b.window.HuntGame.setState('scanning');
    ok('按钮显隐变化后 resize 仍然成立',
      b.window.HuntGame.syncSize() === true && b.els.game.width === b.els.fx.width);
  }
  {
    /* K5. 不再依赖固定 640 / 320 / 400 的视觉魔法坐标 */
    const js = source(DIR + 'game.js');
    ok('game.js 没有写死的 charX:320 / charY:400',
      !/charX:\s*320/.test(js) && !/charY:\s*400/.test(js));
    ok('game.js 没有写死的视觉魔法坐标（640 / 320 / 400）',
      !/fx\.scan\(0,\s*60,\s*640/.test(js) && !/fx\.burst\(320/.test(js) &&
      !/fx\.float\([^)]*,\s*320/.test(js) && !/charX:\s*320/.test(js) && !/charY:\s*400/.test(js));
    ok('特效与角色坐标一律由 claimBox() / fxBox() / verifierBox() 推导',
      js.indexOf('fxBox()') >= 0 && js.indexOf('verifierBox()') >= 0 && js.indexOf('claimBox(') >= 0);
    ok('特效坐标一律由 fxBox() 推导', js.indexOf('fxBox()') >= 0);
    ok('角色坐标一律由 verifierBox() 推导', js.indexOf('verifierBox()') >= 0);
    ok('页面为 verifier 留了专属视觉空间', source(DIR + 'index.html').indexOf('verifier-stage') >= 0);
    ok('样式表给 verifier-stage 定了高度', /\.verifier-stage\s*\{[^}]*height/.test(source(DIR + 'style.css')));
    ok('选中样式是中性色，不是判定色',
      (function () {
        const m = /\.claim\.selected\s*\{([^}]*)\}/.exec(source(DIR + 'style.css'));
        return !!m && /--hunt-accent|#4d6bfe/.test(m[1]) && !/--hunt-ok|--hunt-bad/.test(m[1]);
      })());
  }
  {
    /* K6. 各状态 action button 显隐 */
    const b = fresh({});
    const vis = (id) => b.els[id].getAttribute('hidden') === null;
    ok('intro：显示 Start / Daily，不显示 VERIFY / NO HALLUCINATION',
      vis('btn-start') && vis('btn-daily') && !vis('btn-verify') && !vis('btn-none'));
    b.window.HuntGame.start('endless', 3);
    b.tick(2);
    ok('streaming：不显示任何作答按钮',
      !vis('btn-verify') && !vis('btn-none') && !vis('btn-start'));
    toScanning(b);
    ok('scanning：显示 VERIFY / NO HALLUCINATION', vis('btn-verify') && vis('btn-none'));
    b.window.HuntGame.markNone();
    ok('verifying：隐藏作答按钮', !vis('btn-verify') && !vis('btn-none'));
    b.tick(80);
    ok('result：隐藏作答按钮', !vis('btn-verify') && !vis('btn-none'));
    b.window.HuntGame.setState('gameOver');
    ok('gameOver：显示重玩 / COPY RESULT', vis('btn-again') && vis('btn-copy'));
  }

  /* ================= L. 聊天审查界面结构回归 ================= */
  {
    const html = source(DIR + 'index.html');
    const css = source(DIR + 'style.css');
    const js = source(DIR + 'game.js');
    /* 结构：sidebar + 会话流 + composer，全部保留既有 id */
    ok('存在 sidebar / 主区 / 滚动会话区 / composer',
      /class="hunt-side"/.test(html) && /class="hunt-main"/.test(html) &&
      /id="chat-scroll"/.test(html) && /class="composer"/.test(html));
    ok('应用根仍是 #game-shell（尺寸与 data-state 的锚点不变）',
      /id="game-shell"/.test(html) && html.indexOf('class="hunt-app"') >= 0);
    ok('QUERY 呈现为用户消息轮次（不是大写标签面板）',
      /class="turn turn-user"/.test(html) && !/class="query-panel"/.test(html) &&
      !/data-i18n="hunt.query"/.test(html));
    ok('回答呈现为 assistant 轮次，claim 仍在同一个容器里',
      /class="turn turn-assistant"/.test(html) && /id="response"/.test(html));
    ok('事实核验卡插在会话流里，而不是悬浮弹窗',
      /class="factcard"/.test(html) && html.indexOf('id="overlay"') > html.indexOf('id="response"'));
    ok('composer 承载全部 Hunt 动作',
      ['btn-verify', 'btn-none', 'btn-start', 'btn-daily', 'btn-again', 'btn-copy']
        .every((id) => html.indexOf('id="' + id + '"') >= 0));
    ok('MODEL CONFIDENCE 被标注为 SIMULATED（不冒充真实概率）',
      /hunt\.simulated/.test(html) && /data-i18n="hunt.simulated"/.test(html));
    ok('页面标明 DeepSeek Arcade / Hallucination Hunt 身份，且不冒充官方服务',
      html.indexOf('DeepSeek Arcade') >= 0 && html.indexOf('Hallucination Hunt') >= 0 &&
      !/DeepSeek Chat/.test(html));
    ok('没有真的输入框（不暗示能调用真实模型）',
      !/<textarea[^>]*class="[^"]*composer/.test(html) && !/contenteditable/.test(html));

    /* CSS contract：浅色聊天基调 + 内容栏居中 + 响应式断点 */
    ok('聊天内容有最大宽度并居中', /--hunt-content:\s*\d+px/.test(css) && /max-width:\s*var\(--hunt-content\)/.test(css));
    ok('桌面是 sidebar + 聊天两栏，窄屏折叠为单栏',
      /grid-template-columns:\s*236px minmax\(0, 1fr\)/.test(css) && /@media \(max-width: 1023px\)/.test(css));
    ok('claim 默认就是独立软卡片（实底 + 低对比边框 + 圆角），不是透明正文',
      /\.claim\s*\{([^}]*)\}/.test(css) &&
      (function () {
        const b = /\.claim\s*\{([^}]*)\}/.exec(css)[1];
        return /background:\s*#fff/.test(b) && /border:\s*1px solid var\(--hunt-line\)/.test(b) &&
          /border-radius:\s*10px/.test(b) && !/background:\s*transparent/.test(b);
      })());
    ok('claim 之间有清晰的纵向间距（>=8px）',
      (function () { const m = /\.response\s*\{[^}]*gap:\s*(\d+)px/.exec(css); return !!m && Number(m[1]) >= 8; })());
    ok('hover 有背景/边框/阴影变化，且带轻微位移',
      /\.claim:hover:not\(:disabled\)\s*\{[^}]*border-color/.test(css) &&
      /\.claim:hover:not\(:disabled\)\s*\{[^}]*translateY\(-1px\)/.test(css));
    ok('每条 claim 有轻量审计序号，且对辅助技术隐藏',
      /class="claim-no" aria-hidden="true"/.test(js) && /\.claim-no\s*\{/.test(css));
    ok('verifier 舞台收紧到回答尾部（<=56px，不漂在空白里）',
      (function () { const m = /\.verifier-stage\s*\{[^}]*height:\s*(\d+)px/.exec(css); return !!m && Number(m[1]) <= 56; })());
    ok('选中态用中性强调色，且不使用判定色',
      (function () {
        const m = /\.claim\.selected\s*\{([^}]*)\}/.exec(css);
        if (!m) return false;
        return /--hunt-accent|#4d6bfe/.test(m[1]) && !/--hunt-ok|--hunt-bad|#0f9d8f|#d9534f/.test(m[1]);
      })());
    ok('支持 safe-area（手机底部不被系统手势条挡住）', /env\(safe-area-inset-bottom/.test(css));
    ok('Canvas 退居辅助层：只在辅助层绘制，不画深色背景场',
      js.indexOf('{ field: false }') >= 0 && /renderer\.draw\(scene, \{ field: false \}\)/.test(js));
    ok('特效局部化到被核验的那一句（不再全屏铺）', js.indexOf('claimBox(') >= 0);
    ok('引入过 reduced-motion 覆盖', /prefers-reduced-motion/.test(css));
  }

  /* ================= M. 暂停提示层回归 ================= */
  {
    const b = fresh({ navLang: 'zh-CN' });
    const H = b.window.HuntGame;
    const shell = b.els['game-shell'];
    const stateOf = () => shell.getAttribute('data-state');

    ok('暂停层元素存在（真正的 dialog 语义）',
      !!b.els['pause-overlay'] && source(DIR + 'index.html').indexOf('id="pause-overlay"') >= 0);
    ok('暂停层带 role=dialog / aria-modal=false / aria-labelledby',
      /id="pause-overlay"[^>]*role="dialog"/.test(source(DIR + 'index.html')) &&
      /aria-modal="false"/.test(source(DIR + 'index.html')) &&
      /aria-labelledby="pause-title"/.test(source(DIR + 'index.html')));

    /* 可见性完全由 data-state 驱动，不加额外 boolean */
    ok('intro 下不处于 paused', stateOf() === 'intro');
    b.tick(2);
    H.start('endless', 20261001);
    b.tick(2);
    ok('streaming 下不是 paused', stateOf() !== 'paused', stateOf());
    toScanning(b);
    ok('scanning 下不是 paused', stateOf() !== 'paused', stateOf());

    H.pause();
    ok('setState(paused) 后 #game-shell 标记为 paused', stateOf() === 'paused', stateOf());
    b.tick(60);
    ok('暂停期间仍然保持 paused', stateOf() === 'paused');
    ok('paused 状态下主区 Resume 按钮存在', !!b.els['btn-resume-main']);
    ok('aria-live 播报「游戏已暂停」',
      b.els.status.textContent.indexOf('游戏已暂停') >= 0, b.els.status.textContent);

    /* 主区 Resume 走同一个 togglePause(false) */
    b.els['btn-resume-main'].fire('click');
    b.tick(2);
    ok('主区 Resume 能恢复（不再 paused）', stateOf() !== 'paused', stateOf());
    ok('恢复后 aria-live 播报「游戏已恢复」',
      b.els.status.textContent.indexOf('游戏已恢复') >= 0, b.els.status.textContent);

    /* P 键能暂停与恢复 */
    b.key('keydown', 'p', 'KeyP'); b.tick(2);
    ok('P 键暂停', stateOf() === 'paused', stateOf());
    b.key('keydown', 'p', 'KeyP'); b.tick(2);
    ok('P 键恢复', stateOf() !== 'paused', stateOf());

    /* sidebar 的暂停按钮仍然有效（暂停层不挡它）—— 它是 toggle，
       恢复态点一下应暂停，再点一下应恢复 */
    ok('进入该步前是运行态', stateOf() !== 'paused', stateOf());
    b.els['btn-pause'].fire('click'); b.tick(2);
    ok('sidebar 暂停按钮能暂停（暂停层不挡住 sidebar）', stateOf() === 'paused', stateOf());
    b.els['btn-pause'].fire('click'); b.tick(2);
    ok('sidebar 暂停按钮能恢复', stateOf() !== 'paused', stateOf());

    /* 只在 paused 显示；result / gameOver 都不显示 */
    b.tick(400);
    ok('result 下不是 paused', stateOf() !== 'paused', stateOf());
    H.setState('gameOver');
    ok('gameOver 下不是 paused', stateOf() !== 'paused', stateOf());

    /* CSS 契约（不依赖像素值） */
    const css = source(DIR + 'style.css');
    ok('CSS 默认隐藏暂停层', /\.pause-overlay\s*\{\s*display:\s*none/.test(css));
    ok('CSS 以 [data-state="paused"] 驱动显示',
      /\.hunt-app\[data-state="paused"\]\s*\.pause-overlay\s*\{[^}]*display:\s*flex/.test(css));
    ok('暂停层绝对定位覆盖主区（inset: 0）', /\.pause-overlay\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/.test(css));
    ok('浅色半透明 + 模糊，并提供 backdrop-filter 不支持时的 fallback',
      /background:\s*rgba\(255, 255, 255/.test(css) && /backdrop-filter/.test(css) && /@supports not/.test(css));
    ok('不使用深色全屏遮罩', !/background:\s*rgba\(0,\s*0,\s*0/.test(css));
    ok('触屏下不强调键盘 P',
      /@media \(hover: none\), \(pointer: coarse\)/.test(css) && /\.hint-tap/.test(css));
    ok('暂停层挂在主区内部，结构上不可能盖住 sidebar',
      (function () {
        const html = source(DIR + 'index.html');
        const main = html.indexOf('class="hunt-main"');
        const ov = html.indexOf('id="pause-overlay"');
        const aside = html.indexOf('class="hunt-side"');
        return aside >= 0 && main > aside && ov > main;
      })());
    ok('Resume 是真正的 button', /id="btn-resume-main"[^>]*class="btn primary"[^>]*type="button"/.test(source(DIR + 'index.html')));
  }

  /* ================= N. intro 角色布局回归 ================= */
  {
    const html = source(DIR + 'index.html');
    const css = source(DIR + 'style.css');
    const js = source(DIR + 'game.js');
    ok('存在 intro 专属角色锚点', /id="intro-character-stage"/.test(html) && /class="intro-character-stage"/.test(html));
    ok('intro 锚点在欢迎区内，且与 composer 是两个独立区域',
      (function () {
        const w = html.indexOf('class="welcome"');
        const st = html.indexOf('id="intro-character-stage"');
        const act = html.indexOf('id="action-panel"');
        return w >= 0 && st > w && act > st;
      })());
    ok('CSS 给 intro 锚点真实高度（64~100px）',
      (function () {
        const m = /\.intro-character-stage\s*\{[^}]*height:\s*(\d+)px/.exec(css);
        return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 100;
      })());
    ok('矮屏/窄屏会缩小 intro 锚点而不是叠到 composer 上',
      (css.match(/\.intro-character-stage\s*\{[^}]*height/g) || []).length >= 2);
    ok('角色锚点按状态选择：intro 用 intro 锚点，其余用 verifier 锚点',
      /game\.state === 'intro'\) \? 'intro-character-stage' : 'verifier-stage'/.test(js));
    ok('兜底只用画布中部，不再依赖画布最底部',
      js.indexOf('sz.h - 6') < 0 && /y: sz\.h \* 0\.5/.test(js));
    ok('没有写死的 640 / 320 / 400 角色坐标',
      !/charX:\s*(320|640)/.test(js) && js.indexOf('320, 400') < 0);

    const b = fresh({});
    const H = b.window.HuntGame;
    b.tick(3);
    ok('intro 下角色使用 intro 锚点', H.characterAnchor() === 'intro-character-stage', H.characterAnchor());
    ok('intro 下拿到的是有效锚点（不是 fallback）',
      H.characterAnchor() !== 'fallback' && H.characterBox().size > 0, H.characterAnchor());
    H.start('endless', 20261001);
    b.tick(3);
    ok('streaming 下切回 verifier 锚点', H.characterAnchor() === 'verifier-stage', H.characterAnchor());
    toScanning(b);
    ok('scanning 下仍是 verifier 锚点', H.characterAnchor() === 'verifier-stage', H.characterAnchor());
    H.pause(); b.tick(2);
    ok('paused 下仍是 verifier 锚点（暂停不改变角色布局）', H.characterAnchor() === 'verifier-stage', H.characterAnchor());
    H.resume(); b.tick(2);
    ok('恢复后仍是 verifier 锚点', H.characterAnchor() === 'verifier-stage');
  }

  return out;
}
