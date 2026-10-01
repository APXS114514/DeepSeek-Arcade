/* ============================================================
 * ATTENTION MAZE — DeepSeek Arcade
 * 以 Transformer Attention 为灵感的像素迷宫解谜：
 *   ATTENTION SCAN（整张地图亮 2~3 秒）-> FOCUS MODE（只剩身边一圈）
 *   -> 找到 QUERY -> 看 Attention Weight 记住权重最高的 KEY
 *   -> 走到它（ATTENTION MATCHED）-> 解锁 VALUE -> 解锁 EXIT
 *   后期还有 MULTI-HEAD ATTENTION：两个头各说一半，要综合起来判断。
 * 没有生命值、没有死亡：走错只记 MISTAKE，压力来自记忆与评分。
 *
 * 原生 Canvas 2D，零依赖：经典形态下迷宫 / 小鲸鱼 / 节点 / 注意力连线 / HUD 全部 fillRect；
 * 可选的 Whale-chan 皮肤只把玩家那一格换成一个裁好的小头像（第三方素材，CC BY 4.0）。
 * 与另外三款游戏共用 shared/i18n.js（文案）与 shared/audio.js（音效）。
 * 逻辑坐标恒定 W×H，DPR 只改画布分辨率，不参与任何判定。
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* ================= 逻辑尺寸 / DPR ================= */
  var COLS = 15;
  var ROWS = 11;
  var CELL = 28;                 // 每格逻辑像素：手机上也有 24px 上下，认得清
  var HUD_H = 46;
  var FW = COLS * CELL;          // 420
  var FH = ROWS * CELL;          // 308
  var W = FW;
  var H = HUD_H + FH;            // 354
  var FY = HUD_H;                // 场地顶部

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
  var soundOn = ArcadeAudio ? ArcadeAudio.isEnabled('arcade.attentionMaze.sound') : true;
  function tone(o) { if (soundOn && ArcadeAudio && ArcadeAudio.tone) ArcadeAudio.tone(o); }

  /* 每种事件一句音效，全部现场合成，音量都很克制 */
  function sfx(name) {
    if (name === 'move') tone({ type: 'square', from: 240, to: 210, ms: 26, gain: 0.012 });
    else if (name === 'bump') tone({ type: 'square', from: 130, to: 100, ms: 46, gain: 0.014 });
    else if (name === 'query') tone({ type: 'triangle', from: 520, to: 900, ms: 150, gain: 0.05 });
    else if (name === 'attention') tone({ type: 'triangle', from: 760, to: 1120, ms: 220, gain: 0.045 });
    else if (name === 'head') tone({ type: 'triangle', from: 640, to: 1020, ms: 200, gain: 0.045 });
    else if (name === 'match') tone({ type: 'triangle', from: 660, to: 1320, ms: 220, gain: 0.055 });
    else if (name === 'low') tone({ type: 'square', from: 240, to: 130, ms: 240, gain: 0.05 });
    else if (name === 'value') tone({ type: 'triangle', from: 440, to: 700, ms: 200, gain: 0.05 });
    else if (name === 'unlock') {
      tone({ type: 'triangle', from: 520, to: 780, ms: 180, gain: 0.04 });
      tone({ type: 'triangle', from: 780, to: 1040, ms: 200, gain: 0.035 });
    } else if (name === 'clear') {
      tone({ type: 'triangle', from: 520, to: 660, ms: 260, gain: 0.05 });
      tone({ type: 'triangle', from: 660, to: 880, ms: 300, gain: 0.045 });
      tone({ type: 'triangle', from: 880, to: 1180, ms: 340, gain: 0.04 });
    } else if (name === 'rescan') tone({ type: 'square', from: 420, to: 300, ms: 120, gain: 0.035 });
    else if (name === 'locked') tone({ type: 'square', from: 200, to: 160, ms: 120, gain: 0.03 });
  }

  function updateButtons() {
    var s = document.getElementById('sound');
    if (s) {
      s.textContent = soundOn ? T('btn.sound') : T('btn.muted');
      s.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    }
    var p = document.getElementById('pause');
    if (p) {
      var paused = game.state === 'paused';
      p.textContent = paused ? T('maze.resumeBtn') : T('maze.pauseBtn');
      p.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
    var rs = document.getElementById('rescan');
    if (rs) {
      rs.textContent = T('maze.rescanBtn') + ' ' + game.rescansLeft;
      rs.setAttribute('aria-disabled', game.rescansLeft > 0 && game.state === 'playing' ? 'false' : 'true');
    }
    var rst = document.getElementById('reset');
    if (rst) rst.textContent = game.resetConfirmMs > 0 ? T('maze.resetConfirm') : T('maze.resetBtn');
    var inMenu = game.state === 'menu';
    var pad = document.getElementById('pad');
    if (pad) pad.hidden = inMenu;
    var bar = document.getElementById('playbar');
    if (bar) bar.hidden = inMenu;
    if (rst) rst.hidden = !inMenu;
  }
  function toggleSound() {
    soundOn = ArcadeAudio ? ArcadeAudio.toggle() : !soundOn;
    updateButtons();
    if (soundOn) tone({ type: 'triangle', from: 880, to: 1180, ms: 90, gain: 0.04 });
  }
  if (I18N && I18N.onChange) I18N.onChange(updateButtons);

  /* ================= 节奏常量 ================= */
  var STEP = 1000 / 60;
  var MOVE_REPEAT_DELAY = 240;   // 按住方向后，第一次连走前等这么久
  var MOVE_REPEAT_EVERY = 135;   // 之后每隔这么久走一格（一帧最多一格）
  var TWEEN_MS = 90;             // 纯视觉插值，逻辑仍然是格子制
  var ATT_MS = 1800;             // 单个 QUERY 的权重展示
  var HEAD_MS = 1800;            // MULTI-HEAD：每个头展示
  var COMBINE_MS = 1700;         // “综合两个注意力头”提示
  var RESCAN_MS = 1500;          // RESCAN 的扫描时长
  var SWIPE_MIN = 22;            // 画布滑动阈值（逻辑像素）
  var PROGRESS_KEY = 'arcade.attentionMaze.progress';

  /* ================= 像素精灵 ================= */
  /* 俯视小鲸鱼，朝右：身体 + 两侧胸鳍 + 尾鳍 + 眼睛 + 背部高光。
   * 四个方向直接对字符画做 90° 整数旋转（不旋转 Canvas，判定也不受影响）。 */
  var WHALE_R = [
    '............',
    '....XX...XXX',
    'X...XX..XXXX',
    'XX...XXXXXXX',
    'XXX...XXXXXX',
    'XXXXXoooXeXX',
    'XXXXXoooXeXX',
    'XXX...XXXXXX',
    'XX...XXXXXXX',
    'X...XX..XXXX',
    '....XX...XXX',
    '............'
  ];
  var STAR = [
    '..X..',
    '.XXX.',
    'XXXXX',
    '.X.X.',
    'X...X'
  ];
  var LOCK = [
    '.XXX.',
    'X...X',
    'XXXXX',
    'XX.XX',
    'XXXXX'
  ];

  function rotateRows(rows, times) {
    var r = rows;
    var n = ((times % 4) + 4) % 4;
    for (var i = 0; i < n; i++) {
      var h = r.length, w = r[0].length, out = [];
      for (var x = 0; x < w; x++) {
        var line = '';
        for (var y = h - 1; y >= 0; y--) line += r[y].charAt(x);
        out.push(line);
      }
      r = out;
    }
    return r;
  }
  var WHALE_DIRS = [rotateRows(WHALE_R, 0), rotateRows(WHALE_R, 1), rotateRows(WHALE_R, 2), rotateRows(WHALE_R, 3)];

  /* 角色皮肤由 shared/character.js 统一管理（localStorage: arcade.characterSkin）。
   * Attention Maze 只把「玩家那一格」换成 Whale-chan 头像，网格与判定不动。 */
  var ArcadeCharacter = window.ArcadeCharacter || null;

  /* ================= 关卡数据（见 levels.js） ===================
   * 纯数据已经拆到 games/attention-maze/levels.js，页面在 game.js 之前加载。
   * 这里只取过来用，引擎不再内嵌关卡内容。 */
  var LAYERS = (window.ATTENTION_MAZE_LAYERS || []).slice();
  var MAX_LAYERS = LAYERS.length || 12;
  if (!LAYERS.length && window.console && window.console.warn) {
    window.console.warn('[attention-maze] 缺少 levels.js：没有关卡数据，请检查页面脚本顺序');
  }

  /* ================= 关卡解析 / 权重 ================= */
  function parseMap(map) {
    var grid = [];
    for (var y = 0; y < ROWS; y++) {
      var row = String(map[y] || '');
      var line = [];
      for (var x = 0; x < COLS; x++) line.push(row.charAt(x) === '#' ? '#' : '.');
      grid.push(line);
    }
    return grid;
  }
  function cellKey(x, y) { return x + ',' + y; }
  function buildNodeIndex(nodes) {
    var idx = {};
    idx[cellKey(nodes.start.x, nodes.start.y)] = { type: 'start' };
    idx[cellKey(nodes.exit.x, nodes.exit.y)] = { type: 'exit' };
    if (nodes.query) idx[cellKey(nodes.query.x, nodes.query.y)] = { type: 'query' };
    if (nodes.value) idx[cellKey(nodes.value.x, nodes.value.y)] = { type: 'value' };
    for (var i = 0; i < nodes.keys.length; i++) {
      var k = nodes.keys[i];
      idx[cellKey(k.x, k.y)] = { type: 'key', key: k, index: i };
    }
    return idx;
  }
  /* 每个头一张权重表；单头关卡就是一张。权重只来自关卡数据，绝不随机，
   * 所以同一个 QUERY 对同一个 KEY 的权重在同一局里永远一致。 */
  function weightTables(layer) {
    if (layer.heads) return layer.heads;
    var one = [];
    for (var i = 0; i < layer.nodes.keys.length; i++) one.push(layer.nodes.keys[i].w);
    return [one];
  }
  function isWallAt(grid, x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    return grid[y][x] === '#';
  }

  /* ================= 进度存储 ================= */
  function defaultProgress() {
    return { v: 1, unlocked: 1, stars: {}, best: {} };
  }
  function loadProgress() {
    var p = defaultProgress();
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return p;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return p;
      var unlocked = parseInt(data.unlocked, 10);
      if (isFinite(unlocked)) p.unlocked = Math.max(1, Math.min(MAX_LAYERS, unlocked));
      if (data.stars && typeof data.stars === 'object') {
        for (var i = 1; i <= MAX_LAYERS; i++) {
          var s = parseInt(data.stars[i], 10);
          if (isFinite(s) && s > 0) p.stars[i] = Math.max(1, Math.min(3, s));
        }
      }
      if (data.best && typeof data.best === 'object') {
        for (var j = 1; j <= MAX_LAYERS; j++) {
          var b = data.best[j];
          if (!b || typeof b !== 'object') continue;
          var t = parseInt(b.t, 10), m = parseInt(b.m, 10);
          if (!isFinite(t) || t <= 0 || !isFinite(m) || m <= 0) continue;
          p.best[j] = { t: t, m: m };
        }
      }
      return p;
    } catch (e) {
      return p;      // 存档坏了就当新玩家，绝不因为存档崩溃
    }
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(game.progress)); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* 星级：时间和步数都在 par 内且 0 Mistake = 3 星（用过 RESCAN 最多 2 星）；
   * 基本达标 = 2 星；其余只要走到 EXIT 就是 1 星（1 星不是失败）。 */
  function starsFor(layer, run) {
    var usedRescan = run.rescansUsed > 0;
    var perfect = run.mistakes === 0 && run.timeMs <= layer.parTime * 1000 && run.moves <= layer.parMoves;
    if (perfect && !usedRescan) return 3;
    var ok = run.mistakes <= 1 && run.timeMs <= layer.parTime * 1600 && run.moves <= Math.round(layer.parMoves * 1.5);
    return ok ? 2 : 1;
  }

  /* ================= 状态 ================= */
  var game = {
    state: 'menu',              // menu | scan | playing | attention_show | multihead_show | clear | paused
    prevState: 'menu',
    layers: LAYERS,
    layerIndex: 0,
    layer: null,
    grid: null,
    nodeAt: null,
    weightTables: [],
    headsCount: 1,
    answerId: null,
    player: { cx: 0, cy: 0, dx: 1, dy: 0, px: 0, py: 0 },
    moves: 0,
    mistakes: 0,
    timeMs: 0,
    rescansLeft: 0,
    rescansUsed: 0,
    queryDone: false,
    matchedKeyId: null,
    valueDone: false,
    triedKeys: {},
    visited: {},
    attention: { ms: 0, total: 0, head: 0, phase: 'idle' },
    toast: '',
    toastMs: 0,
    toastTotal: 0,
    tipShown: false,
    scanMs: 0,
    scanTotal: 0,
    starsEarned: 0,
    selected: 0,
    progress: defaultProgress(),
    reducedMotion: false,
    menuTiles: [],
    resetConfirmMs: 0,
    now: 0,
    particles: [],
    /* 下面几个是给测试/内部调用的小接口；画布上的正常操作只走 selectLayer 与方向键 */
    startLayer: startLayer,
    selectLayer: selectLayer,
    restartLayer: restartLayer,
    doRescan: doRescan,
    togglePause: togglePause,
    toMenu: toMenu,
    requestReset: requestReset,
    exitUnlocked: exitUnlocked,
    valueUnlocked: valueUnlocked,
    objectiveStage: objectiveStage
  };

  game.progress = loadProgress();
  game.selected = Math.min(game.progress.unlocked, MAX_LAYERS) - 1;

  /* ================= DOM ================= */
  function byId(id) { return document.getElementById(id); }
  var soundBtn = byId('sound');
  if (soundBtn) soundBtn.addEventListener('click', function () { toggleSound(); });
  var pauseBtn = byId('pause');
  if (pauseBtn) pauseBtn.addEventListener('click', function () { togglePause(); });
  var rescanBtn = byId('rescan');
  if (rescanBtn) rescanBtn.addEventListener('click', function () { doRescan(); });
  var restartBtn = byId('restart');
  if (restartBtn) restartBtn.addEventListener('click', function () { restartLayer(); });
  var menuBtn = byId('menu');
  if (menuBtn) menuBtn.addEventListener('click', function () { toMenu(); });
  var resetBtn = byId('reset');
  if (resetBtn) resetBtn.addEventListener('click', function () { requestReset(); });

  /* ================= 提示条 ================= */
  function showToast(key, ms) {
    if (!key) return;
    game.toast = key;
    game.toastTotal = ms || 2200;
    game.toastMs = game.toastTotal;
  }

  /* ================= 关卡流程 ================= */
  function selectLayer(i) {
    if (!(i >= 0 && i < LAYERS.length)) return false;
    if (i + 1 > game.progress.unlocked) {           // 没解锁的正常途径进不去
      sfx('locked');
      showToast('maze.locked', 1600);
      return false;
    }
    game.selected = i;
    return startLayer(i);
  }

  function startLayer(i) {
    if (!(i >= 0 && i < LAYERS.length)) return false;
    var L = LAYERS[i];
    game.layerIndex = i;
    game.selected = i;      // 菜单高亮与“空格继续”都跟着当前关
    game.layer = L;
    game.grid = parseMap(L.map);
    game.nodeAt = buildNodeIndex(L.nodes);
    game.weightTables = weightTables(L);
    game.headsCount = game.weightTables.length;
    game.answerId = L.answer || null;
    game.player = { cx: L.nodes.start.x, cy: L.nodes.start.y, dx: 1, dy: 0, px: L.nodes.start.x, py: L.nodes.start.y };
    game.moves = 0;
    game.mistakes = 0;
    game.timeMs = 0;
    game.rescansLeft = L.rescan;
    game.rescansUsed = 0;
    game.queryDone = false;
    game.matchedKeyId = null;
    game.valueDone = false;
    game.triedKeys = {};
    game.visited = {};
    game.visited[cellKey(L.nodes.start.x, L.nodes.start.y)] = 1;
    game.attention = { ms: 0, total: 0, head: 0, phase: 'idle' };
    game.toast = '';
    game.toastMs = 0;
    game.starsEarned = 0;
    game.tipShown = false;
    game.scanTotal = L.scanMs;
    game.scanMs = L.scanMs;
    game.particles = [];
    clearInput();
    game.state = 'scan';
    updateButtons();
    return true;
  }

  function restartLayer() {
    if (!game.layer) return false;
    sfx('rescan');
    return startLayer(game.layerIndex);
  }

  function toMenu() {
    clearInput();
    game.state = 'menu';
    game.attention = { ms: 0, total: 0, head: 0, phase: 'idle' };
    updateButtons();
  }

  function enterPlaying() {
    game.state = 'playing';
    clearInput();
    if (!game.tipShown && game.layer && game.layer.tip) {
      game.tipShown = true;
      showToast(game.layer.tip, 3600);
    } else if (!game.tipShown) {
      game.tipShown = true;
    }
    updateButtons();
  }

  /* 当前目标（HUD 上最显眼的那行） */
  function objectiveStage() {
    var L = game.layer;
    if (!L) return 'exit';
    if (!L.nodes.query) return 'exit';
    if (!game.queryDone) return 'query';
    if (game.matchedKeyId !== game.answerId) return 'key';
    if (L.nodes.value && !game.valueDone) return 'value';
    return 'exit';
  }
  var OBJ_KEY = { query: 'maze.obj.query', key: 'maze.obj.key', value: 'maze.obj.value', exit: 'maze.obj.exit' };

  function exitUnlocked() {
    var L = game.layer;
    if (!L) return false;
    if (!L.nodes.query) return true;
    if (!game.queryDone) return false;
    if (game.matchedKeyId !== game.answerId) return false;
    if (L.nodes.value && !game.valueDone) return false;
    return true;
  }
  function valueUnlocked() {
    return game.matchedKeyId !== null && game.matchedKeyId === game.answerId;
  }

  /* ================= 注意力展示 ================= */
  function startAttention() {
    game.queryDone = true;
    clearInput();
    /* 权重展示期间不要再压着关卡提示条：KEY 变多以后第一排的权重标签就在顶部，
     * 提示条正好盖在上面。提示的使命在走进 QUERY 之前已经完成了。 */
    if (game.toast && game.toast.indexOf('maze.tip.') === 0) { game.toast = ''; game.toastMs = 0; }
    if (game.headsCount > 1) {
      game.state = 'multihead_show';
      game.attention = { ms: HEAD_MS, total: HEAD_MS, head: 0, phase: 'head1' };
      sfx('head');
    } else {
      game.state = 'attention_show';
      game.attention = { ms: ATT_MS, total: ATT_MS, head: 0, phase: 'single' };
      sfx('attention');
    }
    updateButtons();
  }

  function updateAttention(dt) {
    game.attention.ms -= dt;
    if (game.attention.ms > 0) return;
    if (game.attention.phase === 'single') { enterPlaying(); return; }
    if (game.attention.phase === 'head1') {
      game.attention.phase = 'head2';
      game.attention.head = 1;
      game.attention.ms = HEAD_MS;
      game.attention.total = HEAD_MS;
      sfx('head');
      return;
    }
    if (game.attention.phase === 'head2') {
      game.attention.phase = 'combine';
      game.attention.ms = COMBINE_MS;
      game.attention.total = COMBINE_MS;
      showToast('maze.combine', COMBINE_MS);
      sfx('attention');
      return;
    }
    game.attention.phase = 'idle';
    enterPlaying();
  }

  /* ================= 走到某一格 ================= */
  function onEnterCell(x, y) {
    var node = game.nodeAt[cellKey(x, y)];
    if (!node) return;

    if (node.type === 'query') {
      if (!game.queryDone) { sfx('query'); startAttention(); }
      return;
    }

    if (node.type === 'key') {
      var id = node.key.id;
      if (!game.queryDone) { showToast('maze.obj.query', 1500); return; }
      if (id === game.answerId) {
        if (game.matchedKeyId !== id) {
          game.matchedKeyId = id;
          sfx('match');
          burst(node.key.x, node.key.y, '#9ff0d8');
          showToast('maze.matched', 2000);
          if (!game.layer.nodes.value) sfx('unlock');
        }
        return;
      }
      if (game.matchedKeyId === game.answerId) return;        // 已经找对了，别的 KEY 就无所谓了
      if (!game.triedKeys[id]) {                              // 同一个错 KEY 只记一次
        game.triedKeys[id] = 1;
        game.mistakes++;
        updateButtons();
      }
      sfx('low');
      showToast('maze.low', 1500);
      return;
    }

    if (node.type === 'value') {
      if (!valueUnlocked()) { showToast(OBJ_KEY[objectiveStage()], 1500); return; }
      if (!game.valueDone) {
        game.valueDone = true;
        sfx('value');
        sfx('unlock');
        burst(node.x, node.y, '#cfe6ff');
        showToast('maze.obj.exit', 1600);
      }
      return;
    }

    if (node.type === 'exit') {
      if (!exitUnlocked()) { showToast(OBJ_KEY[objectiveStage()], 1500); return; }
      clearLayer();
    }
  }
  function clearLayer() {
    var L = game.layer;
    var run = { mistakes: game.mistakes, timeMs: game.timeMs, moves: game.moves, rescansUsed: game.rescansUsed };
    var stars = starsFor(L, run);
    game.starsEarned = stars;
    var id = game.layerIndex + 1;
    var p = game.progress;
    if (!p.stars[id] || stars > p.stars[id]) p.stars[id] = stars;
    var best = p.best[id];
    if (!best) p.best[id] = { t: Math.round(game.timeMs), m: game.moves };
    else {
      if (game.timeMs < best.t) best.t = Math.round(game.timeMs);
      if (game.moves < best.m) best.m = game.moves;
    }
    if (id + 1 > p.unlocked && id < LAYERS.length) p.unlocked = Math.min(MAX_LAYERS, id + 1);
    saveProgress();
    clearInput();
    burst(L.nodes.exit.x, L.nodes.exit.y, '#7fe0a8');
    game.state = 'clear';
    sfx('clear');
    updateButtons();
  }

  /* ================= RESCAN / 重置 ================= */
  function doRescan() {
    if (game.state !== 'playing') return false;
    if (game.rescansLeft <= 0) { showToast('maze.rescanNone', 1400); sfx('locked'); return false; }
    game.rescansLeft--;
    game.rescansUsed++;
    clearInput();
    game.scanTotal = RESCAN_MS;
    game.scanMs = RESCAN_MS;
    game.state = 'scan';
    sfx('rescan');
    updateButtons();
    return true;
  }

  function requestReset() {
    if (game.resetConfirmMs > 0) {
      game.progress = defaultProgress();
      saveProgress();
      game.selected = 0;
      game.resetConfirmMs = 0;
      showToast('maze.resetDone', 1800);
      updateButtons();
      return;
    }
    game.resetConfirmMs = 3000;
    updateButtons();
  }

  /* ================= 暂停 ================= */
  function togglePause() {
    if (game.state === 'paused') {
      game.state = game.prevState === 'paused' ? 'playing' : game.prevState;
      if (game.state === 'menu' || game.state === 'clear') game.state = 'playing';
      clearInput();
    } else if (game.state !== 'menu' && game.state !== 'clear') {
      game.prevState = game.state;
      game.state = 'paused';
      clearInput();
    }
    updateButtons();
  }

  /* ================= 输入 ================= */
  var keys = { up: false, down: false, left: false, right: false };
  var pads = { up: [], down: [], left: [], right: [] };
  var dirStack = [];
  var holdDelay = 0;
  var bumped = false;
  var drag = { id: null, x: 0, y: 0, moved: false };

  function padRemove(dir, id) {
    var i = pads[dir].indexOf(id);
    if (i >= 0) pads[dir].splice(i, 1);
  }
  function inputOf(dir) { return keys[dir] || pads[dir].length > 0; }

  function clearInput() {
    keys.up = keys.down = keys.left = keys.right = false;
    pads.up.length = 0;
    pads.down.length = 0;
    pads.left.length = 0;
    pads.right.length = 0;
    dirStack.length = 0;
    holdDelay = 0;
    bumped = false;
    drag.id = null;
  }
  /* 方向栈里已经没有任何输入来源的方向要踢掉（手指在按钮外抬起 / 被系统打断时用） */
  function pruneDirs() {
    for (var i = dirStack.length - 1; i >= 0; i--) {
      if (!inputOf(dirStack[i])) dirStack.splice(i, 1);
    }
    if (!dirStack.length) holdDelay = 0;
  }
  function pressDir(dir) {
    if (dirStack.indexOf(dir) < 0) dirStack.push(dir);
    holdDelay = MOVE_REPEAT_DELAY;
    bumped = false;
    moveByDir(dir);                       // 按一次就走一格
  }
  function releaseDir(dir) {
    var i = dirStack.indexOf(dir);
    if (i >= 0) dirStack.splice(i, 1);
    if (inputOf(dir)) dirStack.push(dir); // 还有别的来源按着（比如触屏和键盘同时）
    if (!dirStack.length) holdDelay = 0;
  }
  function dirVec(dir) {
    if (dir === 'up') return { dx: 0, dy: -1 };
    if (dir === 'down') return { dx: 0, dy: 1 };
    if (dir === 'left') return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
  }

  function moveByDir(dir) {
    if (game.state !== 'playing') return false;
    var v = dirVec(dir);
    if (isWallAt(game.grid, game.player.cx + v.dx, game.player.cy + v.dy)) {
      if (!bumped) { bumped = true; sfx('bump'); }    // 撞墙：不增加 MOVES
      return false;
    }
    bumped = false;
    game.player.cx += v.dx;
    game.player.cy += v.dy;
    game.player.dx = v.dx;
    game.player.dy = v.dy;
    game.moves++;
    game.visited[cellKey(game.player.cx, game.player.cy)] = 1;
    sfx('move');
    onEnterCell(game.player.cx, game.player.cy);
    return true;
  }

  function pointerKey(e) {
    if (e && e.pointerId !== undefined && e.pointerId !== null) return e.pointerId;
    return 'p';
  }
  function stopEv(e) { if (e && e.preventDefault) e.preventDefault(); }

  function bindPad(id, dir) {
    var el = byId(id);
    if (!el || !el.addEventListener) return;
    el.addEventListener('pointerdown', function (e) {
      stopEv(e);
      var pid = pointerKey(e);
      if (pads[dir].indexOf(pid) < 0) pads[dir].push(pid);
      if (game.state === 'menu') return;
      if (game.state === 'clear') return;
      pressDir(dir);
    });
    var release = function (e) { padRemove(dir, pointerKey(e)); pruneDirs(); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('lostpointercapture', release);
  }
  bindPad('up', 'up');
  bindPad('down', 'down');
  bindPad('left', 'left');
  bindPad('right', 'right');

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var onControl = !!(t && (t.tagName === 'BUTTON' || t.tagName === 'A' ||
      t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
    var k = e.key, c = e.code;
    var dir = null;
    if (c === 'ArrowUp' || c === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W') dir = 'up';
    else if (c === 'ArrowDown' || c === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') dir = 'down';
    else if (c === 'ArrowLeft' || c === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') dir = 'left';
    else if (c === 'ArrowRight' || c === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') dir = 'right';
    if (dir) {
      stopEv(e);
      if (keys[dir]) return;
      keys[dir] = true;
      if (game.state === 'menu') return;
      if (game.state === 'clear') return;
      if (game.state === 'paused') return;
      pressDir(dir);
      return;
    }
    if (c === 'KeyP' || k === 'p' || k === 'P' || c === 'Escape') { stopEv(e); togglePause(); return; }
    if (c === 'KeyM' || k === 'm' || k === 'M') { stopEv(e); toggleSound(); return; }
    if (c === 'KeyR' || k === 'r' || k === 'R') { stopEv(e); doRescan(); return; }
    if (c === 'Space' || k === ' ') {
      if (onControl) return;                 // 焦点在按钮上时交给按钮
      stopEv(e);
      if (game.state === 'menu') { selectLayer(game.selected); return; }
      if (game.state === 'clear') { nextAfterClear(); return; }
      return;
    }
    if (game.state === 'menu' && k >= '1' && k <= '9') { selectLayer(parseInt(k, 10) - 1); }
  });
  document.addEventListener('keyup', function (e) {
    var k = e.key, c = e.code;
    var dir = null;
    if (c === 'ArrowUp' || c === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W') dir = 'up';
    else if (c === 'ArrowDown' || c === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') dir = 'down';
    else if (c === 'ArrowLeft' || c === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') dir = 'left';
    else if (c === 'ArrowRight' || c === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') dir = 'right';
    if (dir) { keys[dir] = false; releaseDir(dir); }
  });

  function globalRelease(e) {
    var pid = pointerKey(e);
    padRemove('up', pid); padRemove('down', pid); padRemove('left', pid); padRemove('right', pid);
    pruneDirs();
    if (drag.id === pid) drag.id = null;
  }
  document.addEventListener('pointerup', globalRelease);
  document.addEventListener('pointercancel', globalRelease);
  function releaseAllInput() {
    var wasHeld = dirStack.length;
    clearInput();
    if (wasHeld) { /* 只是清输入，不改状态 */ }
  }
  if (window.addEventListener) window.addEventListener('blur', releaseAllInput);

  /* 画布：菜单点格子选关；游戏里左右滑动也能走（辅助操作，不是唯一方式） */
  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((e.clientX || 0) - rect.left) * (W / rect.width),
      y: ((e.clientY || 0) - rect.top) * (H / rect.height)
    };
  }
  canvas.addEventListener('pointerdown', function (e) {
    stopEv(e);
    var p = canvasPoint(e);
    if (game.state === 'menu') {
      for (var i = 0; i < game.menuTiles.length; i++) {
        var t = game.menuTiles[i];
        if (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h) { selectLayer(t.layer); return; }
      }
      return;
    }
    if (game.state === 'clear') { nextAfterClear(); return; }
    if (game.state !== 'playing') return;
    drag.id = pointerKey(e);
    drag.x = p.x;
    drag.y = p.y;
    drag.moved = false;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (drag.id === null || pointerKey(e) !== drag.id) return;
    var p = canvasPoint(e);
    var dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    moveByDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    holdDelay = 0;                       // 滑动是一次性输入，不触发按住连走
    drag.x = p.x;
    drag.y = p.y;
  });
  canvas.addEventListener('pointerup', function (e) { if (drag.id === pointerKey(e)) drag.id = null; });
  canvas.addEventListener('pointercancel', function () { drag.id = null; });
  canvas.addEventListener('contextmenu', function (e) { stopEv(e); });

  function nextAfterClear() {
    var next = game.layerIndex + 1;
    if (next < LAYERS.length && next + 1 <= game.progress.unlocked) {
      startLayer(next);
    } else {
      toMenu();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && (game.state === 'playing' || game.state === 'scan' ||
        game.state === 'attention_show' || game.state === 'multihead_show')) {
      game.prevState = game.state;
      game.state = 'paused';
      releaseAllInput();
      updateButtons();
    }
  });

  var stopped = false;
  function stopLoop() { stopped = true; }
  document.addEventListener('pagehide', stopLoop);
  if (window.addEventListener) {
    window.addEventListener('pagehide', stopLoop);
    window.addEventListener('pageshow', function () {
      if (!stopped) return;
      stopped = false;
      last = 0;
      acc = 0;
      requestAnimationFrame(frame);
    });
  }

  /* ================= 逻辑推进 ================= */
  function updateHold(dt) {
    if (!dirStack.length) { holdDelay = 0; return; }
    holdDelay -= dt;
    var guard = 0;
    while (holdDelay <= 0 && guard++ < 2) {           // 一帧最多补一格，绝不瞬移
      var dir = dirStack[dirStack.length - 1];
      if (!dir) break;
      if (!moveByDir(dir)) { holdDelay = MOVE_REPEAT_EVERY; break; }   // 撞墙就等下一次
      holdDelay = MOVE_REPEAT_EVERY;
    }
    if (holdDelay < -MOVE_REPEAT_EVERY) holdDelay = 0;
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
  function burst(cx, cy, color) {
    for (var i = 0; i < 8; i++) {
      var a = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      game.particles.push({
        x: cx * CELL + CELL / 2, y: FY + cy * CELL + CELL / 2,
        vx: Math.cos(a) * (0.5 + Math.random()),
        vy: Math.sin(a) * (0.5 + Math.random()),
        life: 1, color: color
      });
    }
  }

  function step(dt) {
    if (game.state === 'paused') return;      // 暂停：所有计时 + 动画时钟一起冻结
    game.now += dt;
    if (game.resetConfirmMs > 0) {
      game.resetConfirmMs -= dt;
      if (game.resetConfirmMs <= 0) { game.resetConfirmMs = 0; updateButtons(); }
    }
    if (game.toastMs > 0) game.toastMs = Math.max(0, game.toastMs - dt);

    updateParticles(dt);

    /* 视觉插值：逻辑坐标永远是整数格 */
    var t = Math.min(1, dt / TWEEN_MS);
    game.player.px += (game.player.cx - game.player.px) * t;
    game.player.py += (game.player.cy - game.player.py) * t;

    if (game.state === 'menu' || game.state === 'clear') return;

    if (game.state === 'scan') {
      game.scanMs -= dt;
      if (game.scanMs <= 0) { game.scanMs = 0; enterPlaying(); }
      return;
    }

    if (game.state === 'attention_show' || game.state === 'multihead_show') {
      updateAttention(dt);                 // 展示期间不接受移动，但计时只在非暂停时走
      return;
    }

    if (game.state === 'playing') {
      game.timeMs += dt;                   // TIME 只算“能操作的时间”
      updateHold(dt);
    }
  }

  /* ================= 绘制 ================= */
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
  function cx2px(cx) { return cx * CELL; }
  function cy2px(cy) { return FY + cy * CELL; }

  function drawFieldBase() {
    ctx.fillStyle = '#071026';
    ctx.fillRect(0, FY, W, FH);
  }

  function drawWallsAndFloor() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var px = cx2px(x), py = cy2px(y);
        if (game.grid[y][x] === '#') {
          ctx.fillStyle = '#152542';
          ctx.fillRect(px, py, CELL, CELL);
          ctx.fillStyle = '#1d3157';
          ctx.fillRect(px, py, CELL, 3);              // 墙顶一点高光，别做成纯黑
        } else {
          ctx.fillStyle = '#0b1a35';
          ctx.fillRect(px, py, CELL, CELL);
          ctx.fillStyle = 'rgba(120,175,255,0.055)';
          ctx.fillRect(px, py, CELL, 1);
          ctx.fillRect(px, py, 1, CELL);
        }
      }
    }
    /* 走过的格子留一点记忆残影 */
    for (var key in game.visited) {
      if (!Object.prototype.hasOwnProperty.call(game.visited, key)) continue;
      var parts = key.split(',');
      var vx = parseInt(parts[0], 10), vy = parseInt(parts[1], 10);
      if (!isFinite(vx) || !isFinite(vy)) continue;
      ctx.fillStyle = 'rgba(120,175,255,0.10)';
      ctx.fillRect(cx2px(vx) + 4, cy2px(vy) + 4, CELL - 8, CELL - 8);
    }
  }

  function drawMask() {
    if (game.state === 'scan' || game.state === 'menu') return;
    var r = game.layer ? game.layer.focus : 2;
    var pcx = game.player.cx, pcy = game.player.cy;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var d = Math.abs(x - pcx) + Math.abs(y - pcy);
        if (d <= r) continue;
        var visited = game.visited[cellKey(x, y)];
        /* 窗外基本看不见（远处 98.5% 遮住），只给走过的路留一点很暗的记忆残影 */
        var fade;
        if (d === r + 1) fade = visited ? 0.50 : 0.86;
        else if (d === r + 2) fade = visited ? 0.66 : 0.94;
        else fade = visited ? 0.80 : 0.985;
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#050c1c';                   // 深蓝遮罩，不是纯黑
        ctx.fillRect(cx2px(x), cy2px(y), CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }
    /* 注意力窗口的边框：让“只剩身边一圈”这件事一眼能看懂 */
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#6fa8ff';
    for (var yy = 0; yy < ROWS; yy++) {
      for (var xx = 0; xx < COLS; xx++) {
        if (Math.abs(xx - pcx) + Math.abs(yy - pcy) !== r) continue;
        ctx.fillRect(cx2px(xx), cy2px(yy), CELL, 1);
        ctx.fillRect(cx2px(xx), cy2px(yy) + CELL - 1, CELL, 1);
        ctx.fillRect(cx2px(xx), cy2px(yy), 1, CELL);
        ctx.fillRect(cx2px(xx) + CELL - 1, cy2px(yy), 1, CELL);
      }
    }
    ctx.globalAlpha = 1;
  }

  function padGlyph(x, y, color, inner) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    ctx.fillStyle = inner;
    ctx.fillRect(x + 7, y + 7, CELL - 14, CELL - 14);
  }

  function drawNodes() {
    var L = game.layer;
    if (!L) return;
    var n = L.nodes;

    /* 起点 */
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#5c86c9';
    ctx.fillRect(cx2px(n.start.x) + 8, cy2px(n.start.y) + 8, CELL - 16, CELL - 16);
    ctx.globalAlpha = 1;

    /* 出口：解锁前暗，解锁后亮 + 呼吸 */
    var unlocked = exitUnlocked();
    var pulse = game.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(game.now / 260);
    ctx.globalAlpha = unlocked ? 0.55 + 0.35 * pulse : 0.32;
    ctx.fillStyle = '#3ddc84';
    ctx.fillRect(cx2px(n.exit.x) + 2, cy2px(n.exit.y) + 2, CELL - 4, CELL - 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = unlocked ? '#07240f' : '#0d2b1c';
    ctx.fillRect(cx2px(n.exit.x) + 10, cy2px(n.exit.y) + 6, CELL - 20, CELL - 12);
    if (!unlocked) {
      drawSprite(LOCK, 2, cx2px(n.exit.x) + CELL / 2 - 5, cy2px(n.exit.y) + CELL / 2 - 5, { X: '#7fe0a8' });
      ctx.globalAlpha = 1;
    }

    /* QUERY */
    if (n.query) {
      var qDone = game.queryDone;
      ctx.fillStyle = qDone ? '#1b3c78' : '#4d6bfe';
      ctx.fillRect(cx2px(n.query.x) + 1, cy2px(n.query.y) + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = qDone ? '#4a6ba8' : '#cfe0ff';
      ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(T('maze.short.q'), cx2px(n.query.x) + CELL / 2, cy2px(n.query.y) + CELL / 2 + 1);
    }

    /* VALUE：KEY 找对之前是锁着的 */
    if (n.value) {
      var vOpen = valueUnlocked();
      ctx.fillStyle = vOpen ? '#cfe6ff' : '#26375c';
      ctx.fillRect(cx2px(n.value.x) + 1, cy2px(n.value.y) + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = vOpen ? '#123058' : '#4b5f86';
      ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(T('maze.short.v'), cx2px(n.value.x) + CELL / 2, cy2px(n.value.y) + CELL / 2 + 1);
    }

    /* KEY */
    for (var i = 0; i < n.keys.length; i++) {
      var k = n.keys[i];
      var kx = cx2px(k.x), ky = cy2px(k.y);
      var matched = game.matchedKeyId === k.id;
      var locked = !game.queryDone;
      ctx.fillStyle = locked ? '#1d3a5c' : (matched ? '#9ff0d8' : '#28c8d8');
      ctx.fillRect(kx + 1, ky + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = locked ? '#41709a' : (matched ? '#053a2c' : '#04303f');
      ctx.font = 'bold 12px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(T('maze.short.k'), kx + CELL / 2, ky + CELL / 2 + 1);
      /* 编号：和权重表里的 K1/K2 对得上 */
      ctx.font = 'bold 8px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = locked ? '#5c86a8' : '#dff7ff';
      ctx.fillText(String(i + 1), kx + CELL - 6, ky + 6);
      if (matched) {
        ctx.globalAlpha = 0.5 + (game.reducedMotion ? 0 : 0.3 * Math.sin(game.now / 180));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(kx, ky, CELL, 2);
        ctx.fillRect(kx, ky + CELL - 2, CELL, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* 像素风细线：按 weight 决定粗细/亮度，最高分那条再加几个亮点（不只靠颜色区分） */
  function pixelLine(x0, y0, x1, y1, size, color, alpha, step) {
    var dx = x1 - x0, dy = y1 - y0;
    var steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps < 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0), Math.round(y0), size, size);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (var i = 0; i <= steps; i += step) {
      var px = x0 + dx * i / steps;
      var py = y0 + dy * i / steps;
      ctx.fillRect(Math.round(px - size / 2), Math.round(py - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawAttention() {
    if (game.state === 'scan' || game.state === 'menu') return;
    var head = -1;
    if (game.state === 'attention_show' && game.attention.phase === 'single') head = 0;
    else if (game.state === 'multihead_show' && game.attention.phase === 'head1') head = 0;
    else if (game.state === 'multihead_show' && game.attention.phase === 'head2') head = 1;
    if (head < 0) return;
    var L = game.layer;
    if (!L || !L.nodes.query) return;
    var table = game.weightTables[head] || [];
    var qx = cx2px(L.nodes.query.x) + CELL / 2;
    var qy = cy2px(L.nodes.query.y) + CELL / 2;
    var maxW = -1, maxI = -1;
    for (var m = 0; m < table.length; m++) if (table[m] > maxW) { maxW = table[m]; maxI = m; }

    /* 先把所有权重标签的位置算出来、互相错开，再画连线。
     * KEY 数量是数据驱动的（2~6 个，以后还可能更多），同一行里靠得近的两个 KEY
     * 标签会互相压住 —— 只做确定性的上下错位，底板/配色/线型都不动。 */
    ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
    var plates = [];
    for (var q = 0; q < L.nodes.keys.length; q++) {
      var kq = L.nodes.keys[q];
      var wq = table[q] === undefined ? 0 : table[q];
      var lq = T('maze.short.k') + (q + 1) + ' ' + wq.toFixed(2);
      var wlq = Math.round(ctx.measureText(lq).width) + 8;
      plates.push({
        label: lq,
        w: wlq,
        x: Math.max(2, Math.min(W - wlq - 2, Math.round(cx2px(kq.x) + CELL - wlq / 2))),
        y: Math.max(FY + 2, Math.min(FY + FH - 16, cy2px(kq.y) - 14))
      });
    }
    for (var a = 0; a < plates.length; a++) {
      for (var tries = 0; tries < 6; tries++) {
        var hit = null;
        for (var z = 0; z < a; z++) {
          var A = plates[a], B = plates[z];
          if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + 14 && B.y < A.y + 14) { hit = B; break; }
        }
        if (!hit) break;
        plates[a].y = (hit.y - 16 >= FY + 2) ? hit.y - 16 : hit.y + 16;
      }
    }

    for (var i = 0; i < L.nodes.keys.length; i++) {
      var k = L.nodes.keys[i];
      var w = table[i] === undefined ? 0 : table[i];
      var kx = cx2px(k.x) + CELL / 2;
      var ky = cy2px(k.y) + CELL / 2;
      var size = 1 + (w >= 0.5 ? 1 : 0) + (w >= 0.8 ? 1 : 0);
      var alpha = 0.26 + 0.62 * w;
      var dash = head === 1 ? (i === maxI ? 5 : 8) : (i === maxI ? 2 : 4);   // HEAD 2 是点状像素线
      pixelLine(qx, qy, kx, ky, size, w >= 0.75 ? '#bff0ff' : '#4fa8d8', alpha, dash);
      if (i === maxI) {
        /* 最高权重：额外三个亮点，色觉差异用户也能一眼看出 */
        for (var s = 1; s <= 3; s++) {
          var px = qx + (kx - qx) * (s / 4);
          var py = qy + (ky - qy) * (s / 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
        }
      }
      /* 权重标签带 KEY 编号：遮罩蒙住的 KEY 也能一眼对上（K1 0.38） */
      var plate = plates[i];
      var lx = plate.x, ly = plate.y, lw = plate.w;
      ctx.fillStyle = 'rgba(4,10,24,0.88)';
      ctx.fillRect(lx, ly, lw, 14);
      if (i === maxI) {
        /* 最高权重那一块加一圈亮边：5~6 个 KEY 时也能一秒找到它 */
        ctx.fillStyle = 'rgba(191,240,255,0.55)';
        ctx.fillRect(lx, ly, lw, 1);
        ctx.fillRect(lx, ly + 13, lw, 1);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = i === maxI ? '#ffffff' : (w >= 0.5 ? '#a8dcff' : '#5f86ad');
      ctx.fillText(plate.label, lx + lw / 2, ly + 7);
    }
  }

  function drawPlayerSprite() {
    var px = Math.round(cx2px(game.player.px));
    var py = Math.round(cy2px(game.player.py));

    /* Whale-chan 皮肤：一格 28px 塞不下立绘，这里用一张裁好的小头像，
     * 视觉上略大于格子（34px）但逻辑上仍然只占 1 格 —— 碰撞与移动规则完全不变。
     * 不做四方向新图：朝左水平镜像，上下沿用同一张正脸。 */
    if (ArcadeCharacter && ArcadeCharacter.isWhaleChan()) {
      var size = 34;
      var bob2 = game.reducedMotion ? 0 : Math.round(Math.sin(game.now / 160));
      var ccx = cx2px(game.player.px) + CELL / 2;
      var ccy = cy2px(game.player.py) + CELL / 2 + bob2;
      if (ArcadeCharacter.draw(ctx, 'head', ccx - size / 2, ccy - size / 2, size, size,
            { flip: game.player.dx < 0 })) {
        return;
      }
    }

    var frame = 0;
    if (game.player.dx > 0) frame = 0;
    else if (game.player.dy > 0) frame = 1;
    else if (game.player.dx < 0) frame = 2;
    else frame = 3;
    var bob = game.reducedMotion ? 0 : Math.round(Math.sin(game.now / 160));
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#7fd0ff';
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.globalAlpha = 1;
    drawSprite(WHALE_DIRS[frame], 2, px + 2, py + 2 + bob, { X: '#4d6bfe', o: '#c9dcff', e: '#ffffff' });
  }

  function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function hudCenterText() {
    if (game.state === 'scan') return T('maze.scan');
    if (game.state === 'attention_show') return T('maze.query') + ' \u2192 ' + T('maze.key');
    if (game.state === 'multihead_show') {
      if (game.attention.phase === 'head2') return T('maze.head2');
      if (game.attention.phase === 'combine') return T('maze.combine');
      return T('maze.head1');
    }
    if (game.state === 'clear') return T('maze.clear');
    if (game.state === 'menu') return '';
    return T(OBJ_KEY[objectiveStage()]);
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(6,16,36,0.86)';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.textBaseline = 'middle';

    var L = game.layer;
    var layerNo = pad2(game.layerIndex + 1);
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#8fa9d6';
    ctx.fillText(T('maze.layer') + ' ' + layerNo, 10, 15);

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = game.state === 'multihead_show' ? '#9fe8ff' : '#dbe9ff';
    ctx.fillText(hudCenterText(), W / 2, 15);

    ctx.textAlign = 'right';
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = game.rescansLeft > 0 ? '#8fa9d6' : '#5b6b86';
    ctx.fillText(T('maze.rescan') + ' ' + game.rescansLeft, W - 10, 15);

    ctx.textAlign = 'left';
    ctx.font = '13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#7f9bc4';
    ctx.fillText(T('maze.time') + ' ' + fmtTime(game.timeMs), 10, 34);
    ctx.textAlign = 'center';
    ctx.fillText(T('maze.moves') + ' ' + game.moves, W / 2, 34);
    ctx.textAlign = 'right';
    ctx.fillStyle = game.mistakes > 0 ? '#ffb347' : '#7f9bc4';
    ctx.fillText(T('maze.mistakes') + ' ' + game.mistakes, W - 10, 34);

  }

  function drawFocusLabel() {
    if (game.state === 'menu' || game.state === 'scan') return;
    ctx.globalAlpha = 0.5;
    ctx.font = 'bold 10px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6fa8ff';
    ctx.fillText(T('maze.focus'), 6, FY + FH - 8);
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    if (game.toastMs <= 0 || !game.toast) return;
    var txt = T(game.toast);
    ctx.font = 'bold 12px "Courier New", ui-monospace, monospace';
    var maxW = W - 16;
    var lines = [txt];
    if (ctx.measureText(txt).width > maxW) {
      /* 英文提示比画布还宽：优先在空格处折行，单个词太长才按字符切 */
      var words = txt.split(' ');
      lines = [];
      var cur = '';
      for (var wi = 0; wi < words.length; wi++) {
        var cand = cur ? cur + ' ' + words[wi] : words[wi];
        if (!cur || ctx.measureText(cand).width <= maxW) cur = cand;
        else { lines.push(cur); cur = words[wi]; }
        while (ctx.measureText(cur).width > maxW && cur.length > 1) {
          var cutAt = cur.length - 1;
          while (cutAt > 1 && ctx.measureText(cur.slice(0, cutAt)).width > maxW) cutAt--;
          lines.push(cur.slice(0, cutAt));
          cur = cur.slice(cutAt);
        }
      }
      if (cur) lines.push(cur);
    }
    var inner = 0;
    for (var i = 0; i < lines.length; i++) inner = Math.max(inner, ctx.measureText(lines[i]).width);
    var w = Math.min(maxW, inner + 20);
    var h = 8 + lines.length * 14;
    var x = Math.round(W / 2 - w / 2);
    var y = FY + 6;
    ctx.fillStyle = 'rgba(4,10,24,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1d3157';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillStyle = '#dbe9ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], W / 2, y + 7 + j * 14);
  }

  function drawScanOverlay() {
    /* 顶部一条进度，底部一条扫描线（reduced motion 时不动） */
    var ratio = game.scanTotal > 0 ? Math.max(0, Math.min(1, game.scanMs / game.scanTotal)) : 0;
    ctx.fillStyle = 'rgba(120,190,255,0.20)';
    ctx.fillRect(0, FY, W, 3);
    ctx.fillStyle = '#8fe3ff';
    ctx.fillRect(0, FY, Math.round(W * ratio), 3);
    if (!game.reducedMotion) {
      var y = FY + 3 + ((game.now / 3) % (FH - 3));
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#9fe0ff';
      ctx.fillRect(0, Math.round(y), W, 2);
      ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#dbe9ff';
    ctx.fillText(T('maze.scan'), W / 2, FY + 18);
    ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#8fa9d6';
    ctx.fillText(T('maze.scanHint'), W / 2, FY + 36);
    if (game.headsCount > 1) {
      ctx.font = 'bold 12px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = '#8fe3ff';
      ctx.fillText(T('maze.multihead'), W / 2, FY + 58);
    }
    if (game.layer && game.layer.final) {
      ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(T('maze.final'), W / 2, FY + 78);
    }
  }

  function drawStars(cx, y, stars, size) {
    for (var i = 0; i < 3; i++) {
      var color = i < stars ? '#ffd76a' : '#2b3f63';
      drawSprite(STAR, size, Math.round(cx + (i - 1.5) * (5 * size + 4)), y, { X: color });
    }
  }

  function drawClearPanel() {
    var midY = FY + FH / 2;
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#061024';
    ctx.fillRect(20, midY - 108, W - 40, 216);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#8fe3ff';
    ctx.fillText(T('maze.clear'), W / 2, midY - 74);
    ctx.font = '13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#9fb6dd';
    ctx.fillText(T('maze.time') + ' ' + fmtTime(game.timeMs) + '   ' +
      T('maze.moves') + ' ' + game.moves + '   ' + T('maze.mistakes') + ' ' + game.mistakes, W / 2, midY - 40);
    drawStars(W / 2, midY - 12, game.starsEarned, 4);
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#ffd76a';
    var starKey = game.starsEarned === 3 ? 'maze.star3' : (game.starsEarned === 2 ? 'maze.star2' : 'maze.star1');
    ctx.fillText(T(starKey), W / 2, midY + 22);
    ctx.font = '12px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#9fb6dd';
    var hint = (game.layerIndex + 1 < LAYERS.length) ? T('maze.hasNext') : T('maze.allClear');
    ctx.fillText(hint, W / 2, midY + 54);
    ctx.fillStyle = (game.now % 1000) < 620 ? '#ffffff' : '#6f8fc8';
    ctx.fillText(T('maze.tapNext'), W / 2, midY + 80);
  }

  function drawPausedOverlay() {
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#061024';
    ctx.fillRect(0, FY, W, FH);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#dbe9ff';
    ctx.fillText(T('maze.paused'), W / 2, FY + FH / 2 - 12);
    ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#8fa9d6';
    ctx.fillText(T('maze.pausedHint'), W / 2, FY + FH / 2 + 18);
    ctx.font = 'bold 12px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#6f8fc8';
    ctx.fillText(T('maze.resume') + ' : P / ' + T('maze.resumeBtn') + '   ' + T('maze.restart') + ' : ⟲', W / 2, FY + FH / 2 + 46);
  }

  function drawMenu() {
    ctx.fillStyle = '#071026';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#6f8fc8';
    ctx.fillText(T('maze.titleShort'), W / 2, 30);
    ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#9fb6dd';
    ctx.fillText(T('maze.desc'), W / 2, 54);

    /* 4 x 3 的 Layer Select */
    var tw = 86, th = 54, gap = 10;
    var cols = 4, rows = Math.max(1, Math.ceil(MAX_LAYERS / cols));
    var totalW = cols * tw + (cols - 1) * gap;
    var ox = Math.round((W - totalW) / 2);
    var oy = 76;
    game.menuTiles = [];
    for (var i = 0; i < MAX_LAYERS; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      var x = ox + c * (tw + gap), y = oy + r * (th + gap);
      var unlocked = i + 1 <= game.progress.unlocked;
      var selected = i === game.selected;
      game.menuTiles.push({ x: x, y: y, w: tw, h: th, layer: i });
      ctx.fillStyle = unlocked ? (selected ? '#24408a' : '#122247') : '#0c1730';
      ctx.fillRect(x, y, tw, th);
      ctx.fillStyle = unlocked ? (selected ? '#6fa8ff' : '#2b4a86') : '#1a2740';
      ctx.fillRect(x, y, tw, 2);
      ctx.font = 'bold 18px "Courier New", ui-monospace, monospace';
      ctx.fillStyle = unlocked ? '#dbe9ff' : '#3f5478';
      ctx.fillText(pad2(i + 1), x + tw / 2, y + 20);
      if (unlocked) drawStars(x + tw / 2, y + 32, game.progress.stars[i + 1] || 0, 2);
      else drawSprite(LOCK, 2, x + tw / 2 - 5, y + 30, { X: '#3f5478' });
    }

    var bestY = oy + rows * th + (rows - 1) * gap + 22;
    ctx.font = 'bold 13px "Courier New", ui-monospace, monospace';
    ctx.fillStyle = '#8fa9d6';
    ctx.fillText(T('maze.best') + ' ' + pad2(Math.min(game.progress.unlocked, MAX_LAYERS)) + ' / ' + pad2(MAX_LAYERS), W / 2, bestY);
    ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#6f8fc8';
    ctx.fillText(T('maze.menuHint'), W / 2, bestY + 24);
  }

  function render() {
    ctx.fillStyle = '#071026';
    ctx.fillRect(0, 0, W, H);
    if (game.state === 'menu' || !game.layer) { drawMenu(); return; }
    drawFieldBase();
    drawWallsAndFloor();
    drawNodes();
    drawMask();
    drawAttention();
    drawPlayerSprite();
    drawParticles();
    drawFocusLabel();
    drawHud();
    drawToast();
    if (game.state === 'scan') drawScanOverlay();
    if (game.state === 'paused') drawPausedOverlay();
    if (game.state === 'clear') drawClearPanel();
  }

  /* ================= 主循环 ================= */
  var last = 0;
  var acc = 0;

  function frame(now) {
    if (stopped) return;
    if (!last) last = now;
    var dt = now - last;
    last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 250) dt = STEP;         // 切标签页回来不瞬移
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard++ < 5) { step(STEP); acc -= STEP; }
    if (guard >= 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  try {
    game.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { game.reducedMotion = false; }

  updateButtons();
  requestAnimationFrame(frame);
})();
