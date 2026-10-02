/* 测试用的无头运行环境：桩 DOM + 桩 Canvas，把页面脚本跑起来。
 * 不依赖浏览器、不依赖任何 npm 包。
 *
 * DeepSeek Arcade 有三个页面（大厅 / Whale Runner / Context Snake），
 * 它们共用同一套 harness：opts.page 决定加载哪些脚本、铺哪些 DOM 元素。 */
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));   // 仓库根目录

export function source(name) {
  return fs.readFileSync(ROOT + name, 'utf8');
}

export const SHARED_I18N = 'shared/i18n.js';
/* 每个页面都会先加载的共享脚本（顺序与真实 HTML 一致） */
export const SHARED_PRELUDE = ['shared/i18n.js', 'shared/audio.js', 'shared/whale.js', 'shared/character.js',
  'shared/input.js'];

/* 每个页面真正存在的元素（与各自的 index.html 对应） */
const PAGES = {
  runner: {
    scripts: ['games/runner/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'app.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'h1' } },
      { attrs: { 'data-i18n': 'sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'canvas.aria' } },
      { id: 'jump', tag: 'button', attrs: { 'data-i18n': 'btn.jump' } },
      { id: 'duck', tag: 'button', attrs: { 'data-i18n': 'btn.dive' } },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { id: 'fullscreen' },
      { attrs: { 'data-i18n-html': 'tips' } },
      { attrs: { 'data-i18n': 'canvas.rotateHint' } },
    ],
  },
  snake: {
    scripts: ['games/snake/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'snake.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'snake.h1' } },
      { attrs: { 'data-i18n': 'snake.sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'snake.aria' } },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { id: 'up', tag: 'button', attrs: { 'data-i18n-aria': 'snake.ariaUp' } },
      { id: 'down', attrs: { 'data-i18n-aria': 'snake.ariaDown' } },
      { id: 'left', attrs: { 'data-i18n-aria': 'snake.ariaLeft' } },
      { id: 'right', attrs: { 'data-i18n-aria': 'snake.ariaRight' } },
      { attrs: { 'data-i18n-html': 'snake.tips' } },
    ],
  },
  tokenfall: {
    scripts: ['games/token-fall/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'tokenfall.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'tokenfall.h1' } },
      { attrs: { 'data-i18n': 'tokenfall.sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'tokenfall.aria' } },
      { id: 'left', attrs: { 'data-i18n-aria': 'tokenfall.ariaLeft' } },
      { id: 'right', attrs: { 'data-i18n-aria': 'tokenfall.ariaRight' } },
      { id: 'pause', tag: 'button' },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { attrs: { 'data-i18n-html': 'tokenfall.tips' } },
    ],
  },
  attentionmaze: {
    scripts: ['games/attention-maze/levels.js', 'games/attention-maze/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'maze.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'maze.h1' } },
      { attrs: { 'data-i18n': 'maze.sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'maze.aria' } },
      { id: 'pad' },
      { id: 'up', tag: 'button', attrs: { 'data-i18n-aria': 'maze.ariaUp' } },
      { id: 'down', tag: 'button', attrs: { 'data-i18n-aria': 'maze.ariaDown' } },
      { id: 'left', tag: 'button', attrs: { 'data-i18n-aria': 'maze.ariaLeft' } },
      { id: 'right', tag: 'button', attrs: { 'data-i18n-aria': 'maze.ariaRight' } },
      { id: 'playbar' },
      { id: 'pause', tag: 'button' },
      { id: 'rescan', tag: 'button' },
      { id: 'restart', tag: 'button', attrs: { 'data-i18n': 'maze.restartBtn' } },
      { id: 'menu', tag: 'button', attrs: { 'data-i18n': 'maze.menuBtn' } },
      { id: 'reset', tag: 'button' },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { attrs: { 'data-i18n-html': 'maze.tips' } },
    ],
  },
  contextbreaker: {
    scripts: ['games/context-breaker/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'breaker.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'breaker.h1' } },
      { attrs: { 'data-i18n': 'breaker.sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'breaker.aria' } },
      { id: 'left', tag: 'button', attrs: { 'data-i18n-aria': 'breaker.ariaLeft' } },
      { id: 'right', tag: 'button', attrs: { 'data-i18n-aria': 'breaker.ariaRight' } },
      { id: 'launch', tag: 'button', attrs: { 'data-i18n-aria': 'breaker.ariaLaunch' } },
      { id: 'pause', attrs: { 'data-i18n': 'breaker.pauseBtn' } },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { attrs: { 'data-i18n-html': 'breaker.tips' } },
    ],
  },
  hunt: {
    scripts: ['games/hallucination-hunt/rng.js', 'games/hallucination-hunt/content.js',
      'games/hallucination-hunt/mutators.js', 'games/hallucination-hunt/generator.js',
      'games/hallucination-hunt/difficulty.js', 'games/hallucination-hunt/effects.js',
      'games/hallucination-hunt/renderer.js', 'games/hallucination-hunt/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'hunt.title' } },
      { id: 'back', tag: 'a', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'hunt.h1' } },
      { attrs: { 'data-i18n': 'hunt.sub' } },
      { id: 'game-shell' },
      { id: 'game-shell-aside', attrs: { 'data-open': 'false' } },
      { id: 'game', tag: 'canvas' },
      { id: 'fx', tag: 'canvas' },
      { id: 'hud' },
      { id: 'hud-score' }, { id: 'hud-high' }, { id: 'hud-accuracy' }, { id: 'hud-streak' },
      { id: 'hud-load' }, { id: 'hud-lives' }, { id: 'hud-round' },
      { id: 'query-text' },
      { id: 'confidence-bar' }, { id: 'confidence-value' },
      { id: 'response', attrs: { 'data-i18n-aria': 'hunt.responseAria' } },
      { id: 'action-panel' },
      { id: 'btn-none', attrs: { 'data-i18n': 'hunt.noHallucination' } },
      { id: 'btn-verify', attrs: { 'data-i18n': 'hunt.verify' } },
      { id: 'btn-start', tag: 'button', attrs: { 'data-i18n': 'hunt.startBtn' } },
      { id: 'btn-daily', tag: 'button', attrs: { 'data-i18n': 'hunt.dailyBtn' } },
      { id: 'btn-again', attrs: { 'data-i18n': 'hunt.againBtn' } },
      { id: 'btn-copy', attrs: { 'data-i18n': 'hunt.copyBtn' } },
      { id: 'btn-next', attrs: { 'data-final': 'false' } },
      { id: 'scan-bar' },
      { id: 'btn-pause', attrs: { 'data-i18n': 'hunt.pauseBtn' } },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { id: 'overlay', attrs: { 'data-show': 'false' } },
      { id: 'overlay-title' }, { id: 'overlay-body' },
      { id: 'status' },
      { id: 'share-out', tag: 'textarea' },
      { id: 'verifier-stage' },
      { id: 'intro-character-stage' },
      { id: 'btn-menu', attrs: { 'aria-expanded': 'false' } },
      { id: 'sheet-scrim', attrs: { hidden: '' } },
      { id: 'hud-mini-score' }, { id: 'hud-mini-accuracy' },
      { id: 'hud-mini-streak' }, { id: 'hud-mini-lives' }, { id: 'bar-load' },
      { id: 'pause-overlay', attrs: { role: 'dialog' } },
      { id: 'btn-resume-main', attrs: { 'data-i18n': 'hunt.resumeBtn' } },
      { attrs: { 'data-i18n-html': 'hunt.tips' } },
    ],
  },
  lobby: {
    scripts: ['arcade.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'lobby.title' } },
      { attrs: { 'data-i18n': 'lobby.title' } },
      { attrs: { 'data-i18n': 'lobby.sub' } },
      { id: 'lang' },
      { id: 'sound', tag: 'button' },
      { id: 'skin' },
      { attrs: { 'data-i18n': 'lobby.whale.name' } },
      { attrs: { 'data-i18n': 'lobby.whale.desc' } },
      { attrs: { 'data-i18n': 'lobby.snake.name' } },
      { attrs: { 'data-i18n': 'lobby.snake.desc' } },
      { attrs: { 'data-i18n': 'lobby.tokenfall.name' } },
      { attrs: { 'data-i18n': 'lobby.tokenfall.desc' } },
      { attrs: { 'data-i18n': 'lobby.maze.name' } },
      { attrs: { 'data-i18n': 'lobby.maze.desc' } },
      { attrs: { 'data-i18n': 'lobby.breaker.name' } },
      { attrs: { 'data-i18n': 'lobby.breaker.desc' } },
      { attrs: { 'data-i18n': 'lobby.hunt.name' } },
      { attrs: { 'data-i18n': 'lobby.hunt.desc' } },
      { attrs: { 'data-i18n': 'lobby.bestLayer' } },
      { attrs: { 'data-i18n': 'lobby.more' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n-html': 'lobby.footer' } },
      { attrs: { 'data-highscore': 'runner' } },
      { attrs: { 'data-highscore': 'snake' } },
      { attrs: { 'data-highscore': 'tokenFall' } },
      { attrs: { 'data-highscore': 'maze' } },
      { attrs: { 'data-highscore': 'breaker' } },
      { attrs: { 'data-highscore': 'hallucinationHunt' } },
      { id: 'preview-runner', tag: 'canvas' },
      { id: 'preview-snake', tag: 'canvas' },
      { id: 'preview-tokenfall', tag: 'canvas' },
      { id: 'preview-maze', tag: 'canvas' },
      { id: 'preview-breaker', tag: 'canvas' },
      { id: 'preview-hunt', tag: 'canvas' },
    ],
  },
};

export function harness(opts) {
  opts = opts || {};
  const pageName = opts.page || 'runner';
  const page = PAGES[pageName];
  if (!page) throw new Error('未知页面: ' + pageName);

  const px = opts.px === undefined ? 3 : opts.px;
  const log = { texts: [], rects: 0, clears: 0, warns: [], draws: [], scales: [], transforms: [] };
  const errors = [];

  /* 桩 Canvas：多记一点「画这张图时 ctx 处于什么状态」，
   * 用来验证角色模块会临时改 imageSmoothingEnabled / globalAlpha 再恢复。 */
  const makeCtx = () => {
    const c = {
      fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, font: '10px x',
      textAlign: 'left', textBaseline: 'top', lineWidth: 1,
      imageSmoothingEnabled: true,          // 真实 Canvas2D 的默认值
      measureText: () => ({ width: 20 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      scale: (x, y) => { log.scales.push([x, y]); },
      setTransform: (a, b, c, d, e, f) => { log.transforms.push([a, b, c, d, e, f]); },
      save() {}, restore() {}, clearRect: () => { log.clears++; }, translate() {}, rotate() {}, beginPath() {},
      arc() {}, fill() {}, stroke() {}, closePath() {}, moveTo() {}, lineTo() {}, setLineDash() {},
      fillRect: () => { log.rects++; },
      fillText: (s) => { log.texts.push(String(s)); },
      drawImage: (img, dx, dy, dw, dh) => {
        log.draws.push({
          img, x: dx, y: dy, w: dw, h: dh,
          smooth: c.imageSmoothingEnabled, alpha: c.globalAlpha,
        });
      },
    };
    return c;
  };

  /* 桩 Image：默认「加载成功」，opts.images = "fail" 时模拟 404 / 解码失败。
   * 同步触发 onload / onerror，测试才好断言（真实浏览器是异步的）。 */
  const imageMode = opts.images || 'ok';
  /* 只让「路径里含某个片段」的那一张图 404，用来验证单张素材缺失不会拖垮整套皮肤 */
  const failMatch = opts.failMatch || null;
  const imageList = [];
  function StubImage() {
    this.onload = null; this.onerror = null;
    this.naturalWidth = 0; this.naturalHeight = 0; this.width = 0; this.height = 0;
    this._src = '';
    imageList.push(this);
  }
  Object.defineProperty(StubImage.prototype, 'src', {
    get() { return this._src; },
    set(v) {
      this._src = String(v);
      if (imageMode === 'pending') return;
      if (imageMode === 'fail' || (failMatch && this._src.indexOf(failMatch) >= 0)) {
        this.naturalWidth = 0; if (this.onerror) this.onerror(); return;
      }
      this.naturalWidth = 300; this.naturalHeight = 340; this.width = 300; this.height = 340;
      if (this.onload) this.onload();
    },
  });

  const els = {}; const all = []; const docH = {};
  /* 焦点状态：document.activeElement 的真实来源（默认 <body>） */
  let activeEl = null;
  const rootRef = { body: null };

  function makeEl(spec, parent) {
    const attrs = Object.assign({}, spec.attrs || {});
    const handlers = {};
    const e = {
      id: spec.id || '', tagName: (spec.tag || 'div').toUpperCase(),
      textContent: spec.text || '', innerHTML: spec.html || '',
      style: {}, width: 0, height: 0, dataset: {},
      /* 父链 + 焦点 + contenteditable：判断「键盘目标是不是交互控件」要用这三样 */
      parentNode: parent !== undefined ? parent : rootRef.body,
      isContentEditable: spec.contentEditable === true,
      __handlers: handlers,
      getAttribute: (n) => (attrs[n] !== undefined ? attrs[n] : null),
      setAttribute: (n, v) => { attrs[n] = String(v); },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
      removeEventListener: (t, f) => { handlers[t] = (handlers[t] || []).filter((x) => x !== f); },
      fire: (t, ev) => { (handlers[t] || []).forEach((f) => f(ev || { preventDefault() {} })); },
      getContext: makeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 200, right: 360, bottom: 200 }),
      focus() { activeEl = e; },
      blur() { if (activeEl === e) activeEl = null; },
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
    };
    if (e.id) els[e.id] = e;
    /* <body> 刻意不进 all：现有测试大量按 all 过滤，别改变它们的输入 */
    if (!spec.standalone) all.push(e);
    return e;
  }
  const bodyEl = makeEl({ tag: 'body', standalone: true }, null);
  rootRef.body = bodyEl;
  page.elements.forEach((spec) => makeEl(spec));

  const doc = {
    readyState: 'complete', title: '', hidden: false,
    body: bodyEl,
    get activeElement() { return activeEl || bodyEl; },
    documentElement: {
      _a: {},
      setAttribute: function (n, v) { this._a[n] = v; },
      getAttribute: function (n) { return this._a[n]; },
    },
    getElementById: (id) => els[id] || null,
    querySelectorAll: (sel) => {
      const m = /^\[([a-zA-Z0-9-]+)\]$/.exec(sel);
      return m ? all.filter((e) => e.getAttribute(m[1]) !== null) : [];
    },
    addEventListener: (t, f) => { (docH[t] = docH[t] || []).push(f); },
    removeEventListener: (t, f) => { docH[t] = (docH[t] || []).filter((x) => x !== f); },
  };
  /* <title data-i18n> 生效后，document.title 要跟着变（真实浏览器就是这个行为） */
  const titleEl = all.find((e) => e.tagName === 'TITLE');
  if (titleEl) {
    Object.defineProperty(doc, 'title', {
      configurable: true,
      get: () => titleEl.textContent,
      set: (v) => { titleEl.textContent = String(v); },
    });
  }

  const store = new Map(opts.savedLang ? [['arcade.lang', opts.savedLang]] : []);
  if (opts.saved) for (const [k, v] of Object.entries(opts.saved)) store.set(k, v);
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const nav = { language: opts.navLang || 'zh-CN' };
  const winH = {};                          // window 上的监听器也要能触发（blur / pagehide / pageshow）
  const win = {
    devicePixelRatio: opts.dpr || 2, document: doc, localStorage: ls, navigator: nav,
    setTimeout, clearTimeout, Image: StubImage,
    addEventListener: (t, f) => { (winH[t] = winH[t] || []).push(f); },
    removeEventListener: (t, f) => { winH[t] = (winH[t] || []).filter((x) => x !== f); },
    innerWidth: 1280, innerHeight: 800,
  };
  let clock = 0; let rafCb = null; let rafAlive = true;
  const sandbox = {
    window: win, document: doc, localStorage: ls, navigator: nav,
    performance: { now: () => clock },
    requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
    cancelAnimationFrame: () => { rafAlive = false; },
    setTimeout, clearTimeout,
    Image: StubImage,
    console: { log() {}, warn: (m) => log.warns.push(String(m)), error: (m) => errors.push(String(m)) },
  };
  vm.createContext(sandbox);

  const patchGame = (code) => {
    if (px !== 3) code = code.replace('var PX = 3;', 'var PX = ' + px + ';');
    if (opts.exposeGame) code = code.replace('var game = {', 'var game = window.__game = {');
    if (opts.spawn) code = code.replace(/function spawnObstacle\(\) \{[\s\S]*?\n  \}/, 'function spawnObstacle() {\n    ' + opts.spawn + '\n  }');
    if (opts.gap) code = code.replace('rand(60, 110)', 'rand(' + opts.gap[0] + ', ' + opts.gap[1] + ')');
    return code;
  };

  for (const s of SHARED_PRELUDE) vm.runInContext(source(s), sandbox, { filename: s });
  for (const s of page.scripts) {
    let code = source(s);
    if (pageName === 'runner' || pageName === 'snake' || pageName === 'tokenfall' || pageName === 'attentionmaze' || pageName === 'contextbreaker' || pageName === 'hunt') code = patchGame(code);
    vm.runInContext(code, sandbox, { filename: s });
  }

  /* 只推进时钟、不跑帧：下一次 tick 会得到一个很大的 dt（模拟切标签页回来） */
  const jump = (ms) => { clock += ms; };
  const tick = (n) => {
    for (let i = 0; i < n; i++) {
      clock += 1000 / 60;
      const cb = rafCb; rafCb = null;
      if (!cb) { errors.push('rAF 断链 @ frame ' + i); return; }
      try { cb(clock); } catch (e) { errors.push(String((e && e.stack) || e)); return; }
    }
  };
  /* 与浏览器一致：按键从当前焦点（target）沿 parentNode 冒泡到 document。
   * 事件对象带 target / defaultPrevented —— preventDefault 是真的会置位，
   * 所以测试既能验证「谁处理了这次按键」，也能验证「有没有被抢掉原生行为」。
   * 不指定 target 时按 document.activeElement 派发（默认 <body>），
   * 与改造前「直接喂给 document 监听器」的行为完全一致。 */
  function dispatchKey(type, k, code, target) {
    const t = target || activeEl || bodyEl;
    const ev = {
      type, key: k, code, repeat: false, target: t, currentTarget: null,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
    };
    const chain = [];
    for (let n = t; n; n = n.parentNode) { chain.push(n); if (n === bodyEl) break; }
    for (const node of chain) {
      const hs = node.__handlers && node.__handlers[type];
      if (!hs) continue;
      ev.currentTarget = node;
      for (const f of hs.slice()) f(ev);
    }
    ev.currentTarget = doc;
    (docH[type] || []).forEach((f) => f(ev));
    return ev;
  }
  const key = (type, k, code, target) => dispatchKey(type, k, code, target);
  const clearLog = () => { log.texts = []; };
  const byI18n = (attr, key2) => all.find((e) => e.getAttribute(attr) === key2);
  const fireDoc = (type, ev) => (docH[type] || []).forEach((f) => f(ev || {}));
  const fireWin = (type, ev) => (winH[type] || []).forEach((f) => f(ev || {}));
  const rafIsAlive = () => rafAlive;
  const hasPendingRaf = () => !!rafCb;

  return {
    S: px / 3, px, page: pageName, log, errors, els, all, doc, body: bodyEl, store, sandbox, window: win, images: imageList,
    I18N: win.I18N, G: win.__game,
    key, dispatchKey, tick, jump, clearLog, byI18n, fireDoc, fireWin, rafIsAlive, hasPendingRaf,
  };
}