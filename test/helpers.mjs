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

/* 每个页面真正存在的元素（与各自的 index.html 对应） */
const PAGES = {
  runner: {
    scripts: ['games/runner/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'app.title' } },
      { id: 'back', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'h1' } },
      { attrs: { 'data-i18n': 'sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'canvas.aria' } },
      { id: 'jump', attrs: { 'data-i18n': 'btn.jump' } },
      { id: 'duck', attrs: { 'data-i18n': 'btn.dive' } },
      { id: 'lang' },
      { id: 'sound' },
      { id: 'fullscreen' },
      { attrs: { 'data-i18n-html': 'tips' } },
      { attrs: { 'data-i18n': 'canvas.rotateHint' } },
    ],
  },
  snake: {
    scripts: ['games/snake/game.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'snake.title' } },
      { id: 'back', attrs: { 'data-i18n': 'ui.back' } },
      { attrs: { 'data-i18n': 'snake.h1' } },
      { attrs: { 'data-i18n': 'snake.sub' } },
      { id: 'game', attrs: { 'data-i18n-aria': 'snake.aria' } },
      { id: 'lang' },
      { id: 'sound' },
      { id: 'up', attrs: { 'data-i18n-aria': 'snake.ariaUp' } },
      { id: 'down', attrs: { 'data-i18n-aria': 'snake.ariaDown' } },
      { id: 'left', attrs: { 'data-i18n-aria': 'snake.ariaLeft' } },
      { id: 'right', attrs: { 'data-i18n-aria': 'snake.ariaRight' } },
      { attrs: { 'data-i18n-html': 'snake.tips' } },
    ],
  },
  lobby: {
    scripts: ['arcade.js'],
    elements: [
      { tag: 'title', attrs: { 'data-i18n': 'lobby.title' } },
      { attrs: { 'data-i18n': 'lobby.title' } },
      { attrs: { 'data-i18n': 'lobby.sub' } },
      { id: 'lang' },
      { attrs: { 'data-i18n': 'lobby.whale.name' } },
      { attrs: { 'data-i18n': 'lobby.whale.desc' } },
      { attrs: { 'data-i18n': 'lobby.snake.name' } },
      { attrs: { 'data-i18n': 'lobby.snake.desc' } },
      { attrs: { 'data-i18n': 'lobby.soon1.name' } },
      { attrs: { 'data-i18n': 'lobby.soon2.name' } },
      { attrs: { 'data-i18n': 'lobby.soon' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n': 'lobby.play' } },
      { attrs: { 'data-i18n-html': 'lobby.footer' } },
      { attrs: { 'data-highscore': 'runner' } },
      { attrs: { 'data-highscore': 'snake' } },
      { id: 'preview-runner', tag: 'canvas' },
      { id: 'preview-snake', tag: 'canvas' },
    ],
  },
};

export function harness(opts) {
  opts = opts || {};
  const pageName = opts.page || 'runner';
  const page = PAGES[pageName];
  if (!page) throw new Error('未知页面: ' + pageName);

  const px = opts.px === undefined ? 3 : opts.px;
  const log = { texts: [], rects: 0, warns: [] };
  const errors = [];

  const makeCtx = () => ({
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, font: '10px x',
    textAlign: 'left', textBaseline: 'top', lineWidth: 1,
    measureText: () => ({ width: 20 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    scale() {}, save() {}, restore() {}, clearRect() {}, translate() {}, rotate() {}, beginPath() {},
    arc() {}, fill() {}, stroke() {}, closePath() {}, moveTo() {}, lineTo() {}, setLineDash() {},
    fillRect: (x, y, w, h) => { log.rects++; if (log.ops) log.ops.push({ t: 'r', x, y, w, h, c: String(makeCtx.last && makeCtx.last.fillStyle || '#000') }); },
    fillText: (s) => { log.texts.push(String(s)); },
  });

  const els = {}; const all = []; const docH = {};
  function makeEl(spec) {
    const attrs = Object.assign({}, spec.attrs || {});
    const handlers = {};
    const e = {
      id: spec.id || '', tagName: (spec.tag || 'div').toUpperCase(),
      textContent: spec.text || '', innerHTML: spec.html || '',
      style: {}, width: 0, height: 0, dataset: {},
      getAttribute: (n) => (attrs[n] !== undefined ? attrs[n] : null),
      setAttribute: (n, v) => { attrs[n] = String(v); },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
      removeEventListener: (t, f) => { handlers[t] = (handlers[t] || []).filter((x) => x !== f); },
      fire: (t, ev) => { (handlers[t] || []).forEach((f) => f(ev || { preventDefault() {} })); },
      getContext: makeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 200, right: 360, bottom: 200 }),
      focus() {},
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
    };
    if (e.id) els[e.id] = e;
    all.push(e);
    return e;
  }
  page.elements.forEach(makeEl);

  const doc = {
    readyState: 'complete', title: '', hidden: false,
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
  const win = {
    devicePixelRatio: opts.dpr || 2, document: doc, localStorage: ls, navigator: nav,
    addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 800,
  };
  let clock = 0; let rafCb = null; let rafAlive = true;
  const sandbox = {
    window: win, document: doc, localStorage: ls, navigator: nav,
    performance: { now: () => clock },
    requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
    cancelAnimationFrame: () => { rafAlive = false; },
    setTimeout, clearTimeout,
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

  vm.runInContext(source(SHARED_I18N), sandbox, { filename: SHARED_I18N });
  for (const s of page.scripts) {
    let code = source(s);
    if (pageName === 'runner' || pageName === 'snake') code = patchGame(code);
    vm.runInContext(code, sandbox, { filename: s });
  }

  const tick = (n) => {
    for (let i = 0; i < n; i++) {
      clock += 1000 / 60;
      const cb = rafCb; rafCb = null;
      if (!cb) { errors.push('rAF 断链 @ frame ' + i); return; }
      try { cb(clock); } catch (e) { errors.push(String((e && e.stack) || e)); return; }
    }
  };
  const key = (type, k, code) => (docH[type] || []).forEach((f) => f({ key: k, code: code, repeat: false, preventDefault() {} }));
  const clearLog = () => { log.texts = []; };
  const byI18n = (attr, key2) => all.find((e) => e.getAttribute(attr) === key2);
  const fireDoc = (type, ev) => (docH[type] || []).forEach((f) => f(ev || {}));
  const rafIsAlive = () => rafAlive;
  const hasPendingRaf = () => !!rafCb;

  return {
    S: px / 3, px, page: pageName, log, errors, els, all, doc, store, sandbox, window: win,
    I18N: win.I18N, G: win.__game,
    key, tick, clearLog, byI18n, fireDoc, rafIsAlive, hasPendingRaf,
  };
}