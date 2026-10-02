/* ============================================================
 * HALLUCINATION HUNT — 场景渲染器（背景画布层）
 *
 * DOM 负责文字（QUERY / RESPONSE / Claim / HUD），这一层负责画面：
 * 深色背景、网格、以及鲸鱼 / 鲸鱼娘 verifier。
 *
 * 角色只走 shared/character.js 的语义状态；本文件**不出现任何素材文件名**。
 * 角色模块没有 happy，这里用最接近的 jump（跃起）表达「判断正确」，
 * 并在 CHAR_STATES 里显式声明，测试会校验每个映射都真实存在。
 * ============================================================ */
(function (global) {
  'use strict';

  /* 逻辑状态 -> 共享角色模块的真实语义状态 */
  var CHAR_STATES = {
    idle: 'idle',
    think: 'think',
    correct: 'jump',
    startle: 'startle',
    blocked: 'blocked'
  };

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var W = 1, H = 1, dpr = 1;
    var whale = global.ArcadeWhale || {};
    var char = global.ArcadeCharacter || null;
    var reduced = !!opts.reducedMotion;

    function resize(w, h, ratio) {
      W = Math.max(1, w | 0); H = Math.max(1, h | 0);
      dpr = Math.max(1, Math.min(ratio || 1, 3));
      if (canvas) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      if (ctx && ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      else if (ctx && ctx.scale) ctx.scale(dpr, dpr);
    }

    function charStateFor(logical) {
      return CHAR_STATES[logical] || CHAR_STATES.idle;
    }

    function drawSprite(rows, px, x, y, ink) {
      if (!ctx || !rows || !rows.length) return;
      for (var r = 0; r < rows.length; r++) {
        var line = rows[r];
        for (var c = 0; c < line.length; c++) {
          var ch = line.charAt(c);
          if (ch === '.') continue;
          ctx.fillStyle = ch === 'o' ? (ink.o || '#c9dcff') : (ink.X || '#4d6bfe');
          ctx.fillRect(x + c * px, y + r * px, px, px);
        }
      }
    }

    /* 背景：深色 + 细网格 + 轻微的竖向渐变块（不用渐变 API，保持桩环境可用） */
    function drawBackdrop(scene) {
      if (!ctx) return;
      ctx.fillStyle = '#061024';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0a1730';
      for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = '#0d2144';
      for (var x = 0; x < W; x += 28) ctx.fillRect(x, 0, 1, H);
      if (scene && scene.glow > 0.01) {
        ctx.globalAlpha = Math.min(0.25, scene.glow * 0.25);
        ctx.fillStyle = '#4d6bfe';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }

    function drawCharacter(scene) {
      if (!ctx) return false;
      scene = scene || {};
      var st = charStateFor(scene.charState);
      var size = Math.max(16, scene.charSize || 84);
      var cx = scene.charX === undefined ? W * 0.5 : scene.charX;
      var cy = scene.charY === undefined ? H - 28 : scene.charY;
      var drawn = false;
      if (char && char.draw) {
        var m = char.measure ? char.measure(st, size) : { w: size, h: size };
        drawn = char.draw(ctx, st, cx - m.w / 2, cy - m.h, m.w, m.h,
          { time: scene.time || 0, flip: !!scene.flip });
      }
      if (!drawn && whale.NORMAL_A) {
        var rows = (scene.flip && whale.mirror) ? whale.mirror(whale.NORMAL_A) : whale.NORMAL_A;
        var px = Math.max(1, Math.round(size / (rows.length || 18)));
        var sw = rows[0].length * px, sh = rows.length * px;
        drawSprite(rows, px, cx - sw / 2, cy - sh, { X: '#4d6bfe', o: '#c9dcff' });
      }
      return drawn;
    }

    /* 每帧调用：先背景、再角色。FX 由 HuntEffects 画在覆盖层画布上。 */
    function draw(scene) {
      drawBackdrop(scene);
      return drawCharacter(scene);
    }

    return {
      resize: resize,
      draw: draw,
      drawBackdrop: drawBackdrop,
      drawCharacter: drawCharacter,
      charStateFor: charStateFor,
      CHAR_STATES: CHAR_STATES,
      setReduced: function (on) { reduced = !!on; },
      available: !!ctx,
      size: function () { return { w: W, h: H, dpr: dpr }; }
    };
  }

  global.HuntRenderer = { create: create, CHAR_STATES: CHAR_STATES };
})(window);
