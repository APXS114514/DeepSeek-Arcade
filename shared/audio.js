/* ============================================================
 * DeepSeek Arcade — 共享音效工具（Web Audio API，不引用任何音频资源）
 * 同时负责全站统一的 Sound 开关（localStorage: arcade.sound）。
 *
 * 用法：
 *   ArcadeAudio.tone({ type: 'square', from: 420, to: 880, ms: 120, gain: 0.05 });
 *   ArcadeAudio.isEnabled('whaleRunner.sound')  // 读统一开关，必要时从旧 key 迁移
 *   ArcadeAudio.setEnabled(false) / ArcadeAudio.toggle()
 *   ArcadeAudio.available()   // 环境是否支持
 *
 * Sound 状态优先级（第一次读取时确定）：
 *   arcade.sound  >  当前游戏自己的旧 key  >  默认 on
 * 读到旧 key 会顺手写入 arcade.sound 完成迁移，但**不删除**旧 key，方便回退。
 *
 * 说明：Whale Runner 内部保留它自己那套 beep()（三段包络是专门调过的），
 * 只让它用这里的 isEnabled/toggle 读写统一开关，音色不动。
 * 任何浏览器不允许的情况下都静默失败，绝不影响游戏。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'arcade.sound';
  var ctx = null;
  var enabled = null;        // 懒加载：第一次读取时才决定（可能要从旧 key 迁移）

  function readRaw(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; } catch (e) { return null; }
  }
  function writeRaw(key, value) {
    try { if (global.localStorage) global.localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* arcade.sound 优先；没有就看这个页面自己的旧 key；再没有就默认开。
   * 迁移只认当前游戏的旧 key，不会把别的游戏的静音状态传染过来。 */
  function loadState(legacyKey) {
    var v = readRaw(STORAGE_KEY);
    if (v === 'on' || v === 'off') return v === 'on';
    if (legacyKey) {
      var old = readRaw(legacyKey);
      if (old === 'on' || old === 'off') {
        writeRaw(STORAGE_KEY, old);      // 迁移：写入统一 key，旧 key 保留
        return old === 'on';
      }
    }
    return true;
  }

  function isEnabled(legacyKey) {
    if (enabled === null) enabled = loadState(legacyKey);
    return enabled;
  }
  function setEnabled(on) {
    enabled = !!on;
    writeRaw(STORAGE_KEY, enabled ? 'on' : 'off');
    return enabled;
  }
  function toggle() { return setEnabled(!isEnabled()); }

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
    if (!o || !isEnabled()) return;      // 全站静音时任何声音都不发
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
    STORAGE_KEY: STORAGE_KEY,
    tone: tone,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    toggle: toggle,
    available: function () { return !!(global.AudioContext || global.webkitAudioContext); },
    context: ac
  };
})(window);
