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
  var RESULT_MS = 1600;
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
    marked: -1,
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
  var backdrop = null, overlay = null;
  var renderer = null, fx = null;
  var reducedMotion = false;

  function prefersReduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function setupCanvas() {
    backdrop = document.getElementById('game');
    overlay = document.getElementById('fx');
    var dpr = Math.max(1, Math.min(global.devicePixelRatio || 1, 3));
    var w = 640, h = 420;
    var shell = document.getElementById('game-shell');
    if (shell && shell.getBoundingClientRect) {
      var r = shell.getBoundingClientRect();
      if (r && r.width) { w = Math.round(r.width); h = Math.round(r.height); }
    }
    reducedMotion = prefersReduced();
    if (backdrop && REND) {
      renderer = REND.create(backdrop, { reducedMotion: reducedMotion });
      renderer.resize(w, h, dpr);
    }
    if (overlay && FX) {
      fx = FX.create(overlay, { reducedMotion: reducedMotion, glitchSource: backdrop });
      fx.resize(w, h, dpr);
    }
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
    game.marked = -1;
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
      var mark = '';
      if (round.claims[i].__mark === 'hit') { cls += ' hit'; mark = ' <span class="tag">HALLUCINATION</span>'; }
      else if (round.claims[i].__mark === 'ok') { cls += ' ok'; mark = ' <span class="tag">VERIFIED</span>'; }
      else if (round.claims[i].__mark === 'picked') { cls += ' picked'; mark = ' <span class="tag">FALSE ALARM</span>'; }
      out.push('<button type="button" class="' + cls + '" data-claim="' + i + '"' +
        (revealed ? '' : ' disabled') + '>' + escapeHtml(text) + mark + '</button>');
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
    result: [],
    paused: [],
    gameOver: ['btn-again', 'btn-copy']
  };
  var ALL_ACTIONS = ['btn-none', 'btn-verify', 'btn-start', 'btn-daily', 'btn-again', 'btn-copy'];
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
    var shell = el('game-shell');
    if (shell && shell.setAttribute) shell.setAttribute('data-state', s);
    var pause = el('btn-pause');
    if (pause) pause.textContent = T(s === 'paused' ? 'hunt.resumeBtn' : 'hunt.pauseBtn');
    var actions = el('action-panel');
    if (actions && actions.setAttribute) actions.setAttribute('data-enabled', (s === 'scanning') ? 'true' : 'false');
  }

  /* ---------------- 玩家动作 ---------------- */
  function markClaim(index) {
    if (game.state !== 'scanning') return false;
    var r = game.round;
    if (!r || !(index >= 0 && index < r.claims.length)) return false;
    game.marked = index;
    setState('verifying');
    game.verifyLeft = VERIFY_MS / 1000;
    var c = r.claims[index];
    if (fx) {
      fx.scan(0, 60, 640, 240, 620);
      if (c.isHallucination) { fx.glitch(1); fx.rgbSplit(1); fx.burst(320, 180, 26, '#7fe3f0'); }
      else { fx.flash('#ff3355', 0.4); fx.shake(9); fx.burst(320, 180, 16, '#ff3355'); }
    }
    beep({ type: c.isHallucination ? 'square' : 'sawtooth', from: c.isHallucination ? 700 : 300, to: c.isHallucination ? 1100 : 160, ms: 140, gain: 0.05 });
    return true;
  }

  function markNone() {
    if (game.state !== 'scanning') return false;
    game.marked = -1;
    setState('verifying');
    game.verifyLeft = VERIFY_MS / 1000;
    if (fx) { fx.scan(0, 60, 640, 240, 620); fx.pulse(0.6); }
    beep({ type: 'triangle', from: 440, to: 660, ms: 120, gain: 0.045 });
    return true;
  }

  /* ---------------- 结算 ---------------- */
  function resolveRound(timedOut) {
    var r = game.round;
    if (!r) return;
    var outcome, hitIndex = -1;
    var remainRatio = r.scanMs > 0 ? Math.max(0, game.scanLeft) * 1000 / r.scanMs : 0;

    if (timedOut) outcome = 'missed';
    else if (game.marked >= 0) {
      hitIndex = game.marked;
      outcome = r.claims[game.marked].isHallucination ? 'hit' : 'falseAlarm';
    } else {
      outcome = r.hallucinationCount === 0 ? 'clean' : 'missed';
    }

    var gained = 0;
    var success = (outcome === 'hit' || outcome === 'clean');
    if (success) {
      gained = Math.round(BASE_SCORE * multiplierFor(r.load, remainRatio, game.streak));
      game.streak++;
      if (game.streak > game.bestStreak) game.bestStreak = game.streak;
      game.correct++;
      if (fx) { fx.burst(320, 150, 30, '#7fe3f0'); fx.float('+' + gained, 320, 140, '#7fe3f0'); fx.pulse(0.5); }
    } else {
      game.streak = 0;
      game.lives--;
      if (fx) {
        fx.flash('#ff3355', 0.45); fx.shake(10);
        fx.float(outcome === 'falseAlarm' ? T('hunt.falseAlarm') : T('hunt.missed'), 320, 150, '#ff8a8a');
      }
    }
    game.answered++;
    game.score += gained;

    /* 标注每条 claim 的结果 */
    for (var i = 0; i < r.claims.length; i++) {
      var c = r.claims[i];
      c.__mark = '';
      if (c.isHallucination) c.__mark = 'hit';
      else if (i === hitIndex) c.__mark = 'picked';
      else if (outcome === 'clean') c.__mark = 'ok';
    }

    var diff = game.difficulty;
    if (diff && game.mode !== 'daily') {
      diff.record({
        correct: success, reactionMs: (r.scanMs - game.scanLeft * 1000),
        falseAlarm: outcome === 'falseAlarm', missed: outcome === 'missed'
      });
    }

    game.lastOutcome = { outcome: outcome, gained: gained, round: r };
    game.resultLeft = RESULT_MS / 1000;
    setState('result');
    renderResponse(r, roundFullText(r).length, true);
    showResult(outcome, gained, r);
    updateHud();

    if (game.score > game.high) { game.high = game.score; writeNum(HIGH_KEY, game.high); }
    if (game.lives <= 0) { game.lives = 0; endGame(); return; }
    if (game.mode === 'daily' && game.roundIndex >= DAILY_ROUNDS) { endGame(); return; }
  }

  function showResult(outcome, gained, r) {
    var title = el('overlay-title'), body = el('overlay-body');
    var map = {
      hit: ['hunt.detected', 'HALLUCINATION DETECTED'],
      clean: ['hunt.cleanRound', 'NO HALLUCINATION — CLEAN'],
      falseAlarm: ['hunt.falseAlarm', 'FALSE ALARM'],
      missed: ['hunt.missed', 'HALLUCINATION MISSED']
    };
    var m = map[outcome] || map.missed;
    if (title) title.textContent = T(m[0], m[1]);
    var detail = r.explanation || '';
    var truth = r.claims.filter(function (c) { return c.isHallucination; })
      .map(function (c) { return c.mutationType + ': ' + (c.original || '—') + ' → ' + c.replacement; }).join(' · ');
    if (body) {
      body.innerHTML = '<p class="ov-line">' + escapeHtml(detail) + '</p>' +
        (truth ? '<p class="ov-truth">' + escapeHtml(truth) + '</p>' : '') +
        '<p class="ov-gain">' + (gained > 0 ? '+' + gained : '—') + '</p>';
    }
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
    setText('overlay-title', T('hunt.gameOver', 'GAME OVER'));
    var body = el('overlay-body');
    if (body) {
      body.innerHTML = '<p class="ov-line">' + escapeHtml(T('hunt.finalScore', 'Final score')) + ' ' + game.score + '</p>' +
        '<p class="ov-line">' + escapeHtml(T('hunt.accuracy', 'ACCURACY')) + ' ' + accuracyPct() + '%</p>' +
        '<p class="ov-line">' + escapeHtml(T('hunt.bestStreak', 'Best streak')) + ' ×' + game.bestStreak + '</p>';
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
    if (game.state === 'result') {
      game.resultLeft -= dt;
      if (game.resultLeft <= 0) {
        var ov = el('overlay');
        if (ov && ov.setAttribute) ov.setAttribute('data-show', 'false');
        if (game.mode === 'daily' && game.roundIndex >= DAILY_ROUNDS) endGame();
        else nextRound();
      }
    }
  }

  function render() {
    if (!renderer && !fx) return;
    var hint = game.round ? game.round.mutationHint : null;
    var charState = 'idle';
    if (game.state === 'streaming') charState = 'think';
    else if (game.state === 'scanning') charState = 'idle';
    else if (game.state === 'result' && game.lastOutcome) {
      charState = (game.lastOutcome.outcome === 'hit' || game.lastOutcome.outcome === 'clean') ? 'correct' : 'startle';
    } else if (game.state === 'gameOver') charState = 'blocked';
    var scene = {
      time: game.clock, charState: charState, charSize: 96,
      charX: 320, charY: 400, glow: fx ? fx.state().pulse : 0
    };
    if (renderer) renderer.draw(scene);
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
    live(game.state === 'paused' ? T('hunt.paused', 'Paused') : '');
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
    }
  }
  function wireClicks() {
    var resp = el('response');
    if (resp && resp.addEventListener) {
      resp.addEventListener('click', function (e) {
        var t = e && e.target;
        while (t && t.getAttribute && !t.getAttribute('data-claim')) t = t.parentNode;
        if (t && t.getAttribute) markClaim(parseInt(t.getAttribute('data-claim'), 10));
      });
    }
    var none = el('btn-none'); if (none && none.addEventListener) none.addEventListener('click', function () { markNone(); });
    var verify = el('btn-verify'); if (verify && verify.addEventListener) verify.addEventListener('click', function () {
      if (game.state === 'scanning') markNone();
    });
    var startBtn = el('btn-start'); if (startBtn && startBtn.addEventListener) startBtn.addEventListener('click', function () { start('endless'); });
    var dailyBtn = el('btn-daily'); if (dailyBtn && dailyBtn.addEventListener) dailyBtn.addEventListener('click', function () { start('daily'); });
    var again = el('btn-again'); if (again && again.addEventListener) again.addEventListener('click', function () { start(game.mode); });
    var copy = el('btn-copy'); if (copy && copy.addEventListener) copy.addEventListener('click', function () { copyResult(); });
    var pause = el('btn-pause'); if (pause && pause.addEventListener) pause.addEventListener('click', function () { togglePause(); });
    var snd = el('sound'); if (snd && snd.addEventListener) snd.addEventListener('click', function () { if (Audio && Audio.toggle) Audio.toggle(); syncSound(); });
  }
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
          if (again) { game.round = again; game.marked = -1; game.streamElapsed = 0; game.visibleChars = -1; setState('streaming'); renderRound(); }
        }
        updateHud();
      });
    }
    if (global.addEventListener) {
      global.addEventListener('blur', function () { if (game.state !== 'paused' && game.state !== 'intro' && game.state !== 'gameOver') togglePause(true); });
    }
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && game.state !== 'paused' && game.state !== 'intro' && game.state !== 'gameOver') togglePause(true);
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
    DAILY_ROUNDS: DAILY_ROUNDS, VERIFY_MS: VERIFY_MS, RESULT_MS: RESULT_MS
  };
  global.HuntGame = {
    game: game,
    start: start, pause: function () { return togglePause(true); }, resume: function () { return togglePause(false); },
    markClaim: markClaim, markNone: markNone, copyResult: copyResult, shareText: shareText,
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
