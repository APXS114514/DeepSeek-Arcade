/* ============================================================
 * HALLUCINATION HUNT — 难度导演（Difficulty Director）
 *
 * 独立模块，不碰任何 DOM / Canvas。它把玩家最近的表现压成一个 skill 值，
 * 再映射到 LOAD 1~5。三条硬约束：
 *   1. 稳定  —— skill 用 EMA 平滑（0.8 / 0.2），不会因为单题剧烈跳动；
 *   2. 有边界 —— LOAD 恒在 1~5，单轮变化最多 ±1；
 *   3. 可解释 —— 暴露 stats()，每个数字都能说明来源。
 *
 * 设计取向：表现好 -> LOAD 上升（优秀表现**不会**让难度回落）；
 * 连续失误 -> skill 下降 -> LOAD 回落，所以也不会无限往上顶。
 *
 *   var d = HuntDifficulty.create();
 *   d.record({ correct: true, reactionMs: 2400, falseAlarm: false, missed: false });
 *   d.load()   -> 1..5
 * ============================================================ */
(function (global) {
  'use strict';

  var WINDOW = 8;              // 滚动窗口：最近 8 轮
  var ALPHA = 0.2;             // EMA 权重
  var MAX_STEP = 1;            // 单轮 LOAD 最大变化
  var SLOW_MS = 12000;         // 超过这个反应时间视为「慢」
  var FAST_MS = 2200;          // 这个以内视为「快」

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function safeNum(v, dflt) {
    var n = Number(v);
    return (typeof v === 'number' && isFinite(n)) ? n : dflt;
  }

  function create(opts) {
    opts = opts || {};
    var startLoad = clamp(Math.round(safeNum(opts.startLoad, 1)), 1, 5);
    var recent = [];                 // 最近若干轮的表现分 0..1
    var rounds = 0, correct = 0, falseAlarms = 0, misses = 0;
    var streak = 0, bestStreak = 0;
    var reactionSum = 0, reactionN = 0;
    var skill = safeNum(opts.skill, 0.18);
    var load = startLoad;

    function windowAccuracy() {
      if (!recent.length) return null;
      var s = 0;
      for (var i = 0; i < recent.length; i++) s += recent[i];
      return s / recent.length;
    }

    /* 一轮表现 -> 0..1 的分。反应越快分越高（但有上下限，极端值不会污染）。 */
    function performance(r) {
      var score = r.correct ? 0.72 : 0.12;
      if (r.correct && !r.falseAlarm && !r.missed) score += 0.08;
      var rt = safeNum(r.reactionMs, 0);
      if (r.correct && rt > 0) {
        var speed = 1 - clamp((rt - FAST_MS) / (SLOW_MS - FAST_MS), 0, 1);
        score += 0.2 * speed;
      }
      return clamp(score, 0, 1);
    }

    function targetLoad() {
      /* skill 0..1 -> LOAD 1..5；四舍五入比 floor 更平滑，也更容易到 5 */
      return clamp(1 + Math.round(skill * 4), 1, 5);
    }

    function record(r) {
      r = r || {};
      rounds++;
      if (r.correct) { correct++; streak++; if (streak > bestStreak) bestStreak = streak; }
      else { streak = 0; }
      if (r.falseAlarm) falseAlarms++;
      if (r.missed) misses++;

      var rt = safeNum(r.reactionMs, 0);
      if (rt > 0) { reactionSum += rt; reactionN++; }

      var perf = performance(r);
      recent.push(perf);
      if (recent.length > WINDOW) recent.shift();

      skill = clamp(skill * (1 - ALPHA) + perf * ALPHA, 0, 1);

      var want = targetLoad();
      var step = clamp(want - load, -MAX_STEP, MAX_STEP);
      load = clamp(load + step, 1, 5);
      return load;
    }

    function stats() {
      return {
        rounds: rounds,
        load: load,
        skill: skill,
        streak: streak,
        bestStreak: bestStreak,
        accuracy: rounds ? correct / rounds : 0,
        windowAccuracy: windowAccuracy(),
        falsePositiveRate: rounds ? falseAlarms / rounds : 0,
        missRate: rounds ? misses / rounds : 0,
        avgReactionMs: reactionN ? reactionSum / reactionN : 0
      };
    }

    return {
      record: record,
      load: function () { return load; },
      skill: function () { return skill; },
      stats: stats,
      reset: function () {
        recent = []; rounds = 0; correct = 0; falseAlarms = 0; misses = 0;
        streak = 0; bestStreak = 0; reactionSum = 0; reactionN = 0;
        skill = 0.18; load = startLoad;
      }
    };
  }

  global.HuntDifficulty = {
    create: create,
    WINDOW: WINDOW,
    ALPHA: ALPHA,
    MAX_STEP: MAX_STEP
  };
})(window);
