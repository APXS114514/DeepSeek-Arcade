#!/usr/bin/env node
/* ============================================================
 * test/browser-smoke.mjs —— 真实 Chrome 冒烟门禁（CI 里独立一步）
 *
 * 为什么需要它：test/run.mjs 的 1800+ 条断言全部跑在自制 DOM 桩上，证明不了
 * 「真实浏览器里事件到底冒泡到谁」「CSS 解析器有没有丢掉整条规则」这类事实。
 * 这里只补那一层：约 30 条高价值断言，不重复已有逻辑测试。
 *
 * 硬约束：package.json = 0。所以不引 Playwright / Puppeteer / Selenium npm 包，
 * 也不用需要与 Chrome 版本严格配对的 chromedriver —— 直接自己拉起 Chrome 的
 * --remote-debugging-port，用 Node 原生 fetch + WebSocket 走 CDP。
 * （探索过 chromedriver + WebDriver HTTP API：本机没有 chromedriver，无法本地验证，
 *   而 driver 与 Chrome 版本强耦合本身就是 CI flake 的常见来源。）
 *
 * 用法：
 *   node test/browser-smoke.mjs              # 找不到 Chrome 就 SKIP（退出码 0），本地开发不受阻
 *   REQUIRE_BROWSER=1 node test/browser-smoke.mjs   # CI：找不到 Chrome 直接失败
 *   CHROME_BIN=/path/to/chrome node test/browser-smoke.mjs
 * ============================================================ */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(new URL('.', import.meta.url)));   // 仓库根目录
const ART = path.join(ROOT, 'browser-smoke-artifacts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Node >= 21 才有内置的全局 WebSocket（Node 22 起稳定）。CI 的 test job 固定在
 * Node 20（那是逻辑测试的兼容目标），所以 browser-smoke job 单独用 Node 22 —— 
 * 与其手搓一个 WebSocket 帧解析器，不如把这条要求说清楚。 */
if (typeof WebSocket !== 'function') {
  const msg = '浏览器冒烟需要 Node >= 21（内置全局 WebSocket），当前是 ' + process.version + '。' +
    'CI 里 browser-smoke job 用的是 Node 22；本地请换 Node 22+ 或只跑 node test/run.mjs。';
  if (process.env.REQUIRE_BROWSER === '1') { console.error('✗ ' + msg); process.exit(1); }
  console.log('SKIP 浏览器冒烟：' + msg);
  process.exit(0);
}

/* ---------------- 1. 找浏览器（不假定固定路径） ---------------- */
function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const fixed = [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of fixed) if (fs.existsSync(p)) return p;
  /* 再按名字在 PATH 里找一遍（覆盖 nix / 自定义安装） */
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const dir of String(process.env.PATH || '').split(':')) {
    if (!dir) continue;
    for (const n of names) {
      const p = path.join(dir, n);
      try { if (fs.existsSync(p)) return p; } catch {}
    }
  }
  return null;
}

const CHROME = findChrome();
if (!CHROME) {
  const msg = '找不到 Chrome / Chromium。设 CHROME_BIN=... 或装一个再来。';
  if (process.env.REQUIRE_BROWSER === '1') { console.error('✗ ' + msg); process.exit(1); }
  console.log('SKIP 浏览器冒烟：' + msg + '（本地开发不受阻；CI 里 REQUIRE_BROWSER=1 会直接失败）');
  process.exit(0);
}

/* ---------------- 2. 静态服务器 ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(String(req.url).split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port + '/';

/* ---------------- 3. 拉起 Chrome + 连 CDP ---------------- */
const CDP_PORT = 9611;
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-smoke-profile-'));
/* Chrome 的 stderr 直接落在 artifact 目录里：CI 上失败时能一起上传，不用猜 */
fs.mkdirSync(ART, { recursive: true });
const errlog = path.join(ART, 'chrome-stderr.log');
const errfd = fs.openSync(errlog, 'w');
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--remote-allow-origins=*',
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-crash-reporter', '--disable-dev-shm-usage',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--mute-audio', 'about:blank'],
  { stdio: ['ignore', 'ignore', errfd] });
