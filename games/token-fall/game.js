/* ============================================================
 * TOKEN FALL — DeepSeek Arcade
 * 竖向接物小游戏：接住 TOKEN 得分，但会撑大 CONTEXT；
 * 接住 COMPRESS 压缩上下文；躲开 NOISE（只加 Context、不给分）；
 * HEAVY TOKEN 分数很高但一次吃掉大量 Context（中后期的高风险高收益选择）；
 * 低概率的 THINK 触发 4 秒 DEEP THINK（全体减速 + 克制的蓝色泛光）。
 * CONTEXT 到达 1024 后进入 OVERFLOW 抢救时间：吃到 COMPRESS 就能取消溢出。
 *
 * 难度分 5 个阶段 LOAD 1 ~ LOAD 5：
 *   掉落物数值 / 自然概率 / 保底阈值 / Overflow 抢救时间都随 LOAD 变化，
 *   但节奏（速度 / 生成间隔 / 同屏上限）在阶段之间平滑过渡且全部封顶。
 *   LOAD 越高：COMPRESS 越稀有、效果越弱，NOISE 越致命，抢救时间越短 ——
 *   难度来自「资源管理 + 风险选择」，而不是单纯把下落速度拉满。
 *
 * 原生 Canvas 2D，零依赖：经典形态下小鲸鱼 / 掉落物 / 背景 / HUD 全部代码绘制；
 * 可选的 Whale-chan 皮肤只替换底部玩家的贴图（第三方素材，CC BY 4.0）。
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
  /* 全站统一 Sound：arcade.sound 优先，其次才是本游戏的老 key（读到就迁移） */
  var soundOn = ArcadeAudio ? ArcadeAudio.isEnabled('arcade.tokenFall.sound') : true;
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
    soundOn = ArcadeAudio ? ArcadeAudio.toggle() : !soundOn;
    updateButtons();
    if (soundOn) tone({ type: 'triangle', from: 880, to: 1180, ms: 90, gain: 0.04 });
  }
  if (I18N && I18N.onChange) I18N.onChange(updateButtons);

  /* ================= 规则常量 ================= */
  var MAX_CONTEXT = 1024;              // CONTEXT 上限（固定）
  var SCORE_TOKEN = 10, SCORE_HEAVY = 35, SCORE_COMPRESS = 20, SCORE_NOISE = 0, SCORE_THINK = 30;

  /* ---------- 难度阶段 LOAD 1 ~ 5 ----------
   * 难度不是「一个速度数字」，而是每个阶段各自的一整套规则：
   * 掉落物数值、自然概率、保底阈值、Overflow 抢救时间都随 LOAD 变化。
   * 150 秒之后停在 LOAD 5 不再上涨 —— 所有数值都有上限，不会数值爆炸。 */
  var LOAD_STARTS = [0, 30000, 60000, 100000, 150000];   // 各阶段的起始时间（ms）

  var LOADS = [
    {   /* LOAD 1 · 0~30s：新手阶段。掉得慢、同屏 1 个、C 常见、没有 HEAVY */
      tokenCtx: 32, heavyCtx: 96, compressCtx: 256, noiseCtx: 128, thinkCtx: 16,
      overflowMs: 2000,
      urgeRatio: 0.85, urgeMs: 3200,          // 保底一：Context 高且久未给过 C
      rescueRatio: 0.95, rescueMs: 1400,      // 保底二：Context 更高且场上没有 C
      thinkChance: 0.05,
      w: { token: 0.76, heavy: 0.00, compress: 0.18, noise: 0.06 },
      pace: { speed: 95, spawn: 1150, active: 1 }
    },
    {   /* LOAD 2 · 30~60s：开始有资源压力，HEAVY TOKEN 登场 */
      tokenCtx: 32, heavyCtx: 96, compressCtx: 224, noiseCtx: 144, thinkCtx: 16,
      overflowMs: 1800,
      urgeRatio: 0.88, urgeMs: 3800,
      rescueRatio: 0.96, rescueMs: 1800,
      thinkChance: 0.05,
      w: { token: 0.65, heavy: 0.08, compress: 0.14, noise: 0.13 },
      pace: { speed: 130, spawn: 900, active: 2 }
    },
    {   /* LOAD 3 · 60~100s：C 明显变珍贵，必须开始做取舍 */
      tokenCtx: 36, heavyCtx: 96, compressCtx: 192, noiseCtx: 160, thinkCtx: 16,
      overflowMs: 1600,
      urgeRatio: 0.90, urgeMs: 4500,
      rescueRatio: 0.97, rescueMs: 2200,
      thinkChance: 0.035,
      w: { token: 0.55, heavy: 0.15, compress: 0.10, noise: 0.20 },
      pace: { speed: 165, spawn: 720, active: 3 }
    },
    {   /* LOAD 4 · 100~150s：同屏多个目标，不能全接，错误代价明显 */
      tokenCtx: 40, heavyCtx: 96, compressCtx: 160, noiseCtx: 192, thinkCtx: 16,
      overflowMs: 1400,
      urgeRatio: 0.92, urgeMs: 5200,
      rescueRatio: 0.98, rescueMs: 2600,
      thinkChance: 0.025,
      w: { token: 0.46, heavy: 0.20, compress: 0.07, noise: 0.27 },
      pace: { speed: 200, spawn: 600, active: 4 }
    },
    {   /* LOAD 5 · 150s+：无限高压。数值全部封顶，理论上一直能继续玩 */
      tokenCtx: 40, heavyCtx: 96, compressCtx: 128, noiseCtx: 224, thinkCtx: 16,
      overflowMs: 1200,
      urgeRatio: 0.97, urgeMs: 6500,          // 只保留极端保底，不再频繁救玩家
      rescueRatio: 0.99, rescueMs: 3000,
      thinkChance: 0.018,
      w: { token: 0.41, heavy: 0.22, compress: 0.05, noise: 0.32 },
      pace: { speed: 230, spawn: 520, active: 4 }
    }
  ];

  var LOAD_BANNER_MS = 1000;           // 阶段切换横幅（短暂，不做长时间遮挡）
  var OVERFLOW_FLOOR_MS = 1200;        // 抢救时间下限：手机玩家也要有反应时间

  /* COMPRESSION FATIGUE：短时间内连吃 C 会边际递减，7 秒不接就重置 */
  var FATIGUE_WINDOW_MS = 7000;
  var FATIGUE_MUL = [1, 0.75, 0.5];    // 第 1 / 第 2 / 第 3+ 个 C
  var COMPRESS_STEP = 16;              // 最终压缩量按 16 取整（不会出现 -61.382）
  var COMPRESS_MIN_AMOUNT = 64;        // 压缩量下限，避免 C 完全没意义

  /* Context Efficiency：Context 越低，C 的收益越小 —— 别见 C 就无脑接 */
  var EFF_HIGH = 1.0, EFF_MID = 0.8, EFF_LOW = 0.5;
  var EFF_HIGH_AT = 0.75, EFF_MID_AT = 0.40;

  /* Context 越高的一点点公平性回调（很小，不会逆转「LOAD 越高 C 越稀缺」） */
  var MERCY_FROM = 0.70, MERCY_COMPRESS = 0.05, MERCY_NOISE = 0.04;

  var THINK_MS = 4000;                 // DEEP THINK 持续
  var THINK_SLOW = 0.6;                // 期间下落速度 ×0.6
  var THINK_COOLDOWN_MS = 9000;        // 两次 THINK 至少间隔
  var THINK_GRACE_MS = 5000;           // 开局宽限，不会一上来就慢动作

  var TOKEN_W = 34, TOKEN_H = 34;
  var HIT = { token: 5, heavy: 5, compress: 5, noise: 6, think: 6 };   // 每种掉落物的判定内缩

  var PLAYER_EDGE = 6;                 // 左右留边
  var PLAYER_SPEED = 340;              // px/s
  var PLAYER_ACCEL = 2200;             // px/s²（平滑加减速，不做瞬移）
  /* 鲸鱼的尺寸 / 站位 / 判定盒都由下面的字符画推导，见 WHALE_A */

  var SPAWN_FIRST_MS = 700;
  var COMPRESS_MIN_OFFSET = 70;        // 保底 COMPRESS 不直接砸在玩家头顶
  var NOISE_STREAK_MAX = 2;            // 不允许连出 3 个 NOISE 形成“墙”
  var COMBO_STEP = 3, COMBO_MAX = 5;   // CLEAN 倍率：每 3 连 +1，封顶 x5
  var FLOAT_MS = 1100;                 // 接住时浮动数值的停留时间
  var DRAG_MIN = 10;                   // 画布拖动超过这个距离才算拖动（否则算轻点）

  /* ================= 配色 ================= */
  /* HEAVY TOKEN 用亮薄荷绿：和 TOKEN 蓝 / COMPRESS 青 / NOISE 紫 / THINK 金
   * 都拉得开，另外还有专属的「四角加重标记 + H 字」，不靠颜色也能认出来。 */
  var LOOK = {
    token: { body: '#4d6bfe', hi: '#a8c4ff', core: '#122b6e', glow: '#7fa8ff', text: '#eef4ff' },
    heavy: { body: '#2fe39b', hi: '#d9fff1', core: '#064434', glow: '#7dffc9', text: '#03301f' },
    compress: { body: '#2ee6ff', hi: '#d4fbff', core: '#0a4a61', glow: '#8ff2ff', text: '#04303f' },
    noise: { body: '#a24bff', hi: '#e3b9ff', core: '#3b0b66', glow: '#c07bff', text: '#f8ecff' },
    think: { body: '#ffd76a', hi: '#fff4cd', core: '#5c3b00', glow: '#ffe9a3', text: '#3f2f08' }
  };

  /* ---------------- 小鲸鱼（和 Whale Runner / 大厅预览同一只） ----------------
   * 素材统一来自 shared/whale.js（DeepSeek logo 光栅化出的 24×18 两帧），
   * 这里只负责尺寸推导与判定盒，不再自己存一份像素数据。 */
  var ArcadeWhale = window.ArcadeWhale || {};
  var WHALE_A = ArcadeWhale.NORMAL_A || [[]];
  var WHALE_B = ArcadeWhale.NORMAL_B || WHALE_A;
  if (!ArcadeWhale.NORMAL_A && window.console && window.console.warn) {
    window.console.warn('[token-fall] 缺少 shared/whale.js：小鲸鱼素材没加载，请检查页面脚本顺序');
  }

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

  /* ================= 难度阶段 LOAD（纯函数，可以单独测试） =================
   * 这一段不碰任何游戏状态：给时间 / 阶段 / Context 就能算出结果，
   * 测试直接验证数值，不需要靠「随机一万次看比例」这种脆弱写法。 */
  function loadSlot(load) {
    var n = Math.round(isFinite(load) ? load : 1);
    return clamp(n - 1, 0, LOADS.length - 1);
  }
  /* 存活时间 -> 阶段下标 0..4。150 秒之后一直是最后一个，永远不会出现 LOAD 6。 */
  function loadIndexFor(ms) {
    var t = isFinite(ms) ? Math.max(0, ms) : 0;
    var i = 0;
    while (i < LOAD_STARTS.length - 1 && t >= LOAD_STARTS[i + 1]) i++;
    return i;
  }
  function loadForElapsed(ms) { return loadIndexFor(ms) + 1; }      // 1..5

  /* 节奏（速度 / 生成间隔 / 同屏上限）：相邻 LOAD 之间线性过渡，
   * LOAD 5 之后恒定。连续、单调、有上限 —— 不会「玩得够久必定数值爆炸」。 */
  function paceAt(ms) {
    var t = isFinite(ms) ? Math.max(0, ms) : 0;
    var i = loadIndexFor(t);
    var a = LOADS[i].pace;
    if (i >= LOADS.length - 1) return { speed: a.speed, spawn: a.spawn, active: a.active };
    var b = LOADS[i + 1].pace;
    var span = LOAD_STARTS[i + 1] - LOAD_STARTS[i];
    var p = span > 0 ? clamp((t - LOAD_STARTS[i]) / span, 0, 1) : 0;
    return {
      speed: a.speed + (b.speed - a.speed) * p,
      spawn: a.spawn + (b.spawn - a.spawn) * p,
      active: a.active + (b.active - a.active) * p
    };
  }

  /* 掉落物自然权重（纯函数，四项之和恒为 1）：
   * LOAD 越高 -> COMPRESS 越稀有、NOISE 越多、HEAVY TOKEN 出现。
   * contextRatio 只做很小的公平性回调（高 Context 时 C 多一点点、N 少一点点），
   * 幅度远小于 LOAD 带来的趋势，不会把「后期 C 很珍贵」抵消掉。 */
  function getDropWeights(load, contextRatio) {
    var p = LOADS[loadSlot(load)];
    var ratio = isFinite(contextRatio) ? clamp(contextRatio, 0, 1) : 0;
    var mercy = clamp((ratio - MERCY_FROM) / (1 - MERCY_FROM), 0, 1);
    var heavy = p.w.heavy;
    var compress = p.w.compress + MERCY_COMPRESS * mercy;
    var noise = p.w.noise - MERCY_NOISE * mercy;
    var token = 1 - compress - noise - heavy;      // 余数给 TOKEN，保证总和恰好为 1
    if (token < 0) token = 0;
    return { token: token, heavy: heavy, compress: compress, noise: noise };
  }

  /* COMPRESSION FATIGUE：短期连吃 C 的边际递减倍率 */
  function fatigueMultiplier(count) {
    var n = isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    return n >= FATIGUE_MUL.length ? FATIGUE_MUL[FATIGUE_MUL.length - 1] : FATIGUE_MUL[n];
  }
  /* Context Efficiency：高 Context 时 C 最有效，低 Context 时收益明显变小 */
  function contextEfficiency(ratio) {
    var r = isFinite(ratio) ? ratio : 0;
    if (r > EFF_HIGH_AT) return EFF_HIGH;
    if (r >= EFF_MID_AT) return EFF_MID;
    return EFF_LOW;
  }
  /* 最终压缩量 = LOAD 基础值 × Fatigue × Efficiency，
   * 再按 16 取整、套下限 64，并且绝不超过当前 Context（不允许压成负数）。 */
  function compressAmount(load, context, fatigueCount) {
    var ctx = isFinite(context) ? Math.max(0, context) : 0;
    var p = LOADS[loadSlot(load)];
    var raw = p.compressCtx * fatigueMultiplier(fatigueCount) * contextEfficiency(ctx / MAX_CONTEXT);
    var amount = Math.round(raw / COMPRESS_STEP) * COMPRESS_STEP;
    if (amount < COMPRESS_MIN_AMOUNT) amount = COMPRESS_MIN_AMOUNT;
    if (amount > ctx) amount = ctx;
    return amount;
  }

  /* ================= 状态 ================= */
  var game = {
    state: 'ready',            // ready | running | paused | over（overflow 是 running 的子状态）
    contextMax: MAX_CONTEXT,   // 固定 1024
    score: 0,
    context: 0,
    combo: 0,
    multiplier: 1,
    high: 0,
    tokens: [],
    particles: [],
    floats: [],                // 接住时冒出的浮动数值（COMPRESS -192 / NOISE +192 …）
    player: { x: 0, vx: 0, wobbleMs: 0 },
    playerW: PLAYER_W,
    playerH: PLAYER_H,
    elapsedMs: 0,
    load: 1,                   // 当前难度阶段 1~5（HUD 显示 LOAD n）
    loadIndex: 0,              // 阶段下标 0~4
    loadBannerMs: 0,           // 阶段切换横幅剩余时间
    loadBannerLoad: 1,
    thinkMs: 0,
    thinkCooldownMs: 0,
    speedScale: 1,
    overflowActive: false,     // running 的子状态：CONTEXT 溢出但还在抢救
    overflowMs: 0,
    overflowGraceMs: LOADS[0].overflowMs,   // 当前 LOAD 的抢救时长
    overflowBeepMs: 0,
    overReason: '',
    overCooldown: 0,
    spawnTimer: SPAWN_FIRST_MS,
    spawnInterval: LOADS[0].pace.spawn,
    sinceCompressMs: 0,
    rescueMs: LOADS[0].rescueMs,
    noiseStreak: 0,
    speed: LOADS[0].pace.speed,
    maxActive: LOADS[0].pace.active,
    noiseChance: LOADS[0].w.noise,
    compressChance: LOADS[0].w.compress,
    compressStreak: 0,         // COMPRESSION FATIGUE：短期已经接过几个 C
    compressSinceMs: 0,        // 距离上一个 C 多久（>= 7 秒就重置递减）
    heavyCaught: 0,            // 本局接到的 HEAVY TOKEN 数量
    face: 1                    // Whale-chan 朝向：1 = 朝右，-1 = 朝左（停住时保持上一次的方向）
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
    var idx = loadIndexFor(game.elapsedMs);
    if (idx !== game.loadIndex) {
      if (idx > game.loadIndex) {
        /* 阶段切换：1 秒横幅 + 一声提示音（不遮挡太久） */
        game.loadBannerMs = LOAD_BANNER_MS;
        game.loadBannerLoad = idx + 1;
        tone({ type: 'triangle', from: 430, to: 950, ms: 230, gain: 0.05 });
      }
      game.loadIndex = idx;
    }
    game.load = idx + 1;

    var pace = paceAt(game.elapsedMs);
    game.speed = pace.speed;
    game.spawnInterval = pace.spawn;
    /* 同屏数量取整：LOAD 1 是 1~2 个、LOAD 2 是 2~3 个、LOAD 3 是 3~4 个、
     * LOAD 4~5 封顶 4 个 —— 阶段内平滑爬升，不会突然多出一整排掉落物。 */
    game.maxActive = Math.round(pace.active);

    var p = LOADS[idx];
    game.overflowGraceMs = p.overflowMs;
    var w = getDropWeights(game.load, game.context / MAX_CONTEXT);
    game.noiseChance = w.noise;
    game.compressChance = w.compress;
  }

  /* ================= 局面 ================= */
  function reset() {
    game.tokens = [];
    game.particles = [];
    game.floats = [];
    game.score = 0;
    game.context = 0;
    game.combo = 0;
    game.multiplier = 1;
    game.elapsedMs = 0;
    /* 重开 = 回到 LOAD 1：阶段 / 横幅 / Fatigue / HEAVY 计数全部清零 */
    game.load = 1;
    game.loadIndex = 0;
    game.loadBannerMs = 0;
    game.loadBannerLoad = 1;
    game.compressStreak = 0;
    game.compressSinceMs = 0;
    game.heavyCaught = 0;
    game.face = 1;
    game.thinkMs = 0;
    game.thinkCooldownMs = 0;
    game.speedScale = 1;
    game.overflowActive = false;
    game.overflowMs = 0;
    game.overflowGraceMs = LOADS[0].overflowMs;
    game.overflowBeepMs = 0;
    game.overReason = '';
    game.overCooldown = 0;
    game.sinceCompressMs = 0;
    game.rescueMs = LOADS[0].rescueMs;
    game.noiseStreak = 0;
    game.player.x = (W - PLAYER_W) / 2;
    game.player.vx = 0;
    game.player.wobbleMs = 0;
    updateDifficulty();                     // 速度 / 间隔 / 同屏数回到 LOAD 1 的初始值
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
    var p = LOADS[game.loadIndex];

    /* 保底一：Context 进入本 LOAD 的保底区间而且很久没给 COMPRESS —— 直接给一个。
     * LOAD 越高阈值越极端、等待越久，但每个 LOAD 都保留（避免纯随机无解局）。 */
    if (game.context >= MAX_CONTEXT * p.urgeRatio && !hasCompress() && game.sinceCompressMs >= p.urgeMs) {
      return 'compress';
    }
    /* THINK：低概率 + 冷却 + 开局宽限；LOAD 越高越稀有，但永远不取消 */
    if (game.thinkMs <= 0 && game.thinkCooldownMs <= 0 &&
        game.elapsedMs >= THINK_GRACE_MS && Math.random() < p.thinkChance) {
      return 'think';
    }
    var w = getDropWeights(game.load, game.context / MAX_CONTEXT);
    /* 不让 NOISE 连着来：连出 NOISE_STREAK_MAX 个之后，把它的权重让给 TOKEN，
     * 这样横向封锁玩家的「NOISE 墙」不会出现。 */
    if (game.noiseStreak >= NOISE_STREAK_MAX) {
      w.token += w.noise;
      w.noise = 0;
    }
    var total = w.token + w.heavy + w.compress + w.noise;
    var r = Math.random() * (total > 0 ? total : 1);
    if (r < w.token) return 'token';
    r -= w.token;
    if (r < w.heavy) return 'heavy';
    r -= w.heavy;
    if (r < w.compress) return 'compress';
    return 'noise';
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

  /* 接住时冒出的浮动数值：显示的是「实际生效」的数值（例如 COMPRESS -192），
   * 不是基础值 —— 玩家能直接看到 Fatigue / Context Efficiency 的影响。 */
  function floatText(text, x, y, color) {
    if (game.floats.length > 16) game.floats.shift();
    game.floats.push({ text: text, x: x, y: y, life: 1, color: color });
  }

  function catchToken(t) {
    var mult = game.multiplier;              // 用“接到之前”的倍率结算，第 4 个起才吃 x2
    var p = LOADS[game.loadIndex];
    var gain = 0;
    var cx = t.x + TOKEN_W / 2;
    var cy = t.y + TOKEN_H / 2;

    if (t.type === 'token') {
      game.context += p.tokenCtx;
      gain = SCORE_TOKEN;
      bumpCombo();
      burst(cx, cy, LOOK.token.glow);
      floatText(T('tokenfall.name.token') + ' +' + p.tokenCtx, cx, cy - 20, LOOK.token.hi);
      tone({ type: 'square', from: 520, to: 880, ms: 90, gain: 0.05 });
    } else if (t.type === 'heavy') {
      /* HEAVY TOKEN：算作有效 Token（继续 CLEAN），分数很高，但一次吃掉大量 Context */
      game.context += p.heavyCtx;
      gain = SCORE_HEAVY;
      game.heavyCaught++;
      bumpCombo();
      burst(cx, cy, LOOK.heavy.glow);
      floatText(T('tokenfall.name.heavy') + ' +' + p.heavyCtx, cx, cy - 20, LOOK.heavy.hi);
      tone({ type: 'triangle', from: 380, to: 820, ms: 150, gain: 0.055 });
    } else if (t.type === 'compress') {
      /* 实际压缩量受 LOAD + Compression Fatigue + Context Efficiency 三者影响 */
      var amount = compressAmount(game.load, game.context, game.compressStreak);
      game.context = Math.max(0, game.context - amount);
      game.compressStreak = Math.min(game.compressStreak + 1, FATIGUE_MUL.length - 1);
      game.compressSinceMs = 0;
      gain = SCORE_COMPRESS;
      bumpCombo();
      burst(cx, cy, LOOK.compress.glow);
      floatText(T('tokenfall.name.compress') + ' -' + amount, cx, cy - 20, LOOK.compress.hi);
      tone({ type: 'sawtooth', from: 900, to: 260, ms: 180, gain: 0.055 });
    } else if (t.type === 'think') {
      game.thinkMs = THINK_MS;
      game.thinkCooldownMs = THINK_COOLDOWN_MS;
      game.context += p.thinkCtx;
      gain = SCORE_THINK;
      bumpCombo();
      burst(cx, cy, LOOK.think.glow);
      floatText(T('tokenfall.name.think') + ' +' + p.thinkCtx, cx, cy - 20, LOOK.think.text);
      tone({ type: 'triangle', from: 660, to: 1320, ms: 220, gain: 0.055 });
    } else {                                  // NOISE：加 Context、不给分、断 Combo
      game.context += p.noiseCtx;
      gain = SCORE_NOISE;
      game.combo = 0;
      game.multiplier = 1;
      burst(cx, cy, LOOK.noise.glow);
      floatText(T('tokenfall.name.noise') + ' +' + p.noiseCtx, cx, cy - 20, '#e9b4ff');
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
    var dir = inputDir();
    if (dir !== 0) game.face = dir;          // 只换朝向，不影响任何移动数值
    var target = dir * PLAYER_SPEED;
    var accel = PLAYER_ACCEL * dt / 1000;
    if (game.player.vx < target) game.player.vx = Math.min(target, game.player.vx + accel);
    else game.player.vx = Math.max(target, game.player.vx - accel);
    game.player.x += game.player.vx * dt / 1000;

    if (drag.active) {
      var cx = game.player.x + PLAYER_W / 2;
      var step = PLAYER_SPEED * 1.25 * dt / 1000;
      var dx = drag.targetX - cx;
      game.player.x += Math.abs(dx) <= step ? dx : (dx > 0 ? step : -step);
      if (dx > 1) game.face = 1;             // 拖动同样决定朝向
      else if (dx < -1) game.face = -1;
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
        /* 抢救时长随 LOAD 收紧（2.0s -> 1.2s），但不会低于 OVERFLOW_FLOOR_MS */
        game.overflowMs = Math.max(OVERFLOW_FLOOR_MS, game.overflowGraceMs);
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
    var p = LOADS[game.loadIndex];

    /* 保底二：Context 进入本 LOAD 的抢救区间且场上没有 COMPRESS —— 限时给一个。
     * LOAD 越高阈值越极端、等待越久（LOAD 5 只在 99% 以上才触发）；
     * 任何保底都仍然要求玩家自己移动过去接，不会直接落在头顶、也不会自动压缩。 */
    if (game.context >= MAX_CONTEXT * p.rescueRatio && !hasCompress()) {
      game.rescueMs -= dt;
      if (game.rescueMs <= 0) {
        game.rescueMs = p.rescueMs;
        spawnToken('compress', true);
        return;
      }
    } else {
      game.rescueMs = p.rescueMs;
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

  function updateFloats(dt) {
    for (var i = game.floats.length - 1; i >= 0; i--) {
      var f = game.floats[i];
      f.y -= 0.55 * (dt / 16.67);
      f.life -= dt / FLOAT_MS;
      if (f.life <= 0) game.floats.splice(i, 1);
    }
  }

  function step(dt) {
    if (game.state === 'paused') return;   // 暂停：掉落物 / 计时 / 分数 / 粒子全部冻结

    updateParticles(dt);
    updateFloats(dt);

    if (game.state === 'over') {
      if (game.overCooldown > 0) game.overCooldown -= dt;
      return;
    }
    if (game.state !== 'running') return;

    game.elapsedMs += dt;
    updateDifficulty();

    /* COMPRESSION FATIGUE 的恢复计时：暂停时不推进（step 在 paused 时已经返回），
     * 超过恢复窗口就把连吃递减重置回 100%。 */
    if (game.compressStreak > 0) {
      game.compressSinceMs += dt;
      if (game.compressSinceMs >= FATIGUE_WINDOW_MS) {
        game.compressStreak = 0;
        game.compressSinceMs = 0;
      }
    }
    if (game.loadBannerMs > 0) {
      game.loadBannerMs -= dt;
      if (game.loadBannerMs < 0) game.loadBannerMs = 0;
    }

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

  /* ================= 角色皮肤（Classic Whale / Whale-chan） =================
   * Whale-chan 只是底部玩家的贴图：PLAYER_TOP / PLAYER_HIT / 移动速度与判定
   * 全部不动，所以接物手感、漏接判定和经典皮肤完全一致。 */
  var ArcadeCharacter = window.ArcadeCharacter || null;
  var CHAN_H = 78;                      // 站立视觉高度（逻辑像素）
  var CHAN_W = CHAN_H * (300 / 340);    // 素材画布比例

  function chanFrame() {
    if (game.state === 'over') return 'blocked';
    if (game.overflowActive) return 'startle';    // 溢出抢救：慌张
    if (game.thinkMs > 0) return 'think';         // DEEP THINK：埋头工作
    if (inputDir() !== 0 || Math.abs(game.player.vx) > 30) return 'move';
    return 'idle';
  }
  function chanBox() {
    var cx = game.player.x + PLAYER_W / 2;
    var bottom = PLAYER_TOP + PLAYER_H;
    return { x: Math.round(cx - CHAN_W / 2), y: Math.round(bottom - CHAN_H), w: CHAN_W, h: CHAN_H };
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
    else if (type === 'heavy') short = T('tokenfall.short.heavy');
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
      /* HEAVY TOKEN 画两个对角「加重角标」：除了颜色，形状上也和别的掉落物不同 */
      if (t.type === 'heavy') {
        var tick = 7;
        ctx.fillStyle = look.hi;
        ctx.fillRect(x - 4, y - 4, tick, 3);                          // 左上 横
        ctx.fillRect(x - 4, y - 4, 3, tick);                          // 左上 竖
        ctx.fillRect(x + TOKEN_W - 3, y + TOKEN_H + 1, tick, 3);      // 右下 横
        ctx.fillRect(x + TOKEN_W + 1, y + TOKEN_H - 4, 3, tick);      // 右下 竖
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
    var chanName = ArcadeCharacter && ArcadeCharacter.isWhaleChan() ? chanFrame() : null;
    var chan = !!(chanName && ArcadeCharacter.ready(chanName));
    var box = chan ? chanBox() : { x: x, y: y, w: PLAYER_W, h: PLAYER_H };

    if (think) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(box.x - 5, box.y - 5, box.w + 10, box.h + 10);
      ctx.globalAlpha = 1;
    }

    /* Context Buffer：头顶上的几个发光小槽，很轻，不挡画面 */
    var slots = 8, cw = 5, gap = 3;
    var tw = slots * cw + (slots - 1) * gap;
    var bx = Math.round(x + PLAYER_W / 2 - tw / 2);
    var by = box.y - 12;
    var filled = Math.round(clamp(ratio, 0, 1) * slots);
    for (var i = 0; i < slots; i++) {
      ctx.globalAlpha = i < filled ? 0.55 : 0.16;
      ctx.fillStyle = ratio >= 0.85 ? '#ffd27a' : '#7fd0ff';
      ctx.fillRect(bx + i * (cw + gap), by, cw, 4);
    }
    ctx.globalAlpha = 1;

    /* Whale-chan 皮肤：画得出来就直接返回 */
    /* 素材本体朝左：面朝右 = 镜像；面朝左 = 原图。朝向由 game.face 记住，停下不会乱翻。 */
    if (chan && ArcadeCharacter.draw(ctx, chanName, box.x, box.y, box.w, box.h, { flip: game.face > 0 })) return;

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

  function drawFloats() {
    if (!game.floats.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Courier New", ui-monospace, monospace';
    for (var i = 0; i < game.floats.length; i++) {
      var f = game.floats[i];
      var a = clamp(f.life, 0, 1);
      var x = Math.round(f.x), y = Math.round(f.y);
      /* 一小块深色底：数字会和鲸鱼 / 网格重叠，纯描边还是看不清 */
      var tw = ctx.measureText ? ctx.measureText(f.text).width : 40;
      ctx.globalAlpha = a * 0.62;
      ctx.fillStyle = '#04101f';
      ctx.fillRect(x - tw / 2 - 4, y - 8, tw + 8, 16);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
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

    /* DEEP THINK 放在中间，右边固定给当前难度阶段 LOAD n（不遮挡掉落物） */
    if (think) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cdefff';
      ctx.fillText(T('tokenfall.think'), W / 2, 37);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = game.load >= 4 ? '#ffd27a' : (game.load >= 3 ? '#8fe3ff' : '#6f8fc8');
    ctx.fillText(T('tokenfall.loadLabel') + ' ' + game.load, W - 10, 37);

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
      var or = clamp(game.overflowMs / game.overflowGraceMs, 0, 1);
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
      /* 高度按实际换行结果算：中英文长度差很多，写死会溢出或者挤在一起 */
      var l1 = wrapText(T('tokenfall.ready'), W - 76);
      var l2 = wrapText(T('tokenfall.hint'), W - 76);
      var l3 = wrapText(T('tokenfall.legend'), W - 76);
      var l4 = wrapText(T('tokenfall.start'), W - 76);
      var h1 = l1.length * 19, h2 = l2.length * 17, h3 = l3.length * 16, h4 = 18;
      var boxH = h1 + h2 + h3 + h4 + 34 + 24;
      var boxTop = midY - boxH / 2;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = '#061024';
      ctx.fillRect(16, boxTop, W - 32, boxH);
      ctx.globalAlpha = 1;
      var ry = boxTop + 17 + h1 / 2;
      drawCenteredLines(l1, ry, bodyFont, '#dbe9ff', 19);
      ry += h1 / 2 + 12 + h2 / 2;
      drawCenteredLines(l2, ry, '12px -apple-system, "PingFang SC", sans-serif', '#7f9bc4', 17);
      ry += h2 / 2 + 12 + h3 / 2;
      drawCenteredLines(l3, ry, '11px "Courier New", ui-monospace, monospace', '#6f8fc8', 16);
      ry += h3 / 2 + 14 + h4 / 2;
      if (blink) drawCenteredLines(l4, ry, monoFont, '#ffffff', 18);
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

  /* 阶段切换横幅：中央短暂显示 LOAD n + 压力提示，约 1 秒后淡出 */
  function drawLoadBanner() {
    if (game.loadBannerMs <= 0) return;
    var t = clamp(game.loadBannerMs / LOAD_BANNER_MS, 0, 1);        // 1 -> 0
    var a = t > 0.7 ? (1 - t) / 0.3 : Math.min(1, t / 0.3);         // 淡入 + 淡出
    a = clamp(a, 0, 1);
    if (a <= 0) return;
    var top = HUD_H + (H - HUD_H) * 0.34;
    var h = 86;
    ctx.globalAlpha = 0.60 * a;
    ctx.fillStyle = '#061024';
    ctx.fillRect(0, Math.round(top), W, h);
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(0, Math.round(top), W, 2);
    ctx.fillRect(0, Math.round(top + h - 2), W, 2);
    ctx.globalAlpha = a;
    drawCenteredLines([T('tokenfall.loadLabel') + ' ' + game.loadBannerLoad],
      top + 31, 'bold 26px "Courier New", ui-monospace, monospace', '#ffd27a', 30);
    drawCenteredLines([T('tokenfall.pressure')],
      top + 60, 'bold 12px "Courier New", ui-monospace, monospace', '#8fe3ff', 16);
    ctx.globalAlpha = 1;
  }

  function render() {
    var ratio = game.context / MAX_CONTEXT;
    drawBackground(ratio);
    drawTokens();
    drawPlayer(ratio);
    drawParticles();
    drawFloats();
    drawHud(ratio);
    drawLoadBanner();
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

  /* ================= 纯规则对外暴露（给测试用） =================
   * 掉落权重 / 压缩公式 / 阶段划分都是纯函数，测试直接验证数值，
   * 不需要写「随机一万次看比例」这种脆弱测试。 */
  window.TokenFallRules = {
    LOAD_STARTS: LOAD_STARTS,
    LOADS: LOADS,
    MAX_CONTEXT: MAX_CONTEXT,
    COMPRESS_STEP: COMPRESS_STEP,
    COMPRESS_MIN_AMOUNT: COMPRESS_MIN_AMOUNT,
    FATIGUE_WINDOW_MS: FATIGUE_WINDOW_MS,
    FATIGUE_MUL: FATIGUE_MUL,
    OVERFLOW_FLOOR_MS: OVERFLOW_FLOOR_MS,
    loadSlot: loadSlot,
    loadIndexFor: loadIndexFor,
    loadForElapsed: loadForElapsed,
    paceAt: paceAt,
    getDropWeights: getDropWeights,
    fatigueMultiplier: fatigueMultiplier,
    contextEfficiency: contextEfficiency,
    compressAmount: compressAmount
  };

  reset();
  updateButtons();
  requestAnimationFrame(frame);
})();
