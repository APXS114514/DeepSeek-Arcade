/* ============================================================
 * 小鲸鱼跑酷 DeepSeek Whale Runner
 * 原生 JavaScript + Canvas 2D，零依赖。
 * 深海版：小鲸鱼躲开海胆 / 珊瑚 / 水母 / 小鱼，越游越快。
 * 小鲸鱼造型取自 DeepSeek 官方 logo（那条 cubic 路径），光栅化成 24x18 像素网格。
 * 摆尾两帧 = 对尾鳍做沿 x 的平滑剪切后重新光栅化；
 * 下潜两帧 = 先把全身纵向压扁到 0.72 再叠同样的尾鳍剪切（见 README）。
 * 结构：精灵 -> 状态 -> 输入 -> 逻辑(step) -> 渲染(render) -> 主循环
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 画布 ---------------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var PX = 3;              // 精灵单个像素的边长，也是整个世界缩放的唯一开关
  var S = PX / 3;          // 世界缩放系数：画布、物理、判定盒、字号全部等比跟随 PX
  var W = 900 * S;         // 逻辑宽度
  var H = 200 * S;         // 逻辑高度
  var GROUND_Y = 158 * S;  // 海床线

  function fpx(n) { return Math.max(8, Math.round(n * S)); }   // 字号也跟着缩放

  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  /* ---------------- 多语言（词典与切换逻辑在 i18n.js） ---------------- */
  var I18N = window.I18N || null;
  function T(key) { return (I18N && I18N.t) ? I18N.t(key) : key; }
  // 画布文字每帧重新取，切语言立刻生效；这里只需刷新按钮文案
  if (I18N && I18N.onChange) I18N.onChange(function () { updateSoundButton(); updateFsButton(); });

  /* ---------------- 物理常量（手感都在这儿调） ---------------- */
  var STEP = 1000 / 60;      // 固定步长
  var GRAVITY = 0.62 * S;
  var FAST_FALL = 2.2;         // 空中按 ↓ 时的重力倍率
  var JUMP_V = -10.6 * S;      // 上浮初速（越负跳越高）
  var START_SPEED = 5.4 * S;
  var MAX_SPEED = 13.5 * S;
  var ACCEL = 0.0014 * S;

  var PLAYER_X = 80 * S;

  /* ---------------- 像素精灵 ----------------
   * X = 主色, o = 肚皮, f = 胸鳍, e = 眼白, p = 瞳孔, . = 透明
   * 想改造型直接改字符画即可，尺寸会自动按上面的 PX 缩放。 */
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
  var WHALE_DIVE_A = [
    '.......X....XX..........',
    'X....XXX....XXXXXXXXX...',
    'XXXXXXXX...XXXXXXXXXXX..',
    '.XXXXXX..XXXXXXXXXXXXXX.',
    '...XXX..XXXXXXXXXXXXXXXX',
    '....XXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXoooooooXX',
    '.....XXXXXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXX.',
    '......XXXXXXooooooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '.....XXXXXXXXXXXXXXX....',
    '...........XXXXXXX......'
  ];
  var WHALE_DIVE_B = [
    '............XX..........',
    '.......X....XXXXXXXXX...',
    '.....XXX...XXXXXXXXXXX..',
    'XXXXXXXX.XXXXXXXXXXXXXX.',
    'XXXXXXXoXXXXXXXXXXXXXXXX',
    '..XXXXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXoooooooXX',
    '....XXXXooXXXXooooooooXX',
    '.....XXXXXXXXooooooooXX.',
    '.....XXXXXXXooooooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '......XXXXXXXXXXXXXX....',
    '.....XX....XXXXXXX......'
  ];
  var URCHIN = [
    '..X........X..',
    '...X..XX..X...',
    '....XXXXXX....',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '....XXXXXX....',
    '...X..XX..X...',
    '..X........X..'
  ];
  var CORAL = [
    '....X.......',
    '...XXX......',
    '..XX.XX.....',
    '..XX..XX....',
    '..XX...XX...',
    '...XX..XX...',
    '....XX.XX...',
    '.....XXXX...',
    '......XX....',
    '......XX....',
    '....XXXX....',
    '...XXXXXX...',
    '..XXXXXXXX..',
    '.XXXXXXXXXX.'
  ];
  var JELLY_A = [
    '....XXXXXX....',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.X.X.X.X.X.X..',
    '.X.X.X.X.X.X..',
    '.X.X.X.X.X.X..',
    '..X.X.X.X.X...',
    '..X.X.X.X.X...',
    '...X.X.X.X....'
  ];
  var JELLY_B = [
    '...XXXXXXX....',
    '.XXXXXXXXXXX..',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    '.XXXXXXXXXXXX.',
    'X.X.X.X.X.X...',
    '.X.X.X.X.X.X..',
    '..X.X.X.X.X...',
    '...X.X.X.X....',
    '...X.X.X.X....',
    '....X.X.X.....'
  ];
  var FISH_A = [
    '.....XXXX...X.',
    '...XXXXXXXX.X.',
    '..XXXXXXXXXXXX',
    'eXXXXXXXXXXXX.',
    'eXXXXXXXXXXXX.',
    '..XXXXXXXXXXXX',
    '...XXXXXXXX.X.',
    '.....XXXX...X.'
  ];
  var FISH_B = [
    '.....XXXX.....',
    '...XXXXXXX...X',
    '..XXXXXXXXXXXX',
    'eXXXXXXXXXXXX.',
    'eXXXXXXXXXXXX.',
    '..XXXXXXXXXXXX',
    '...XXXXXXX...X',
    '.....XXXX.....'
  ];

  /* 尺寸直接由字符画推导，改造型不用改这里 */
  var WHALE_W = WHALE_A[0].length * PX;
  var WHALE_H = WHALE_A.length * PX;
  var DIVE_W  = WHALE_DIVE_A[0].length * PX;
  var DIVE_H  = WHALE_DIVE_A.length * PX;

  /* ---------------- 判定盒与障碍高度（单位：精灵格子，随 PX 一起缩放） ----------------
   * 下面三个高度互相咬合，构成"下潜能过、站立会撞"的核心机制：
   *     下潜盒上沿  <  中层障碍盒下沿  <  站立盒上沿
   * 现在 = 11 < 13 < 16（格）。谁把它改坏，下潜躲中层生物就会静默失效，所以启动自检一次。 */
  var BOX = {
    stand: { dx: 6, dy: 2, w: 17, h: 15 },   // 上沿 = 18 - 2 = 16 格
    dive:  { dx: 6, dy: 2, w: 17, h: 9 },    // 上沿 = 13 - 2 = 11 格
    inset: 1                                  // 障碍判定盒四周内缩的格数
  };
  var MID_BOTTOM = 13;   // 中层生物（水母 / 小鱼）底部离海床的高度
  var LOW_BOTTOM = 2;    // 低浮水母底部离海床的高度

  (function boxGeometryCheck() {
    var standTop = WHALE_H - BOX.stand.dy * PX;
    var diveTop = DIVE_H - BOX.dive.dy * PX;
    var midBottom = (MID_BOTTOM + BOX.inset) * PX;
    if (!(diveTop < midBottom && midBottom < standTop)) {
      var msg = '[whale] 判定盒几何被改坏：下潜上沿 ' + diveTop + 'px < 中层下沿 ' + midBottom +
                'px < 站立上沿 ' + standTop + 'px 不成立，下潜将无法躲开中层生物';
      if (window.console && window.console.warn) window.console.warn(msg);
    }
  })();

  /* ---------------- 配色：浅海(昼) <-> 深海(夜) ----------------
   * 每项是 [浅海 RGB, 深海 RGB]，中间按 nightMix 插值。 */
  var PAL = {
    bg:     { d: [226, 243, 255], n: [7, 22, 44] },
    text:   { d: [22, 50, 79],    n: [222, 235, 255] },
    dim:    { d: [156, 196, 230], n: [66, 104, 158] },
    sand:   { d: [201, 181, 143], n: [88, 90, 122] },
    whale:  { d: [77, 107, 254],  n: [112, 142, 255] },
    belly:  { d: [207, 224, 255], n: [126, 152, 232] },
    urchin: { d: [124, 92, 214],  n: [170, 141, 240] },
    coral:  { d: [255, 122, 138], n: [255, 163, 174] },
    jelly:  { d: [255, 158, 203], n: [255, 196, 224] },
    fish:   { d: [255, 169, 64],  n: [255, 201, 122] }
  };

  function mix(a, b, t) {
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function theme() {
    var t = game.nightMix;
    var out = {};
    for (var k in PAL) out[k] = mix(PAL[k].d, PAL[k].n, t);
    return out;
  }

  /* ---------------- 背景浮游生物（深海时可见） ---------------- */
  var plankton = [];
  for (var pi = 0; pi < 52; pi++) {
    plankton.push({
      x: Math.random() * W,
      y: 10 * S + Math.random() * (GROUND_Y - 70 * S),
      s: Math.max(2, Math.round((Math.random() < 0.22 ? 3 : 2) * S)),
      p: Math.random() * Math.PI * 2
    });
  }

  /* ---------------- 音效（WebAudio 合成，无资源文件） ---------------- */
  var audioCtx = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('whaleRunner.sound') !== 'off'; } catch (e) { soundOn = true; }

  function beep(kind) {
    if (!soundOn) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
      var t = audioCtx.currentTime;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      if (kind === 'jump') {
        o.type = 'sine';
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(900, t + 0.16);
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.start(t); o.stop(t + 0.21);
      } else if (kind === 'point') {
        o.type = 'triangle';
        o.frequency.setValueAtTime(1180, t);
        g.gain.setValueAtTime(0.045, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.start(t); o.stop(t + 0.1);
      } else {
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(320, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.42);
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.start(t); o.stop(t + 0.46);
      }
    } catch (e) { /* 无音频环境时静默失败 */ }
  }

  /* ---------------- 游戏状态 ---------------- */
  var game = {
    state: 'ready',        // ready | running | over | paused
    speed: START_SPEED,
    distance: 0,
    score: 0,
    high: 0,
    night: false,
    nightMix: 0,
    nextNight: 700,
    nextMilestone: 100,
    spawnAt: 560 * S,
    overCooldown: 0,
    obstacles: [],
    bubbles: [],
    player: {
      x: PLAYER_X, y: GROUND_Y - WHALE_H, vy: 0,
      onGround: true, ducking: false, crouch: false,
      frame: 0, frameTimer: 0
    }
  };

  try {
    var saved = parseInt(localStorage.getItem('whaleRunner.high') || '0', 10);
    if (isFinite(saved) && saved > 0) game.high = saved;
  } catch (e) { /* 隐私模式下忽略 */ }

  /* ---------------- 工具 ---------------- */
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /* 画像素字符画：同色连续像素合并成一次 fillRect */
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

  /* ---------------- 生成物 ----------------
   * 海床上的：海胆 / 珊瑚 / 低浮水母  -> 必须跳过去
   * 中层的：水母(触手垂到头顶) / 小鱼   -> 必须下潜躲开 */
  function spawnObstacle() {
    var r = Math.random();
    if (game.score > 260 && r < 0.26) {
      if (Math.random() < 0.5) spawnJelly(true); else spawnFish();
      return;
    }
    var r2 = Math.random();
    if (r2 < 0.42) spawnUrchin();
    else if (r2 < 0.78) spawnCoral();
    else spawnJelly(false);
  }

  function spawnUrchin() {
    var h = URCHIN.length * PX;
    game.obstacles.push({ kind: 'urchin', x: W + 20 * S, y: GROUND_Y - h, w: URCHIN[0].length * PX, h: h });
  }

  function spawnCoral() {
    var h = CORAL.length * PX;
    game.obstacles.push({ kind: 'coral', x: W + 20 * S, y: GROUND_Y - h, w: CORAL[0].length * PX, h: h });
  }

  function spawnJelly(mid) {
    var h = JELLY_A.length * PX;
    var bottom = (mid ? MID_BOTTOM : LOW_BOTTOM) * PX;   // 中空：触手垂到头顶；低浮：贴近海床
    game.obstacles.push({
      kind: 'jelly', x: W + 20 * S, y: GROUND_Y - bottom - h,
      w: JELLY_A[0].length * PX, h: h, frame: 0, frameTimer: 0
    });
  }

  function spawnFish() {
    var h = FISH_A.length * PX;
    game.obstacles.push({
      kind: 'fish', x: W + 20 * S, y: GROUND_Y - MID_BOTTOM * PX - h,
      w: FISH_A[0].length * PX, h: h, frame: 0, frameTimer: 0
    });
  }

  function spawnBubble(x, y, spread) {
    game.bubbles.push({
      x: x === undefined ? rand(60 * S, W) : x + rand(-spread, spread),
      y: y === undefined ? GROUND_Y + rand(4 * S, 40 * S) : y + rand(-spread, spread),
      s: Math.max(2, Math.round((Math.random() < 0.6 ? 2 : 3) * S)),
      v: rand(0.35, 1.1) * S,
      a: rand(0.35, 0.85)
    });
  }

  function puff(x, y) {          // 上浮时吐出的气泡
    for (var i = 0; i < 5; i++) spawnBubble(x, y, 14 * S);
  }

  /* ---------------- 状态切换 ---------------- */
  function startRun() {
    var p = game.player;
    game.state = 'running';
    game.speed = START_SPEED;
    game.distance = 0;
    game.score = 0;
    game.night = false;
    game.nightMix = 0;
    game.nextNight = 700;
    game.nextMilestone = 100;
    game.spawnAt = 560 * S;
    game.overCooldown = 0;
    game.obstacles.length = 0;
    game.bubbles.length = 0;
    p.x = PLAYER_X;
    p.y = GROUND_Y - WHALE_H;
    p.vy = 0;
    p.onGround = true;
    p.ducking = false;
    p.crouch = false;
    p.frame = 0;
    p.frameTimer = 0;
  }

  function gameOver() {
    game.state = 'over';
    game.overCooldown = 26;
    var final = Math.floor(game.score);
    if (final > game.high) {
      game.high = final;
      try { localStorage.setItem('whaleRunner.high', String(final)); } catch (e) { /* ignore */ }
    }
    beep('over');
  }

  /* ---------------- 输入 ---------------- */
  function doJump() {
    var p = game.player;
    if (game.state === 'ready') { startRun(); return; }
    if (game.state === 'paused') { game.state = 'running'; return; }
    if (game.state === 'over') {
      if (game.overCooldown <= 0) startRun();
      return;
    }
    if (p.onGround) {
      p.vy = JUMP_V;
      p.onGround = false;
      p.crouch = false;
      p.y = GROUND_Y - WHALE_H;
      puff(p.x + 20 * S, p.y + 10 * S);
      beep('jump');
    }
  }


  function doDuck(down) {
    var p = game.player;
    if (game.state !== 'running') { if (!down) p.ducking = false; return; }
    p.ducking = down;
  }

  function togglePause() {
    if (game.state === 'running') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'running';
  }

  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('whaleRunner.sound', soundOn ? 'on' : 'off'); } catch (e) { /* ignore */ }
    updateSoundButton();
    if (soundOn) beep('point');
  }

  function updateSoundButton() {
    var btn = document.getElementById('sound');
    if (!btn) return;
    btn.textContent = soundOn ? T('btn.sound') : T('btn.muted');
    btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    var c = e.code;
    if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW' || k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      if (e.preventDefault) e.preventDefault();
      if (!e.repeat) doJump();
      return;
    }
    if (c === 'ArrowDown' || c === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') {
      if (e.preventDefault) e.preventDefault();
      doDuck(true);
      return;
    }
    if (c === 'KeyP' || k === 'p' || k === 'P' || k === 'Escape') {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (c === 'KeyM' || k === 'm' || k === 'M') {
      if (e.preventDefault) e.preventDefault();
      toggleSound();
    }
  });

  document.addEventListener('keyup', function (e) {
    var k = e.key;
    var c = e.code;
    if (c === 'ArrowDown' || c === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') {
      doDuck(false);
    }
  });

  var jumpBtn = document.getElementById('jump');
  var duckBtn = document.getElementById('duck');
  var soundBtn = document.getElementById('sound');

  if (jumpBtn) jumpBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); doJump(); });
  if (duckBtn) {
    duckBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); doDuck(true); });
    duckBtn.addEventListener('pointerup', function () { doDuck(false); });
    duckBtn.addEventListener('pointercancel', function () { doDuck(false); });
    duckBtn.addEventListener('pointerleave', function () { doDuck(false); });
  }
  if (soundBtn) soundBtn.addEventListener('click', function () { toggleSound(); });

  /* ---------------- 手机：全屏按钮（顺带尝试锁横屏） ----------------
   * 手机上横屏时画布宽度是竖屏的 2 倍多，所以全屏 + 锁横屏是提升观感最直接的一步。
   * 任何一步不支持（桌面、iOS 锁不了方向）都静默跳过，不能影响游戏。 */
  var fsBtn = document.getElementById('fullscreen');

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function updateFsButton() {
    if (fsBtn) fsBtn.textContent = T(isFullscreen() ? 'btn.fullscreenExit' : 'btn.fullscreen');
  }
  function lockLandscape() {
    try {
      var so = window.screen && window.screen.orientation;
      if (so && so.lock) {
        var p = so.lock('landscape');
        if (p && p.catch) p.catch(function () { /* 桌面/不支持:忽略 */ });
      }
    } catch (e) { /* 忽略 */ }
  }
  function toggleFullscreen() {
    var root = document.documentElement;
    var req = root.requestFullscreen || root.webkitRequestFullscreen;
    var exit = document.exitFullscreen || document.webkitExitFullscreen;
    try {
      if (isFullscreen()) {
        if (exit) exit.call(document);
      } else if (req) {
        var r = req.call(root);
        if (r && r.then) r.then(lockLandscape, function () { /* 被拒绝:忽略 */ });
        else lockLandscape();
      }
    } catch (e) { /* 不支持全屏就静默忽略 */ }
  }

  if (fsBtn) fsBtn.addEventListener('click', function (e) { if (e.preventDefault) e.preventDefault(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', updateFsButton);
  document.addEventListener('webkitfullscreenchange', updateFsButton);
  updateFsButton();

  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); doJump(); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.state === 'running') game.state = 'paused';
  });

  updateSoundButton();

  /* ---------------- 逻辑：固定步长 ---------------- */
  function step() {
    var p = game.player;

    // 浅海 <-> 深海 的颜色渐变
    var target = game.night ? 1 : 0;
    if (game.nightMix !== target) {
      game.nightMix += (target > game.nightMix ? 0.02 : -0.02);
      if (Math.abs(game.nightMix - target) < 0.021) game.nightMix = target;
    }

    // 气泡上浮（任何时候都在动，画面不死）
    for (var bi = game.bubbles.length - 1; bi >= 0; bi--) {
      var b = game.bubbles[bi];
      b.y -= b.v;
      b.x -= game.state === 'running' ? game.speed * 0.3 : 0.3;
      if (b.y < 6 * S || b.x < -10 * S) game.bubbles.splice(bi, 1);
    }
    if (game.state === 'running' && Math.random() < 0.06) spawnBubble();

    // 待机 / 结束时也摆尾
    if (game.state !== 'running') {
      p.frameTimer += 2.4 * S;
      if (p.frameTimer > 52 * S) { p.frameTimer = 0; p.frame ^= 1; }
    }

    if (game.state === 'over') {
      if (game.overCooldown > 0) game.overCooldown--;
    }

    if (game.state !== 'running') return;

    /* --- 速度与分数 --- */
    game.speed = Math.min(MAX_SPEED, game.speed + ACCEL);
    game.distance += game.speed;
    game.score += game.speed * 0.05;

    if (game.score >= game.nextMilestone) {
      game.nextMilestone += 100;
      beep('point');
    }
    if (game.score >= game.nextNight) {
      game.night = !game.night;
      game.nextNight += 700;
    }

    /* --- 小鲸鱼物理 --- */
    if (!p.onGround) {
      p.vy += GRAVITY * (p.ducking ? FAST_FALL : 1);
      p.y += p.vy;
      if (p.y + WHALE_H >= GROUND_Y) {
        p.y = GROUND_Y - WHALE_H;
        p.vy = 0;
        p.onGround = true;
      }
    }
    p.crouch = p.ducking && p.onGround;
    var h = p.crouch ? DIVE_H : WHALE_H;
    if (p.onGround) p.y = GROUND_Y - h;

    /* --- 摆尾动画 --- */
    p.frameTimer += game.speed;
    if (p.frameTimer > 52 * S) { p.frameTimer = 0; p.frame ^= 1; }

    /* --- 生成障碍 --- */
    if (game.distance >= game.spawnAt) {
      spawnObstacle();
      game.spawnAt = game.distance + game.speed * rand(60, 110);
    }

    /* --- 障碍移动与回收 --- */
    for (var i = game.obstacles.length - 1; i >= 0; i--) {
      var o = game.obstacles[i];
      o.x -= game.speed;
      if (o.kind === 'jelly' || o.kind === 'fish') {
        o.frameTimer += game.speed;
        if (o.frameTimer > 58 * S) { o.frameTimer = 0; o.frame ^= 1; }
      }
      if (o.x + o.w < -40) game.obstacles.splice(i, 1);
    }

    /* --- 碰撞检测 --- */
    var pb = playerBox();
    for (var j = 0; j < game.obstacles.length; j++) {
      if (overlap(pb, obstacleBox(game.obstacles[j]))) { gameOver(); return; }
    }
  }

  function playerBox() {
    var p = game.player;
    var b = p.crouch ? BOX.dive : BOX.stand;   // 格子数 × PX：改造型、改 PX 都不用动这里
    return { x: p.x + b.dx * PX, y: p.y + b.dy * PX, w: b.w * PX, h: b.h * PX };
  }

  function obstacleBox(o) {
    var i = BOX.inset * PX;
    return { x: o.x + i, y: o.y + i, w: o.w - 2 * i, h: o.h - 2 * i };
  }

  /* ---------------- 渲染 ---------------- */
  var clock = 0;

  function drawSeabed(t) {
    ctx.fillStyle = t.sand;
    ctx.fillRect(0, GROUND_Y, W, 2 * S);

    ctx.fillStyle = t.dim;
    var off = game.distance % (68 * S);
    for (var i = -1; i < W / (68 * S) + 1; i++) {
      var x = i * 68 * S - off;
      ctx.fillRect(x + 8 * S, GROUND_Y + 8 * S, 16 * S, 3 * S);
      ctx.fillRect(x + 40 * S, GROUND_Y + 15 * S, 9 * S, 3 * S);
      ctx.fillRect(x + 24 * S, GROUND_Y + 24 * S, 6 * S, 3 * S);
    }
  }

  function drawPlankton() {
    if (game.nightMix <= 0.02) return;
    for (var i = 0; i < plankton.length; i++) {
      var s = plankton[i];
      var tw = 0.5 + 0.5 * Math.sin(clock / 420 + s.p);
      ctx.globalAlpha = game.nightMix * tw * 0.9;
      ctx.fillStyle = '#dff0ff';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawBubbles(t) {
    ctx.fillStyle = t.dim;
    for (var i = 0; i < game.bubbles.length; i++) {
      var b = game.bubbles[i];
      var s = b.s;
      ctx.globalAlpha = b.a;
      ctx.fillRect(b.x + s, b.y, s, s);
      ctx.fillRect(b.x, b.y + s, s, s);
      ctx.fillRect(b.x + 2 * s, b.y + s, s, s);
      ctx.fillRect(b.x + s, b.y + 2 * s, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(t) {
    var p = game.player;
    var ink = { X: t.whale, o: t.belly };
    if (p.crouch) {
      drawSprite(p.frame ? WHALE_DIVE_B : WHALE_DIVE_A, PX, p.x, p.y, ink);   // 下潜也有专门的两帧
      return;
    }
    drawSprite(p.frame ? WHALE_B : WHALE_A, PX, p.x, p.y, ink);   // 两帧摆尾
  }

  function drawObstacle(o, t) {
    if (o.kind === 'urchin') {
      drawSprite(URCHIN, PX, o.x, o.y, { X: t.urchin });
    } else if (o.kind === 'coral') {
      drawSprite(CORAL, PX, o.x, o.y, { X: t.coral });
    } else if (o.kind === 'jelly') {
      drawSprite(o.frame ? JELLY_B : JELLY_A, PX, o.x, o.y, { X: t.jelly });
    } else {
      drawSprite(o.frame ? FISH_B : FISH_A, PX, o.x, o.y, { X: t.fish });
    }
  }

  function drawHud(t) {
    ctx.font = 'bold ' + fpx(16) + 'px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = t.dim;
    ctx.fillText(T('hud.hi') + ' ' + pad(game.high, 5), W - 132 * S, 16 * S);
    ctx.fillStyle = t.text;
    ctx.fillText(pad(game.score, 5), W - 22 * S, 16 * S);
  }

  function drawOverlay(t) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (game.state === 'ready') {
      if ((Math.floor(clock / 520) % 2) === 0) {
        ctx.fillStyle = t.text;
        ctx.font = 'bold ' + fpx(20) + 'px "Courier New", ui-monospace, monospace';
        ctx.fillText(T('canvas.ready'), W / 2, 74 * S);
      }
      ctx.fillStyle = t.dim;
      ctx.font = fpx(13) + 'px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(T('canvas.hint'), W / 2, 108 * S);
      return;
    }

    if (game.state === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = t.text;
      ctx.font = 'bold ' + fpx(22) + 'px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('canvas.paused'), W / 2, 78 * S);
      ctx.font = fpx(13) + 'px -apple-system, "PingFang SC", sans-serif';
      ctx.fillStyle = t.dim;
      ctx.fillText(T('canvas.pausedHint'), W / 2, 108 * S);
      return;
    }

    if (game.state === 'over') {
      ctx.fillStyle = t.text;
      ctx.font = 'bold ' + fpx(26) + 'px "Courier New", ui-monospace, monospace';
      ctx.fillText(T('canvas.over'), W / 2, 70 * S);
      if ((Math.floor(clock / 520) % 2) === 0) {
        ctx.font = 'bold ' + fpx(15) + 'px "Courier New", ui-monospace, monospace';
        ctx.fillText(T('canvas.restart'), W / 2, 108 * S);
      }
    }
  }

  function render() {
    var t = theme();

    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);

    drawPlankton();
    drawBubbles(t);
    drawSeabed(t);
    for (var j = 0; j < game.obstacles.length; j++) drawObstacle(game.obstacles[j], t);
    drawPlayer(t);
    drawHud(t);
    drawOverlay(t);
  }

  /* ---------------- 主循环 ---------------- */
  var last = 0;
  var acc = 0;

  function frame(now) {
    if (!last) last = now;
    var dt = now - last;
    last = now;
    clock = now;

    if (dt > 250) dt = STEP;   // 切走标签页回来时不要一次性追帧
    acc += dt;

    var guard = 0;
    while (acc >= STEP && guard < 5) { step(); acc -= STEP; guard++; }
    if (guard >= 5) acc = 0;

    render();
    requestAnimationFrame(frame);
  }

  // 开场先放几颗气泡，画面不空
  spawnBubble(300 * S, 120 * S, 10 * S);
  spawnBubble(520 * S, 150 * S, 10 * S);
  spawnBubble(700 * S, 100 * S, 10 * S);
  requestAnimationFrame(frame);
})();