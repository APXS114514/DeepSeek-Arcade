/* ============================================================
 * DeepSeek Arcade — CONTEXT BREAKER（第 5 款正式小游戏）
 * Breakout / Arkanoid：用底部的 TOKEN 弹球击碎上方的 CONTEXT 砖块。
 *
 * 与原有四款保持同一套约定：
 *   - 纯 Canvas 2D，零依赖 / 零构建 / 零后端 / 零外部请求；
 *   - 文案全部走 shared/i18n.js，音效全部走 shared/audio.js，不引音频文件；
 *   - 角色只说语义状态（idle / walk / think / startle / blocked），
 *     由 shared/character.js 决定画哪张图 —— 本文件不出现任何素材文件名；
 *   - **挡板碰撞盒是固定常量，与角色素材尺寸完全无关**；
 *   - localStorage 不可用时静默降级（隐私模式照样能玩）。
 *
 * 状态机：serve → playing → (levelClear | gameOver)，任意时刻可 paused。
 * 暂停会冻结：球运动、特殊效果计时、关卡计时、角色动画时钟。
 * ============================================================ */
(function () {
  'use strict';

  var I18N = window.I18N || null;
  function T(k) { return I18N ? I18N.t(k) : k; }

  var Audio = window.ArcadeAudio || null;
  var SOUND_LEGACY_KEY = 'arcade.breaker.sound';   // 历史兼容位（本项目从未写过，保留迁移语义）
  function soundOn() { return !Audio || !Audio.isEnabled || Audio.isEnabled(SOUND_LEGACY_KEY); }
  function sound(o) { if (Audio && Audio.tone && soundOn()) Audio.tone(o); }

  var Character = window.ArcadeCharacter || null;
  var Whale = window.ArcadeWhale || {};

  /* requestAnimationFrame 可能只挂在全局、而不是 window 上（测试桩就是这样） */
  function raf(fn) {
    if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(fn); return true; }
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(fn); return true; }
    return false;
  }

  var HIGH_KEY = 'arcade.breakerHighScore';

  /* ---------------- 逻辑画布与几何 ---------------- */
  var W = 400;
  var H = 540;
  var HUD_H = 46;

  var MARGIN = 11;
  var COLS = 10;
  var BRICK_W = 35.6;
  var BRICK_H = 17;
  var BRICK_GAP = 2;
  var FIELD_TOP = HUD_H + 12;
  var MAX_ROWS = 6;

  var PADDLE_W = 86;          // 基准宽度（碰撞盒）
  var PADDLE_W_MIN = 52;      // NOISE 缩窄后的宽度
  var PADDLE_H = 12;
  var PADDLE_Y = H - 44;

  var BALL_R = 6;
  var BASE_SPEED = 196;       // px/s
  var MAX_SPEED = 372;
  var SPEED_STEP = 16;
  var SERVE_ANGLE = 0.42;     // 开场固定角度，保证可复现
  var MAX_BOUNCE_ANGLE = Math.PI / 3;   // 相对竖直方向最大 60°（永远打不出接近水平的球）

  var NOISE_MS = 6000;        // 挡板变窄持续
  var THINK_MS = 5000;        // 慢动作持续
  var THINK_FACTOR = 0.62;
  var STARTLE_MS = 700;
  var LEVEL_CLEAR_MS = 1500;

  var SCORES = { context: 10, dense: 20, noise: 5, compress: 15, think: 25 };
  var HITS = { context: 1, dense: 2, noise: 1, compress: 1, think: 1 };

  var SOUND = {
    launch: { type: 'square', from: 420, to: 760, ms: 110, gain: 0.05 },
    paddle: { type: 'square', from: 300, to: 380, ms: 60, gain: 0.045 },
    hit: { type: 'square', from: 520, to: 480, ms: 50, gain: 0.035 },
    brk: { type: 'square', from: 700, to: 1040, ms: 80, gain: 0.045 },
    special: { type: 'triangle', from: 880, to: 460, ms: 190, gain: 0.05 },
    lose: { type: 'sawtooth', from: 260, to: 120, ms: 260, gain: 0.05 },
    clear: { type: 'triangle', from: 620, to: 1180, ms: 220, gain: 0.05 },
    over: { type: 'sawtooth', from: 340, to: 90, ms: 420, gain: 0.055 }
  };

  /* ---------------- 预定义布局模板（只描述形状）----------------
   * 'C' = 有砖，'.' = 空；具体砖种由关卡难度按确定性哈希分配，
   * 所以同一关每次开都完全一样，绝不会「随机到没法打」。 */
  var TEMPLATES = [
    [ /* 0 矩形墙 */
      'CCCCCCCCCC',
      'CCCCCCCCCC',
      'CCCCCCCCCC',
      'CCCCCCCCCC'
    ],
    [ /* 1 中央空洞 */
      'CCCCCCCCCC',
      'CC......CC',
      'CC......CC',
      'CCCCCCCCCC'
    ],
    [ /* 2 阶梯 */
      '........CC',
      '......CCCC',
      '....CCCCCC',
      '..CCCCCCCC'
    ],
    [ /* 3 金字塔 */
      '....CC....',
      '...CCCC...',
      '..CCCCCC..',
      '.CCCCCCCC.'
    ],
    [ /* 4 对称双塔 */
      'CCC....CCC',
      'CCC....CCC',
      'CCC....CCC',
      'CCC....CCC'
    ],
    [ /* 5 棋盘 */
      'C.C.C.C.C.',
      '.C.C.C.C.C',
      'C.C.C.C.C.',
      '.C.C.C.C.C'
    ],
    [ /* 6 菱形 */
      '....CC....',
      '...CCCC...',
      '..CC..CC..',
      '.CC....CC.',
      '..CC..CC..',
      '...CCCC...'
    ],
    [ /* 7 立柱 */
      'CC..CC..CC',
      'CC..CC..CC',
      'CC..CC..CC',
      'CC..CC..CC'
    ]
  ];

  /* 确定性哈希：同一 (level, index) 永远得到同一个值 —— 布局可复现 */
  function hash2(a, b) {
    var x = (a * 73856093) ^ (b * 19349663);
    x = (x ^ (x >>> 13)) >>> 0;
    x = (x * 1274126177) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x;
  }
  function ratioAt(level) {
    var l = Math.max(0, level - 1);
    return {
      think: Math.min(0.02 + 0.012 * l, 0.08),
      compress: Math.min(0.04 + 0.015 * l, 0.12),
      noise: Math.min(0.03 + 0.020 * l, 0.13),
      dense: Math.min(0.10 + 0.045 * l, 0.32)
    };
  }
  /* 关卡越高特殊砖越多，但一律有上限（难度会封顶，不会失控） */
  function pickType(level, index) {
    var r = ratioAt(level);
    var h = hash2(level * 2654435761, index * 40503) / 4294967296;
    var acc = 0;
    acc += r.think; if (h < acc) return 'think';
    acc += r.compress; if (h < acc) return 'compress';
    acc += r.noise; if (h < acc) return 'noise';
    acc += r.dense; if (h < acc) return 'dense';
    return 'context';
  }
  function speedFor(level) {
    return Math.min(BASE_SPEED + (Math.max(1, level) - 1) * SPEED_STEP, MAX_SPEED);
  }

  function buildLevel(level) {
    var tpl = TEMPLATES[(Math.max(1, level) - 1) % TEMPLATES.length];
    var bricks = [];
    var n = 0;
    for (var r = 0; r < tpl.length && r < MAX_ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (tpl[r].charAt(c) !== 'C') continue;
        var type = pickType(level, n++);
        bricks.push({
          x: MARGIN + c * (BRICK_W + BRICK_GAP),
          y: FIELD_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          type: type,
          hp: HITS[type],
          maxHp: HITS[type],
          alive: true
        });
      }
    }
    return bricks;
  }

  /* ---------------- 游戏状态 ---------------- */
  var game = {
    state: 'serve',            // serve | playing | paused | levelClear | gameOver
    score: 0,
    high: 0,
    lives: 3,
    level: 1,
    time: 0,                   // 角色动画时钟（暂停时冻结）
    levelClearMs: 0,
    startleMs: 0,
    effects: { noiseMs: 0, thinkMs: 0 },
    balls: [],
    bricks: [],
    particles: [],
    paddle: { x: W / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
    input: { left: false, right: false },
    paddleDir: 0
  };

  function readHigh() {
    try {
      var v = window.localStorage ? window.localStorage.getItem(HIGH_KEY) : null;
      return parseInt(v, 10) || 0;
    } catch (e) { return 0; }
  }
  function writeHigh() {
    if (game.score > game.high) game.high = game.score;
    try {
      if (window.localStorage) window.localStorage.setItem(HIGH_KEY, String(game.high));
    } catch (e) { /* 隐私模式：静默降级，游戏照常 */ }
  }
  game.high = readHigh();

  function paddleLeft() { return game.paddle.x - game.paddle.w / 2; }
  function paddleTop() { return game.paddle.y - game.paddle.h / 2; }

  function ballSpeed() {
    return speedFor(game.level) * (game.effects.thinkMs > 0 ? THINK_FACTOR : 1);
  }
  function makeBall() {
    return { x: game.paddle.x, y: paddleTop() - BALL_R - 1, vx: 0, vy: 0, r: BALL_R };
  }
  function resetBall() { game.balls = [makeBall()]; }

  function startLevel(level) {
    game.level = Math.max(1, level);
    game.bricks = buildLevel(game.level);
    game.particles = [];
    game.effects = { noiseMs: 0, thinkMs: 0 };
    game.startleMs = 0;
    game.paddle.w = PADDLE_W;
    game.paddle.x = W / 2;
    game.state = 'serve';
    resetBall();
  }

  function newGame() {
    game.score = 0;
    game.lives = 3;
    game.time = 0;
    startLevel(1);
  }

  function launchBall() {
    if (game.state !== 'serve') return false;
    var b = game.balls[0];
    if (!b) { resetBall(); b = game.balls[0]; }
    var sp = ballSpeed();
    b.vx = sp * Math.sin(SERVE_ANGLE);
    b.vy = -sp * Math.cos(SERVE_ANGLE);
    b.x = game.paddle.x;
    b.y = paddleTop() - b.r - 1;
    game.state = 'playing';
    sound(SOUND.launch);
    return true;
  }

  function loseLife() {
    game.lives -= 1;
    game.effects.noiseMs = 0;
    game.effects.thinkMs = 0;
    game.startleMs = STARTLE_MS;
    game.paddle.w = PADDLE_W;
    sound(SOUND.lose);
    if (game.lives <= 0) {
      game.lives = 0;
      game.state = 'gameOver';
      writeHigh();
      sound(SOUND.over);
      return;
    }
    game.state = 'serve';
    game.paddle.x = W / 2;
    resetBall();
  }

  function nextLevel() {
    writeHigh();
    startLevel(game.level + 1);
  }

  function togglePause(force) {
    if (game.state === 'gameOver') return game.state;
    var want = force === undefined ? game.state !== 'paused' : !!force;
    if (want && game.state !== 'paused') {
      game._resume = game.state;
      game.state = 'paused';
    } else if (!want && game.state === 'paused') {
      game.state = game._resume || 'playing';
    }
    return game.state;
  }

  /* ---------------- 粒子 ---------------- */
  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      game.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * (40 + (i % 5) * 22),
        vy: Math.sin(a) * (40 + (i % 5) * 22),
        life: 380, maxLife: 380, color: color
      });
    }
  }

  /* ---------------- 砖块伤害与效果 ---------------- */
  var BRICK_COLORS = {
    context: ['#4d6bfe', '#9db4ff'],
    dense: ['#2f4bd0', '#7d92ff'],
    noise: ['#8b5cf6', '#c4b5fd'],
    compress: ['#22a5b8', '#7fe3f0'],
    think: ['#d99a1f', '#ffd77a']
  };

  function damageBrick(br, fromBall) {
    if (!br.alive) return;
    br.hp -= 1;
    if (br.hp > 0) { sound(SOUND.hit); return; }
    br.alive = false;
    game.score += SCORES[br.type] || 0;
    var col = BRICK_COLORS[br.type] || BRICK_COLORS.context;
    burst(br.x + br.w / 2, br.y + br.h / 2, 6, col[0]);
    sound(SOUND.brk);
    if (fromBall) triggerEffect(br.type);
  }

  function triggerEffect(type) {
    if (type === 'noise') {
      game.effects.noiseMs = NOISE_MS;
      game.paddle.w = PADDLE_W_MIN;
      sound(SOUND.special);
    } else if (type === 'think') {
      game.effects.thinkMs = THINK_MS;
      sound(SOUND.special);
    } else if (type === 'compress') {
      sound(SOUND.special);
      compressBurst();
    }
  }

  /* COMPRESS：其它可破坏砖块 HP -1；被它压碎的不再连锁触发效果，避免无限递归 */
  function compressBurst() {
    var list = game.bricks.slice();
    for (var i = 0; i < list.length; i++) damageBrick(list[i], false);
  }

  function aliveBricks() {
    var n = 0;
    for (var i = 0; i < game.bricks.length; i++) if (game.bricks[i].alive) n++;
    return n;
  }
  function checkClear() {
    if (game.state !== 'playing') return false;
    if (aliveBricks() > 0) return false;
    game.state = 'levelClear';
    game.levelClearMs = 0;
    writeHigh();
    sound(SOUND.clear);
    return true;
  }

  /* ---------------- 物理 ---------------- */
  function bounceOffPaddle(b) {
    var half = game.paddle.w / 2;
    var rel = (b.x - game.paddle.x) / (half || 1);
    if (rel < -1) rel = -1;
    if (rel > 1) rel = 1;
    var ang = rel * MAX_BOUNCE_ANGLE;      // 中心=竖直，边缘=60°，永不接近水平
    var sp = ballSpeed();
    b.vx = sp * Math.sin(ang);
    b.vy = -sp * Math.cos(ang);
    b.y = paddleTop() - b.r - 0.01;
    sound(SOUND.paddle);
  }

  function hitBrick(b, br) {
    var nx = Math.max(br.x, Math.min(b.x, br.x + br.w));
    var ny = Math.max(br.y, Math.min(b.y, br.y + br.h));
    var dx = b.x - nx, dy = b.y - ny;
    return dx * dx + dy * dy <= b.r * b.r;
  }

  function separate(b, br) {
    var bcx = br.x + br.w / 2, bcy = br.y + br.h / 2;
    var ox = (br.w / 2 + b.r) - Math.abs(b.x - bcx);
    var oy = (br.h / 2 + b.r) - Math.abs(b.y - bcy);
    if (ox < oy) {
      b.vx = -b.vx;
      b.x += (b.x < bcx ? -ox : ox);
    } else {
      b.vy = -b.vy;
      b.y += (b.y < bcy ? -oy : oy);
    }
  }

  function moveBalls(dt) {
    var sp = ballSpeed();
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      /* 速度始终由关卡决定（THINK 时整体变慢），不会因为反复反弹而漂移 */
      var mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (mag > 0.0001) { b.vx = b.vx / mag * sp; b.vy = b.vy / mag * sp; }

      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 6));
      var sub = dt / steps;
      for (var s = 0; s < steps; s++) {
        b.x += b.vx * sub;
        b.y += b.vy * sub;

        /* 墙 */
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
        else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y - b.r < HUD_H) { b.y = HUD_H + b.r; b.vy = Math.abs(b.vy); }

        /* 挡板 */
        var pt = paddleTop();
        if (b.vy > 0 && b.y + b.r >= pt && b.y - b.r <= game.paddle.y + game.paddle.h / 2 &&
            b.x >= paddleLeft() - b.r && b.x <= paddleLeft() + game.paddle.w + b.r) {
          bounceOffPaddle(b);
        }

        /* 砖块 */
        for (var k = 0; k < game.bricks.length; k++) {
          var br = game.bricks[k];
          if (!br.alive) continue;
          if (hitBrick(b, br)) {
            separate(b, br);
            damageBrick(br, true);
            break;
          }
        }

        /* 掉底 */
        if (b.y - b.r > H) { game.balls.splice(i, 1); i--; break; }
      }
    }
    if (game.balls.length === 0 && game.state === 'playing') loseLife();
  }

  /* ---------------- 每帧推进 ---------------- */
  function update(dt) {
    if (game.state === 'paused' || game.state === 'gameOver') return;   // 全冻结

    if (game.state === 'levelClear') {
      game.levelClearMs += dt * 1000;
      if (game.levelClearMs >= LEVEL_CLEAR_MS) nextLevel();
      return;
    }

    game.time += dt * 1000;                    // 角色动画时钟：只在非暂停时走

    if (game.startleMs > 0) game.startleMs = Math.max(0, game.startleMs - dt * 1000);
    if (game.effects.noiseMs > 0) {
      game.effects.noiseMs = Math.max(0, game.effects.noiseMs - dt * 1000);
      if (game.effects.noiseMs === 0) game.paddle.w = PADDLE_W;
    }
    if (game.effects.thinkMs > 0) game.effects.thinkMs = Math.max(0, game.effects.thinkMs - dt * 1000);

    movePaddle(dt);

    if (game.state === 'serve') {
      var b = game.balls[0];
      if (b) { b.x = game.paddle.x; b.y = paddleTop() - b.r - 1; b.vx = 0; b.vy = 0; }
    } else {
      moveBalls(dt);
      checkClear();
    }

    for (var i = game.particles.length - 1; i >= 0; i--) {
      var p = game.particles[i];
      p.life -= dt * 1000;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  var PADDLE_SPEED = 430;
  function movePaddle(dt) {
    var dir = (game.input.right ? 1 : 0) - (game.input.left ? 1 : 0);
    game.paddleDir = dir;
    if (!dir) return;
    var half = game.paddle.w / 2;
    game.paddle.x += dir * PADDLE_SPEED * dt;
    if (game.paddle.x - half < MARGIN) game.paddle.x = MARGIN + half;
    if (game.paddle.x + half > W - MARGIN) game.paddle.x = W - MARGIN - half;
  }

  /* ---------------- 绘制 ---------------- */
  var canvas = null, ctx = null, dpr = 1;

  function setupCanvas() {
    canvas = document.getElementById('game');
    if (!canvas || !canvas.getContext) return false;
    ctx = canvas.getContext('2d');
    if (!ctx) return false;
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    else if (ctx.scale) ctx.scale(dpr, dpr);
    return true;
  }

  function text(s, x, y, color, font, align) {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.font = font || 'bold 13px monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function pad5(n) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < 5) s = '0' + s;
    return s;
  }

  function drawSprite(rows, px, x, y, ink) {
    if (!rows || !rows.length) return;
    for (var r = 0; r < rows.length; r++) {
      var line = rows[r];
      for (var c = 0; c < line.length; c++) {
        var ch = line.charAt(c);
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'o' ? (ink.o || '#ffffff') : (ink.X || '#4d6bfe');
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  }

  function charState() {
    if (game.state === 'gameOver') return 'blocked';
    if (game.startleMs > 0) return 'startle';
    if (game.effects.thinkMs > 0) return 'think';
    if (game.paddleDir !== 0 || game.input.left || game.input.right) return 'walk';
    return 'idle';
  }

  function drawPaddleCharacter() {
    /* 视觉尺寸可以随皮肤变，**碰撞盒永远是 PADDLE_W × PADDLE_H** */
    var st = charState();
    var skinH = 36;
    var cx = game.paddle.x;
    var bottom = paddleTop() - 1;
    var flip = game.paddleDir < 0;

    var drawn = false;
    if (Character && Character.draw) {
      var m = Character.measure ? Character.measure(st, skinH) : { w: skinH, h: skinH };
      drawn = Character.draw(ctx, st, cx - m.w / 2, bottom - m.h, m.w, m.h,
        { time: game.time, flip: flip });
    }
    if (!drawn) {
      var rows = game.paddleDir < 0 ? Whale.mirror && Whale.mirror(Whale.NORMAL_A) : Whale.NORMAL_A;
      if (!rows) rows = Whale.NORMAL_A;
      if (rows) {
        var px = Math.max(1, Math.round(skinH / (rows.length || 18)));
        var sw = rows[0].length * px, sh = rows.length * px;
        drawSprite(rows, px, cx - sw / 2, bottom - sh, { X: '#4d6bfe', o: '#c9dcff' });
      }
    }
  }

  function drawBrick(br) {
    var col = BRICK_COLORS[br.type] || BRICK_COLORS.context;
    var damaged = br.hp < br.maxHp;
    ctx.globalAlpha = damaged ? 0.55 : 1;
    ctx.fillStyle = damaged ? col[1] : col[0];
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.globalAlpha = 1;
    /* 受损状态：内部再画一圈浅色凹槽，一眼能看出「还剩一次」 */
    if (damaged) {
      ctx.fillStyle = '#0b1c38';
      ctx.fillRect(br.x + 3, br.y + 3, br.w - 6, br.h - 6);
      ctx.fillStyle = col[1];
      ctx.fillRect(br.x + 3, br.y + br.h - 6, br.w - 6, 3);
    }
  }

  function drawHud() {
    ctx.fillStyle = '#0b1c38';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = '#16305c';
    ctx.fillRect(0, HUD_H - 1, W, 1);

    var t = T('breaker.score'), hi = T('breaker.hi'), lv = T('breaker.lives'), le = T('breaker.level');
    text(t, 12, 14, '#7f9dd6', 'bold 10px monospace');
    text(pad5(game.score), 12, 31, '#ffffff', 'bold 15px monospace');
    text(hi, 128, 14, '#7f9dd6', 'bold 10px monospace');
    text(pad5(game.high), 128, 31, '#9db4ff', 'bold 15px monospace');
    text(lv, 250, 14, '#7f9dd6', 'bold 10px monospace');
    text(String(game.lives), 250, 31, game.lives > 1 ? '#ffffff' : '#ff8a8a', 'bold 15px monospace');
    text(le, 316, 14, '#7f9dd6', 'bold 10px monospace');
    text(String(game.level), 316, 31, '#ffffff', 'bold 15px monospace');

    /* 当前状态提示 */
    var status = '', color = '#7fe3f0';
    if (game.state === 'paused') { status = T('breaker.paused'); color = '#c4b5fd'; }
    else if (game.state === 'gameOver') { status = T('breaker.over'); color = '#ff8a8a'; }
    else if (game.state === 'levelClear') { status = T('breaker.clear'); color = '#ffd77a'; }
    else if (game.effects.thinkMs > 0) { status = T('breaker.think'); color = '#ffd77a'; }
    else if (game.effects.noiseMs > 0) { status = T('breaker.noise'); color = '#c4b5fd'; }
    else if (game.state === 'serve') { status = T('breaker.serve'); color = '#9db4ff'; }
    else { status = T('breaker.playing'); }
    text(status, W - 12, 23, color, 'bold 11px monospace', 'right');
  }

  function drawOverlay() {
    if (game.state === 'playing') return;
    var lines = [];
    if (game.state === 'serve') { lines = [T('breaker.ready'), T('breaker.hint')]; }
    else if (game.state === 'paused') { lines = [T('breaker.paused'), T('breaker.pausedHint')]; }
    else if (game.state === 'levelClear') { lines = [T('breaker.clear'), T('breaker.tapNext')]; }
    else if (game.state === 'gameOver') { lines = [T('breaker.over'), T('breaker.restart')]; }
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#061024';
    ctx.fillRect(0, H / 2 - 58, W, 116);
    ctx.globalAlpha = 1;
    for (var i = 0; i < lines.length; i++) {
      text(lines[i], W / 2, H / 2 - 16 + i * 30,
        i === 0 ? '#ffffff' : '#9db4ff',
        i === 0 ? 'bold 19px monospace' : 'bold 12px monospace', 'center');
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#08152c';
    ctx.fillRect(0, 0, W, H);
    /* 背景网格，营造「上下文窗口」的感觉 */
    ctx.fillStyle = '#0d2144';
    for (var gx = 0; gx < W; gx += 20) ctx.fillRect(gx, HUD_H, 1, H - HUD_H);

    for (var i = 0; i < game.bricks.length; i++) if (game.bricks[i].alive) drawBrick(game.bricks[i]);

    for (var p = 0; p < game.particles.length; p++) {
      var q = game.particles[p];
      ctx.globalAlpha = Math.max(0, q.life / q.maxLife);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    /* 挡板碰撞盒（固定尺寸）与角色（视觉尺寸可随皮肤变） */
    ctx.fillStyle = '#4d6bfe';
    ctx.fillRect(paddleLeft(), paddleTop(), game.paddle.w, game.paddle.h);
    ctx.fillStyle = '#9db4ff';
    ctx.fillRect(paddleLeft(), paddleTop(), game.paddle.w, 3);
    drawPaddleCharacter();

    for (var b = 0; b < game.balls.length; b++) {
      var ball = game.balls[b];
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      if (ctx.arc) ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ball.x - 2, ball.y - 2, 2, 2);
    }

    drawHud();
    drawOverlay();
  }

  /* ---------------- 主循环（暂停时时钟照走，但游戏状态不推进） ---------------- */
  var lastTs = 0;
  function frame(now) {
    var ts = typeof now === 'number' ? now : 0;
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
    lastTs = ts;
    if (dt > 0) update(dt);
    draw();
    raf(frame);
  }

  /* ---------------- 输入 ---------------- */
  function keyOf(e) { return e && (e.code || e.key) || ''; }
  function onKeyDown(e) {
    var k = keyOf(e);
    if (k === 'ArrowLeft' || k === 'KeyA' || k === 'a' || k === 'A') { game.input.left = true; if (e && e.preventDefault) e.preventDefault(); return; }
    if (k === 'ArrowRight' || k === 'KeyD' || k === 'd' || k === 'D') { game.input.right = true; if (e && e.preventDefault) e.preventDefault(); return; }
    if (k === 'Space' || k === ' ' || k === 'Enter') {
      if (e && e.preventDefault) e.preventDefault();
      if (game.state === 'gameOver') { newGame(); return; }
      if (game.state === 'levelClear') { nextLevel(); return; }
      launchBall();
      return;
    }
    if (k === 'KeyP' || k === 'p' || k === 'P') { togglePause(); syncButtons(); return; }
    if (k === 'KeyM' || k === 'm' || k === 'M') { if (Audio && Audio.toggle) { Audio.toggle(); syncSound(); } }
  }
  function onKeyUp(e) {
    var k = keyOf(e);
    if (k === 'ArrowLeft' || k === 'KeyA' || k === 'a' || k === 'A') game.input.left = false;
    if (k === 'ArrowRight' || k === 'KeyD' || k === 'd' || k === 'D') game.input.right = false;
  }

  function hold(el, on, off) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('pointerdown', function (e) { if (e && e.preventDefault) e.preventDefault(); on(); });
    var end = function () { off(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  }

  /* ---------------- DOM 接线 ---------------- */
  function syncSound() {
    var btn = document.getElementById('sound');
    if (!btn) return;
    var on = soundOn();
    btn.textContent = T(on ? 'btn.sound' : 'btn.muted');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function syncButtons() {
    var p = document.getElementById('pause');
    if (p) p.textContent = T(game.state === 'paused' ? 'breaker.resumeBtn' : 'breaker.pauseBtn');
  }

  function wire() {
    var l = document.getElementById('left'), r = document.getElementById('right');
    hold(l, function () { game.input.left = true; }, function () { game.input.left = false; });
    hold(r, function () { game.input.right = true; }, function () { game.input.right = false; });

    var launch = document.getElementById('launch');
    if (launch && launch.addEventListener) {
      launch.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (game.state === 'gameOver') newGame();
        else if (game.state === 'levelClear') nextLevel();
        else launchBall();
      });
    }
    var pause = document.getElementById('pause');
    if (pause && pause.addEventListener) {
      pause.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        togglePause(); syncButtons();
      });
    }
    var snd = document.getElementById('sound');
    if (snd && snd.addEventListener) {
      snd.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); if (Audio && Audio.toggle) Audio.toggle(); syncSound(); });
    }
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('pointerdown', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (game.state === 'levelClear') { nextLevel(); return; }
        if (game.state === 'gameOver') { newGame(); return; }
        launchBall();
      });
    }

    /* 键盘挂在 document 上：与另外四款保持一致（无头测试也按这个约定驱动） */
    var doc = window.document;
    if (doc && doc.addEventListener) {
      doc.addEventListener('keydown', onKeyDown);
      doc.addEventListener('keyup', onKeyUp);
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden && game.state === 'playing') { togglePause(true); syncButtons(); }
      });
    }
    if (window.addEventListener) {
      /* 失焦也暂停：沿用项目惯例，回来不会自己继续 */
      window.addEventListener('blur', function () { if (game.state === 'playing') { togglePause(true); syncButtons(); } });
    }
    if (I18N && I18N.onChange) I18N.onChange(function () { syncSound(); syncButtons(); });
    if (Character && Character.onChange) Character.onChange(function () { /* 下一帧自动重画 */ });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!setupCanvas()) return;
    wire();
    newGame();
    syncSound();
    syncButtons();
    draw();
    raf(frame);
  }

  /* 测试钩子：暴露内部状态（生产环境只是多挂一个属性，无副作用） */
  game.__test = {
    buildLevel: buildLevel,
    pickType: pickType,
    ratioAt: ratioAt,
    speedFor: speedFor,
    T: T,
    W: W, H: H, HUD_H: HUD_H,
    PADDLE_W: PADDLE_W, PADDLE_W_MIN: PADDLE_W_MIN,
    NOISE_MS: NOISE_MS, THINK_MS: THINK_MS,
    MAX_BOUNCE_ANGLE: MAX_BOUNCE_ANGLE,
    HIGH_KEY: HIGH_KEY,
    SCORES: SCORES,
    HITS: HITS,
    TEMPLATES: TEMPLATES
  };
  window.__breaker = game.__test;

  /* 对外暴露少量操作，便于测试与将来扩展 */
  window.ContextBreaker = {
    game: game,
    launch: launchBall,
    pause: function () { return togglePause(true); },
    resume: function () { return togglePause(false); },
    nextLevel: nextLevel,
    newGame: newGame,
    startLevel: startLevel
  };

  if (window.document && window.document.readyState === 'loading' && window.document.addEventListener) {
    window.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
