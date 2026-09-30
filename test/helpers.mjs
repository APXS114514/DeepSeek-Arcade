/* 测试用的无头运行环境：桩 DOM + 桩 Canvas，把 game.js / i18n.js 跑起来。
 * 不依赖浏览器、不依赖任何 npm 包。 */
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const GAME_DIR = fileURLToPath(new URL('..', import.meta.url));   // .../Game/

export function source(name) {
  return fs.readFileSync(GAME_DIR + name, 'utf8');
}

/* 与 index.html 一一对应的元素清单 */
const ELEMENTS = [
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
];

export function harness(opts) {
  opts = opts || {};
  const px = opts.px === undefined ? 3 : opts.px;
  const log = { texts: [], rects: 0, warns: [] };
  const errors = [];

  const makeCtx = () => ({
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, font: '10px x',
    textAlign: 'left', textBaseline: 'top', lineWidth: 1,
    measureText: () => ({ width: 20 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    scale() {}, save() {}, restore() {}, clearRect() {},
    fillRect: () => { log.rects++; },
    fillText: (s) => { log.texts.push(String(s)); },
  });

  const els = {}; const all = []; const docH = {};
  function makeEl(spec) {
    const attrs = Object.assign({}, spec.attrs || {});
    const handlers = {};
    const e = {
      id: spec.id || '', textContent: spec.text || '', innerHTML: spec.html || '',
      style: {}, width: 0, height: 0,
      getAttribute: (n) => (attrs[n] !== undefined ? attrs[n] : null),
      setAttribute: (n, v) => { attrs[n] = String(v); },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
      fire: (t, ev) => { (handlers[t] || []).forEach((f) => f(ev || { preventDefault() {} })); },
      getContext: makeCtx,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      focus() {},
    };
    if (e.id) els[e.id] = e;
    all.push(e);
    return e;
  }
  ELEMENTS.forEach(makeEl);

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
  };

  const store = new Map(opts.savedLang ? [['whaleRunner.lang', opts.savedLang]] : []);
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };

  const nav = { language: opts.navLang || 'zh-CN' };
  const win = { devicePixelRatio: opts.dpr || 2, document: doc, localStorage: ls, navigator: nav };
  let clock = 0; let rafCb = null;
  const sandbox = {
    window: win, document: doc, localStorage: ls, navigator: nav,
    performance: { now: () => clock },
    requestAnimationFrame: (cb) => { rafCb = cb; },
    cancelAnimationFrame() {},
    console: { log() {}, warn: (m) => log.warns.push(String(m)), error: (m) => errors.push(String(m)) },
  };
  vm.createContext(sandbox);

  const patch = (code) => {
    if (px !== 3) code = code.replace('var PX = 3;', 'var PX = ' + px + ';');
    if (opts.exposeGame) code = code.replace('var game = {', 'var game = window.__game = {');
    if (opts.spawn) code = code.replace(/function spawnObstacle\(\) \{[\s\S]*?\n  \}/, 'function spawnObstacle() {\n    ' + opts.spawn + '\n  }');
    if (opts.gap) code = code.replace('rand(60, 110)', 'rand(' + opts.gap[0] + ', ' + opts.gap[1] + ')');
    return code;
  };

  vm.runInContext(source('i18n.js'), sandbox, { filename: 'i18n.js' });
  vm.runInContext(patch(source('game.js')), sandbox, { filename: 'game.js' });

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

  return {
    S: px / 3, px, log, errors, els, all, doc, store, sandbox, window: win,
    I18N: win.I18N, G: win.__game,
    key, tick, clearLog, byI18n, fireDoc,
  };
}