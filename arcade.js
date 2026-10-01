/* ============================================================
 * DeepSeek Arcade — 大厅脚本
 * 只做三件事：把各游戏的本地最高分填进卡片；画卡片预览图；
 * 提供全站角色外观（经典鲸鱼 / 鲸鱼娘）的循环按钮。
 *
 * 卡片预览复用 shared/character.js，不自己建素材加载系统：
 * 当前皮肤是图片皮肤时，预览会跑一个很轻的 rAF 只用来推进角色动画时间。
 * 语言与切换由 shared/i18n.js 负责，角色状态由 shared/character.js 负责，
 * 这里都不重复实现。
 * ============================================================ */
(function () {
  'use strict';

  var HIGH_KEYS = {
    runner: 'whaleRunner.high',          // Whale Runner 沿用原有 key，不动它的历史最高分
    snake: 'arcade.snake.high',          // Context Snake 独立 key
    tokenFall: 'arcade.tokenFall.high',  // Token Fall 独立 key，五者互不覆盖
    breaker: 'arcade.breakerHighScore'    // Context Breaker 独立 key
  };
  /* Attention Maze 没有传统高分，首页显示“最高解锁到第几层” */
  var MAZE_PROGRESS_KEY = 'arcade.attentionMaze.progress';
  var MAZE_LAYERS = 12;

  function readMazeLayer() {
    try {
      var raw = localStorage.getItem(MAZE_PROGRESS_KEY);
      if (!raw) return 0;
      var data = JSON.parse(raw);
      var u = parseInt(data && data.unlocked, 10);
      if (!isFinite(u) || u < 1) return 0;
      return Math.max(1, Math.min(MAZE_LAYERS, u));
    } catch (e) { return 0; }
  }

  function readInt(key) {
    try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) { return 0; }
  }

  function paintHighScores() {
    var nodes = document.querySelectorAll('[data-highscore]');
    for (var i = 0; i < nodes.length; i++) {
      var which = nodes[i].getAttribute('data-highscore');
      if (which === 'maze') {
        var layer = readMazeLayer();
        nodes[i].textContent = layer > 0
          ? (layer < 10 ? '0' : '') + layer + ' / ' + MAZE_LAYERS
          : '—';
        continue;
      }
      var v = readInt(HIGH_KEYS[which] || '');
      nodes[i].textContent = v > 0 ? String(v) : '—';
    }
  }

  /* ---------------- 全站 Sound 开关（shared/audio.js 负责存取） ---------------- */
  var ArcadeAudio = window.ArcadeAudio || null;

  function updateSoundButton() {
    var btn = document.getElementById('sound');
    if (!btn) return;
    var on = ArcadeAudio ? ArcadeAudio.isEnabled() : true;
    var I = window.I18N;
    btn.textContent = (I && I.t) ? (on ? I.t('btn.sound') : I.t('btn.muted')) : (on ? '🔊' : '🔇');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleSound() {
    if (ArcadeAudio) ArcadeAudio.toggle();
    updateSoundButton();
    if (ArcadeAudio && ArcadeAudio.isEnabled()) {
      ArcadeAudio.tone({ type: 'triangle', from: 880, to: 1180, ms: 90, gain: 0.04 });
    }
  }
  var soundBtn = document.getElementById('sound');
  if (soundBtn) soundBtn.addEventListener('click', toggleSound);

  /* ---------------- 全站角色外观：三态循环按钮 + 让预览跟着皮肤走 ---------------- */
  var ArcadeCharacter = window.ArcadeCharacter || null;

  /* 身体 / 头像的预览绘制。素材没就绪（或当前是经典皮肤）时返回 false，
   * 调用方照常画代码像素小鲸鱼，所以切换过程中不会出现空窗。 */
  function skinBody(ctx, state, cx, bottom, h, time) {
    if (!ArcadeCharacter) return false;
    var m = ArcadeCharacter.measure(state, h);
    return ArcadeCharacter.draw(ctx, state, cx - m.w / 2, bottom - m.h, m.w, m.h, { time: time });
  }
  function skinHead(ctx, state, cx, cy, size, time) {
    if (!ArcadeCharacter) return false;
    return ArcadeCharacter.draw(ctx, state, cx - size / 2, cy - size / 2, size, size, { time: time });
  }

  function updateSkinButton() {
    var btn = document.getElementById('skin');
    if (!btn) return;
    var I = window.I18N;
    var info = ArcadeCharacter ? ArcadeCharacter.getSkinInfo() : null;
    var key = (info && info.label) || 'skin.classic';
    var fallback = ArcadeCharacter ? ArcadeCharacter.getSkin() : 'classic';
    btn.textContent = (I && I.t) ? I.t(key) : fallback;
    btn.setAttribute('aria-pressed', (ArcadeCharacter && ArcadeCharacter.getSkin() !== 'classic') ? 'true' : 'false');
    var aria = (I && I.t) ? I.t('skin.aria') : 'Switch character skin';
    btn.setAttribute('title', aria);
    btn.setAttribute('aria-label', aria);
  }
  function cycleSkin() {
    if (!ArcadeCharacter) return;
    ArcadeCharacter.cycleSkin();                // 立刻写入 arcade.characterSkin
    updateSkinButton();
    drawPreviews(previewTime);                  // 四张卡片预览同步换人，不需要刷新页面
    syncPreviewLoop();
    if (ArcadeAudio && ArcadeAudio.isEnabled()) {
      ArcadeAudio.tone({ type: 'triangle', from: 620, to: 980, ms: 110, gain: 0.04 });
    }
  }
  var skinBtn = document.getElementById('skin');
  if (skinBtn) {
    skinBtn.addEventListener('click', cycleSkin);
    /* 用户把鼠标移到 / 键盘聚焦到按钮上时，顺手把「下一套」皮肤预加载了，
     * 真的按下切换时通常已经 ready，不会先闪一下经典鲸鱼。 */
    var warmNextSkin = function () { if (ArcadeCharacter) ArcadeCharacter.preloadNext(); };
    skinBtn.addEventListener('pointerenter', warmNextSkin);
    skinBtn.addEventListener('focus', warmNextSkin);
    skinBtn.addEventListener('pointerdown', warmNextSkin);
  }
  if (ArcadeCharacter) {
    /* 换皮肤、以及当前皮肤素材加载完成后都重画一次 */
    ArcadeCharacter.onChange(function () {
      updateSkinButton();
      drawPreviews(previewTime);
      syncPreviewLoop();
    });
  }

  /* ---------------- 预览动画时钟 ----------------
   * 只有画得出来的图片皮肤才转 rAF；经典皮肤保持「画一次就完事」。
   * dt 做了钳制，切走标签页回来不会一次性把角色动画追帧跑完。 */
  var previewTime = 0;
  var previewLast = 0;
  var previewRaf = 0;

  function previewAnimating() {
    return !!(ArcadeCharacter && ArcadeCharacter.getSkinInfo().image && ArcadeCharacter.isActive());
  }
  function previewTick(now) {
    previewRaf = 0;
    if (!previewLast) previewLast = now;
    var dt = now - previewLast;
    previewLast = now;
    if (dt > 250) dt = STEP_MS;
    previewTime += Math.max(0, dt);
    drawPreviews(previewTime);
    if (previewAnimating() && typeof window.requestAnimationFrame === 'function') {
      previewRaf = window.requestAnimationFrame(previewTick);
    } else {
      previewLast = 0;
    }
  }
  function syncPreviewLoop() {
    var want = previewAnimating() && typeof window.requestAnimationFrame === 'function';
    if (want && !previewRaf) { previewLast = 0; previewRaf = window.requestAnimationFrame(previewTick); }
    else if (!want && previewRaf) { window.cancelAnimationFrame(previewRaf); previewRaf = 0; }
  }
  var STEP_MS = 1000 / 60;

  /* ---------------- 卡片预览：经典形态是纯代码像素画 ---------------- */
  var URCHIN = [
    '..X..X..',
    'XXXXXXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    '..X..X..'
  ];

  /* 卡片预览用的小鲸鱼：和游戏里同一份素材（shared/whale.js），不再单独存一份 */
  var WHALE_LOGO = (window.ArcadeWhale && window.ArcadeWhale.NORMAL_A) || [];

  /* 预览图上的字也要跟着语言走（切语言时整个预览会重画一次） */
  function ctxLabel() {
    var I = window.I18N;
    return (I && I.t) ? I.t('tokenfall.ctxLabel') : 'CONTEXT';
  }

  function pixels(ctx, rows, px, ox, oy, colors) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch] || colors.X;
        ctx.fillRect(ox + c * px, oy + r * px, px, px);
      }
    }
  }

  function seaBackground(ctx, w, h, deep, sand) {
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,175,255,0.10)';
    for (var x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
    for (var y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = sand;
    ctx.fillRect(0, h - 14, w, 2);
    ctx.fillStyle = 'rgba(160,190,235,0.30)';
    for (var i = 0; i < 6; i++) ctx.fillRect(10 + i * 38, h - 8, 12, 2);
  }

  function previewRunner(ctx, w, h, time) {
    seaBackground(ctx, w, h, '#08152c', '#2a4a86');
    var px = 2;
    /* 素材没加载好 / 还是经典皮肤时 skinBody 返回 false，这里继续画像素小鲸鱼 */
    if (!skinBody(ctx, 'walk', 48, h - 14, 52, time)) {
      pixels(ctx, WHALE_LOGO, px, 24, h - 14 - 18 * px, { X: '#4d6bfe', o: '#c9dcff' });
    }
    pixels(ctx, URCHIN, 5, w - 78, h - 14 - 5 * 5, { X: '#8d6ce0' });
    pixels(ctx, URCHIN, 4, w - 44, h - 14 - 5 * 4, { X: '#e07a8e' });
  }

  function previewSnake(ctx, w, h, time) {
    seaBackground(ctx, w, h, '#08152c', '#16305c');
    var cell = 14;
    for (var i = 0; i < 7; i++) {
      var t = i / 6;
      var c = Math.round(150 - 90 * t);
      ctx.fillStyle = 'rgb(' + (c - 60) + ',' + (c - 30) + ',' + Math.min(255, c + 120) + ')';
      ctx.fillRect(24 + i * cell, 18 + i * 7, cell - 3, cell - 3);
    }
    ctx.fillStyle = '#dbe7ff';
    ctx.fillRect(24 + 7 * cell + 2, 18 + 7 * 7 + 2, 5, 5);
    if (!skinHead(ctx, 'head', 24 + 7 * cell + (cell - 3) / 2, 18 + 7 * 7 + (cell - 3) / 2, cell + 4, time)) {
      ctx.fillStyle = '#4d6bfe';
      ctx.fillRect(24 + 7 * cell, 18 + 7 * 7, cell - 3, cell - 3);
    }
    ctx.fillStyle = 'rgba(159,240,255,0.9)';
    ctx.fillRect(w - 56, 26, 14, 14);
    ctx.fillStyle = '#0b1b34';
    ctx.fillRect(w - 52, 30, 6, 6);
  }

  /* TOKEN FALL：小鲸鱼 + 往下掉的 TOKEN / COMPRESS / NOISE */
  function previewTokenFall(ctx, w, h, time) {
    seaBackground(ctx, w, h, '#07132a', '#16305c');
    var px = 2;
    if (!skinBody(ctx, 'idle', 54, h - 14, 52, time)) {
      pixels(ctx, WHALE_LOGO, px, 30, h - 14 - 18 * px, { X: '#4d6bfe', o: '#c9dcff' });
    }
    var items = [
      { x: 34, y: 22, color: '#4d6bfe', hi: '#a8c4ff', ch: 'T' },
      { x: 100, y: 12, color: '#2ee6ff', hi: '#d4fbff', ch: 'C' },
      { x: 166, y: 30, color: '#a24bff', hi: '#e3b9ff', ch: 'N' }
    ];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var s = 17;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = it.hi;
      ctx.fillRect(it.x - 2, it.y - 2, s + 4, s + 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = it.color;
      ctx.fillRect(it.x, it.y, s, s);
      ctx.fillStyle = it.hi;
      ctx.fillRect(it.x, it.y, s, 2);
      ctx.fillRect(it.x, it.y, 2, s);
      ctx.fillStyle = '#03102b';
      ctx.font = 'bold 11px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.ch, it.x + s / 2, it.y + s / 2 + 1);
    }
    /* CONTEXT 条：一眼看出「接物 + 管理上下文」 */
    ctx.fillStyle = 'rgba(120,170,255,0.20)';
    ctx.fillRect(w - 74, 16, 56, 5);
    ctx.fillStyle = '#ffc061';
    ctx.fillRect(w - 74, 16, 42, 5);
    ctx.fillStyle = 'rgba(6,16,36,0.65)';
    ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = '#9fb6dd';
    ctx.font = 'bold 7px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctxLabel() + ' 768/1024', 6, 4);
  }

  /* ATTENTION MAZE：小鲸鱼 + QUERY/KEY 注意力连线（粗细亮度不同）+ 出口 */
  function previewMaze(ctx, w, h, time) {
    seaBackground(ctx, w, h, '#07102a', '#16305c');
    var walls = [[12, 26, 30, 9], [54, 26, 26, 9], [12, 50, 26, 9], [92, 52, 34, 9], [12, 78, 44, 9], [104, 26, 30, 9]];
    for (var i = 0; i < walls.length; i++) {
      ctx.fillStyle = '#152542';
      ctx.fillRect(walls[i][0], walls[i][1], walls[i][2], walls[i][3]);
      ctx.fillStyle = '#1d3157';
      ctx.fillRect(walls[i][0], walls[i][1], walls[i][2], 2);
    }
    /* QUERY -> KEY 的注意力连线：低权重细而暗，最高权重粗且带亮点 */
    var q = [46, 68];
    var ks = [[104, 44, 0.31], [150, 70, 0.88], [84, 98, 0.52]];
    for (var j = 0; j < ks.length; j++) {
      var k = ks[j];
      var size = k[2] >= 0.8 ? 3 : (k[2] >= 0.5 ? 2 : 1);
      ctx.fillStyle = k[2] >= 0.75 ? '#bff0ff' : '#4fa8d8';
      ctx.globalAlpha = 0.25 + 0.6 * k[2];
      for (var s = 0; s <= 24; s += 2) {
        ctx.fillRect(Math.round(q[0] + (k[0] - q[0]) * s / 24), Math.round(q[1] + (k[1] - q[1]) * s / 24), size, size);
      }
      ctx.globalAlpha = 1;
      if (j === 1) {
        for (var b = 1; b <= 3; b++) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(q[0] + (k[0] - q[0]) * b / 4) - 1, Math.round(q[1] + (k[1] - q[1]) * b / 4) - 1, 3, 3);
        }
      }
      ctx.fillStyle = j === 1 ? '#9ff0d8' : '#28c8d8';
      ctx.fillRect(k[0] - 7, k[1] - 7, 14, 14);
      ctx.fillStyle = j === 1 ? '#053a2c' : '#04303f';
      ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('K', k[0], k[1] + 1);
    }
    ctx.fillStyle = '#4d6bfe';
    ctx.fillRect(q[0] - 7, q[1] - 7, 14, 14);
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q', q[0], q[1] + 1);
    /* 出口 */
    ctx.fillStyle = '#3ddc84';
    ctx.fillRect(176, 30, 16, 16);
    ctx.fillStyle = '#07240f';
    ctx.fillRect(181, 34, 6, 8);
    /* 小鲸鱼（和其他卡片同一只；换皮肤后变成鲸鱼娘的小头像） */
    if (!skinHead(ctx, 'head', 176, h - 14 - 14, 30, time)) {
      pixels(ctx, WHALE_LOGO, 2, 152, h - 14 - 18 * 2, { X: '#4d6bfe', o: '#c9dcff' });
    }
  }


  /* CONTEXT BREAKER 预览：自成一体的迷你打砖块（不依赖其它预览的小工具） */
  function previewBreaker(ctx, w, h, time) {
    var palette = [['#4d6bfe', '#9db4ff'], ['#22a5b8', '#7fe3f0'], ['#8b5cf6', '#c4b5fd'], ['#d99a1f', '#ffd77a']];
    var bw = 17, bh = 7, gap = 3;
    var cols = Math.floor((w - 12 + gap) / (bw + gap));
    var x0 = (w - (cols * (bw + gap) - gap)) / 2;
    for (var r = 0; r < palette.length; r++) {
      var offset = (r % 2) ? (bw + gap) / 2 : 0;
      for (var c = 0; c < cols; c++) {
        var x = x0 + c * (bw + gap) + offset;
        if (x + bw > w - 5) continue;
        var y = 12 + r * (bh + gap);
        ctx.fillStyle = palette[r][0];
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = palette[r][1];
        ctx.fillRect(x, y, bw, 2);
      }
    }
    var t = (typeof time === 'number' ? time : 0) / 1000;
    var cx = w / 2, py = h - 18;
    var bx = cx + Math.sin(t * 1.35) * (w * 0.3);
    var by = 50 + Math.abs(Math.cos(t * 1.35)) * (h - 92);
    ctx.fillStyle = '#ffd77a';
    ctx.beginPath();
    if (ctx.arc) ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4d6bfe';
    ctx.fillRect(cx - 25, py, 50, 6);
    ctx.fillStyle = '#9db4ff';
    ctx.fillRect(cx - 25, py, 50, 2);

    var drawn = false;
    if (window.ArcadeCharacter && window.ArcadeCharacter.draw) {
      var m = window.ArcadeCharacter.measure('idle', 24);
      drawn = window.ArcadeCharacter.draw(ctx, 'idle', cx - m.w / 2, py - m.h - 1, m.w, m.h, { time: time });
    }
    if (!drawn && window.ArcadeWhale && window.ArcadeWhale.NORMAL_A) {
      var rows = window.ArcadeWhale.NORMAL_A;
      for (var rr = 0; rr < rows.length; rr++) {
        for (var cc = 0; cc < rows[rr].length; cc++) {
          var ch = rows[rr].charAt(cc);
          if (ch === '.') continue;
          ctx.fillStyle = ch === 'o' ? '#c9dcff' : '#4d6bfe';
          ctx.fillRect(cx - 12 + cc, py - rows.length - 1 + rr, 1, 1);
        }
      }
    }
  }

  var PREVIEW_W = 224;
  var PREVIEW_H = 120;
  var previewCtx = {};

  function setup(id, draw, time) {
    var cv = document.getElementById(id);
    if (!cv || !cv.getContext) return;
    var ctx = previewCtx[id];
    if (!ctx) {
      ctx = cv.getContext('2d');
      if (!ctx) return;
      previewCtx[id] = ctx;
      var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      cv.width = Math.round(PREVIEW_W * dpr);
      cv.height = Math.round(PREVIEW_H * dpr);
      if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      else if (ctx.scale) ctx.scale(dpr, dpr);
    }
    /* 预览底色 / 经典像素画保持硬边；角色模块会临时改再改回来 */
    ctx.imageSmoothingEnabled = false;
    draw(ctx, PREVIEW_W, PREVIEW_H, time);
  }

  function drawPreviews(time) {
    var t = typeof time === 'number' ? time : 0;
    setup('preview-runner', previewRunner, t);
    setup('preview-snake', previewSnake, t);
    setup('preview-tokenfall', previewTokenFall, t);
    setup('preview-maze', previewMaze, t);
    setup('preview-breaker', previewBreaker, t);
  }

  paintHighScores();
  drawPreviews(previewTime);
  updateSoundButton();
  updateSkinButton();
  syncPreviewLoop();
  if (window.I18N && window.I18N.onChange) {
    window.I18N.onChange(function () {
      drawPreviews(previewTime);
      updateSoundButton();
      updateSkinButton();
    });
  }
})();