let chromeExit = null;
chrome.on('exit', (c, s) => { chromeExit = 'code=' + c + ' sig=' + s; });

let ver = null;
for (let i = 0; i < 120; i++) {
  if (chromeExit) break;
  try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version', { headers: { Connection: 'close' } }); if (r.ok) { ver = await r.json(); break; } } catch {}
  await sleep(250);
}
if (!ver) {
  console.error('✗ Chrome 起来了但 CDP 端点连不上：' + (chromeExit || '超时'));
  console.error('  Chrome 路径: ' + CHROME + '  Node: ' + process.version);
  try { console.error(fs.readFileSync(errlog, 'utf8').split('\n').slice(-20).join('\n')); } catch {}
  chrome.kill('SIGKILL'); server.close();
  process.exit(process.env.REQUIRE_BROWSER === '1' ? 1 : 0);
}
console.log('浏览器: ' + ver.Browser + '  (' + CHROME + ')');

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP websocket 连不上')); });
let msgId = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); const p = m.id && pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++msgId;
  const to = setTimeout(() => { pending.delete(id); rej(new Error('CDP 超时: ' + method)); }, 30000);
  pending.set(id, { res: (v) => { clearTimeout(to); res(v); }, rej: (e) => { clearTimeout(to); rej(e); } });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const t0 = await send('Target.createTarget', { url: 'about:blank' });
const att = await send('Target.attachToTarget', { targetId: t0.targetId, flatten: true });
const SID = att.sessionId;
await send('Page.enable', {}, SID);
await send('Runtime.enable', {}, SID);

/* 每次新文档都先装好「未捕获错误」收集器 —— 这是 Node 桩永远证明不了的一条 */
const HOOK = `window.__smokeErrors = [];
window.addEventListener('error', function (e) { window.__smokeErrors.push('error: ' + (e.message || (e.error && e.error.message) || 'unknown')); });
window.addEventListener('unhandledrejection', function (e) { window.__smokeErrors.push('unhandledrejection: ' + String(e.reason)); });
window.__lastKey = null;
document.addEventListener('keydown', function (e) {
  var t = e.target || {};
  /* 先同步记一笔（永远不会读到 null），再在事件跑完后回填真正的 defaultPrevented */
  var rec = { key: e.key, code: e.code, prevented: !!e.defaultPrevented, target: t.id || (t.tagName || '?'), settled: false };
  window.__lastKey = rec;
  setTimeout(function () { rec.prevented = !!e.defaultPrevented; rec.settled = true; }, 0);
}, true);`;
const hook = await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK }, SID);

/* ---------------- 4. 断言与诊断 ---------------- */
let passN = 0; let failN = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passN++; console.log('PASS  ' + name); return true; }
  failN++; failures.push({ name, detail }); console.log('FAIL  ' + name + (detail ? '\n        -> ' + detail : ''));
  return false;
}
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false }, SID);
  if (r.exceptionDetails) throw new Error('页面内求值异常: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
  return r.result.value;
};

