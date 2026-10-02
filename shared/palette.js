/* ============================================================
 * DeepSeek Arcade — 共享色「同源映射」
 *
 * 为什么需要它：
 *   Canvas 里的颜色没法用 CSS 变量（ctx.fillStyle 只认字符串），于是品牌蓝
 *   #4d6bfe 在 arcade.js / game.js 里被抄了 26 遍，全站 137 个不同色值里
 *   有一批其实和 shared/arcade.css 的 :root 是同一支颜色。改一处漏一处。
 *
 * 这个文件不是运行时注入系统，也不读 getComputedStyle —— 就是一份**显式的小映射**：
 *   名字 → { token, hex }
 * 其中 token 是 shared/arcade.css :root 里的变量名，hex 必须与它逐字相同。
 * test/engineering.test.mjs 的 U 段会静态比对两者，一旦谁改了另一半就红，
 * 所以这份映射不可能悄悄过期。
 *
 * 本轮（第一轮 UI 收敛）**只做准备，不改任何画面颜色**：没有任何脚本引用它。
 * 下一轮把 arcade.js / games/*/game.js 里的 ' #4d6bfe ' 换成 ArcadePalette.brand
 * 即可，颜色值逐字相同，视觉零变化；引用前需要给页面加一行
 *   <script src="shared/palette.js?v=<版本>"></script>
 *
 * 刻意**不**收进来的：另外 133 个色值（鲸鱼腹白 #c9dcff、水母粉、珊瑚红、
 * Token Fall 的方块色…）。它们是各玩法的美术资产，跟产品 UI 不是同一个语义，
 * 硬塞进公共调色板只会制造假共享。
 *
 * 盘点方式见 Game-Miscellaneous/_ui-revalidate/palette-overlap.mjs。
 * ============================================================ */
(function (global) {
  'use strict';

  var PALETTE = {
    /* 品牌 / 主色 */
    brand:       { token: '--accent',      hex: '#4d6bfe' },
    brandDark:   { token: '--accent-dark', hex: '#3d5be8' },

    /* 深色面（贪吃蛇场地、缩略图底、深海天） */
    deep:        { token: '--deep',        hex: '#08152c' },
    deepLine:    { token: '--deep-line',   hex: '#16305c' },

    /* 浅色面与文字 */
    white:       { token: '--card-bg',     hex: '#ffffff' },
    surface:     { token: '--surface',     hex: '#f2f7fc' },
    ink:         { token: '--text',        hex: '#16324f' },
    muted:       { token: '--muted',       hex: '#5a7183' },
    line:        { token: '--line',        hex: '#d8e4ef' },
    pageBg:      { token: '--page-bg',     hex: '#e8f2fb' }
  };

  global.ArcadePalette = PALETTE;
})(window);
