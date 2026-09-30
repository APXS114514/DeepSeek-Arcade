/* ============================================================
 * DeepSeek Arcade — 大厅脚本
 * 只做两件事：把三个游戏的本地最高分填进卡片；用代码画卡片预览图。
 * 语言与切换由 shared/i18n.js 负责，这里不重复实现。
 * ============================================================ */
(function () {
  'use strict';

  var HIGH_KEYS = {
    runner: 'whaleRunner.high',          // Whale Runner 沿用原有 key，不动它的历史最高分
    snake: 'arcade.snake.high',          // Context Snake 独立 key
    tokenFall: 'arcade.tokenFall.high'   // Token Fall 独立 key，三者互不覆盖
  };

  function readInt(key) {
    try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) { return 0; }
  }

  function paintHighScores() {
    var nodes = document.querySelectorAll('[data-highscore]');
    for (var i = 0; i < nodes.length; i++) {
      var which = nodes[i].getAttribute('data-highscore');
      var v = readInt(HIGH_KEYS[which] || '');
      nodes[i].textContent = v > 0 ? String(v) : '—';
    }
  }

  /* ---------------- 卡片预览：纯代码像素画，不引用任何图片 ---------------- */
  var QMARK = [
    '.XXXX.',
    'XX..XX',
    '....XX',
    '..XXX.',
    '..XX..',
    '......',
    '..XX..'
  ];
  var URCHIN = [
    '..X..X..',
    'XXXXXXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    '..X..X..'
  ];

  /* Token Fall 预览用的鲸鱼：和 Whale Runner / Token Fall 游戏里同一只
   * （DeepSeek logo 光栅化出的 24×18 字符画，这里只取第一帧）。 */
  var WHALE_LOGO = [
    '.......X....X...........',
    '......XX....XXXXXXXX....',
    'XXX..XXX....XXXXXXXXX...',
    'XXXXXXXX...XXXXXXXXXXX..',
    '.XXXXXX...XXXXXXXXXXXXX.',
    '..XXXX...XXXXXXXXXXXXXXX',
    '....XX.XXXXXXXXXXXXXXXXX',
    '....XXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXXooooooXX',
    '....XXXXooXXXXXoooooooXX',
    '.....XXXXXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXXX',
    '......XXXXXXXooooooooXX.',
    '......XXXXXXoooXooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '.....XXXXXooXXXXXXXXX...',
    '......XX..XXXXXXXXXX....',
    '...........XXXXXXX......'
  ];

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

  function previewRunner(ctx, w, h) {
    seaBackground(ctx, w, h, '#08152c', '#2a4a86');
    var px = 2;
    pixels(ctx, WHALE_LOGO, px, 24, h - 14 - 18 * px, { X: '#4d6bfe', o: '#c9dcff' });
    pixels(ctx, URCHIN, 5, w - 78, h - 14 - 5 * 5, { X: '#8d6ce0' });
    pixels(ctx, URCHIN, 4, w - 44, h - 14 - 5 * 4, { X: '#e07a8e' });
  }

  function previewSnake(ctx, w, h) {
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
    ctx.fillStyle = '#4d6bfe';
    ctx.fillRect(24 + 7 * cell, 18 + 7 * 7, cell - 3, cell - 3);
    ctx.fillStyle = 'rgba(159,240,255,0.9)';
    ctx.fillRect(w - 56, 26, 14, 14);
    ctx.fillStyle = '#0b1b34';
    ctx.fillRect(w - 52, 30, 6, 6);
  }

  /* TOKEN FALL：小鲸鱼 + 往下掉的 TOKEN / COMPRESS / NOISE */
  function previewTokenFall(ctx, w, h) {
    seaBackground(ctx, w, h, '#07132a', '#16305c');
    var px = 2;
    pixels(ctx, WHALE_LOGO, px, 30, h - 14 - 18 * px, { X: '#4d6bfe', o: '#c9dcff' });
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

  function previewSoon(ctx, w, h) {
    seaBackground(ctx, w, h, '#08152c', '#16305c');
    ctx.globalAlpha = 0.5;
    pixels(ctx, QMARK, 8, Math.round(w / 2 - 3 * 8), Math.round(h / 2 - 3.5 * 8), { X: '#6f8fc8' });
    ctx.globalAlpha = 1;
  }

  function setup(id, draw) {
    var cv = document.getElementById(id);
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var w = 224;
    var h = 120;
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    if (ctx.scale) ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    draw(ctx, w, h);
  }

  function drawPreviews() {
    setup('preview-runner', previewRunner);
    setup('preview-snake', previewSnake);
    setup('preview-tokenfall', previewTokenFall);
    setup('preview-soon2', previewSoon);
  }

  paintHighScores();
  drawPreviews();
  if (window.I18N && window.I18N.onChange) window.I18N.onChange(drawPreviews);
})();