const VIEWPORTS = {
  'mobile-390x844': { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  'mobile-430x932': { width: 430, height: 932, deviceScaleFactor: 2, mobile: true },
  'landscape-844x390': { width: 844, height: 390, deviceScaleFactor: 2, mobile: true },
  'desktop-1280x900': { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
};
const PAGES = [
  ['lobby', 'index.html', ['main.card', '.games']],
  ['runner', 'games/runner/index.html', ['.stage', '#game']],
  ['snake', 'games/snake/index.html', ['.stage', '#game', '.pad']],
  ['tokenfall', 'games/token-fall/index.html', ['.stage', '#game', '.pad']],
  ['maze', 'games/attention-maze/index.html', ['.stage', '#game']],
  ['breaker', 'games/context-breaker/index.html', ['.stage', '#game', '.pad']],
  ['hunt', 'games/hallucination-hunt/index.html', ['.hunt-app', '#game']],
];
const REL = Object.fromEntries(PAGES.map((p) => [p[0], p[1]]));
const PAGE_ERRORS = new Map();     // page -> 该页在所有机型里累计的错误

let current = { url: '', vp: '' };
async function openPage(page, vpName) {
  const vp = VIEWPORTS[vpName];
  current = { url: ORIGIN + REL[page], vp: vpName + ' (' + vp.width + 'x' + vp.height + ')' };
  await send('Emulation.setDeviceMetricsOverride', vp, SID);
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }, SID);
  await send('Page.navigate', { url: ORIGIN + REL[page] }, SID);
  for (let i = 0; i < 60; i++) {
    try { if (await evalJs('document.readyState') === 'complete') break; } catch {}
    await sleep(100);
  }
  await sleep(700);                       // 让 rAF 驱动的布局 / 字体稳定下来
}
async function diagnose(page, vpName, sels) {
  try {
    const info = await evalJs(`(() => {
      const sels = ${JSON.stringify(sels || [])};
      const boxes = {};
      for (const s of sels) { const el = document.querySelector(s); if (!el) { boxes[s] = null; continue; }
        const r = el.getBoundingClientRect(); boxes[s] = { left: +r.left.toFixed(1), top: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), display: getComputedStyle(el).display }; }
      return JSON.stringify({ location: location.href, readyState: document.readyState, activeElement: (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || '?',
        innerWidth: innerWidth, innerHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth,
        errors: window.__smokeErrors || [], boxes: boxes });
    })()`);
    console.log('        诊断[' + page + ' ' + current.vp + ']: ' + info);
  } catch (e) { console.log('        诊断失败: ' + e.message); }
  try {
    fs.mkdirSync(ART, { recursive: true });
    const shot = await send('Page.captureScreenshot', { format: 'png' }, SID);
    const f = path.join(ART, 'FAIL-' + page + '-' + vpName + '.png');
    fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
    console.log('        截图: ' + f);
  } catch {}
}

/* ---------------- 5. 全部页面 × 手机竖屏：加载健康度 ---------------- */
for (const [page, , sels] of PAGES) {
  await openPage(page, 'mobile-390x844');
  let bad = 0;
  try { bad = (await evalJs('(window.__smokeErrors || []).length')); } catch {}
  PAGE_ERRORS.set(page, bad);
  const okHealth = await check(page + ' 390x844：readyState complete 且无未捕获错误',
    (await evalJs('document.readyState')) === 'complete' && bad === 0,
    bad ? ('未捕获错误 ' + (await evalJs('JSON.stringify(window.__smokeErrors)'))) : '');
  const boxes = await evalJs(`(() => { const o = {}; for (const s of ${JSON.stringify(sels)}) { const el = document.querySelector(s);
    o[s] = el ? { w: +el.getBoundingClientRect().width.toFixed(1), h: +el.getBoundingClientRect().height.toFixed(1) } : null; } return JSON.stringify(o); })()`);
  const parsed = JSON.parse(boxes);
  const zero = sels.filter((s) => !parsed[s] || parsed[s].w <= 0 || parsed[s].h <= 0);
  await check(page + ' 390x844：关键元素存在且 bounding box 非 0（' + sels.join(' / ') + '）',
    zero.length === 0, zero.map((s) => s + '=' + JSON.stringify(parsed[s])).join(', '));
  const noHScroll = await evalJs('document.documentElement.scrollWidth <= innerWidth + 1');
  await check(page + ' 390x844：没有异常横向溢出', noHScroll,
    'scrollWidth=' + (await evalJs('document.documentElement.scrollWidth')) + ' innerWidth=' + (await evalJs('innerWidth')));
  if (!okHealth || zero.length || !noHScroll) await diagnose(page, 'mobile-390x844', sels);
}

