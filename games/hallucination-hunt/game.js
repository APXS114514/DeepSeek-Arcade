/* ============================================================
 * HALLUCINATION HUNT — 游戏主控（第 6 款正式游戏）
 *
 * READ THE RESPONSE. FIND THE LIE. VERIFY BEFORE IT FOOLS YOU.
 *
 * 架构：content(知识库) -> rng(确定性随机) -> mutators(制造幻觉)
 *       -> generator+validator(合格 round) -> 本文件(状态机 + DOM/Canvas)
 *
 * 硬约束：纯前端、零依赖、零构建、零外部请求；file:// 与 GitHub Pages 都能跑。
 * 状态机是唯一的真相来源，**不用一堆互相交错的 boolean**。
 * ============================================================ */
(function (global) {
  'use strict';

  var RNG = global.HuntRNG;
  var GEN = global.HuntGenerator;
  var DIFF = global.HuntDifficulty;
  var FX = global.HuntEffects;
  var REND = global.HuntRenderer;
  var CHAR = global.ArcadeCharacter;

  var I18N = global.I18N || null;
  function T(k, fallback) {
    if (!I18N || !I18N.t) return fallback === undefined ? k : fallback;
    var v = I18N.t(k);
    return (v === k && fallback !== undefined) ? fallback : v;
  }

  var HIGH_KEY = 'arcade.hallucinationHunt.high';
  var DAILY_KEY = 'arcade.hallucinationHunt.daily';
  var SOUND_LEGACY_KEY = 'arcade.hallucinationHunt.sound';

  var STATES = ['intro', 'streaming', 'scanning', 'verifying', 'result', 'paused', 'gameOver'];
  var CHARS_PER_SEC = 46;
  var VERIFY_MS = 720;
  var DAILY_ROUNDS = 10;
  var BASE_SCORE = 100;
  var MAX_MULT = 5.4;            // 上限，防止分数指数爆炸

  var Audio = global.ArcadeAudio || null;
  function soundOn() { return !Audio || !Audio.isEnabled || Audio.isEnabled(SOUND_LEGACY_KEY); }
  function beep(o) { if (Audio && Audio.tone && soundOn()) Audio.tone(o); }

  var game = {
    state: 'intro',
    mode: 'endless',
    roundIndex: 0,
    score: 0, high: 0, lives: 3,
    streak: 0, bestStreak: 0,
    answered: 0, correct: 0,
    clock: 0,
    streamElapsed: 0,
    scanLeft: 0,
    verifyLeft: 0,
    resultLeft: 0,
    round: null,
    session: null,
    marked: -1,            /* 兼容镜像，不驱动核心逻辑 */
    selectedClaims: [],     /* 唯一真相：玩家选中的 claim 索引（升序） */
    noneMarked: false,      /* 玩家是否明确按了「没有幻觉」 */
    lastOutcome: null,
    visibleChars: 0,
    daily: null,
    difficulty: null,
    errors: []
  };

  /* ---------------- 存储（一律 try/catch，隐私模式静默降级） ---------------- */
  /* 启动时先把历史最高分读回来 —— 否则刷新后 HUD 永远显示 0 */
  game.high = readNum(HIGH_KEY);

  function readNum(key) {
    try {
      var v = global.localStorage ? global.localStorage.getItem(key) : null;
      var n = parseInt(v, 10);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (e) { return 0; }
  }
  function writeNum(key, v) {
    try { if (global.localStorage) global.localStorage.setItem(key, String(v)); } catch (e) {}
  }
  function readJson(key) {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(key) : null;
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : null;       // JSON 损坏时安全恢复
    } catch (e) { return null; }
  }
  function writeJson(key, o) {
    try { if (global.localStorage) global.localStorage.setItem(key, JSON.stringify(o)); } catch (e) {}
  }

  /* ---------------- Canvas / 特效 ---------------- */
  var backdrop = null, overlay = null, resizeObserver = null;
  var renderer = null, fx = null;
  var reducedMotion = false;

  function prefersReduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* 画布的真实尺寸只从布局读，不写死任何魔法数字 */
  function shellSize() {
    var shell = el('game-shell');
    if (shell && shell.getBoundingClientRect) {
      var r = shell.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return { w: Math.round(r.width), h: Math.round(r.height) };
    }
    return null;
  }
  /* backing store 必须始终与真实 CSS 尺寸 + DPR 一致。
   * 按钮显隐、QUERY/RESPONSE 文案长度、语言切换都会改变布局，所以这里可重复调用。 */
  function syncSize() {
    var sz = shellSize();
    if (!sz) return false;
    var dpr = Math.max(1, Math.min(global.devicePixelRatio || 1, 3));
    if (renderer) renderer.resize(sz.w, sz.h, dpr);
    if (fx) fx.resize(sz.w, sz.h, dpr);
    return true;
  }
  function watchResize() {
    var shell = el('game-shell');
    if (shell) {
      try {
        if (typeof global.ResizeObserver === 'function') {
          resizeObserver = new global.ResizeObserver(function () { syncSize(); });
          resizeObserver.observe(shell);
        }
      } catch (e) { resizeObserver = null; }
    }
    /* fallback：没有 ResizeObserver（或 observe 失败）时至少跟窗口变化走 */
    if (global.addEventListener) global.addEventListener('resize', function () { syncSize(); });
  }
  function setupCanvas() {
    backdrop = document.getElementById('game');
    overlay = document.getElementById('fx');
    reducedMotion = prefersReduced();
    if (backdrop && REND) renderer = REND.create(backdrop, { reducedMotion: reducedMotion });
    if (overlay && FX) fx = FX.create(overlay, { reducedMotion: reducedMotion, glitchSource: backdrop });
    syncSize();
    watchResize();
  }

  /* 特效坐标一律从画布尺寸推导，不再出现写死的 640 / 320 / 400 */
  function fxBox() {
    if (fx && fx.size) { var a = fx.size(); return { w: a.w, h: a.h, cx: a.w / 2, cy: a.h / 2 }; }
    var c = el('fx');
    var w = (c && c.width) ? c.width : 1, h = (c && c.height) ? c.height : 1;
    return { w: w, h: h, cx: w / 2, cy: h / 2 };
  }
  /* 被核验的那一条 claim 在画布坐标系里的位置：特效据此局部化，不覆盖正文 */
  function claimBox(index) {
    var shell = el('game-shell'), resp = el('response');
    if (shell && resp && shell.getBoundingClientRect && resp.getBoundingClientRect) {
      var sr = shell.getBoundingClientRect();
      var nodes = resp.children || [];
      var node = (index >= 0) ? nodes[index] : null;
      if (node && node.getBoundingClientRect) {
        var r = node.getBoundingClientRect();
        if (r && r.width > 0) return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
      }
    }
    var b = fxBox();
    return { x: 0, y: b.h * 0.18, w: b.w, h: b.h * 0.5 };
  }

  /* 从某个锚点元素推导角色的位置与大小（锚点必须有真实布局尺寸） */
  function stageBox(stageId) {
    var shell = el('game-shell'), stage = el(stageId);
    if (!shell || !stage || !shell.getBoundingClientRect || !stage.getBoundingClientRect) return null;
    var sr = shell.getBoundingClientRect(), tr = stage.getBoundingClientRect();
    if (!(sr.width > 0 && tr.width > 0 && tr.height > 0)) return null;   // 元素被隐藏 -> 不可用
    return {
      x: tr.left - sr.left + tr.width / 2,
      y: tr.bottom - sr.top,
      size: Math.max(36, Math.min(tr.height * 0.94, tr.width * 0.42))
    };
  }
  /* 角色锚点按状态选择：
   *   intro            -> #intro-character-stage（欢迎页里的专属区域）
   *   其余所有游戏状态 -> #verifier-stage（回答尾部，gameplay 布局保持不变）
   * 只有两者都拿不到有效尺寸（真正的异常降级）时才回退到画布中部，
   * 这个 fallback 绝不参与正常布局。 */
  var lastAnchor = 'none';
  function characterBox() {
    var wantId = (game.state === 'intro') ? 'intro-character-stage' : 'verifier-stage';
    var box = stageBox(wantId);
    if (box) { lastAnchor = wantId; return box; }
    box = stageBox('verifier-stage') || stageBox('intro-character-stage');
    if (box) { lastAnchor = 'hidden-anchor'; return box; }
    lastAnchor = 'fallback';
    var sz = renderer && renderer.size ? renderer.size() : null;
    if (sz) return { x: sz.w / 2, y: sz.h * 0.5, size: Math.max(36, Math.min(88, sz.h * 0.18)) };
    return { x: 0, y: 0, size: 64 };
  }
  function characterAnchor() { return lastAnchor; }
  /* gameplay 特效（结算浮动文字等）固定用回答尾部锚点 */
  function verifierBox() {
    return stageBox('verifier-stage') || characterBox();
  }

  /* ---------------- DOM 引用 ---------------- */
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var n = el(id); if (n) n.textContent = String(v); }
  function setHtml(id, v) { var n = el(id); if (n) n.innerHTML = String(v); }
  function live(msg) { var n = el('status'); if (n) n.textContent = String(msg); }

  /* ---------------- 计分 ---------------- */
  function multiplierFor(load, remainRatio, streak) {
    var loadMult = 1 + (load - 1) * 0.25;
    var speedMult = 1 + 0.5 * Math.max(0, Math.min(1, remainRatio));
    var streakMult = 1 + Math.min(streak, 8) * 0.1;
    return Math.min(loadMult * speedMult * streakMult, MAX_MULT);
  }

  /* ---------------- Streaming（时间驱动，与帧率无关） ---------------- */
  function charCost(ch) {
    if (ch === ',' || ch === '，' || ch === '、') return 1000 / CHARS_PER_SEC + 90;
    if (ch === '.' || ch === '。' || ch === '!' || ch === '！' || ch === '?' || ch === '？') return 1000 / CHARS_PER_SEC + 180;
    if (ch === '\n') return 1000 / CHARS_PER_SEC + 260;
    return 1000 / CHARS_PER_SEC;
  }
  function visibleCharsFor(text, elapsedMs) {
    var t = 0;
    for (var i = 0; i < text.length; i++) {
      t += charCost(text.charAt(i));
      if (t > elapsedMs) return i;
    }
    return text.length;
  }
  function roundFullText(round) {
    return round ? round.claims.map(function (c) { return c.text; }).join('\n') : '';
  }

  /* ---------------- result 的推进（唯一入口） ---------------- */
  /* 这一轮之后还有没有下一题：命数耗尽，或 Daily 已打完 */
  function isFinalRound() {
    return game.lives <= 0 || (game.mode === 'daily' && game.roundIndex >= DAILY_ROUNDS);
  }
  /* result 时按钮显示「下一题」还是「查看结果」：只改 data-final，
     由 CSS 切换两个走 i18n 的 span，不新增任何状态。 */
  function syncNextAction() {
    var btn = el('btn-next');
    if (btn && btn.setAttribute) btn.setAttribute('data-final', isFinalRound() ? 'true' : 'false');
    return isFinalRound();
  }
  /* result -> 下一题，或 -> 结算。点击 btn-next 与 Enter/Space 都走这里，
     判断不散落在各处 handler 里。 */
  function advanceFromResult() {
    if (game.state !== 'result') return false;
    if (isFinalRound()) {
      endGame();
    } else {
      var ov = el('overlay');
      if (ov && ov.setAttribute) ov.setAttribute('data-show', 'false');
      nextRound();
    }
    return true;
  }

  /* ---------------- Round 生命周期 ---------------- */
  function nextRound() {
    if (game.mode === 'daily' && game.roundIndex >= DAILY_ROUNDS) { endGame(); return; }
    var load = game.mode === 'daily'
      ? Math.min(5, 1 + Math.floor(game.roundIndex / 2))
      : game.difficulty.load();
    var round = null;
    if (game.session) round = game.session.next(load);
    if (!round) round = GEN.generateRound((game.session ? game.session.seed : 1) + game.roundIndex, load, I18N ? I18N.lang : 'zh');
    game.round = round;
    game.roundIndex++;
    clearSelection();
    game.noneMarked = false;
    game.streamElapsed = 0;
    game.visibleChars = -1;
    game.lastOutcome = null;
    setState('streaming');
    renderRound();
    beep({ type: 'triangle', from: 520, to: 880, ms: 90, gain: 0.04 });
  }

  function renderRound() {
    var r = game.round;
    if (!r) return;
    setText('query-text', r.query);
    setText('confidence-value', r.confidence + '%');
    var bar = el('confidence-bar');
    if (bar) bar.style.width = r.confidence + '%';
    renderResponse(r, 0, false);
    live('');
  }

  function renderResponse(round, visible, clickable) {
    var out = [];
    var remaining = visible;
    var streaming = !clickable;
    for (var i = 0; i < round.claims.length; i++) {
      var c = round.claims[i];
      var text, cls = 'claim';
      if (streaming && remaining < c.text.length) {
        text = c.text.slice(0, Math.max(0, remaining)) + (remaining > 0 ? '▌' : '');
        remaining = 0;
      } else {
        text = c.text;
        remaining -= c.text.length;
      }
      var revealed = clickable || !streaming;
      /* 选中只是「我怀疑这条」，用中性强调色，绝不等同于判对/判错 */
      if (game.state === 'scanning' && game.selectedClaims && game.selectedClaims.indexOf(i) >= 0) cls += ' selected';
      var mark = '';
      if (round.claims[i].__mark === 'hit') { cls += ' hit'; mark = ' <span class="tag">' + escapeHtml(T('hunt.detectedTag', 'HALLUCINATION')) + '</span>'; }
      else if (round.claims[i].__mark === 'missed') { cls += ' missed'; mark = ' <span class="tag">' + escapeHtml(T('hunt.missedTag', 'MISSED')) + '</span>'; }
      else if (round.claims[i].__mark === 'ok') { cls += ' ok'; mark = ' <span class="tag">VERIFIED</span>'; }
      else if (round.claims[i].__mark === 'picked') { cls += ' picked'; mark = ' <span class="tag">FALSE ALARM</span>'; }
      /* 审计序号：纯装饰（aria-hidden），让每条 claim 有独立的视觉锚点 */
      var no = text ? '<span class="claim-no" aria-hidden="true">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' : '';
      /* 多选：每个 claim 都是真 button，aria-pressed 必须如实反映是否已选中 */
      var pressed = (game.state === 'scanning' &&
        game.selectedClaims && game.selectedClaims.indexOf(i) >= 0) ? 'true' : 'false';
      out.push('<button type="button" class="' + cls + '" data-claim="' + i + '" aria-pressed="' + pressed + '"' +
        (revealed ? '' : ' disabled') + '>' + no + escapeHtml(text) + mark + '</button>');
    }
    setHtml('response', out.join(''));
    var resp = el('response');
    if (resp) resp.setAttribute('aria-busy', streaming ? 'true' : 'false');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* 动作区按状态显隐：否则「VERIFY」会和「开始审查」同时出现 */
  var ACTION_BY_STATE = {
    intro: ['btn-start', 'btn-daily'],
    streaming: [],
    scanning: ['btn-none', 'btn-verify'],
    verifying: [],
    result: ['btn-next'],
    paused: [],
    gameOver: ['btn-again', 'btn-copy']
  };
  var ALL_ACTIONS = ['btn-none', 'btn-verify', 'btn-next', 'btn-start', 'btn-daily', 'btn-again', 'btn-copy'];
  function syncActions(state) {
    var show = ACTION_BY_STATE[state] || [];
    for (var i = 0; i < ALL_ACTIONS.length; i++) {
      var node = el(ALL_ACTIONS[i]);
      if (!node) continue;
      if (show.indexOf(ALL_ACTIONS[i]) >= 0) { if (node.removeAttribute) node.removeAttribute('hidden'); }
      else if (node.setAttribute) node.setAttribute('hidden', '');
    }
  }

  function setState(s) {
    game.state = s;
    syncActions(s);
    if (s === 'result') syncNextAction();
    syncVerify();
    /* 动作按钮显隐会改变布局 -> 画布尺寸必须跟着重算 */
    syncSize();
    var shell = el('game-shell');
    if (shell && shell.setAttribute) shell.setAttribute('data-state', s);
    var pause = el('btn-pause');
    if (pause) pause.textContent = T(s === 'paused' ? 'hunt.resumeBtn' : 'hunt.pauseBtn');
    var actions = el('action-panel');
    if (actions && actions.setAttribute) actions.setAttribute('data-enabled', (s === 'scanning') ? 'true' : 'false');
  }

  /* ---------------- 玩家动作 ----------------
   * 流程：scanning --(点 claim)--> scanning(已选中) --(VERIFY)--> verifying --> result
   *       scanning --(NO HALLUCINATION)--> verifying --> result
   * 「选中」只记录意图，**不进入 verifying、也不暴露对错**。 */
  function selectClaim(index) {
    if (game.state !== 'scanning') return false;
    var r = game.round;
    if (!r || !(index >= 0 && index < r.claims.length)) return false;
    var pos = game.selectedClaims.indexOf(index);
    if (pos >= 0) game.selectedClaims.splice(pos, 1);            // 再点一次 = 取消
    else { game.selectedClaims.push(index); game.selectedClaims.sort(function (a, b) { return a - b; }); }
    syncSelection();
    renderResponse(r, roundFullText(r).length, true);
    syncVerify();
    beep({ type: 'square', from: 520, to: 640, ms: 45, gain: 0.03 });
    return true;
  }

  /* marked 只是给旧调用方/测试看的镜像，判定一律用 selectedClaims */
  function syncSelection() {
    game.marked = game.selectedClaims.length ? game.selectedClaims[0] : -1;
  }
  function clearSelection() {
    game.selectedClaims = [];
    syncSelection();
  }
  function isSelected(i) {
    return game.selectedClaims.indexOf(i) >= 0;
  }
  function selectedList() {
    return game.selectedClaims.slice();
  }

  /* VERIFY：确认**当前选中的整组** claim；一条都没选就不允许 */
  function confirmSelection() {
    if (game.state !== 'scanning') return false;
    var r = game.round;
    if (!r || game.selectedClaims.length === 0) return false;
    game.noneMarked = false;
    var picked = game.selectedClaims[game.selectedClaims.length - 1];
    setState('verifying');
    game.verifyLeft = VERIFY_MS / 1000;
    if (fx) {
      /* 特效只作用在被核验的那些句子上，绝不盖住整段正文 */
      var anyHall = false;
      for (var k = 0; k < game.selectedClaims.length; k++) {
        var idx = game.selectedClaims[k];
        var box = claimBox(idx);
        var c0 = r.claims[idx];
        if (c0 && c0.isHallucination) anyHall = true;
        fx.scan(box.x, box.y, box.w, box.h, 620);
        if (c0 && c0.isHallucination) { fx.glitch(0.7); fx.rgbSplit(0.6); fx.burst(box.x + box.w / 2, box.y + box.h / 2, 18, '#7fe3f0'); }
        else { fx.flash('#d9534f', 0.16); fx.shake(4); fx.burst(box.x + box.w / 2, box.y + box.h / 2, 12, '#d9534f'); }
      }
    }
    beep({ type: 'square', from: 520, to: 900, ms: 140, gain: 0.05 });
    return true;
  }

  /* NO HALLUCINATION：直接确认「整段回答没有幻觉」，与 VERIFY 完全不同的语义 */
  function markNone() {
    if (game.state !== 'scanning') return false;
    if (!game.round) return false;
    clearSelection();
    game.noneMarked = true;      // 与「什么都没选就 VERIFY」是两回事（后者根本不允许）
    setState('verifying');
    game.verifyLeft = VERIFY_MS / 1000;
    if (fx) { var nb = fxBox(); fx.scan(0, nb.h * 0.18, nb.w, nb.h * 0.5, 620); fx.pulse(0.45); }
    beep({ type: 'triangle', from: 440, to: 660, ms: 120, gain: 0.045 });
    return true;
  }

  /* VERIFY 只有在 scanning 且真的选中了一条 claim 时才可用 */
  function syncVerify() {
    var v = el('btn-verify');
    if (!v || !v.setAttribute) return;
    var enabled = game.state === 'scanning' && game.selectedClaims.length > 0;
    v.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    if (enabled) { if (v.removeAttribute) v.removeAttribute('disabled'); }
    else v.setAttribute('disabled', '');
  }

  /* ---------------- 结算 ---------------- */
  function resolveRound(timedOut) {
    var r = game.round;
    if (!r) return;
    var outcome;
    var remainRatio = r.scanMs > 0 ? Math.max(0, game.scanLeft) * 1000 / r.scanMs : 0;

    /* exact-set 判定：玩家选择集合必须与真实幻觉集合**完全一致**
       —— 数量相同、索引相同、没有遗漏、没有误报。 */
    var truth = (r.hallucinationIndexes || []).slice().sort(function (a, b) { return a - b; });
    var picked = selectedList();
    var foundCount = 0;
    for (var q = 0; q < picked.length; q++) if (truth.indexOf(picked[q]) >= 0) foundCount++;
    var missedCount = truth.length - foundCount;         // 漏掉的幻觉条数
    var falseAlarmCount = picked.length - foundCount;    // 误选正确陈述的条数
    game.roundStats = { found: foundCount, total: truth.length, missed: missedCount, falseAlarm: falseAlarmCount };

    if (timedOut) outcome = 'missed';
    else if (game.noneMarked || picked.length === 0) {
      outcome = r.hallucinationCount === 0 ? 'clean' : 'missed';
    } else if (missedCount === 0 && falseAlarmCount === 0) outcome = 'hit';
    else if (missedCount > 0 && falseAlarmCount === 0) outcome = 'missed';
    else if (missedCount === 0 && falseAlarmCount > 0) outcome = 'falseAlarm';
    else outcome = 'mixed';

    var gained = 0;
    var success = (outcome === 'hit' || outcome === 'clean');
    if (success) {
      gained = Math.round(BASE_SCORE * multiplierFor(r.load, remainRatio, game.streak));
      game.streak++;
      if (game.streak > game.bestStreak) game.bestStreak = game.streak;
      game.correct++;
      if (fx) { var vb = verifierBox(); fx.burst(vb.x, vb.y - 18, 26, '#7fe3f0'); fx.float('+' + gained, vb.x, vb.y - 6, '#7fe3f0'); fx.pulse(0.45); }
    } else {
      game.streak = 0;
      game.lives--;
      if (fx) {
        fx.flash('#ff3355', 0.45); fx.shake(10);
        var fb = verifierBox();
        fx.float(outcome === 'falseAlarm' ? T('hunt.falseAlarm')
          : (outcome === 'mixed' ? T('hunt.mixed', 'FALSE ALARM + MISSED') : T('hunt.missed')), fb.x, fb.y - 6, '#ff8a8a');
      }
    }
    game.answered++;
    game.score += gained;

    /* 逐条标注：必须区分「找到」「漏掉」「误报」「正确且未选」四种 */
    for (var i = 0; i < r.claims.length; i++) {
      var c = r.claims[i];
      var isTruth = !!c.isHallucination;
      var wasPicked = isSelected(i);
      if (isTruth && wasPicked) c.__mark = 'hit';        // DETECTED
      else if (isTruth) c.__mark = 'missed';             // MISSED：玩家没找出来
      else if (wasPicked) c.__mark = 'picked';           // FALSE ALARM
      else c.__mark = 'ok';                              // 正确且未被选
    }

    var diff = game.difficulty;
    if (diff && game.mode !== 'daily') {
      diff.record({
        correct: success, reactionMs: (r.scanMs - game.scanLeft * 1000),
        falseAlarm: outcome === 'falseAlarm', missed: outcome === 'missed'
      });
    }

    game.lastOutcome = { outcome: outcome, gained: gained, round: r };
    setState('result');
    renderResponse(r, roundFullText(r).length, true);
    showResult(outcome, gained, r);
    updateHud();

    if (game.score > game.high) { game.high = game.score; writeNum(HIGH_KEY, game.high); }
    /* 刻意不在这里 endGame()：即使命数归零或 Daily 打完，也必须先停留在 result
       让玩家读完最后一次 FACT CHECK。推进由 advanceFromResult() 负责。 */
    game.resultSince = game.clock;
    syncNextAction();
  }

  function showResult(outcome, gained, r) {
    var title = el('overlay-title'), body = el('overlay-body');
    var map = {
      hit: ['hunt.detected', 'HALLUCINATION DETECTED'],
      clean: ['hunt.cleanRound', 'NO HALLUCINATION — CLEAN'],
      falseAlarm: ['hunt.falseAlarm', 'FALSE ALARM'],
      missed: ['hunt.missed', 'HALLUCINATION MISSED'],
      mixed: ['hunt.mixed', 'FALSE ALARM + MISSED']
    };
    var m = map[outcome] || map.missed;
    if (title) title.textContent = T(m[0], m[1]);
    var rows = [];
    function row(k, v, html) {
      if (!v) return;
      rows.push('<div class="fc-row"><span class="fc-k">' + escapeHtml(k) + '</span>' +
        '<span class="fc-v">' + (html || escapeHtml(v)) + '</span></div>');
    }
    var stats = game.roundStats || { found: 0, total: 0, missed: 0, falseAlarm: 0 };
    /* 「找到几条」：多幻觉轮次必须明确告诉玩家找漏了 */
    if (outcome !== 'clean' && stats.total > 0) {
      rows.push('<p class="fc-found' + (stats.found === stats.total && stats.falseAlarm === 0 ? '' : ' bad') + '">' +
        escapeHtml(T('hunt.foundCount', 'Detected {found} / {total} hallucinations')
          .replace('{found}', String(stats.found)).replace('{total}', String(stats.total))) + '</p>');
    } else if (stats.falseAlarm > 0) {
      rows.push('<p class="fc-found bad">' + escapeHtml(T('hunt.falseAlarm')) + '</p>');
    }
    /* 逐条展示**所有**幻觉；漏掉的明确标 MISSED，不能只显示第一条 */
    var hallNo = 0;
    for (var hi = 0; hi < r.claims.length; hi++) {
      var hc = r.claims[hi];
      if (!hc.isHallucination) continue;
      hallNo++;
      var got = isSelected(hi);
      rows.push('<div class="fc-hall' + (got ? '' : ' missed') + '">' +
        '<p class="fc-hall-k">' + escapeHtml((hallNo < 10 ? '0' : '') + hallNo + ' · ' +
          (got ? T('hunt.detectedTag', 'HALLUCINATION') : T('hunt.missedTag', 'MISSED'))) + '</p>' +
        '<div class="fc-row"><span class="fc-k">' + escapeHtml(T('hunt.modelSaid', 'Model said')) + '</span>' +
          '<span class="fc-v">' + escapeHtml(hc.text) + '</span></div>' +
        '<div class="fc-row"><span class="fc-k">' + escapeHtml(T('hunt.truth', 'Correct fact')) + '</span>' +
          '<span class="fc-v">' + escapeHtml(hc.canonical) + '</span></div>' +
        (hc.mutationType ? '<div class="fc-row"><span class="fc-k">' + escapeHtml(T('hunt.mutation', 'Mutation')) +
          '</span><span class="fc-v"><code>' + escapeHtml(hc.mutationType) + '</code></span></div>' : '') +
        '</div>');
    }
    if (r.explanation) row(T('hunt.note', 'Note'), r.explanation);
    if (r.source && r.source.name) {
      var srcHtml = r.source.url
        ? '<a href="' + escapeHtml(r.source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(r.source.name) + '</a>'
        : escapeHtml(r.source.name);
      row(T('hunt.source', 'Source'), r.source.name, srcHtml);
    }
    rows.push('<p class="fc-gain' + (gained > 0 ? '' : ' bad') + '">' +
      (gained > 0 ? '+' + gained : T('hunt.noScore', 'no score')) +
      (game.streak > 0 ? ' · ' + escapeHtml(T('hunt.streak')) + ' ×' + game.streak : '') + '</p>');
    if (body) body.innerHTML = rows.join('');
    var ov = el('overlay');
    if (ov && ov.setAttribute) ov.setAttribute('data-show', 'true');
    var liveMsg = {
      hit: T('hunt.liveDetected', 'Hallucination detected'),
      clean: T('hunt.liveClean', 'Round complete'),
      falseAlarm: T('hunt.liveFalseAlarm', 'False alarm'),
      missed: T('hunt.liveMissed', 'Hallucination missed')
    }[outcome];
    live(liveMsg + (game.lives < 3 ? ' · ' + T('hunt.lifeLost', 'Life lost') : ''));
    beep({ type: outcome === 'hit' || outcome === 'clean' ? 'square' : 'sawtooth',
      from: outcome === 'hit' ? 700 : 320, to: outcome === 'hit' ? 1200 : 140, ms: 220, gain: 0.05 });
  }

  function endGame() {
    setState('gameOver');
    writeNum(HIGH_KEY, game.high);
    if (game.mode === 'daily') {
      game.daily = { date: RNG.todayString(), score: game.score, correct: game.correct,
        total: game.answered, bestStreak: game.bestStreak };
      writeJson(DAILY_KEY, game.daily);
    }
    var ov = el('overlay');
    if (ov && ov.setAttribute) ov.setAttribute('data-show', 'true');
    setText('overlay-title', T('hunt.sessionSummary', 'Session summary'));
    var body = el('overlay-body');
    if (body) {
      var srows = [];
      function srow(k, v) {
        srows.push('<div class="fc-row"><span class="fc-k">' + escapeHtml(k) + '</span>' +
          '<span class="fc-v">' + escapeHtml(String(v)) + '</span></div>');
      }
      srow(T('hunt.finalScore', 'Final score'), game.score);
      srow(T('hunt.accuracy', 'ACCURACY'), accuracyPct() + '%');
      srow(T('hunt.bestStreak', 'Best streak'), '×' + game.bestStreak);
      srow(T('hunt.rounds', 'Rounds'), game.answered);
      if (game.mode === 'daily') srow(T('hunt.mode', 'Mode'), T('hunt.dailyBtn'));
      srows.push('<p class="fc-gain">' + escapeHtml(shareText().split('\n')[0]) + '</p>');
      body.innerHTML = srows.join('');
    }
    live(T('hunt.gameOver', 'Game over'));
    beep({ type: 'sawtooth', from: 320, to: 90, ms: 480, gain: 0.055 });
  }

  function accuracyPct() { return game.answered ? Math.round(game.correct / game.answered * 100) : 0; }

  /* ---------------- HUD ---------------- */
  var hudCache = {};
  function updateHud() {
    var v = {
      'hud-score': game.score, 'hud-high': game.high, 'hud-accuracy': accuracyPct() + '%',
      'hud-streak': '×' + game.streak, 'hud-lives': game.lives,
      'hud-load': game.round ? 'LOAD ' + game.round.load : 'LOAD 1',
      'hud-round': (game.mode === 'daily' ? game.roundIndex + '/' + DAILY_ROUNDS : '#' + game.roundIndex)
    };
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (hudCache[k] === v[k]) continue;
      hudCache[k] = v[k];
      setText(k, v[k]);
    }
    var acc = el('hud-accuracy');
    if (acc) acc.setAttribute('data-accuracy', accuracyPct());
  }

  /* ---------------- 主循环 ---------------- */
  var lastTs = 0;
  function frame(now) {
    var ts = typeof now === 'number' ? now : 0;
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
    lastTs = ts;
    step(dt);
    render();
    raf(frame);
  }
  function raf(fn) {
    /* requestAnimationFrame 可能只挂在全局、而不是 window 上（测试桩就是这样） */
    if (typeof global.requestAnimationFrame === 'function') { global.requestAnimationFrame(fn); return true; }
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(fn); return true; }
    return false;
  }

  function step(dt) {
    if (!(dt > 0)) return;
    if (game.state === 'paused') return;         // 全冻结：计时、特效、角色时钟都不动
    game.clock += dt * 1000;
    if (fx) fx.update(dt);

    if (game.state === 'streaming') {
      game.streamElapsed += dt * 1000;
      var full = roundFullText(game.round);
      var vis = visibleCharsFor(full, game.streamElapsed);
      if (vis !== game.visibleChars) {
        game.visibleChars = vis;
        renderResponse(game.round, vis, vis >= full.length);
      }
      if (vis >= full.length) {
        setState('scanning');
        game.scanLeft = (game.round ? game.round.scanMs : 15000) / 1000;
        renderResponse(game.round, full.length, true);
        var resp = el('response');
        if (resp) resp.setAttribute('aria-busy', 'false');
        live(T('hunt.liveScanning', 'Response complete. Find the hallucination.'));
      }
      return;
    }

    if (game.state === 'scanning') {
      game.scanLeft -= dt;
      if (game.scanLeft <= 0) { game.scanLeft = 0; game.marked = -1; resolveRound(true); }
      return;
    }
    if (game.state === 'verifying') {
      game.verifyLeft -= dt;
      if (game.verifyLeft <= 0) { resolveRound(false); updateHud(); }
      return;
    }
    /* result 没有计时器：FACT CHECK 无限停留，直到玩家点「下一题 / 查看结果」。
       SCAN 计时在 resolveRound 时就已停住，所以阅读时长不可能进入 reactionMs。 */
  }

  function render() {
    if (!renderer && !fx) return;
    var hint = game.round ? game.round.mutationHint : null;
    var charState = 'idle';
    if (game.state === 'streaming') charState = 'think';
    else if (game.state === 'scanning') charState = 'idle';
    else if (game.state === 'result' && game.lastOutcome) {
      /* result 现在会停很久：先播 2.2s 反应，之后自然回到 idle，
         避免玩家长时间阅读时角色一直重复跳跃 / 受惊。
         只在 Hunt 自己的 scene 里处理，不动 shared/character.js。 */
      var settled = game.resultSince >= 0 && (game.clock - game.resultSince) > 2200;
      charState = settled ? 'idle'
        : ((game.lastOutcome.outcome === 'hit' || game.lastOutcome.outcome === 'clean') ? 'correct' : 'startle');
    } else if (game.state === 'gameOver') charState = 'blocked';
    var v = characterBox();
    var scene = {
      time: game.clock, charState: charState, charSize: v.size,
      charX: v.x, charY: v.y, glow: fx ? fx.state().pulse : 0
    };
    /* Canvas 退居辅助层：不再铺满深色背景场，只画 verifier 角色 */
    if (renderer) renderer.draw(scene, { field: false });
    if (fx) fx.drawOverlay(null);
    updateTimerBar();
  }

  function updateTimerBar() {
    var bar = el('scan-bar');
    if (!bar) return;
    var ratio = 0;
    if (game.state === 'scanning' && game.round) ratio = Math.max(0, game.scanLeft * 1000 / game.round.scanMs);
    else if (game.state === 'streaming') ratio = 1;
    bar.style.width = Math.round(ratio * 100) + '%';
  }

  /* ---------------- 控制 ---------------- */
  function start(mode, seedOverride) {
    game.mode = mode === 'daily' ? 'daily' : 'endless';
    game.score = 0; game.lives = 3; game.streak = 0; game.bestStreak = 0;
    game.answered = 0; game.correct = 0; game.roundIndex = 0;
    game.clock = 0;
    var seed;
    if (seedOverride !== undefined && seedOverride !== null) {
      seed = RNG.hashString ? RNG.hashString(String(seedOverride)) : (seedOverride >>> 0);
      if (typeof seedOverride === 'number') seed = seedOverride >>> 0;
    } else if (game.mode === 'daily') {
      seed = RNG.fromDate(RNG.todayString());
      game.dailySeed = seed;
    } else {
      /* 无限模式的 seed 取当前时间；**生成器内部一次都不调用 Math.random()** */
      seed = Date.now() >>> 0;
    }
    game.session = GEN.createSession(seed, I18N ? I18N.lang : 'zh');
    game.difficulty = DIFF.create({ startLoad: 1 });
    hudCache = {};
    updateHud();
    var ov = el('overlay');
    if (ov && ov.setAttribute) ov.setAttribute('data-show', 'false');
    nextRound();
  }

  function togglePause(force) {
    if (game.state === 'gameOver' || game.state === 'intro') return game.state;
    var want = force === undefined ? game.state !== 'paused' : !!force;
    if (want && game.state !== 'paused') { game.__resume = game.state; setState('paused'); }
    else if (!want && game.state === 'paused') { setState(game.__resume || 'scanning'); }
    /* aria-live 播报：暂停 / 恢复各播一次，但不抢焦点（从外部链接回来时焦点行为要正常） */
    live(game.state === 'paused' ? T('hunt.livePaused', 'Hunt paused') : T('hunt.liveResumed', 'Hunt resumed'));
    return game.state;
  }

  function copyResult() {
    var text = shareText();
    var done = function (okFlag) {
      live(okFlag ? T('hunt.copied', 'Result copied') : T('hunt.copyFailed', 'Copy unavailable — select the text below'));
      var out = el('share-out');
      if (out && !okFlag) out.textContent = text;
    };
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        var p = global.navigator.clipboard.writeText(text);
        if (p && p.then) { p.then(function () { done(true); }, function () { done(legacyCopy(text)); }); return true; }
        done(true); return true;
      }
    } catch (e) { /* 继续走 fallback */ }
    done(legacyCopy(text));
    return false;
  }
  function legacyCopy(text) {
    try {
      var ta = el('share-out');
      if (!ta || !ta.select || !document.execCommand) return false;
      ta.value = text; ta.select();
      return !!document.execCommand('copy');
    } catch (e) { return false; }
  }
  function shareText() {
    var d = game.daily || { date: RNG.todayString(), score: game.score, correct: game.correct,
      total: game.answered, bestStreak: game.bestStreak };
    var total = d.total || DAILY_ROUNDS;
    var filled = Math.round((d.correct || 0) / Math.max(1, total) * 10);
    var blocks = '';
    for (var i = 0; i < 10; i++) blocks += i < filled ? '█' : '░';
    return 'HALLUCINATION HUNT #' + String(d.date || '').replace(/-/g, '') + '\n\n' +
      blocks + ' ' + (d.correct || 0) + '/' + total + '\n' +
      'Accuracy ' + accuracyPct() + '%\n' +
      'Best Streak ×' + game.bestStreak + '\n' +
      'Score ' + game.score;
  }

  /* ---------------- 输入 ---------------- */
  function keyOf(e) { return (e && (e.code || e.key)) || ''; }
  function onKeyDown(e) {
    var k = keyOf(e);
    if (k === 'KeyP' || k === 'p' || k === 'P') { if (e && e.preventDefault) e.preventDefault(); togglePause(); updateHud(); return; }
    if (k === 'KeyM' || k === 'm' || k === 'M') { if (Audio && Audio.toggle) { Audio.toggle(); syncSound(); } return; }
    if (k === 'KeyN' || k === 'n' || k === 'N') { markNone(); return; }
    if (k === 'Space' || k === ' ' || k === 'Enter') {
      if (game.state === 'intro') { if (e && e.preventDefault) e.preventDefault(); start('endless'); }
      else if (game.state === 'gameOver') { if (e && e.preventDefault) e.preventDefault(); start(game.mode); }
      else if (game.state === 'result') {
        /* 焦点落在链接 / 按钮 / 可编辑元素上时不拦截，
           保留浏览器原生行为（例如用键盘打开 Source 链接）。 */
        var ae = document.activeElement;
        var tag = ae && ae.tagName ? String(ae.tagName).toLowerCase() : '';
        if (tag === 'a' || tag === 'button' || (ae && ae.isContentEditable)) return;
        if (e && e.preventDefault) e.preventDefault();
        advanceFromResult();
      }
    }
  }
  function wireClicks() {
    var resp = el('response');
    if (resp && resp.addEventListener) {
      resp.addEventListener('click', function (e) {
        var t = e && e.target;
        while (t && t.getAttribute && !t.getAttribute('data-claim')) t = t.parentNode;
        if (t && t.getAttribute) selectClaim(parseInt(t.getAttribute('data-claim'), 10));
      });
    }
    var none = el('btn-none'); if (none && none.addEventListener) none.addEventListener('click', function () { markNone(); });
    var verify = el('btn-verify'); if (verify && verify.addEventListener) verify.addEventListener('click', function () {
      confirmSelection();          // VERIFY 只确认当前选中的 claim，绝不等于 NO HALLUCINATION
    });
    var startBtn = el('btn-start'); if (startBtn && startBtn.addEventListener) startBtn.addEventListener('click', function () { start('endless'); });
    var dailyBtn = el('btn-daily'); if (dailyBtn && dailyBtn.addEventListener) dailyBtn.addEventListener('click', function () { start('daily'); });
    var again = el('btn-again'); if (again && again.addEventListener) again.addEventListener('click', function () { start(game.mode); });
    var copy = el('btn-copy'); if (copy && copy.addEventListener) copy.addEventListener('click', function () { copyResult(); });
    var pause = el('btn-pause'); if (pause && pause.addEventListener) pause.addEventListener('click', function () { togglePause(); });
    /* 主区暂停卡里的「继续」只是另一个入口，仍然调用同一个 togglePause(false) */
    var resumeMain = el('btn-resume-main');
    if (resumeMain && resumeMain.addEventListener) resumeMain.addEventListener('click', function () { togglePause(false); });
    var nextBtn = el('btn-next');
    if (nextBtn && nextBtn.addEventListener) nextBtn.addEventListener('click', function () { advanceFromResult(); });
    var snd = el('sound'); if (snd && snd.addEventListener) snd.addEventListener('click', function () { if (Audio && Audio.toggle) Audio.toggle(); syncSound(); });
  }
  /* 这些状态不参与「失焦自动暂停」 */
  var NO_AUTO_PAUSE = { paused: true, intro: true, gameOver: true, result: true };

  function syncSound() {
    var b = el('sound');
    if (!b) return;
    var on = soundOn();
    b.textContent = T(on ? 'btn.sound' : 'btn.muted');
    /* 与另外五款一致：aria-pressed 必须跟着状态走（无障碍要求） */
    if (b.setAttribute) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    setupCanvas();
    wireClicks();
    syncSound();
    updateHud();
    setState('intro');
    if (I18N && I18N.onChange) {
      I18N.onChange(function () {
        syncSound();
        /* 语言变了：用同一 seed 重新生成当前 round，保证同一题两种语言都成立 */
        if (game.round && game.session && game.state !== 'intro' && game.state !== 'gameOver') {
          var load = game.round.load;
          var again = GEN.generateRound(game.session.seed + game.roundIndex, load, I18N.lang);
          if (again) { game.round = again; clearSelection(); game.streamElapsed = 0; game.visibleChars = -1; setState('streaming'); renderRound(); }
        }
        updateHud();
      });
    }
    if (global.addEventListener) {
      /* result 绝不能因失焦暂停：玩家点 Source 会开新标签页、必然触发 blur，
         回来后必须还看到同一张 FACT CHECK。 */
      global.addEventListener('blur', function () { if (!NO_AUTO_PAUSE[game.state]) togglePause(true); });
    }
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && !NO_AUTO_PAUSE[game.state]) togglePause(true);
      });
      document.addEventListener('keydown', onKeyDown);
    }
    render();
    raf(frame);
  }

  game.__test = {
    T: T, STATES: STATES, HIGH_KEY: HIGH_KEY, DAILY_KEY: DAILY_KEY,
    multiplierFor: multiplierFor, visibleCharsFor: visibleCharsFor, charCost: charCost,
    shareText: shareText, accuracyPct: accuracyPct,
    CHARS_PER_SEC: CHARS_PER_SEC, BASE_SCORE: BASE_SCORE, MAX_MULT: MAX_MULT,
    DAILY_ROUNDS: DAILY_ROUNDS, VERIFY_MS: VERIFY_MS
  };
  global.HuntGame = {
    game: game,
    start: start, pause: function () { return togglePause(true); }, resume: function () { return togglePause(false); },
    selectClaim: selectClaim, toggleClaim: selectClaim, confirm: confirmSelection, markNone: markNone,
    selectedClaims: selectedList, roundStats: function () { return game.roundStats || null; },
    /* 兼容旧调用：markClaim 现在等价于「选中」，不再直接进入 verifying */
    markClaim: selectClaim,
    syncSize: syncSize, hasResizeObserver: function () { return !!resizeObserver; },
    characterBox: characterBox, characterAnchor: characterAnchor,
    copyResult: copyResult, shareText: shareText,
    nextRound: nextRound, setState: setState, updateHud: updateHud,
    isReducedMotion: function () { return reducedMotion; },
    effects: function () { return fx; }, renderer: function () { return renderer; }
  };

  if (document.readyState === 'loading' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
