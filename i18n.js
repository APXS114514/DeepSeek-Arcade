/* ============================================================
 * 多语言模块 i18n —— 中文 / English
 *
 * 用法：
 *   I18N.t('key')              取当前语言的文案
 *   I18N.toggle()              中英互换（点右上角 🌐 按钮时调用）
 *   I18N.setLang('en' | 'zh')  指定语言
 *   I18N.lang                  当前语言
 *   I18N.onChange(fn)          语言变化回调（画布文字靠它自动跟着变）
 *
 * HTML 里给元素加属性即可自动翻译：
 *   data-i18n="key"        写 textContent
 *   data-i18n-html="key"   写 innerHTML（文案里带 <b> 等标签时用）
 *   data-i18n-aria="key"   写 aria-label
 *
 * 语言优先级：上次选择（localStorage）> 浏览器语言 > 中文
 * ============================================================ */
(function (global) {
  'use strict';

  var DICT = {
    zh: {
      'app.title': '小鲸鱼跑酷 · DeepSeek Whale Runner',
      'h1': '🐳 小鲸鱼跑酷',
      'sub': '空格 / ↑ 上浮跳跃　·　↓ 下潜　·　P 暂停　·　M 静音',
      'btn.jump': '跳跃',
      'btn.dive': '下潜',
      'btn.sound': '🔊 音效',
      'btn.muted': '🔇 静音',
      'btn.lang': '🌐 English',
      'btn.langTitle': '切换语言 / Switch language',
      'btn.fullscreen': '⛶ 全屏',
      'btn.fullscreenExit': '⛶ 退出全屏',
      'canvas.rotateHint': '↻ 把手机横过来，画面更大',
      'tips': '海床上的<b>海胆 · 珊瑚 · 低浮水母</b>要跳过去；中层垂着触手的<b>水母</b>和迎面游来的<b>小鱼</b>要下潜躲开。游得越远速度越快，每 100 分响一声，每 700 分从浅海潜入深海。最高分存在本地浏览器里。',
      'canvas.aria': '小鲸鱼跑酷游戏画面',
      'canvas.ready': '按 空格 / 点击画面 开始游动',
      'canvas.hint': '↑/空格 上浮跳跃　↓ 下潜',
      'canvas.paused': '已暂停',
      'canvas.pausedHint': '按 P 继续',
      'canvas.over': 'G A M E   O V E R',
      'canvas.restart': '按 空格 / 点击画面 重新开始',
      'hud.hi': 'HI'
    },
    en: {
      'app.title': 'Whale Runner · DeepSeek Whale',
      'h1': '🐳 Whale Runner',
      'sub': 'Space / ↑ jump　·　↓ dive　·　P pause　·　M mute',
      'btn.jump': 'Jump',
      'btn.dive': 'Dive',
      'btn.sound': '🔊 Sound',
      'btn.muted': '🔇 Muted',
      'btn.lang': '🌐 中文',
      'btn.langTitle': 'Switch language / 切换语言',
      'btn.fullscreen': '⛶ Fullscreen',
      'btn.fullscreenExit': '⛶ Exit fullscreen',
      'canvas.rotateHint': '↻ Rotate your phone for a bigger view',
      'tips': 'Jump over the <b>urchins, corals and low jellyfish</b> on the seabed; dive under the <b>jellyfish and fish</b> floating at head height. The longer you swim the faster it gets — a beep every 100 points, and every 700 points the sea turns from shallow to deep. Your best score is saved in this browser.',
      'canvas.aria': 'Whale Runner game canvas',
      'canvas.ready': 'Press Space / tap to start',
      'canvas.hint': '↑ / Space jump　↓ dive',
      'canvas.paused': 'PAUSED',
      'canvas.pausedHint': 'Press P to resume',
      'canvas.over': 'G A M E   O V E R',
      'canvas.restart': 'Press Space / tap to restart',
      'hud.hi': 'HI'
    }
  };

  var STORAGE_KEY = 'whaleRunner.lang';
  var DEFAULT_LANG = 'zh';
  var listeners = [];

  function readSaved() {
    try { return global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null; } catch (e) { return null; }
  }
  function save(lang) {
    try { if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 隐私模式忽略 */ }
  }
  function normalize(v) {
    if (!v) return null;
    v = String(v).toLowerCase();
    if (v.indexOf('zh') === 0) return 'zh';
    if (v.indexOf('en') === 0) return 'en';
    return null;
  }
  function detect() {
    var saved = normalize(readSaved());
    if (saved) return saved;
    var nav = global.navigator;
    var lang = nav && (nav.language || (nav.languages && nav.languages[0]));
    return normalize(lang) || DEFAULT_LANG;
  }

  var current = detect();

  function t(key) {
    var d = DICT[current] || DICT[DEFAULT_LANG];
    if (d && d[key] !== undefined) return d[key];
    if (DICT[DEFAULT_LANG][key] !== undefined) return DICT[DEFAULT_LANG][key];
    return key;
  }

  function each(selector, fn) {
    var doc = global.document;
    if (!doc || !doc.querySelectorAll) return;
    var nodes = doc.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function applyDom() {
    var doc = global.document;
    if (!doc) return;
    if (doc.documentElement && doc.documentElement.setAttribute) {
      doc.documentElement.setAttribute('lang', current === 'zh' ? 'zh-CN' : 'en');
    }
    doc.title = t('app.title');
    each('[data-i18n]', function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    each('[data-i18n-html]', function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    each('[data-i18n-aria]', function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    var btn = doc.getElementById('lang');
    if (btn) {
      btn.textContent = t('btn.lang');
      btn.setAttribute('title', t('btn.langTitle'));
      btn.setAttribute('aria-label', t('btn.langTitle'));
    }
  }

  function setLang(lang) {
    var v = normalize(lang) || DEFAULT_LANG;
    var changed = v !== current;
    current = v;
    save(v);
    applyDom();
    if (changed) {
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](current); } catch (e) { /* 回调出错不影响切换 */ }
      }
    }
  }

  function toggle() { setLang(current === 'zh' ? 'en' : 'zh'); }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  function init() {
    applyDom();
    var btn = global.document && global.document.getElementById('lang');
    if (btn && btn.addEventListener) {
      btn.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        toggle();
      });
    }
  }

  global.I18N = {
    t: t,
    toggle: toggle,
    setLang: setLang,
    applyDom: applyDom,
    onChange: onChange,
    supported: ['zh', 'en'],
    get lang() { return current; }
  };

  if (!global.document) return;
  var doc = global.document;
  if (doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);