/* ---------------- 6. Lobby 结构 ---------------- */
{
  await openPage('lobby', 'desktop-1280x900');
  const cards = await evalJs("document.querySelectorAll('.game').length");
  check('Lobby 正好六张 game card', cards === 6, '实际 ' + cards);
  const playable = await evalJs("Array.from(document.querySelectorAll('.game')).filter(function (c) { return c.querySelector('a.btn.primary'); }).length");
  check('六张卡片都有可点的「开始游戏」入口', playable === 6, '实际 ' + playable);
  const thumbs = await evalJs("Array.from(document.querySelectorAll('.thumb canvas, .thumb img')).filter(function (c) { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length");
  check('六张卡片的缩略图都有实际尺寸', thumbs === 6, '实际 ' + thumbs);
}

/* ---------------- 7. 多机型：无横向溢出 + 横屏不破版 ---------------- */
for (const [page, vpName] of [['lobby', 'desktop-1280x900'], ['hunt', 'desktop-1280x900'],
  ['runner', 'landscape-844x390'], ['hunt', 'landscape-844x390'],
  ['snake', 'landscape-844x390'], ['breaker', 'mobile-430x932']]) {
  await openPage(page, vpName);
  const noH = await evalJs('document.documentElement.scrollWidth <= innerWidth + 1');
  check(page + ' ' + vpName + '：没有异常横向溢出', noH,
    'scrollWidth=' + (await evalJs('document.documentElement.scrollWidth')) + ' innerWidth=' + (await evalJs('innerWidth')));
  if (!noH) await diagnose(page, vpName, PAGES.find((p) => p[0] === page)[2]);
}

/* ---------------- 8. 本轮修的真实键盘 bug（真 focus + 真按键） ---------------- */
/* 真按键：必须用 keyDown + text（rawKeyDown 不产生 char 事件，浏览器就不会执行
 * 「Enter 激活聚焦按钮」这类默认动作 —— 那是 dispatch 方式的问题，不是页面问题）。 */
async function key(k, code, keyCode, text) {
  const base = { key: k, code: code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text: text, unmodifiedText: text } : {}) }, SID);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, SID);
  await sleep(200);
}
const KEY_ENTER = () => key('Enter', 'Enter', 13, '\r');
const KEY_SPACE = () => key(' ', 'Space', 32, ' ');
const KEY_M = () => key('m', 'KeyM', 77, 'm');

/* 8.1 Hunt：Tab 到 Daily Challenge 按 Enter 必须真的进 Daily（被劫持的话会变成 Endless） */
{
  await openPage('hunt', 'mobile-390x844');
  const isIntro = await evalJs("window.HuntGame.game.state === 'intro'");
  await evalJs("document.getElementById('btn-daily').focus()");
  const focused = await evalJs("(document.activeElement || {}).id");
  await KEY_ENTER();
  const mode = await evalJs("window.HuntGame.game.mode");
  const state = await evalJs("window.HuntGame.game.state");
  check('Hunt：intro 下 Enter 之前确实停在 intro 且焦点在 Daily 按钮上', isIntro && focused === 'btn-daily', 'intro=' + isIntro + ' focused=' + focused);
  check('Hunt：焦点在 Daily Challenge 上按 Enter 真的进 Daily（没有被 document handler 改成 Endless）',
    mode === 'daily' && state !== 'intro', 'state=' + state + ' mode=' + mode);
  const prevented = await evalJs("window.__lastKey && window.__lastKey.prevented");
  check('Hunt：这次 Enter 没有被 gameplay 抢掉原生行为（defaultPrevented=false）', prevented === false, 'prevented=' + prevented);
  if (mode !== 'daily') await diagnose('hunt', 'mobile-390x844', ['#btn-daily', '#btn-start']);
}

