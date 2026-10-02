/* ============================================================
 * DeepSeek Arcade — 全站版本常量（cache-busting 的唯一真相来源）
 *
 * 纯静态站没有构建步骤，所以静态资源靠 query-string 破缓存：
 *   shared/arcade.css?v=1.6.2
 *   games/snake/game.js?v=1.6.2
 *
 * 发版流程（见 README「发布」一节）：
 *   1. 只改本文件的 VERSION；
 *   2. 跑  node tools/bump-asset-version.mjs
 *      它会把所有 HTML 里的 ?v= 同步成新版本（幂等）；
 *   3. 测试会校验「每个本地 css/js 引用都带 ?v= 且等于本文件的版本」。
 *
 * 同时在页面右下角渲染版本角标，方便一眼确认线上跑的是哪一版。
 * ============================================================ */
(function (global) {
  'use strict';

  var VERSION = '1.6.4';
  global.ARCADE_VERSION = VERSION;

  function badge() {
    var doc = global.document;
    if (!doc || !doc.body || !doc.createElement) return;   // 无 DOM 环境（测试桩）直接跳过
    try {
      if (doc.querySelector && doc.querySelector('.arcade-version')) return;
      var el = doc.createElement('div');
      el.className = 'arcade-version';
      el.setAttribute('data-version', VERSION);
      el.setAttribute('aria-label', 'DeepSeek Arcade version ' + VERSION);
      el.textContent = 'v' + VERSION;
      doc.body.appendChild(el);
    } catch (e) { /* 角标只是辅助信息，失败绝不影响游戏 */ }
  }

  if (global.document) {
    if (global.document.readyState === 'loading' && global.document.addEventListener) {
      global.document.addEventListener('DOMContentLoaded', badge);
    } else {
      badge();
    }
  }
})(window);
