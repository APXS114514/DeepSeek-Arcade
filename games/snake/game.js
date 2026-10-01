/* ============================================================
 * Context Snake — DeepSeek Arcade
 * 经典贪吃蛇，蓝色像素海域：吃 TOKEN 让 CONTEXT 变长，
 * 低概率出现的 THINK 会进入 4 秒 DEEP THINK（减速 + 泛蓝光）。
 * 原生 Canvas 2D，零依赖：经典形态下鲸鱼头/TOKEN/网格/粒子全部代码绘制；
 * 可选的 Whale-chan 皮肤只把「蛇头」那一格换成仓库自带的第三方 WebP（CC BY 4.0）。
 * 与 Whale Runner 共用 shared/i18n.js（文案）与 shared/audio.js（音效）。
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  /* ---------------- 网格与画布 ---------------- */
  var CELL = 24;          // 每格逻辑像素
  var COLS = 30;
  var ROWS = 20;
  var PX = 3;             // 像素块大小（CELL 要能被它整除，保证像素硬边）
  var HUD_H = 30;         // 顶部信息条高度
  var GX = 0;
  var GY = HUD_H;
  var FW = COLS * CELL;   // 场地宽
  var FH = ROWS * CELL;   // 场地高
  var W = FW;
  var H = HUD_H + FH;

  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  /* ---------------- 多语言 / 音效 ---------------- */
  var I18N = window.I18N || null;
  function T(key) { return (I18N && I18N.t) ? I18N.t(key) : key; }
  var ArcadeAudio = window.ArcadeAudio || null;
  /* 全站统一 Sound：arcade.sound 优先，其次才是本游戏的老 key（读到就迁移） */
  var soundOn = ArcadeAudio ? ArcadeAudio.isEnabled('arcade.snake.sound') : true;

  function tone(o) { if (soundOn && ArcadeAudio && ArcadeAudio.tone) ArcadeAudio.tone(o); }

  function updateSoundButton() {
    var btn = document.getElementById('sound');
    if (!btn) return;
    btn.textContent = soundOn ? T('btn.sound') : T('btn.muted');
    btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }
  function toggleSound() {
    soundOn = ArcadeAudio ? ArcadeAudio.toggle() : !soundOn;
    updateSoundButton();
    if (soundOn) tone({ type: 'triangle', from: 880, to: 1180, ms: 90, gain: 0.04 });
  }
  if (I18N && I18N.onChange) I18N.onChange(function () { updateSoundButton(); });

  /* ---------------- 手感常量 ---------------- */
  var STEP = 1000 / 60;        // 固定步长
  var BASE_STEP_MS = 150;      // 起始速度：每格 150ms
  var STEP_DEC = 4;            // 每吃一个 TOKEN 提速 4ms
  var MIN_STEP_MS = 72;        // 速度上限：每格 72ms（再快就没法玩了）
  var THINK_MS = 4000;         // DEEP THINK 持续时长
  var THINK_SLOW = 1.7;        // 期间每格耗时 ×1.7（明显但克制的减速）
  var THINK_CHANCE = 0.25;     // 吃完 TOKEN 后出现 THINK 的概率
  var THINK_COOLDOWN = 26;     // 两次 THINK 至少间隔这么多格
  var THINK_MIN_TOKENS = 3;    // 至少吃过这么多 TOKEN 才有机会见到
  var CTX_PER_TOKEN = 8;       // 一个 TOKEN 增加多少 CONTEXT
  var START_LEN = 3;

  /* ---------------- 调色 ---------------- */
  var BLUE = [77, 107, 254];
  var BLUE_LIGHT = [150, 180, 255];
  var DEEP = [16, 38, 86];

  function mix(a, b, t) {
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* ---------------- 角色皮肤（Classic Whale / Whale-chan） ----------------
   * 只换「蛇头」这一格：身体仍然是 Context 像素块，游戏的识别度不变。
   * 网格、CELL、移动与判定完全不动 —— 素材只是画在那一格上的贴图。 */
  var ArcadeCharacter = window.ArcadeCharacter || null;

  /* ---------------- 精灵：小鲸鱼头（朝右，旋转贴到四个方向） ---------------- */
  var HEAD = [
    '..XXXX..',
    '.XXXXXX.',
    'XXXXeXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '.XX..XX.'
  ];

  function drawSprite(rows, px, x, y, colors) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var c = 0;
      while (c < row.length) {
        var ch = row.charAt(c);
        if (ch === '.') { c++; continue; }
        var start = c;
        while (c < row.length && row.charAt(c) === ch) c++;
        ctx.fillStyle = colors[ch] || colors.X;
        ctx.fillRect(x + start * px, y + r * px, (c - start) * px, px);
      }
    }
  }

  /* ---------------- 状态 ---------------- */
  var game = {
    state: 'ready',          // ready | running | paused | over
    dir: { x: 1, y: 0 },
    pending: [],             // 输入队列（最多 2 个，防止一次 tick 内连转两次）
    snake: [],
    food: null,
    think: null,
    eatCount: 0,
    context: 0,
    high: 0,
    thinkMs: 0,
    thinkCooldown: 0,
    moveAcc: 0,
    msPerCell: BASE_STEP_MS,
    overCooldown: 0,
    particles: []
  };

  try {
    var saved = parseInt(localStorage.getItem('arcade.snake.high') || '0', 10);
    if (isFinite(saved) && saved > 0) game.high = saved;
  } catch (e) { /* 隐私模式忽略 */ }

  function saveHigh() {
    try { localStorage.setItem('arcade.snake.high', String(game.high)); } catch (e) { /* ignore */ }
  }

  /* ---------------- 局面 ---------------- */
  function freeCells() {
    var taken = {};
    for (var i = 0; i < game.snake.length; i++) taken[game.snake[i].x + ',' + game.snake[i].y] = 1;
    if (game.think) taken[game.think.x + ',' + game.think.y] = 1;
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) if (!taken[x + ',' + y]) free.push({ x: x, y: y });
    }
    return free;
  }

  function spawnFood() {
    var free = freeCells();
    game.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function maybeSpawnThink() {
    if (game.think || game.thinkMs > 0 || game.thinkCooldown > 0) return;
    if (game.eatCount < THINK_MIN_TOKENS) return;
    if (Math.random() >= THINK_CHANCE) return;
    var head = game.snake[0];
    var pool = freeCells().filter(function (c) {
      return Math.abs(c.x - head.x) + Math.abs(c.y - head.y) >= 3;   // 别贴脸刷
    });
    if (!pool.length) return;
    game.think = pool[Math.floor(Math.random() * pool.length)];
  }

  function burst(gx, gy, color) {
    for (var i = 0; i < 9; i++) {
      var a = (Math.PI * 2 * i) / 9 + Math.random() * 0.6;
      game.particles.push({
        x: GX + gx * CELL + CELL / 2,
        y: GY + gy * CELL + CELL / 2,
        vx: Math.cos(a) * (0.6 + Math.random() * 1.4),
        vy: Math.sin(a) * (0.6 + Math.random() * 1.4),
        life: 1,
        color: color
      });
    }
  }

  function reset() {
    var cy = Math.floor(ROWS / 2);
    game.snake = [];
    for (var i = 0; i < START_LEN; i++) game.snake.push({ x: 4 - i, y: cy });
    game.dir = { x: 1, y: 0 };
    game.pending = [];
    game.eatCount = 0;
    game.context = 0;
    game.think = null;
    game.thinkMs = 0;
    game.thinkCooldown = 0;
    game.moveAcc = 0;
    game.msPerCell = BASE_STEP_MS;
    game.overCooldown = 0;
    game.particles = [];
    game.food = null;
    spawnFood();
  }

  function start() {
    reset();
    game.state = 'running';
  }

  function stepMs() {
    var base = Math.max(MIN_STEP_MS, BASE_STEP_MS - game.eatCount * STEP_DEC);
    return game.thinkMs > 0 ? base * THINK_SLOW : base;
  }

  function gameOver() {
    game.state = 'over';
    game.overCooldown = 24;
    if (game.context > game.high) game.high = game.context;
    saveHigh();
    tone({ type: 'sawtooth', from: 320, to: 70, ms: 420, gain: 0.07 });
  }

  function eatToken() {
    var fx = game.food.x;
    var fy = game.food.y;
    game.eatCount++;
    game.context += CTX_PER_TOKEN;
    if (game.context > game.high) { game.high = game.context; saveHigh(); }
    burst(fx, fy, BLUE_LIGHT);
    tone({ type: 'square', from: 520, to: 880, ms: 90, gain: 0.05 });
    spawnFood();
    maybeSpawnThink();
  }

  function eatThink() {
    var tx = game.think.x;
    var ty = game.think.y;
    game.think = null;
    game.thinkMs = THINK_MS;
    game.thinkCooldown = THINK_COOLDOWN;
    burst(tx, ty, [200, 245, 255]);
    tone({ type: 'triangle', from: 660, to: 1320, ms: 220, gain: 0.055 });
  }

  /* ---------------- 输入 ---------------- */
  function queueDir(nx, ny) {
    if (game.state === 'ready') start();
    else if (game.state === 'over') { if (game.overCooldown <= 0) start(); else return; }
    else if (game.state === 'paused') game.state = 'running';
    if (game.state !== 'running') return;

    /* 关键：拿"最后一个已排队的方向"比较，而不是当前方向。
     * 否则快速连按（比如右 -> 上 -> 左）会在同一 tick 内被当成 180° 反向放过去。 */
    var last = game.pending.length ? game.pending[game.pending.length - 1] : game.dir;
    if (last.x === -nx && last.y === -ny) return;   // 禁止原地掉头
    if (last.x === nx && last.y === ny) return;     // 同方向不入队
    /* 队列满就忽略这次输入。注意不能 shift() 丢队首：
     * 队首正是"后面那个方向合法"的依据，丢掉它会让后续方向绕过校验、变成非法反向。 */
    if (game.pending.length >= 2) return;
    game.pending.push({ x: nx, y: ny });
  }

  function togglePause() {
    if (game.state === 'running') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'running';
  }

  function tapAction() {
    if (game.state === 'ready') start();
    else if (game.state === 'over') { if (game.overCooldown <= 0) start(); }
    else if (game.state === 'running') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'running';
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    var c = e.code;
    function stop() { if (e.preventDefault) e.preventDefault(); }
    if (c === 'ArrowUp' || c === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W') { stop(); queueDir(0, -1); return; }
    if (c === 'ArrowDown' || c === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') { stop(); queueDir(0, 1); return; }
    if (c === 'ArrowLeft' || c === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') { stop(); queueDir(-1, 0); return; }
    if (c === 'ArrowRight' || c === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') { stop(); queueDir(1, 0); return; }
    if (c === 'KeyP' || k === 'p' || k === 'P' || k === 'Escape') { stop(); togglePause(); return; }
    if (c === 'KeyM' || k === 'm' || k === 'M') { stop(); toggleSound(); return; }
    if (c === 'Space' || k === ' ') { stop(); tapAction(); }
  });

  /* 触屏：十字键 + 画布滑动都支持 */
  function bindPad(id, nx, ny) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', function (e) {
      if (e.preventDefault) e.preventDefault();
      queueDir(nx, ny);
    });
  }
  bindPad('up', 0, -1);
  bindPad('down', 0, 1);
  bindPad('left', -1, 0);
  bindPad('right', 1, 0);

  var swipe = null;
  var SWIPE_MIN = 22;

  canvas.addEventListener('pointerdown', function (e) {
    if (e.preventDefault) e.preventDefault();
    swipe = { x: e.clientX || 0, y: e.clientY || 0, moved: false };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!swipe) return;
    var dx = (e.clientX || 0) - swipe.x;
    var dy = (e.clientY || 0) - swipe.y;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 1 : -1, 0);
    else queueDir(0, dy > 0 ? 1 : -1);
    swipe = { x: e.clientX || 0, y: e.clientY || 0, moved: true };
  });
  canvas.addEventListener('pointerup', function () {
    if (swipe && !swipe.moved) tapAction();
    swipe = null;
  });
  canvas.addEventListener('pointercancel', function () { swipe = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  var soundBtn = document.getElementById('sound');
  if (soundBtn) soundBtn.addEventListener('click', function () { toggleSound(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.state === 'running') game.state = 'paused';
  });

  /* 页面离开就停掉循环，避免 requestAnimationFrame 继续空转 */
  var stopped = false;
  function stopLoop() { stopped = true; }
  document.addEventListener('pagehide', stopLoop);
  if (window.addEventListener) window.addEventListener('pagehide', stopLoop);

  updateSoundButton();

  /* ---------------- 逻辑 ---------------- */
  function moveCell() {
    if (game.pending.length) game.dir = game.pending.shift();
    var head = game.snake[0];
    var nx = head.x + game.dir.x;
    var ny = head.y + game.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { gameOver(); return; }

    var eats = !!(game.food && nx === game.food.x && ny === game.food.y);
    /* 这一步尾巴会腾出来（除非正好吃到东西），所以尾巴那一格不算撞 */
    var limit = eats ? game.snake.length : game.snake.length - 1;
    for (var i = 0; i < limit; i++) {
      if (game.snake[i].x === nx && game.snake[i].y === ny) { gameOver(); return; }
    }

    game.snake.unshift({ x: nx, y: ny });
    if (eats) eatToken();
    else game.snake.pop();

    if (game.state !== 'running') return;
    if (game.think && nx === game.think.x && ny === game.think.y) eatThink();
    if (game.thinkCooldown > 0) game.thinkCooldown--;
  }

  function updateParticles(dt) {
    for (var i = game.particles.length - 1; i >= 0; i--) {
      var p = game.particles[i];
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.life -= dt / 420;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  function step(dt) {
    updateParticles(dt);
    if (game.state === 'over' && game.overCooldown > 0) game.overCooldown--;
    if (game.state !== 'running') return;

    if (game.thinkMs > 0) {
      game.thinkMs -= dt;
      if (game.thinkMs < 0) game.thinkMs = 0;
    }

    game.msPerCell = stepMs();
    game.moveAcc += dt;
    var guard = 0;
    while (game.moveAcc >= game.msPerCell && game.state === 'running' && guard++ < 4) {
      game.moveAcc -= game.msPerCell;
      moveCell();
      game.msPerCell = stepMs();
    }
    if (guard >= 4) game.moveAcc = 0;
  }

  /* ---------------- 渲染 ---------------- */
  var clock = 0;

  function drawBackground(think) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    if (think) { g.addColorStop(0, '#0a1f45'); g.addColorStop(1, '#123a72'); }
    else { g.addColorStop(0, '#08152c'); g.addColorStop(1, '#0e2148'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (think) {
      var pulse = 0.10 + 0.06 * Math.sin(clock / 180);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#4d9bff';
      ctx.fillRect(0, GY, W, 5);
      ctx.fillRect(0, H - 5, W, 5);
      ctx.fillRect(0, GY, 5, FH);
      ctx.fillRect(W - 5, GY, 5, FH);
      ctx.globalAlpha = 1;
    }
  }

  function drawGrid() {
    ctx.fillStyle = 'rgba(120,175,255,0.10)';
    for (var x = 1; x < COLS; x++) ctx.fillRect(GX + x * CELL, GY, 1, FH);
    for (var y = 1; y < ROWS; y++) ctx.fillRect(GX, GY + y * CELL, FW, 1);

    ctx.fillStyle = 'rgba(77,107,254,0.55)';
    ctx.fillRect(0, GY, W, 2);
    ctx.fillRect(0, H - 2, W, 2);
    ctx.fillRect(0, GY, 2, FH);
    ctx.fillRect(W - 2, GY, 2, FH);
  }

  function drawToken(gx, gy) {
    var pulse = 0.5 + 0.5 * Math.sin(clock / 220);
    var x = GX + gx * CELL;
    var y = GY + gy * CELL;
    ctx.globalAlpha = 0.16 + 0.20 * pulse;
    ctx.fillStyle = '#7fa8ff';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.globalAlpha = 1;
    var p = 6;
    ctx.fillStyle = '#4d6bfe';
    ctx.fillRect(x + p, y + p, CELL - p * 2, CELL - p * 2);
    ctx.fillStyle = '#dbe7ff';
    ctx.fillRect(x + p + PX, y + p + PX, PX, PX);
  }

  function drawThink(gx, gy) {
    var pulse = 0.5 + 0.5 * Math.sin(clock / 160);
    var x = GX + gx * CELL;
    var y = GY + gy * CELL;
    var cx = x + CELL / 2;
    var cy = y + CELL / 2;
    ctx.globalAlpha = 0.22 + 0.22 * pulse;
    ctx.fillStyle = '#9ff0ff';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dff7ff';
    ctx.fillRect(cx - 4, cy - 12, 8, 24);
    ctx.fillRect(cx - 12, cy - 4, 24, 8);
    ctx.fillStyle = '#7fe6ff';
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
  }

  function roundPixel(x, y, s) {
    ctx.fillRect(x + PX, y, s - PX * 2, PX);
    ctx.fillRect(x, y + PX, s, s - PX * 2);
    ctx.fillRect(x + PX, y + s - PX, s - PX * 2, PX);
  }

  function drawSnake(think) {
    var n = game.snake.length;
    for (var i = n - 1; i >= 1; i--) {
      var t = i / Math.max(1, n - 1);
      var p = 2 + Math.round(t * 5);
      var x = GX + game.snake[i].x * CELL + p;
      var y = GY + game.snake[i].y * CELL + p;
      var s = CELL - p * 2;
      ctx.fillStyle = think ? mix(BLUE_LIGHT, BLUE, t) : mix(BLUE, DEEP, Math.min(1, t * 0.95));
      roundPixel(x, y, s);
      if (s >= 12) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = think ? '#eaf6ff' : mix(BLUE_LIGHT, BLUE, t * 0.7);
        ctx.fillRect(x + PX * 2, y + PX * 2, s - PX * 4, PX);
        ctx.globalAlpha = 1;
      }
    }
    drawHead(think);
  }

  function drawHead(think) {
    var h = game.snake[0];
    var cx = GX + h.x * CELL + CELL / 2;
    var cy = GY + h.y * CELL + CELL / 2;
    var ang = Math.atan2(game.dir.y, game.dir.x);

    if (think) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(GX + h.x * CELL - 4, GY + h.y * CELL - 4, CELL + 8, CELL + 8);
      ctx.globalAlpha = 1;
    }

    /* Whale-chan 皮肤：一张正面脸不整体旋转（转 90° 很难看），
     * 改成「朝左时水平镜像」，上下方向沿用同一张脸。 */
    if (ArcadeCharacter && ArcadeCharacter.isWhaleChan()) {
      var size = CELL * 1.25;                 // 略大于格子，缩到 30px 才看得清
      if (ArcadeCharacter.draw(ctx, think ? 'headThink' : 'head',
            cx - size / 2, cy - size / 2, size, size, { flip: game.dir.x < 0 })) {
        return;
      }
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.translate(-CELL / 2, -CELL / 2);
    drawSprite(HEAD, PX, 0, 0, { X: think ? '#bfe4ff' : '#5b7dff', e: '#ffffff' });
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i];
      var c = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), PX, PX);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(think) {
    ctx.fillStyle = 'rgba(6,16,36,0.6)';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Courier New", ui-monospace, monospace';

    ctx.textAlign = 'left';
    ctx.fillStyle = think ? '#9fe8ff' : '#6f8fc8';
    ctx.fillText(T('snake.ctx') + ' ' + pad(game.context, 3), 12, HUD_H / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#5f7ba8';
    ctx.fillText(T('hud.hi') + ' ' + pad(Math.max(game.high, game.context), 3), W - 12, HUD_H / 2);

    if (think) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#dff4ff';
      ctx.font = 'bold 14px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('snake.think'), W / 2, HUD_H / 2 - 4);
      var ratio = Math.max(0, Math.min(1, game.thinkMs / THINK_MS));
      var bw = 120;
      var bx = Math.round(W / 2 - bw / 2);
      ctx.fillStyle = 'rgba(120,190,255,0.25)';
      ctx.fillRect(bx, HUD_H - 8, bw, 3);
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(bx, HUD_H - 8, Math.round(bw * ratio), 3);
    }
  }

  function drawOverlay() {
    var midY = GY + FH / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var blink = (Math.floor(clock / 520) % 2) === 0;

    if (game.state === 'ready') {
      if (blink) {
        ctx.fillStyle = '#cfe4ff';
        ctx.font = 'bold 22px "Courier New", ui-monospace, monospace';
        ctx.fillText(T('snake.ready'), W / 2, midY - 14);
      }
      ctx.fillStyle = '#5f7ba8';
      ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(T('snake.hint'), W / 2, midY + 22);
      return;
    }
    if (game.state === 'paused') {
      ctx.fillStyle = 'rgba(6,16,36,0.55)';
      ctx.fillRect(0, GY, W, FH);
      ctx.fillStyle = '#dbe9ff';
      ctx.font = 'bold 22px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('snake.paused'), W / 2, midY - 8);
      ctx.fillStyle = '#5f7ba8';
      ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(T('snake.pausedHint'), W / 2, midY + 24);
      return;
    }
    if (game.state === 'over') {
      ctx.fillStyle = 'rgba(6,16,36,0.55)';
      ctx.fillRect(0, GY, W, FH);
      ctx.fillStyle = '#dbe9ff';
      ctx.font = 'bold 26px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('snake.over'), W / 2, midY - 12);
      if (blink) {
        ctx.font = 'bold 15px "Courier New", ui-monospace, monospace';
        ctx.fillText(T('snake.restart'), W / 2, midY + 26);
      }
    }
  }

  function render() {
    var think = game.thinkMs > 0;
    drawBackground(think);
    drawGrid();
    if (game.food) drawToken(game.food.x, game.food.y);
    if (game.think) drawThink(game.think.x, game.think.y);
    drawSnake(think);
    drawParticles();
    drawHud(think);
    drawOverlay();
  }

  /* ---------------- 主循环 ---------------- */
  var last = 0;
  var acc = 0;

  function frame(now) {
    if (stopped) return;
    if (!last) last = now;
    var dt = now - last;
    last = now;
    clock = now;
    if (dt > 250) dt = STEP;
    acc += dt;

    var guard = 0;
    while (acc >= STEP && guard++ < 5) { step(STEP); acc -= STEP; }
    if (guard >= 5) acc = 0;

    render();
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
})();