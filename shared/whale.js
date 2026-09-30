/* ============================================================
 * DeepSeek Arcade — 共享像素素材：DeepSeek 小鲸鱼
 * 全站唯一一份。Whale Runner（游动 / 下潜）、Token Fall（接物）、
 * 大厅卡片预览都从这里取，改造型只改这一个文件。
 *
 * 数据来源：DeepSeek 官方 logo 的那条 cubic 路径光栅化成 24×18 像素网格
 * （镜像成朝右）。两帧只差尾鳍摆动，逐格对齐，所以换帧不影响判定盒。
 *
 *   X = 主色   o = 肚皮   . = 透明
 *   NORMAL_A / NORMAL_B   正常游动两帧（24×18）
 *   DIVE_A   / DIVE_B     下潜两帧（24×13，纵向压扁 + 同样的尾鳍剪切）
 *
 * 纯数据 + 少量几何小工具，不放任何游戏逻辑。
 * 直接 <script src=".../shared/whale.js"></script> 加载，不用 ES Module。
 * 注意：Attention Maze 用的是另一只俯视角小鲸鱼（四个朝向），不在这里。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- 正常游动两帧 ---------------- */
  var NORMAL_A = [
    '.......X....X...........',
    '......XX....XXXXXXXX....',
    'XXX..XXX....XXXXXXXXX...',
    'XXXXXXXX...XXXXXXXXXXX..',
    '.XXXXXX...XXXXXXXXXXXXX.',
    '..XXXX...XXXXXXXXXXXXXXX',
    '....XX.XXXXXXXXXXXXXXXXX',
    '....XXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXXooooooXX',
    '....XXXXooXXXXXoooooooXX',
    '.....XXXXXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXXX',
    '......XXXXXXXooooooooXX.',
    '......XXXXXXoooXooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '.....XXXXXooXXXXXXXXX...',
    '......XX..XXXXXXXXXX....',
    '...........XXXXXXX......'
  ];
  var NORMAL_B = [
    '............X...........',
    '.......X....XXXXXXXX....',
    '......XX....XXXXXXXXX...',
    'X....XXX...XXXXXXXXXXX..',
    'XXXXXXXX..XXXXXXXXXXXXX.',
    'XXXXXXX..XXXXXXXXXXXXXXX',
    '.XXXXX..XXXXXXXXXXXXXXXX',
    '...XXXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXXooooooXX',
    '....XXXXooXXXXXoooooooXX',
    '....XXXXoXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXXX',
    '.....XXXXXXXXooooooooXX.',
    '......XXXXXXoooXooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '......XXXXooXXXXXXXXX...',
    '.....XXXXXXXXXXXXXXX....',
    '...........XXXXXXX......'
  ];

  /* ---------------- 下潜两帧 ---------------- */
  var DIVE_A = [
    '.......X....XX..........',
    'X....XXX....XXXXXXXXX...',
    'XXXXXXXX...XXXXXXXXXXX..',
    '.XXXXXX..XXXXXXXXXXXXXX.',
    '...XXX..XXXXXXXXXXXXXXXX',
    '....XXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXoooooooXX',
    '.....XXXXXXXXXooooooooXX',
    '.....XXXXXXXXooooooooXX.',
    '......XXXXXXooooooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '.....XXXXXXXXXXXXXXX....',
    '...........XXXXXXX......'
  ];
  var DIVE_B = [
    '............XX..........',
    '.......X....XXXXXXXXX...',
    '.....XXX...XXXXXXXXXXX..',
    'XXXXXXXX.XXXXXXXXXXXXXX.',
    'XXXXXXXoXXXXXXXXXXXXXXXX',
    '..XXXXXXXXoXXXXXXoooooXX',
    '....XXXXXoXXXXXoooooooXX',
    '....XXXXooXXXXooooooooXX',
    '.....XXXXXXXXooooooooXX.',
    '.....XXXXXXXooooooooXXX.',
    '.......XXXXooXXXoooXXX..',
    '......XXXXXXXXXXXXXX....',
    '.....XX....XXXXXXX......'
  ];

  /* ---------------- 几何小工具（只跟字符画本身有关） ---------------- */
  function width(rows) { return rows && rows.length ? rows[0].length : 0; }
  function height(rows) { return rows ? rows.length : 0; }

  /* 水平镜像：朝左游的时候用 */
  function mirror(rows) {
    var out = [];
    for (var y = 0; y < rows.length; y++) {
      var line = '';
      for (var x = rows[y].length - 1; x >= 0; x--) line += rows[y].charAt(x);
      out.push(line);
    }
    return out;
  }

  /* 顺时针 90° 整数旋转（times 次）：俯视 / 竖向场景可以直接用 */
  function rotate(rows, times) {
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

  global.ArcadeWhale = {
    NORMAL_A: NORMAL_A,
    NORMAL_B: NORMAL_B,
    DIVE_A: DIVE_A,
    DIVE_B: DIVE_B,
    WIDTH: width(NORMAL_A),      // 24 格
    HEIGHT: height(NORMAL_A),    // 18 格
    DIVE_HEIGHT: height(DIVE_A), // 13 格
    width: width,
    height: height,
    mirror: mirror,
    rotate: rotate
  };
})(window);