/* 8.2 Breaker：焦点在「返回游戏厅」链接上按 Enter 必须触发链接（而不是 launchBall） */
{
  await openPage('breaker', 'mobile-390x844');
  await evalJs("window.__backClick = 0; var a = document.querySelector('.arcade-back'); if (a) a.addEventListener('click', function (e) { window.__backClick++; e.preventDefault(); });");
  await evalJs("var a = document.querySelector('.arcade-back'); if (a) a.focus();");
  const focused = await evalJs("(document.activeElement || {}).className");
  await KEY_ENTER();
  const prevented = await evalJs("window.__lastKey && window.__lastKey.prevented");
  const clicked = await evalJs('window.__backClick');
  check('Breaker：焦点能落在「返回游戏厅」链接上', String(focused).indexOf('arcade-back') >= 0, 'activeElement=' + focused);
  check('Breaker：链接上按 Enter 触发了链接自身的激活（会正常导航）', clicked >= 1, 'click 次数=' + clicked);
  check('Breaker：这次 Enter 没有被 gameplay handler preventDefault 掉', prevented === false, 'prevented=' + prevented);
  if (clicked !== 1) await diagnose('breaker', 'mobile-390x844', ['.arcade-back', '#game']);
}

/* 8.3 传统游戏：焦点在音效按钮上按 Space 必须激活按钮，而不是起跑 */
{
  await openPage('runner', 'mobile-390x844');
  /* 用「按钮自己被点了多少次」而不是文案奇偶：CDP 派发可能出现重复，文案会比较不可靠 */
  await evalJs("window.__soundClicks = 0; document.getElementById('sound').addEventListener('click', function () { window.__soundClicks++; }, true);");
  await evalJs("document.getElementById('sound').focus()");
  await KEY_SPACE();
  const clicks = await evalJs('window.__soundClicks');
  const prevented = await evalJs("window.__lastKey && window.__lastKey.prevented");
  check('Runner：焦点在音效按钮上按 Space 激活了按钮本身（click 到达），而不是被游戏抢去起跑',
    clicks >= 1, 'click 次数=' + clicks);
  check('Runner：这次 Space 没有被 gameplay preventDefault 掉', prevented === false, 'prevented=' + prevented);
  if (clicks < 1) await diagnose('runner', 'mobile-390x844', ['#sound', '.stage']);
}

/* 8.4 文字输入：在 textarea 里打 m 不能静音 */
{
  await openPage('hunt', 'mobile-390x844');
  /* 记「静音动作被调用了几次」，而不是看文案奇偶 —— CDP 派发可能重复，计数才可靠 */
  await evalJs("window.__toggles = 0; if (window.ArcadeAudio && window.ArcadeAudio.toggle) { var _t = window.ArcadeAudio.toggle; window.ArcadeAudio.toggle = function () { window.__toggles++; return _t.apply(this, arguments); }; }");
  const label = () => evalJs("document.getElementById('sound').textContent");
  const before = await label();
  await evalJs("document.getElementById('share-out').focus()");
  const focusedId = await evalJs("(document.activeElement || {}).id");
  await KEY_M();
  const togglesInTextarea = await evalJs('window.__toggles');
  const inTextarea = await label();
  const prevented = await evalJs("window.__lastKey && window.__lastKey.prevented");
  check('Hunt：焦点确实落在 textarea 上', focusedId === 'share-out', 'activeElement=' + focusedId);
  check('Hunt：焦点在 textarea 里打 m 完全不触发静音，也没被 preventDefault',
    togglesInTextarea === 0 && inTextarea === before && prevented === false,
    'toggle 次数=' + togglesInTextarea + ' ' + before + ' -> ' + inTextarea + ' prevented=' + prevented);
  /* 自校准对照组：焦点离开输入框后，同一个 m 必须照旧静音。
     真实浏览器里 body.focus() 不会真的挪走焦点，必须 blur()。 */
  await evalJs('(document.activeElement || document.body).blur()');
  await evalJs('window.__toggles = 0');
  await KEY_M();
  const togglesOutside = await evalJs('window.__toggles');
  check('Hunt：焦点不在输入框时同一个 m 仍然静音（快捷键没被修坏）',
    togglesOutside >= 1, 'toggle 次数=' + togglesOutside);
  if (togglesInTextarea !== 0) await diagnose('hunt', 'mobile-390x844', ['#share-out', '#sound']);
}

