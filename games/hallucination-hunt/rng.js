/* ============================================================
 * HALLUCINATION HUNT — 确定性伪随机数发生器（seeded PRNG）
 *
 * 核心内容生成**禁止**直接调用 Math.random()：相同的 seed 必须产出完全相同的
 * Fact / Mutation / Claim 顺序 / Confidence / Round，这样单元测试与 Daily Hunt
 * 才可复现。
 *
 * 算法：mulberry32（32 位状态，周期 2^32，分布好、代码只有几行）。
 * 用 IIFE + window 命名空间，保持 file:// 直接打开也能用（不依赖 ES Module）。
 *
 *   var rng = HuntRNG.create(123456);
 *   rng.next()            -> [0, 1)
 *   rng.int(1, 5)         -> 1..5（含两端）
 *   rng.pick(['a','b'])   -> 均匀取一个
 *   rng.shuffle(arr)      -> 返回打乱后的新数组（不改原数组）
 *   rng.fork('mutate')    -> 由当前 seed 派生出的独立子流
 * ============================================================ */
(function (global) {
  'use strict';

  /* mulberry32：单状态 32 位，足够本项目使用 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 字符串 -> 32 位无符号整数（FNV-1a 变体）。用于把 "2026-10-01" 变成当天 seed。 */
  function hashString(str) {
    var h = 2166136261 >>> 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    /* 再混一次，避免短字符串低位规律性太强 */
    h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }

  function create(seed) {
    var base = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : hashString(seed);
    var next = mulberry32(base);
    var api = {
      seed: base,
      next: next,
      /* 含两端的整数区间；参数非法时退化为 0 */
      int: function (min, max) {
        var lo = Math.ceil(Number(min) || 0);
        var hi = Math.floor(Number(max) || 0);
        if (hi < lo) { var t = lo; lo = hi; hi = t; }
        if (!isFinite(lo) || !isFinite(hi)) return 0;
        return lo + Math.floor(next() * (hi - lo + 1));
      },
      pick: function (arr) {
        if (!arr || !arr.length) return undefined;
        return arr[Math.floor(next() * arr.length) % arr.length];
      },
      bool: function (p) { return next() < (p === undefined ? 0.5 : p); },
      /* Fisher-Yates，返回新数组 */
      shuffle: function (arr) {
        var a = (arr || []).slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      /* 从数组里挑 n 个不重复的（n 超界时返回全量打乱） */
      sample: function (arr, n) {
        var s = api.shuffle(arr);
        return s.slice(0, Math.max(0, Math.min(n, s.length)));
      },
      /* 派生独立子流：同 seed + 同 label 永远得到同一条子流 */
      fork: function (label) { return create(hashString(base + ':' + label)); }
    };
    return api;
  }

  /* 本地日期 -> 当天 seed（YYYY-MM-DD）。不访问任何网络。 */
  function fromDate(dateStr) {
    return hashString('hunt-daily:' + String(dateStr));
  }
  function todayString(d) {
    var t = d || new Date();
    var m = t.getMonth() + 1, day = t.getDate();
    return t.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  global.HuntRNG = {
    create: create,
    mulberry32: mulberry32,
    hashString: hashString,
    fromDate: fromDate,
    todayString: todayString
  };
})(window);
