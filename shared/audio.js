/* ============================================================
 * DeepSeek Arcade — 共享音效工具（Web Audio API，不引用任何音频资源）
 *
 * 用法：
 *   ArcadeAudio.tone({ type: 'square', from: 420, to: 880, ms: 120, gain: 0.05 });
 *   ArcadeAudio.available()   // 环境是否支持
 *
 * 说明：Whale Runner 内部保留了它自己那套 beep()（三段包络是专门调过的），
 * 这里只服务于 Context Snake 及以后的新游戏，避免为了统一而改动已稳定的跑酷手感。
 * 任何浏览器不允许的情况下都静默失败，绝不影响游戏。
 * ============================================================ */
(function (global) {
  'use strict';

  var ctx = null;

  function ac() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(o) {
    if (!o) return;
    var c = ac();
    if (!c) return;
    try {
      var ms = o.ms || 120;
      var gain = o.gain === undefined ? 0.05 : o.gain;
      var t = c.currentTime;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.from || 440, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + ms / 1000);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch (e) { /* 无音频环境时静默 */ }
  }

  global.ArcadeAudio = {
    tone: tone,
    available: function () { return !!(global.AudioContext || global.webkitAudioContext); },
    context: ac
  };
})(window);