/* ---------------- 9. 历史高风险点 ---------------- */
/* 9.1 Hunt intro 不能再泄漏 .turn / Context Model（上一轮的 CSS parser P0） */
{
  await openPage('hunt', 'mobile-390x844');
  const leaked = await evalJs(`(() => {
    const out = [];
    for (const s of ['.turn', '.assistant-meta', '.conf-track', '.am-sim']) {
      for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') out.push(s + '=' + r.width + 'x' + r.height);
      }
    }
    const cm = Array.from(document.querySelectorAll('*')).find(function (el) {
      return el.children.length === 0 && /Context Model/i.test(el.textContent || '') && el.getBoundingClientRect().height > 0;
    });
    if (cm) out.push('可见的 Context Model 标签');
    return JSON.stringify(out);
  })()`);
  check('Hunt intro：没有泄漏 turn / assistant-meta / conf-track / am-sim / Context Model 标签',
    JSON.parse(leaked).length === 0, leaked);
  if (JSON.parse(leaked).length) await diagnose('hunt', 'mobile-390x844', ['.turn', '.am-conf']);
}
/* 9.2 Runner 竖屏：舞台已经是「跟着天色的宽屏面板」，不是旧的 84px 细条 + 上下死白 */
{
  await openPage('runner', 'mobile-390x844');
  const g = JSON.parse(await evalJs("(() => { const s = document.querySelector('.stage').getBoundingClientRect(); const c = document.querySelector('#game').getBoundingClientRect(); return JSON.stringify({ stageH: +s.height.toFixed(1), canvasH: +c.height.toFixed(1), canvasW: +c.width.toFixed(1) }); })()"));
  check('Runner 竖屏：舞台撑起来了（>200px）且画布仍是 4.5:1 的宽条（高<120px）',
    g.stageH > 200 && g.canvasH < 120, JSON.stringify(g));
  if (!(g.stageH > 200)) await diagnose('runner', 'mobile-390x844', ['.stage', '#game']);
}
/* 9.3 primary action 用的是 --accent-fill 而不是品牌蓝 */
{
  await openPage('lobby', 'mobile-390x844');
  const bg = await evalJs("getComputedStyle(document.querySelector('.btn.primary')).backgroundColor");
  check('primary 按钮的实心底色是 #465fe8（--accent-fill，白字过 AA）而不是品牌蓝 #4d6bfe',
    bg === 'rgb(70, 95, 232)', '实际 ' + bg);
  const brand = await evalJs("getComputedStyle(document.querySelector('.brand')).color");
  check('品牌字仍然是品牌蓝 #4d6bfe（没有被 accent-fill 带偏）', brand === 'rgb(77, 107, 254)', '实际 ' + brand);
}
/* 9.4 真按 Tab：键盘焦点环必须真的出现 */
{
  await openPage('lobby', 'desktop-1280x900');
  await evalJs('(document.activeElement || document.body).blur()');
  let ring = null; let who = null;
  for (let i = 0; i < 10; i++) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, SID);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, SID);
    await sleep(90);
    const r = JSON.parse(await evalJs("(() => { const el = document.activeElement; if (!el || el === document.body) return JSON.stringify({ none: true }); const cs = getComputedStyle(el); return JSON.stringify({ id: el.id || el.className, fv: el.matches(':focus-visible'), style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor }); })()"));
    if (r.fv) { ring = r; who = r.id; break; }
  }
  check('真按 Tab：焦点环在浏览器里真的出现（solid 2px 品牌蓝）',
    !!ring && ring.style === 'solid' && parseFloat(ring.width) >= 2, ring ? JSON.stringify(ring) : '没找到 focus-visible 元素');
  if (!ring) await diagnose('lobby', 'desktop-1280x900', ['.btn']);
}

/* ---------------- 10. 收尾 ---------------- */
console.log('\n浏览器冒烟：' + passN + ' / ' + (passN + failN) + ' 通过');
if (failN) {
  console.log('失败项：');
  for (const f of failures) console.log('  - ' + f.name + (f.detail ? '  ->  ' + f.detail : ''));
}
ws.close();
try { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: hook.identifier }, SID); } catch {}
chrome.kill('SIGKILL');
server.close();
fs.closeSync(errfd);
await sleep(300);
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(failN === 0 ? 0 : 1);
