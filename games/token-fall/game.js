/* ============================================================
 * TOKEN FALL — DeepSeek Arcade
 * 竖向接物小游戏：接住 TOKEN 得分，但会撑大 CONTEXT；
 * 接住 COMPRESS 压缩上下文；躲开 NOISE（只加 Context、不给分）；
 * 低概率的 THINK 触发 4 秒 DEEP THINK（全体减速 + 克制的蓝色泛光）。
 * CONTEXT 到达 1024 后有 2 秒 OVERFLOW 抢救时间：吃到 COMPRESS 就能取消溢出。
 *
 * 原生 Canvas 2D，零依赖、零图片：小鲸鱼 / 掉落物 / 背景 / HUD 全部代码绘制。
 * 与另外两款游戏共用 shared/i18n.js（文案）与 shared/audio.js（音效）。
 * 逻辑坐标恒定 W×H，DPR 只改画布分辨率，不参与任何判定。
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* ================= 逻辑尺寸 / DPR ================= */
  var W = 380;                 // 逻辑宽（所有坐标、判定都用它）
  var H = 560;                 // 逻辑高
  var HUD_H = 58;              // 顶部信息条
  var STEP = 1000 / 60;        // 固定步长

  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (ctx.scale) ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  /* ================= 多语言 / 音效 ================= */
  var I18N = window.I18N || null;
  function T(key) { return (I18N && I18N.t) ? I18N.t(key) : key; }

  var ArcadeAudio = window.ArcadeAudio || null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('arcade.tokenFall.sound') !== 'off'; } catch (e) { soundOn = true; }
  function tone(o) { if (soundOn && ArcadeAudio && ArcadeAudio.tone) ArcadeAudio.tone(o); }

  function updateButtons() {
    var s = document.getElementById('sound');
    if (s) {
      s.textContent = soundOn ? T('btn.sound') : T('btn.muted');
      s.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    }
    var p = document.getElementById('pause');
    if (p) {
      var paused = game.state === 'paused';
      p.textContent = paused ? T('tokenfall.resumeBtn') : T('tokenfall.pauseBtn');
      p.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('arcade.tokenFall.sound', soundOn ? 'on' : 'off'); } catch (e) { /* 隐私模式忽略 */ }
    updateButtons();
    if (soundOn) tone({ type: 'triangle', from: 880, to: 1180, ms: 90, gain: 0.04 });
  }
  if (I18N && I18N.onChange) I18N.onChange(updateButtons);

  /* ================= 规则常量 ================= */
  var MAX_CONTEXT = 1024;              // CONTEXT 上限（第一版固定）
  var CTX_TOKEN = 32, SCORE_TOKEN = 10;
  var CTX_COMPRESS = 256, SCORE_COMPRESS = 20;
  var CTX_NOISE = 128, SCORE_NOISE = 0;
  var CTX_THINK = 16, SCORE_THINK = 30;

  var THINK_MS = 4000;                 // DEEP THINK 持续
  var THINK_SLOW = 0.6;                // 期间下落速度 ×0.6
  var THINK_CHANCE = 0.05;             // 单次生成概率（很低）
  var THINK_COOLDOWN_MS = 9000;        // 两次 THINK 至少间隔
  var THINK_GRACE_MS = 5000;           // 开局宽限，不会一上来就慢动作

  var OVERFLOW_MS = 2000;              // 溢出抢救时间

  var TOKEN_W = 34, TOKEN_H = 34;
  var HIT = { token: 5, compress: 5, noise: 6, think: 6 };   // 每种掉落物的判定内缩

  var PLAYER_EDGE = 6;                 // 左右留边
  var PLAYER_SPEED = 340;              // px/s
  var PLAYER_ACCEL = 2200;             // px/s²（平滑加减速，不做瞬移）
  /* 鲸鱼的尺寸 / 站位 / 判定盒都由下面的字符画推导，见 WHALE_A */

  var SPEED_START = 95, SPEED_GROWTH = 2.1, SPEED_MAX = 230;      // px/s，约 64s 到顶
  var SPAWN_START = 1150, SPAWN_MIN = 520, SPAWN_DECAY = 11;      // 生成间隔 ms
  var SPAWN_FIRST_MS = 700;
  var ACTIVE_START = 1, ACTIVE_MAX = 4, ACTIVE_EVERY_S = 13;      // 同屏数量
  var NOISE_MIN = 0.13, NOISE_MAX = 0.30, NOISE_RAMP = 0.0021;    // NOISE 概率
  var COMPRESS_MIN = 0.12, COMPRESS_MAX = 0.22;                   // COMPRESS 概率（随 Context 提高）
  var COMPRESS_URGE_MS = 3200;         // Context > 85% 且这么久没给 COMPRESS -> 下一次必定是它
  var COMPRESS_RESCUE_MS = 1400;       // Context > 95% 且场上没有 COMPRESS -> 限时保底
  var COMPRESS_MIN_OFFSET = 70;        // 保底 COMPRESS 不直接砸在玩家头顶
  var NOISE_STREAK_MAX = 2;            // 不允许连出 3 个 NOISE 形成“墙”
  var COMBO_STEP = 3, COMBO_MAX = 5;   // CLEAN 倍率：每 3 连 +1，封顶 x5
  var DRAG_MIN = 10;                   // 画布拖动超过这个距离才算拖动（否则算轻点）

  /* ================= 配色 ================= */
  var LOOK = {
    token: { body: '#4d6bfe', hi: '#a8c4ff', core: '#122b6e', glow: '#7fa8ff', text: '#eef4ff' },
    compress: { body: '#2ee6ff', hi: '#d4fbff', core: '#0a4a61', glow: '#8ff2ff', text: '#04303f' },
    noise: { body: '#a24bff', hi: '#e3b9ff', core: '#3b0b66', glow: '#c07bff', text: '#f8ecff' },
    think: { body: '#ffd76a', hi: '#fff4cd', core: '#5c3b00', glow: '#ffe9a3', text: '#3f2f08' }
  };

  /* ---------------- 小鲸鱼（和 Whale Runner 是同一只） ----------------
   * DeepSeek 官方 logo 的那条 cubic 路径光栅化成 24×18 像素网格（镜像成朝右），
   * 字符画与 Whale Runner 里的 WHALE_A / WHALE_B 完全一致：两帧只差尾鳍摆动，
   * 身体逐格对齐，所以换帧不影响判定。
   * X = 主色, o = 肚皮, . = 透明；想改造型直接改字符即可，尺寸会自动跟着走。 */
  var WHALE_A = [
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
  var WHALE_B = [
    '............X...........',
    '.......X....XXXXXXXX....',
    '......XX....XXXXXXXXX...',
    'X....XXX...XXXXXXXXXXX..',
    'XXXXXXXX..XXXXXXXXXXXXX.',
    'XXXXXXX..XXXXXXXXXXXXXXX',
    '.XXXXX..XXXXXXXXXXXXXXXX',
    '...XXXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXXooooooXX',
    '....XXXXooXXXXXoooooooXX',
    '....XXXXoXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXXX',
    '.....XXXXXXXXooooooooXX.',
    '......XXXXXXoooXooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '......XXXXooXXXXXXXXX...',
    '.....XXXXXXXXXXXXXXX....',
    '...........XXXXXXX......'
  ];

  /* 尺寸直接由字符画推导（改鲸鱼造型不用改这里） */
  var SHEET_PX = 3;                              // 每个精灵格子在画布上的像素大小
  var PLAYER_W = WHALE_A[0].length * SHEET_PX;   // 24 格 × 3 = 72px
  var PLAYER_H = WHALE_A.length * SHEET_PX;      // 18 格 × 3 = 54px
  var PLAYER_TOP = H - PLAYER_H - 6;             // 贴着画面底部，留 6px 海床

  /* 判定盒用「精灵格子」表达：只取身体中段，
   * 尾鳍和上下留白这些透明区域不算碰撞（和 Whale Runner 一个套路）。 */
  var PLAYER_HIT_CELLS = { dx: 7, dy: 8, w: 10, h: 6 };
  var PLAYER_HIT = {
    x: PLAYER_HIT_CELLS.dx * SHEET_PX,
    y: PLAYER_HIT_CELLS.dy * SHEET_PX,
    w: PLAYER_HIT_CELLS.w * SHEET_PX,
    h: PLAYER_HIT_CELLS.h * SHEET_PX
  };

  (function hitboxCheck() {
    var inside = PLAYER_HIT.x >= 0 && PLAYER_HIT.y >= 0 &&
      PLAYER_HIT.x + PLAYER_HIT.w <= PLAYER_W && PLAYER_HIT.y + PLAYER_HIT.h <= PLAYER_H;
    if (!inside && window.console && window.console.warn) {
      window.console.warn("[token-fall] 鲸鱼判定盒超出精灵范围，" +
        "碰撞会变得莫名其妙（检查 PLAYER_HIT_CELLS 与 SHEET_PX）");
    }
  })();

  /* ================= 工具 ================= */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  /* ================= 状态 ================= */
  var game = {
    state: 'ready',            // ready | running | paused | over（overflow 是 running 的子状态）
    contextMax: MAX_CONTEXT,   // 第一版固定 1024
    score: 0,
    context: 0,
    combo: 0,
    multiplier: 1,
    high: 0,
    tokens: [],
    particles: [],
    player: { x: 0, vx: 0, wobbleMs: 0 },
    playerW: PLAYER_W,
    playerH: PLAYER_H,
    elapsedMs: 0,
    thinkMs: 0,
    thinkCooldownMs: 0,
    speedScale: 1,
    overflowActive: false,     // running 的子状态：CONTEXT 溢出但还在抢救
    overflowMs: 0,
    overflowBeepMs: 0,
    overReason: '',
    overCooldown: 0,
    spawnTimer: SPAWN_FIRST_MS,
    spawnInterval: SPAWN_START,
    sinceCompressMs: 0,
    rescueMs: COMPRESS_RESCUE_MS,
    noiseStreak: 0,
    speed: SPEED_START,
    maxActive: ACTIVE_START,
    noiseChance: NOISE_MIN,
    compressChance: COMPRESS_MIN
  };

  try {
    var saved = parseInt(localStorage.getItem('arcade.tokenFall.high') || '0', 10);
    if (isFinite(saved) && saved > 0) game.high = saved;
  } catch (e) { /* 隐私模式忽略 */ }

  function saveHigh() {
    try { localStorage.setItem('arcade.tokenFall.high', String(game.high)); } catch (e) { /* ignore */ }
  }

  /* ================= 难度 ================= */
  function updateDifficulty() {
    var t = game.elapsedMs / 1000;
    game.speed = Math.min(SPEED_MAX, SPEED_START + t * SPEED_GROWTH);
    game.spawnInterval = Math.max(SPAWN_MIN, SPAWN_START - t * SPAWN_DECAY);
    game.maxActive = Math.min(ACTIVE_MAX, ACTIVE_START + Math.floor(t / ACTIVE_EVERY_S));
    game.noiseChance = Math.min(NOISE_MAX, NOISE_MIN + t * NOISE_RAMP);
    game.compressChance = COMPRESS_MIN + (COMPRESS_MAX - COMPRESS_MIN) * clamp(game.context / MAX_CONTEXT, 0, 1);
  }

  /* ================= 局面 ================= */
  function reset() {
    game.tokens = [];
    game.particles = [];
    game.score = 0;
    game.context = 0;
    game.combo = 0;
    game.multiplier = 1;
    game.elapsedMs = 0;
    game.thinkMs = 0;
    game.thinkCooldownMs = 0;
    game.speedScale = 1;
    game.overflowActive = false;
    game.overflowMs = 0;
    game.overflowBeepMs = 0;
    game.overReason = '';
    game.overCooldown = 0;
    game.sinceCompressMs = 0;
    game.rescueMs = COMPRESS_RESCUE_MS;
    game.noiseStreak = 0;
    game.player.x = (W - PLAYER_W) / 2;
    game.player.vx = 0;
    game.player.wobbleMs = 0;
    updateDifficulty();
    game.spawnTimer = SPAWN_FIRST_MS;
  }

  function start() {
    reset();
    game.state = 'running';
    updateButtons();
  }

  function gameOver(reason) {
    game.state = 'over';
    game.overReason = reason || 'overflow';
    game.overCooldown = 420;
    game.overflowActive = false;
    game.overflowMs = 0;
    game.thinkMs = 0;
    game.speedScale = 1;
    if (game.score > game.high) { game.high = game.score; }
    saveHigh();
    updateButtons();
    tone({ type: 'sawtooth', from: 320, to: 70, ms: 420, gain: 0.07 });
  }

  function hasCompress() {
    for (var i = 0; i < game.tokens.length; i++) {
      if (game.tokens[i].type === 'compress') return true;
    }
    return false;
  }

  /* 生成横坐标：尽量和最近生成的掉落物拉开横向间距，避免“墙”。 */
  function gapAt(x, w) {
    var best = 9999;
    for (var i = 0; i < game.tokens.length; i++) {
      var t = game.tokens[i];
      if ((t.y || 0) > 150) continue;                  // 已经落到中段的不用管
      var tw = t.w || TOKEN_W;
      var gap = Math.abs((x + w / 2) - (t.x + tw / 2)) - (w + tw) / 2;
      if (gap < best) best = gap;
    }
    return best;
  }
  function pickX(w, type) {
    var lo = 8, hi = W - 8 - w;
    var best = rand(lo, hi), bestGap = -9999;
    for (var i = 0; i < 16; i++) {
      var x = rand(lo, hi);
      var gap = gapAt(x, w);
      if (type === 'compress') {
        /* 抢救道具也不能直接送到嘴边：离玩家太近的位置几乎排除，
         * 只有所有候选都靠得太近时才会退而求其次。 */
        var d = Math.abs(x + w / 2 - (game.player.x + PLAYER_W / 2));
        if (d < COMPRESS_MIN_OFFSET) gap -= 100000;
      }
      if (gap > bestGap) { bestGap = gap; best = x; }
      if (bestGap > 70) break;
    }
    return best;
  }

  function pickType() {
    /* 保底一：Context 很高而且很久没给 COMPRESS —— 直接给一个 */
    if (game.context >= MAX_CONTEXT * 0.85 && !hasCompress() && game.sinceCompressMs >= COMPRESS_URGE_MS) {
      return 'compress';
    }
    /* THINK：低概率 + 冷却 + 开局宽限，绝不刷屏 */
    if (game.thinkMs <= 0 && game.thinkCooldownMs <= 0 &&
        game.elapsedMs >= THINK_GRACE_MS && Math.random() < THINK_CHANCE) {
      return 'think';
    }
    /* 不让 NOISE 连着来 */
    if (game.noiseStreak >= NOISE_STREAK_MAX) {
      return Math.random() < game.compressChance ? 'compress' : 'token';
    }
    var r = Math.random();
    if (r < game.noiseChance) return 'noise';
    if (r < game.noiseChance + game.compressChance) return 'compress';
    return 'token';
  }

  function spawnToken(type, forced) {
    type = type || pickType();
    var x = pickX(TOKEN_W, type);
    var t = {
      type: type,
      x: x,
      y: -TOKEN_H - (forced ? 0 : rand(0, 40)),
      w: TOKEN_W,
      h: TOKEN_H,
      speed: game.speed * rand(0.92, 1.08)
    };
    game.tokens.push(t);
    game.spawnTimer = game.spawnInterval;
    if (type === 'compress') game.sinceCompressMs = 0;
    game.noiseStreak = type === 'noise' ? game.noiseStreak + 1 : 0;
    return t;
  }

  function burst(x, y, color) {
    for (var i = 0; i < 10; i++) {
      var a = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      game.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * (0.5 + Math.random() * 1.5),
        vy: Math.sin(a) * (0.5 + Math.random() * 1.5) - 0.6,
        life: 1,
        color: color
      });
    }
  }

  /* ================= 接住 ================= */
  function bumpCombo() {
    game.combo++;
    game.multiplier = Math.min(COMBO_MAX, 1 + Math.floor(game.combo / COMBO_STEP));
  }

  function catchToken(t) {
    var mult = game.multiplier;              // 用“接到之前”的倍率结算，第 4 个起才吃 x2
    var gain = 0;
    var cx = t.x + TOKEN_W / 2;
    var cy = t.y + TOKEN_H / 2;

    if (t.type === 'token') {
      game.context += CTX_TOKEN;
      gain = SCORE_TOKEN;
      bumpCombo();
      burst(cx, cy, LOOK.token.glow);
      tone({ type: 'square', from: 520, to: 880, ms: 90, gain: 0.05 });
    } else if (t.type === 'compress') {
      game.context = Math.max(0, game.context - CTX_COMPRESS);
      gain = SCORE_COMPRESS;
      bumpCombo();
      burst(cx, cy, LOOK.compress.glow);
      tone({ type: 'sawtooth', from: 900, to: 260, ms: 180, gain: 0.055 });
    } else if (t.type === 'think') {
      game.thinkMs = THINK_MS;
      game.thinkCooldownMs = THINK_COOLDOWN_MS;
      game.context += CTX_THINK;
      gain = SCORE_THINK;
      bumpCombo();
      burst(cx, cy, LOOK.think.glow);
      tone({ type: 'triangle', from: 660, to: 1320, ms: 220, gain: 0.055 });
    } else {                                  // NOISE：加 Context、不给分、断 Combo
      game.context += CTX_NOISE;
      gain = SCORE_NOISE;
      game.combo = 0;
      game.multiplier = 1;
      burst(cx, cy, LOOK.noise.glow);
      tone({ type: 'square', from: 220, to: 90, ms: 260, gain: 0.06 });
    }
    game.score += gain * mult;
  }

  function tokenBox(t) {
    var inset = HIT[t.type] === undefined ? HIT.token : HIT[t.type];
    var w = t.w || TOKEN_W, h = t.h || TOKEN_H;
    return { x: t.x + inset, y: t.y + inset, w: w - inset * 2, h: h - inset * 2 };
  }
  function playerBox() {
    return {
      x: game.player.x + PLAYER_HIT.x,
      y: PLAYER_TOP + PLAYER_HIT.y,
      w: PLAYER_HIT.w,
      h: PLAYER_HIT.h
    };
  }

  /* ================= 输入 ================= */
  var keys = { left: false, right: false };
  var pads = { left: [], right: [] };        // 每个方向按住的所有 pointerId
  var drag = { id: null, active: false, moved: false, startX: 0, targetX: 0, consumed: false };

  function padCount(dir) { return pads[dir].length; }
  function padAdd(dir, id) { if (pads[dir].indexOf(id) < 0) pads[dir].push(id); }
  function padRemove(dir, id) {
    var i = pads[dir].indexOf(id);
    if (i >= 0) pads[dir].splice(i, 1);
  }
  function padReleaseAll(id) { padRemove('left', id); padRemove('right', id); }

  function inputDir() {
    var l = keys.left || padCount('left') > 0;
    var r = keys.right || padCount('right') > 0;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  function pointerKey(e) {
    if (e && e.pointerId !== undefined && e.pointerId !== null) return e.pointerId;
    return 'p';
  }
  function stopEv(e) { if (e && e.preventDefault) e.preventDefault(); }

  function pressStart() {
    if (game.state === 'ready') start();
    else if (game.state === 'over') { if (game.overCooldown <= 0) start(); }
    else if (game.state === 'paused') { game.state = 'running'; updateButtons(); }
  }
  function togglePause() {
    if (game.state === 'running') { game.state = 'paused'; updateButtons(); }
    else if (game.state === 'paused') { game.state = 'running'; updateButtons(); }
  }
  function tapAction() {
    if (game.state === 'ready') start();
    else if (game.state === 'over') { if (game.overCooldown <= 0) start(); }
    else togglePause();
  }

  function keyAxis(e, down) {
    var k = e.key, c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = down; return true; }
    if (c === 'ArrowRight' || c === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = down; return true; }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    if (keyAxis(e, true)) { stopEv(e); pressStart(); return; }
    var k = e.key, c = e.code;
    if (c === 'KeyP' || k === 'p' || k === 'P' || k === 'Escape') { stopEv(e); togglePause(); return; }
    if (c === 'KeyM' || k === 'm' || k === 'M') { stopEv(e); toggleSound(); return; }
    if (c === 'Space' || k === ' ') { stopEv(e); tapAction(); }
  });
  document.addEventListener('keyup', function (e) { if (keyAxis(e, false)) stopEv(e); });

  /* 触屏方向键：按住持续移动，pointerup / pointercancel / pointerleave 都会松手 */
  function bindPad(id, dir) {
    var el = document.getElementById(id);
    if (!el || !el.addEventListener) return;
    el.addEventListener('pointerdown', function (e) {
      stopEv(e);
      padAdd(dir, pointerKey(e));
      pressStart();
    });
    var release = function (e) { padRemove(dir, pointerKey(e)); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('lostpointercapture', release);
  }
  bindPad('left', 'left');
  bindPad('right', 'right');

  /* 手指滑出按钮、或在按钮外面抬手时，靠 document 兜底松开，避免角色一直跑 */
  function globalRelease(e) {
    var id = pointerKey(e);
    padReleaseAll(id);
    if (drag.id === id) endDrag();
  }
  document.addEventListener('pointerup', globalRelease);
  document.addEventListener('pointercancel', globalRelease);
  /* 窗口失焦 / 切走标签页时统一松手：
   * 有些浏览器切到别的应用只发 visibilitychange、不发 blur，
   * 不清掉的话回来会看到鲸鱼自己一直往一个方向跑。 */
  function releaseAllInput() {
    keys.left = false;
    keys.right = false;
    pads.left.length = 0;
    pads.right.length = 0;
    endDrag();
  }
  if (window.addEventListener) window.addEventListener('blur', releaseAllInput);

  /* 画布：轻点 = 开始 / 暂停 / 重开；左右拖动 = 跟着手指走（额外操作方式） */
  function canvasX(e) {
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    if (!rect || !rect.width) return game.player.x + PLAYER_W / 2;
    return clamp(((e.clientX || 0) - rect.left) * (W / rect.width), 0, W);
  }
  function endDrag() { drag.id = null; drag.active = false; drag.moved = false; drag.consumed = false; }

  canvas.addEventListener('pointerdown', function (e) {
    stopEv(e);
    drag.id = pointerKey(e);
    drag.active = false;
    drag.moved = false;
    drag.startX = e.clientX || 0;
    drag.targetX = canvasX(e);
    /* 这一次轻点用来「开始 / 继续 / 重开」了，松手时就不要再当成暂停键 */
    var idle = game.state === 'ready' || game.state === 'paused' || game.state === 'over';
    drag.consumed = idle;
    if (idle) pressStart();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (drag.id === null || pointerKey(e) !== drag.id) return;
    if (!drag.moved && Math.abs((e.clientX || 0) - drag.startX) > DRAG_MIN) drag.moved = true;
    if (drag.moved) { drag.active = true; drag.targetX = canvasX(e); if (game.state === 'ready') start(); }
  });
  canvas.addEventListener('pointerup', function (e) {
    if (drag.id !== pointerKey(e)) return;
    var tapped = !drag.moved && !drag.active && !drag.consumed;
    endDrag();
    if (tapped) tapAction();
  });
  canvas.addEventListener('pointercancel', function () { endDrag(); });
  canvas.addEventListener('contextmenu', function (e) { stopEv(e); });

  var soundBtn = document.getElementById('sound');
  if (soundBtn) soundBtn.addEventListener('click', function () { toggleSound(); });
  var pauseBtn = document.getElementById('pause');
  if (pauseBtn) pauseBtn.addEventListener('click', function () { togglePause(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.state === 'running') { game.state = 'paused'; updateButtons(); }
    if (document.hidden) releaseAllInput();
  });

  var stopped = false;
  function stopLoop() { stopped = true; }
  document.addEventListener('pagehide', stopLoop);
  if (window.addEventListener) window.addEventListener('pagehide', stopLoop);

  /* 前进/后退从 bfcache 恢复：循环已被 pagehide 停掉，这里把它接回来，
   * 否则页面会停在最后一帧、再也不动（首次加载时 pageshow 也会来，那时 stopped 还是 false）。 */
  if (window.addEventListener) {
    window.addEventListener('pageshow', function () {
      if (!stopped) return;
      stopped = false;
      last = 0;
      acc = 0;
      requestAnimationFrame(frame);
    });
  }

  /* ================= 逻辑推进 ================= */
  function movePlayer(dt) {
    var target = inputDir() * PLAYER_SPEED;
    var accel = PLAYER_ACCEL * dt / 1000;
    if (game.player.vx < target) game.player.vx = Math.min(target, game.player.vx + accel);
    else game.player.vx = Math.max(target, game.player.vx - accel);
    game.player.x += game.player.vx * dt / 1000;

    if (drag.active) {
      var cx = game.player.x + PLAYER_W / 2;
      var step = PLAYER_SPEED * 1.25 * dt / 1000;
      var dx = drag.targetX - cx;
      game.player.x += Math.abs(dx) <= step ? dx : (dx > 0 ? step : -step);
      game.player.vx = 0;
    }

    var maxX = W - PLAYER_W - PLAYER_EDGE;
    if (game.player.x < PLAYER_EDGE) { game.player.x = PLAYER_EDGE; game.player.vx = 0; }
    if (game.player.x > maxX) { game.player.x = maxX; game.player.vx = 0; }
    game.player.wobbleMs += dt;
  }

  function fallSpeed(t) {
    return (typeof t.speed === 'number' && isFinite(t.speed) && t.speed > 0) ? t.speed : game.speed;
  }

  function moveTokens(dt) {
    var scale = game.speedScale;
    var box = playerBox();
    for (var i = game.tokens.length - 1; i >= 0; i--) {
      var t = game.tokens[i];
      t.y += fallSpeed(t) * scale * dt / 1000;
      if (overlap(tokenBox(t), box)) {
        catchToken(t);
        game.tokens.splice(i, 1);
        continue;
      }
      if (t.y > H + 6) game.tokens.splice(i, 1);       // 漏掉的掉落物不扣分、不结束游戏
    }
  }

  function updateOverflow(dt) {
    if (game.context >= MAX_CONTEXT) {
      if (!game.overflowActive) {
        game.overflowActive = true;
        game.overflowMs = OVERFLOW_MS;
        game.overflowBeepMs = 0;
        tone({ type: 'square', from: 300, to: 640, ms: 200, gain: 0.05 });
      }
      /* 关键：这里每帧都重新看 Context。
       * 只要这段时间里吃到 COMPRESS 把 Context 压回 1024 以下，
       * 下一次进来就会走 else 分支直接取消，绝不会出现“已经救回来了还被计时器判死”。 */
      game.overflowMs -= dt;
      game.overflowBeepMs -= dt;
      if (game.overflowBeepMs <= 0) {
        game.overflowBeepMs = 600;
        tone({ type: 'square', from: 500, to: 320, ms: 120, gain: 0.04 });
      }
      if (game.overflowMs <= 0) {
        game.overflowMs = 0;
        gameOver('overflow');
      }
    } else if (game.overflowActive) {
      game.overflowActive = false;
      game.overflowMs = 0;
      game.overflowBeepMs = 0;
      tone({ type: 'triangle', from: 520, to: 940, ms: 170, gain: 0.045 });
    }
  }

  function updateSpawn(dt) {
    game.sinceCompressMs += dt;

    /* 保底二：Context > 95% 且场上没有 COMPRESS —— 限时给一个（仍然要玩家自己去接） */
    if (game.context >= MAX_CONTEXT * 0.95 && !hasCompress()) {
      game.rescueMs -= dt;
      if (game.rescueMs <= 0) {
        game.rescueMs = COMPRESS_RESCUE_MS;
        spawnToken('compress', true);
        return;
      }
    } else {
      game.rescueMs = COMPRESS_RESCUE_MS;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;
    if (game.tokens.length >= game.maxActive) {   // 同屏满了就等下一个，但计时器归零，
      game.spawnTimer = 0;                        // 免得空位一出来就连着刷好几个
      return;
    }
    spawnToken(pickType(), false);
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
    if (game.state === 'paused') return;   // 暂停：掉落物 / 计时 / 分数 / 粒子全部冻结

    updateParticles(dt);

    if (game.state === 'over') {
      if (game.overCooldown > 0) game.overCooldown -= dt;
      return;
    }
    if (game.state !== 'running') return;

    game.elapsedMs += dt;
    updateDifficulty();

    if (game.thinkMs > 0) {
      game.thinkMs -= dt;
      if (game.thinkMs < 0) game.thinkMs = 0;
    }
    if (game.thinkCooldownMs > 0) {
      game.thinkCooldownMs -= dt;
      if (game.thinkCooldownMs < 0) game.thinkCooldownMs = 0;
    }
    game.speedScale = game.thinkMs > 0 ? THINK_SLOW : 1;

    movePlayer(dt);
    moveTokens(dt);
    updateOverflow(dt);
    if (game.state !== 'running') return;
    updateSpawn(dt);
  }

  /* ================= 背景（纯视觉，不参与逻辑） ================= */
  var bgPixels = [];
  var bgBubbles = [];
  (function initBackground() {
    for (var i = 0; i < 28; i++) {
      bgPixels.push({ x: rand(0, W), y: rand(0, H), s: Math.random() < 0.3 ? 3 : 2, v: rand(5, 20) });
    }
    for (var j = 0; j < 12; j++) {
      bgBubbles.push({ x: rand(10, W - 10), y: rand(0, H), s: Math.random() < 0.5 ? 5 : 3, v: rand(9, 26) });
    }
  })();

  function updateBackground(dt) {
    var s = dt / 1000;
    for (var i = 0; i < bgPixels.length; i++) {
      var p = bgPixels[i];
      p.y += p.v * s;
      if (p.y > H) { p.y = -4; p.x = rand(0, W); }
    }
    for (var j = 0; j < bgBubbles.length; j++) {
      var b = bgBubbles[j];
      b.y -= b.v * s;
      if (b.y < -8) { b.y = H + 8; b.x = rand(10, W - 10); }
    }
  }

  /* ================= 绘制 ================= */
  var clock = 0;

  function drawBackground(ratio) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    var think = game.thinkMs > 0;
    if (think) { g.addColorStop(0, '#0b2450'); g.addColorStop(1, '#14417d'); }
    else { g.addColorStop(0, '#07132a'); g.addColorStop(1, '#0d1f43'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 缓慢流动的数据像素 */
    ctx.fillStyle = 'rgba(120,175,255,0.20)';
    for (var i = 0; i < bgPixels.length; i++) {
      var p = bgPixels[i];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    /* 气泡 */
    ctx.fillStyle = 'rgba(150,200,255,0.10)';
    for (var j = 0; j < bgBubbles.length; j++) {
      var b = bgBubbles[j];
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s);
      ctx.fillRect(Math.round(b.x + b.s), Math.round(b.y - 2), 2, 2);
    }
    /* 网格（很淡，不抢掉落物的辨识度） */
    ctx.fillStyle = 'rgba(120,175,255,0.055)';
    for (var x = 0; x <= W; x += 38) ctx.fillRect(x, HUD_H, 1, H - HUD_H);
    for (var y = HUD_H; y <= H; y += 38) ctx.fillRect(0, y, W, 1);

    /* DEEP THINK：克制的蓝色像素泛光 + 底部扫描线 */
    if (think) {
      var pulse = 0.06 + 0.05 * Math.sin(clock / 190);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#59a6ff';
      ctx.fillRect(0, HUD_H, W, H - HUD_H);
      ctx.globalAlpha = 0.30 + 0.18 * Math.sin(clock / 130);
      ctx.fillStyle = '#9fe0ff';
      var sy = HUD_H + ((clock / 26) % (H - HUD_H));
      ctx.fillRect(0, Math.round(sy), W, 2);
      ctx.globalAlpha = 1;
    }
    /* Context 压力：越满，画面边缘越“挤” */
    if (ratio >= 0.6) {
      ctx.globalAlpha = ratio >= 0.85 ? 0.10 + 0.05 * Math.sin(clock / 260) : 0.05;
      ctx.fillStyle = '#3f6fd8';
      ctx.fillRect(0, HUD_H, W, 3);
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillRect(0, HUD_H, 3, H - HUD_H);
      ctx.fillRect(W - 3, HUD_H, 3, H - HUD_H);
      ctx.globalAlpha = 1;
    }
  }

  function drawTokenLabel(type, x, y, color) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (type === 'think') {
      ctx.font = 'bold 9px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('tokenfall.thinkName'), x + TOKEN_W / 2, y + TOKEN_H / 2 + 1);
      return;
    }
    var short = T('tokenfall.short.token');
    if (type === 'compress') short = T('tokenfall.short.compress');
    else if (type === 'noise') short = T('tokenfall.short.noise');
    ctx.font = 'bold 16px "Courier New", ui-monospace, monospace';
    ctx.fillText(short, x + TOKEN_W / 2, y + TOKEN_H / 2 + 1);
  }

  function drawTokens() {
    for (var i = 0; i < game.tokens.length; i++) {
      var t = game.tokens[i];
      var x = Math.round(t.x), y = Math.round(t.y);
      if (y > H + 4 || y < -TOKEN_H - 44) continue;
      var look = LOOK[t.type] || LOOK.token;
      var pulse = 0.5 + 0.5 * Math.sin((clock + i * 140) / 240);

      /* 外发光：像素风的一层半透明方块，不用 shadow，省性能 */
      ctx.globalAlpha = 0.10 + 0.12 * pulse;
      ctx.fillStyle = look.glow;
      ctx.fillRect(x - 3, y - 3, TOKEN_W + 6, TOKEN_H + 6);
      ctx.globalAlpha = 1;

      ctx.fillStyle = look.body;
      ctx.fillRect(x, y, TOKEN_W, TOKEN_H);
      ctx.fillStyle = look.hi;
      ctx.fillRect(x, y, TOKEN_W, 3);
      ctx.fillRect(x, y, 3, TOKEN_H);
      ctx.fillStyle = look.core;
      ctx.fillRect(x + 6, y + 6, TOKEN_W - 12, TOKEN_H - 12);

      /* NOISE 额外画两道错位的紫光，一眼就能和 TOKEN 区分 */
      if (t.type === 'noise') {
        ctx.globalAlpha = 0.35 + 0.25 * pulse;
        ctx.fillStyle = '#e2a6ff';
        ctx.fillRect(x - 5, y + 10, 5, 3);
        ctx.fillRect(x + TOKEN_W, y + 22, 5, 3);
        ctx.globalAlpha = 1;
      }
      drawTokenLabel(t.type, x, y, look.text);
    }
  }

  function drawSprite(rows, px, ox, oy, colors) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var c = 0;
      while (c < row.length) {
        var ch = row.charAt(c);
        if (ch === '.') { c++; continue; }
        var start = c;
        while (c < row.length && row.charAt(c) === ch) c++;
        ctx.fillStyle = colors[ch] || colors.X;
        ctx.fillRect(ox + start * px, oy + r * px, (c - start) * px, px);
      }
    }
  }

  function drawPlayer(ratio) {
    var x = Math.round(game.player.x);
    var y = PLAYER_TOP;
    var think = game.thinkMs > 0;

    if (think) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(x - 5, y - 5, PLAYER_W + 10, PLAYER_H + 10);
      ctx.globalAlpha = 1;
    }

    /* Context Buffer：鲸鱼背上的几个发光小槽，很轻，不挡画面 */
    var slots = 8, cw = 5, gap = 3;
    var tw = slots * cw + (slots - 1) * gap;
    var bx = Math.round(x + PLAYER_W / 2 - tw / 2);
    var by = y - 12;
    var filled = Math.round(clamp(ratio, 0, 1) * slots);
    for (var i = 0; i < slots; i++) {
      ctx.globalAlpha = i < filled ? 0.55 : 0.16;
      ctx.fillStyle = ratio >= 0.85 ? '#ffd27a' : '#7fd0ff';
      ctx.fillRect(bx + i * (cw + gap), by, cw, 4);
    }
    ctx.globalAlpha = 1;

    /* 摆尾两帧，110ms 一换；X 主色 / o 肚皮（和 Whale Runner 同一套配色） */
    var frame = Math.floor(game.player.wobbleMs / 110) % 2 === 0 ? WHALE_A : WHALE_B;
    var ink = { X: think ? '#93c8ff' : '#4d6bfe', o: think ? '#e3f1ff' : '#c9dcff' };
    if (game.player.vx < -20) {
      /* 往左游就把精灵镜像一下，头始终朝前 */
      ctx.save();
      ctx.translate(x + PLAYER_W, y);
      ctx.scale(-1, 1);
      drawSprite(frame, SHEET_PX, 0, 0, ink);
      ctx.restore();
    } else {
      drawSprite(frame, SHEET_PX, x, y, ink);
    }
  }

  function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i];
      var c = p.color;
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(ratio) {
    var think = game.thinkMs > 0;
    var low = clock / 300;
    var blink = (Math.floor(clock / 260) % 2) === 0;

    ctx.fillStyle = 'rgba(6,16,36,0.74)';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.textBaseline = 'middle';

    /* 顶边：DEEP THINK 剩余时间条 */
    if (think) {
      var tr = clamp(game.thinkMs / THINK_MS, 0, 1);
      ctx.fillStyle = 'rgba(120,190,255,0.25)';
      ctx.fillRect(0, 0, W, 4);
      ctx.fillStyle = '#8fe3ff';
      ctx.fillRect(0, 0, Math.round(W * tr), 4);
    }

    ctx.font = 'bold 15px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb6dd';
    ctx.fillText(T('tokenfall.score') + ' ' + pad(game.score, 5), 10, 16);

    ctx.textAlign = 'center';
    if (game.overflowActive) {
      if (blink) {
        ctx.fillStyle = '#ffc061';
        ctx.font = 'bold 15px "Courier New", ui-monospace, monospace';
        ctx.fillText(T('tokenfall.overflow'), W / 2, 16);
      }
    } else if (game.multiplier > 1) {
      ctx.fillStyle = '#8fe3ff';
      ctx.fillText(T('tokenfall.clean') + ' x' + game.multiplier, W / 2, 16);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6f8fc8';
    ctx.fillText(T('hud.hi') + ' ' + pad(Math.max(game.high, game.score), 5), W - 10, 16);

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = game.overflowActive ? '#ffc061' : (ratio >= 0.85 ? '#ffd27a' : '#8fa9d6');
    ctx.fillText(T('tokenfall.ctxLabel') + ' ' + Math.round(game.context) + ' / ' + game.contextMax, 10, 37);

    ctx.textAlign = 'right';
    if (think) {
      ctx.fillStyle = '#cdefff';
      ctx.fillText(T('tokenfall.think'), W - 10, 37);
    }

    /* CONTEXT 条 */
    var bx = 10, bw = W - 20, by = HUD_H - 10, bh = 6;
    ctx.fillStyle = 'rgba(120,170,255,0.16)';
    ctx.fillRect(bx, by, bw, bh);
    var fill = clamp(ratio, 0, 1);
    var col = '#4d6bfe';
    if (game.overflowActive) col = '#ffab3d';
    else if (ratio >= 0.95) col = '#ffc061';
    else if (ratio >= 0.85) col = blink ? '#ffd27a' : '#8fbf6a';
    else if (ratio >= 0.6) col = '#6fb3ff';
    if (ratio >= 0.6 && !game.overflowActive) {
      ctx.globalAlpha = ratio >= 0.85 ? 0.14 + 0.10 * Math.sin(low * 3.1) : 0.10;
      ctx.fillStyle = col;
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    ctx.fillRect(bx, by, Math.round(bw * fill), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx, by, Math.round(bw * fill), 2);

    /* OVERFLOW 抢救倒计时（画在场地顶部，不进 HUD） */
    if (game.overflowActive) {
      var or = clamp(game.overflowMs / OVERFLOW_MS, 0, 1);
      ctx.fillStyle = 'rgba(255,176,61,0.22)';
      ctx.fillRect(0, HUD_H + 3, W, 5);
      ctx.fillStyle = '#ffab3d';
      ctx.fillRect(0, HUD_H + 3, Math.round(W * or), 5);
    }
  }

  function wrapText(text, maxW) {
    var lines = [];
    var words = String(text).replace(/\u3000/g, ' ').split(' ');
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var cand = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || ctx.measureText(cand).width <= maxW) cur = cand;
      else { lines.push(cur); cur = words[i]; }
      /* 中文没有空格，单个“词”就可能超宽：按字符再切 */
      while (ctx.measureText(cur).width > maxW && cur.length > 1) {
        var cut = cur.length - 1;
        while (cut > 1 && ctx.measureText(cur.slice(0, cut)).width > maxW) cut--;
        lines.push(cur.slice(0, cut));
        cur = cur.slice(cut);
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawCenteredLines(lines, midY, font, color, lineH) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var start = midY - ((lines.length - 1) * lineH) / 2;
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, start + i * lineH);
  }

  function drawOverlay() {
    var midY = HUD_H + (H - HUD_H) / 2;
    var blink = (Math.floor(clock / 520) % 2) === 0;
    var bodyFont = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var monoFont = 'bold 15px "Courier New", ui-monospace, monospace';

    if (game.state === 'ready') {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#061024';
      ctx.fillRect(18, midY - 96, W - 36, 184);
      ctx.globalAlpha = 1;
      drawCenteredLines(wrapText(T('tokenfall.ready'), W - 72), midY - 62, bodyFont, '#dbe9ff', 19);
      drawCenteredLines(wrapText(T('tokenfall.hint'), W - 72), midY - 4, '12px -apple-system, "PingFang SC", sans-serif', '#7f9bc4', 17);
      drawCenteredLines(wrapText(T('tokenfall.legend'), W - 72), midY + 34, '11px "Courier New", ui-monospace, monospace', '#6f8fc8', 16);
      if (blink) drawCenteredLines(wrapText(T('tokenfall.start'), W - 72), midY + 68, monoFont, '#ffffff', 18);
      return;
    }
    if (game.state === 'paused') {
      ctx.globalAlpha = 0.68;
      ctx.fillStyle = '#061024';
      ctx.fillRect(0, HUD_H, W, H - HUD_H);
      ctx.globalAlpha = 1;
      drawCenteredLines([T('tokenfall.paused')], midY - 10, 'bold 22px "Courier New", ui-monospace, monospace', '#dbe9ff', 24);
      drawCenteredLines([T('tokenfall.pausedHint')], midY + 26, bodyFont, '#7f9bc4', 18);
      return;
    }
    if (game.state === 'over') {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#061024';
      ctx.fillRect(0, HUD_H, W, H - HUD_H);
      ctx.globalAlpha = 1;
      drawCenteredLines([T('tokenfall.gameover')], midY - 62, bodyFont, '#7f9bc4', 18);
      drawCenteredLines([T('tokenfall.over')], midY - 26, 'bold 22px "Courier New", ui-monospace, monospace', '#ffab3d', 26);
      drawCenteredLines(
        [T('tokenfall.score') + ' ' + pad(game.score, 5), T('hud.hi') + ' ' + pad(game.high, 5)],
        midY + 24, monoFont, '#dbe9ff', 22);
      if (blink) drawCenteredLines([T('tokenfall.restart')], midY + 66, bodyFont, '#9fb6dd', 18);
    }
  }

  function drawEdgePressure(ratio) {
    var a = 0;
    if (game.overflowActive) a = 0.12 + 0.10 * Math.sin(clock / 150);
    else if (ratio >= 0.95) a = 0.06 + 0.05 * Math.sin(clock / 300);
    if (a <= 0) return;
    /* 克制的琥珀色边框，不用刺眼的红闪 */
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffb03d';
    ctx.fillRect(0, HUD_H, W, 8);
    ctx.fillRect(0, H - 8, W, 8);
    ctx.fillRect(0, HUD_H, 8, H - HUD_H);
    ctx.fillRect(W - 8, HUD_H, 8, H - HUD_H);
    ctx.globalAlpha = 1;
  }

  function render() {
    var ratio = game.context / MAX_CONTEXT;
    drawBackground(ratio);
    drawTokens();
    drawPlayer(ratio);
    drawParticles();
    drawHud(ratio);
    drawOverlay();
    drawEdgePressure(ratio);
  }

  /* ================= 主循环 ================= */
  var last = 0;
  var acc = 0;

  function frame(now) {
    if (stopped) return;
    if (!last) last = now;
    var dt = now - last;
    last = now;
    clock = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 250) dt = STEP;      // 切标签页 / 卡顿回来时不让掉落物瞬移
    acc += dt;

    var guard = 0;
    while (acc >= STEP && guard++ < 5) { step(STEP); acc -= STEP; }
    if (guard >= 5) acc = 0;

    if (game.state !== 'paused') updateBackground(dt);
    render();
    requestAnimationFrame(frame);
  }

  reset();
  updateButtons();
  requestAnimationFrame(frame);
})();
