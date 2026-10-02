/* ============================================================
 * HALLUCINATION HUNT — 独立视觉特效系统
 *
 * 只负责「看起来发生了什么」，不碰任何游戏规则。所有特效都是时间驱动的，
 * 暂停时由调用方停止 update() 即可整体冻结。
 *
 * 效果：particles / floating text / flash / screen shake / scan beam /
 *       glitch slices / RGB split / confidence pulse
 *
 * 两条工程约束：
 *   1. OffscreenCanvas 是 **Progressive Enhancement** —— 有就用（离屏合成 glitch），
 *      没有就用主 Canvas 直接画，游戏必须完全可玩；
 *   2. prefers-reduced-motion 开启时，自动关闭/大幅削弱抖动、RGB 位移、glitch 与
 *      大面积粒子，只保留必要的状态提示。
 * ============================================================ */
(function (global) {
  'use strict';

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var reduced = !!opts.reducedMotion;
    var W = 1, H = 1, dpr = 1, time = 0;

    var parts = [], floats = [];
    var shakeAmt = 0, flashAmt = 0, flashColor = '#ffffff';
    var beam = null, glitchAmt = 0, rgbAmt = 0, pulseAmt = 0;

    var glitchSource = opts.glitchSource || null;   // glitch 切片采样哪张画布
    var offscreen = null;
    function probeOffscreen() {
      if (reduced) { offscreen = null; return; }
      try {
        if (typeof global.OffscreenCanvas === 'function') {
          offscreen = new global.OffscreenCanvas(1, 1);
          if (!offscreen.getContext || !offscreen.getContext('2d')) offscreen = null;
        }
      } catch (e) { offscreen = null; }
    }
    probeOffscreen();

    function resize(w, h, ratio) {
      W = Math.max(1, w | 0); H = Math.max(1, h | 0);
      dpr = Math.max(1, Math.min(ratio || 1, 3));
      if (canvas) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      if (ctx && ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      else if (ctx && ctx.scale) ctx.scale(dpr, dpr);
      if (offscreen) {
        try { offscreen.width = Math.round(W * dpr); offscreen.height = Math.round(H * dpr); }
        catch (e) { offscreen = null; }
      }
    }

    function setReduced(on) { reduced = !!on; probeOffscreen(); }
    function isReduced() { return reduced; }
    function hasOffscreen() { return !!offscreen; }

    /* ---------------- 触发接口 ---------------- */
    function burst(x, y, n, color, power) {
      var count = reduced ? Math.min(6, n) : n;
      var scale = reduced ? 0.5 : 1;
      for (var i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2 + (x % 7) * 0.1;
        var sp = (40 + (i % 6) * 26) * scale * (power || 1);
        parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
          life: 520, max: 520, color: color || '#4d6bfe', size: reduced ? 2 : 3 });
      }
    }
    function float(text, x, y, color) {
      if (!text) return;
      floats.push({ text: String(text), x: x, y: y, life: 1100, max: 1100, color: color || '#9db4ff' });
    }
    function flash(color, amount) {
      if (reduced) { flashAmt = Math.max(flashAmt, Math.min(amount === undefined ? 0.35 : amount, 0.18)); }
      else flashAmt = Math.max(flashAmt, amount === undefined ? 0.35 : amount);
      flashColor = color || '#ffffff';
    }
    function shake(amount) {
      var a = amount === undefined ? 10 : amount;
      shakeAmt = Math.max(shakeAmt, reduced ? Math.min(a, 2) : a);
    }
    function scan(x, y, w, h, ms) {
      beam = { x: x, y: y, w: w, h: h, t: 0, ms: ms || 620 };
    }
    function glitch(amount) {
      glitchAmt = Math.max(glitchAmt, reduced ? 0 : (amount === undefined ? 1 : amount));
    }
    function rgbSplit(amount) {
      rgbAmt = Math.max(rgbAmt, reduced ? 0 : (amount === undefined ? 1 : amount));
    }
    function pulse(amount) { pulseAmt = Math.max(pulseAmt, amount === undefined ? 1 : amount); }
    function clearFx() {
      parts.length = 0; floats.length = 0;
      shakeAmt = 0; flashAmt = 0; beam = null; glitchAmt = 0; rgbAmt = 0; pulseAmt = 0;
    }

    /* ---------------- 推进（暂停时不要调用） ---------------- */
    function update(dt) {
      if (!(dt > 0)) return;
      time += dt * 1000;
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= dt * 1000;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      for (var j = floats.length - 1; j >= 0; j--) {
        var f = floats[j];
        f.life -= dt * 1000; f.y -= 26 * dt;
        if (f.life <= 0) floats.splice(j, 1);
      }
      if (beam) { beam.t += dt * 1000; if (beam.t >= beam.ms) beam = null; }
      var decay = dt * 1000;
      shakeAmt = Math.max(0, shakeAmt - shakeAmt * 0.14 - decay * 0.02);
      flashAmt = Math.max(0, flashAmt - dt * 1.9);
      glitchAmt = Math.max(0, glitchAmt - dt * 3.2);
      rgbAmt = Math.max(0, rgbAmt - dt * 1.6);
      pulseAmt = Math.max(0, pulseAmt - dt * 1.1);
    }

    /* ---------------- 绘制 ----------------
     * 分两层调用：drawBackdrop() 在 DOM 内容之下，drawOverlay() 在其上。 */
    function drawBackdrop(c) {
      var g = c || ctx;
      if (!g) return;
      g.save && g.save();
      if (shakeAmt > 0.01 && !reduced) {
        var sx = (Math.sin(time * 0.09) * shakeAmt) * 0.6;
        var sy = (Math.cos(time * 0.13) * shakeAmt) * 0.6;
        if (g.translate) g.translate(sx, sy);
      }
      /* 深色底 + 扫描线纹理 */
      g.fillStyle = '#061024';
      if (g.fillRect) g.fillRect(-20, -20, W + 40, H + 40);
      if (g.fillStyle !== undefined) g.fillStyle = '#0b1c38';
      for (var y = 0; y < H; y += 4) if (g.fillRect) g.fillRect(0, y, W, 1);

      if (pulseAmt > 0.01) {
        if (g.globalAlpha !== undefined) g.globalAlpha = Math.min(0.22, pulseAmt * 0.22);
        g.fillStyle = '#4d6bfe';
        if (g.fillRect) g.fillRect(0, 0, W, H);
        if (g.globalAlpha !== undefined) g.globalAlpha = 1;
      }
      g.restore && g.restore();
    }

    function drawOverlay(c) {
      var g = c || ctx;
      if (!g) return;
      /* glitch 切片：优先用 OffscreenCanvas 离屏合成，没有就直接自绘 */
      if (glitchAmt > 0.02) {
        drawGlitch(g, glitchAmt);
      }
      if (rgbAmt > 0.02 && g.globalCompositeOperation !== undefined) {
        var prev = g.globalCompositeOperation;
        try {
          g.globalCompositeOperation = 'lighter';
          if (g.globalAlpha !== undefined) g.globalAlpha = Math.min(0.3, rgbAmt * 0.22);
          g.fillStyle = '#ff3355';
          if (g.fillRect) g.fillRect(Math.round(rgbAmt * 4), 0, W, H);
          g.fillStyle = '#33ddff';
          if (g.fillRect) g.fillRect(-Math.round(rgbAmt * 4), 0, W, H);
          g.globalCompositeOperation = prev;
          if (g.globalAlpha !== undefined) g.globalAlpha = 1;
        } catch (e) { /* 某些实现不支持合成模式，忽略即可 */ }
      }

      /* 扫描光束 */
      if (beam) {
        var prog = beam.t / beam.ms;
        var by = beam.y + beam.h * prog;
        if (g.globalAlpha !== undefined) g.globalAlpha = Math.sin(prog * Math.PI) * 0.85;
        g.fillStyle = '#7fe3f0';
        if (g.fillRect) g.fillRect(beam.x, by - 2, beam.w, 4);
        g.fillStyle = '#ffffff';
        if (g.fillRect) g.fillRect(beam.x, by - 1, beam.w, 1);
        if (g.globalAlpha !== undefined) g.globalAlpha = 1;
      }

      /* 粒子 */
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (g.globalAlpha !== undefined) g.globalAlpha = Math.max(0, p.life / p.max);
        g.fillStyle = p.color;
        if (g.fillRect) g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      /* 浮动文字 */
      for (var j = 0; j < floats.length; j++) {
        var f = floats[j];
        if (g.globalAlpha !== undefined) g.globalAlpha = Math.max(0, f.life / f.max);
        g.fillStyle = f.color;
        g.font = 'bold 14px ui-monospace, monospace';
        if (g.textAlign !== undefined) g.textAlign = 'center';
        if (g.fillText) g.fillText(f.text, f.x, f.y);
      }
      if (g.globalAlpha !== undefined) g.globalAlpha = 1;

      /* 全屏闪 */
      if (flashAmt > 0.01) {
        if (g.globalAlpha !== undefined) g.globalAlpha = Math.min(0.55, flashAmt);
        g.fillStyle = flashColor;
        if (g.fillRect) g.fillRect(0, 0, W, H);
        if (g.globalAlpha !== undefined) g.globalAlpha = 1;
      }
    }

    function drawGlitch(g, amt) {
      var slices = 3 + Math.round(amt * 3);
      for (var i = 0; i < slices; i++) {
        var sy = Math.floor((Math.sin(i * 12.9898 + time * 0.004) * 0.5 + 0.5) * (H - 8));
        var sh = 3 + Math.round(Math.abs(Math.cos(i * 78.233 + time * 0.006)) * 10);
        var dx = Math.sin(i * 43.7 + time * 0.02) * 14 * amt;
        var src = glitchSource || canvas;
        try {
          if (g.drawImage && src) g.drawImage(src, 0, sy * dpr, src.width, sh * dpr, dx, sy, W, sh);
        } catch (e) { /* 采样失败就跳过这一片，绝不影响可玩性 */ }
      }
    }

    return {
      resize: resize, update: update, clear: clearFx,
      burst: burst, float: float, flash: flash, shake: shake,
      scan: scan, glitch: glitch, rgbSplit: rgbSplit, pulse: pulse,
      drawBackdrop: drawBackdrop, drawOverlay: drawOverlay,
      setReduced: setReduced, isReduced: isReduced, hasOffscreen: hasOffscreen,
      counts: function () { return { particles: parts.length, floats: floats.length }; },
      state: function () {
        return { shake: shakeAmt, flash: flashAmt, glitch: glitchAmt, rgb: rgbAmt,
          pulse: pulseAmt, beam: !!beam, time: time };
      }
    };
  }

  global.HuntEffects = { create: create };
})(window);
