/* ============================================================
 * DeepSeek Arcade — 共享多语言模块 i18n（中文 / English）
 * 全站只有这一份词典：大厅 / Whale Runner / Context Snake 共用。
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
      'hud.hi': 'HI',

      /* ---------- 游戏大厅 ---------- */
      'lobby.title': 'DEEPSEEK ARCADE',
      'lobby.sub': '一个 DeepSeek 同人小游戏合集。',
      'lobby.hi': '最高分',
      'lobby.play': '开始游戏',

      'lobby.whale.name': 'WHALE RUNNER',
      'lobby.whale.desc': '上浮 · 下潜 · 活下来',
      'lobby.snake.name': 'CONTEXT SNAKE',
      'lobby.snake.desc': '吃 TOKEN · 增长 Context',
      'lobby.tokenfall.name': 'TOKEN FALL',
      'lobby.tokenfall.desc': '接住 Token · 管理上下文',
      'lobby.maze.name': 'ATTENTION MAZE',
      'lobby.maze.desc': '记住路径 · 聚焦关键 · 找到出口',
      'lobby.bestLayer': '最高 LAYER',
      'lobby.more': '更多小游戏，以后再说。',
      'lobby.footer': '非官方同人作品，与 DeepSeek 官方无关联。',
      'lobby.aria': 'DeepSeek Arcade 游戏大厅',

      /* ---------- 全站共用控件 ---------- */
      'ui.back': '← 返回游戏厅',

      /* ---------- Context Snake ---------- */
      'snake.title': 'Context 贪吃蛇 · DeepSeek Arcade',
      'snake.h1': '🐳 Context 贪吃蛇',
      'snake.sub': '方向键 / WASD 控制　·　吃 TOKEN 增长 Context　·　P 暂停',
      'snake.aria': 'Context Snake 游戏画面',
      'snake.ctx': 'CONTEXT',
      'snake.think': 'DEEP THINK',
      'snake.ready': '按 方向键 / 滑动屏幕 开始',
      'snake.hint': '方向键 · WASD · 滑动或十字键',
      'snake.paused': '已暂停',
      'snake.pausedHint': '按 P 继续',
      'snake.over': 'G A M E   O V E R',
      'snake.restart': '按 空格 / 点击画面 重新开始',
      'snake.ariaUp': '向上',
      'snake.ariaDown': '向下',
      'snake.ariaLeft': '向左',
      'snake.ariaRight': '向右',
      'snake.tips': '经典贪吃蛇玩法：吃 <b>TOKEN</b> 让 Context 变长，别撞墙也别咬到自己。低概率出现的 <b>THINK</b> 会进入 4 秒 <b>DEEP THINK</b> —— 速度变慢并泛蓝光。最高分存在本地浏览器里。',

      /* ---------- Token Fall ---------- */
      'tokenfall.title': 'TOKEN FALL · DeepSeek Arcade',
      'tokenfall.h1': '🐳 TOKEN FALL',
      'tokenfall.sub': '← → / A D 移动　·　接 TOKEN 与 COMPRESS，躲开 NOISE　·　P 暂停　·　M 静音',
      'tokenfall.aria': 'TOKEN FALL 游戏画面',
      'tokenfall.ariaLeft': '向左',
      'tokenfall.ariaRight': '向右',
      'tokenfall.score': 'SCORE',
      'tokenfall.ctxLabel': 'CONTEXT',
      'tokenfall.clean': 'CLEAN',
      'tokenfall.think': 'DEEP THINK',
      'tokenfall.thinkName': '<think>',
      'tokenfall.overflow': 'OVERFLOW',
      'tokenfall.over': '上下文溢出',
      'tokenfall.gameover': '游戏结束',
      'tokenfall.paused': '已暂停',
      'tokenfall.pausedHint': '按 P 继续',
      'tokenfall.pauseBtn': '⏸ 暂停',
      'tokenfall.resumeBtn': '▶ 继续',
      'tokenfall.ready': '接住 TOKEN，避开 NOISE，别让 CONTEXT 溢出',
      'tokenfall.hint': '← → 或 A D 左右移动　·　手机按住下方方向键　·　也可以直接拖动鲸鱼',
      'tokenfall.legend': 'TOKEN +32 · COMPRESS −256 · NOISE +128 · <think> 慢动作',
      'tokenfall.start': '按 空格 / 点击画面 开始',
      'tokenfall.restart': '按 空格 / 点击画面 重新开始',
      'tokenfall.short.token': 'T',
      'tokenfall.short.compress': 'C',
      'tokenfall.short.noise': 'N',
      'tokenfall.tips': '屏幕顶部落下 <b>TOKEN</b>（蓝）/ <b>COMPRESS</b>（青）/ <b>NOISE</b>（紫）/ <b>THINK</b>（金）。接 <b>TOKEN</b> 得分但 <b>CONTEXT +32</b>；接 <b>COMPRESS</b> 压缩 <b>CONTEXT −256</b>；<b>NOISE</b> 会让 <b>CONTEXT +128</b> 且不加分，必须躲开。<b>THINK</b> 是低概率道具，吃到进入 4 秒 <b>DEEP THINK</b>（下落变慢 + 泛蓝光）。CONTEXT 满 1024 后还有 <b>2 秒抢救时间</b>，吃到 COMPRESS 就能取消溢出；连续干净接取可以叠到 <b>CLEAN x5</b>。最高分存在本地浏览器里。',

      /* ---------- Attention Maze ---------- */
      'maze.title': 'Attention Maze · DeepSeek Arcade',
      'maze.h1': '🐳 ATTENTION MAZE',
      'maze.titleShort': 'ATTENTION MAZE',
      'maze.sub': '方向键 / WASD 走格子　·　SCAN 记住地图，FOCUS 只看身边一圈　·　P 暂停　·　R 重扫',
      'maze.desc': '记住路径 · 聚焦关键 · 找到出口',
      'maze.aria': 'ATTENTION MAZE 游戏画面',
      'maze.ariaUp': '向上',
      'maze.ariaDown': '向下',
      'maze.ariaLeft': '向左',
      'maze.ariaRight': '向右',
      'maze.layer': 'LAYER',
      'maze.scan': 'ATTENTION SCAN',
      'maze.scanHint': '记住地图：出口 / QUERY / KEY / VALUE 各在哪',
      'maze.focus': 'FOCUS MODE',
      'maze.query': 'QUERY',
      'maze.key': 'KEY',
      'maze.value': 'VALUE',
      'maze.short.q': 'Q',
      'maze.short.k': 'K',
      'maze.short.v': 'V',
      'maze.matched': 'ATTENTION MATCHED',
      'maze.low': 'LOW ATTENTION',
      'maze.multihead': 'MULTI-HEAD ATTENTION',
      'maze.head1': 'HEAD 1',
      'maze.head2': 'HEAD 2',
      'maze.combine': '综合两个注意力头',
      'maze.final': 'FINAL ATTENTION',
      'maze.obj.query': '寻找 QUERY',
      'maze.obj.key': '寻找 KEY',
      'maze.obj.value': '寻找 VALUE',
      'maze.obj.exit': '寻找出口',
      'maze.time': 'TIME',
      'maze.moves': 'MOVES',
      'maze.mistakes': 'MISTAKES',
      'maze.rescan': 'RESCAN',
      'maze.paused': '已暂停',
      'maze.resume': '继续',
      'maze.restart': '重新开始',
      'maze.pausedHint': '所有计时都已冻结',
      'maze.pauseBtn': '⏸ 暂停',
      'maze.resumeBtn': '▶ 继续',
      'maze.rescanBtn': '↻ RESCAN',
      'maze.restartBtn': '⟲ 重来本关',
      'maze.menuBtn': '☰ 选关',
      'maze.resetBtn': 'RESET PROGRESS',
      'maze.resetConfirm': '确认清空进度？',
      'maze.resetDone': '进度已清空',
      'maze.clear': 'LAYER CLEAR',
      'maze.locked': '还没解锁',
      'maze.best': 'BEST',
      'maze.star1': '1 星',
      'maze.star2': '2 星',
      'maze.star3': '3 星',
      'maze.menuHint': '点一个 LAYER 开始　·　也可以按 1-9',
      'maze.hasNext': '下一关已解锁',
      'maze.allClear': '全部 12 关完成！',
      'maze.tapNext': '点击画面 / 空格 继续',
      'maze.rescanNone': 'RESCAN 已经用完了',
      'maze.tip.scan': '记住地图，之后只剩身边一圈可见',
      'maze.tip.longPath': '路更长了，记住整条走廊怎么绕',
      'maze.tip.branches': '岔路很多，记住哪几列能上下走',
      'maze.tip.qkv': 'QUERY 会寻找最相关的 KEY',
      'maze.tip.weights': '权重越高，越是真正的 KEY',
      'maze.tip.value': '找对 KEY 才能解锁 VALUE',
      'maze.tip.focus': '视野更窄了，靠记忆走',
      'maze.tip.scanShort': '扫描时间变短了，看仔细',
      'maze.tip.multihead': '两个注意力头会关注不同的 KEY',
      'maze.tip.combineHint': '两个头都高的那个才是答案',
      'maze.tip.final': 'FINAL ATTENTION：把学过的全用上',
      'maze.tips': '<b>ATTENTION SCAN</b> 时整张地图可见，之后进入 <b>FOCUS MODE</b>：只看得到身边一圈，走过的地方留下很暗的残影。走到 <b>QUERY</b> 会亮起它到各个 <b>KEY</b> 的注意力连线与权重数字，记住权重最高的 KEY，走过去即 <b>ATTENTION MATCHED</b>，接着 <b>VALUE</b> 与 <b>EXIT</b> 依次解锁。后期出现 <b>MULTI-HEAD ATTENTION</b>：两个头分别给权重，要综合判断。走错 KEY 只记 1 次 MISTAKE，不会 Game Over；<b>RESCAN</b> 每关 1~2 次，用过最多只能拿 2 星。进度与星级存在本地浏览器里。'
    },
    en: {
      'app.title': 'Whale Runner · DeepSeek Arcade',
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
      'hud.hi': 'HI',

      'lobby.title': 'DEEPSEEK ARCADE',
      'lobby.sub': 'A tiny collection of DeepSeek-inspired games.',
      'lobby.hi': 'HIGH SCORE',
      'lobby.play': 'PLAY',

      'lobby.whale.name': 'WHALE RUNNER',
      'lobby.whale.desc': 'Jump · Dive · Survive',
      'lobby.snake.name': 'CONTEXT SNAKE',
      'lobby.snake.desc': 'Eat tokens · Grow context',
      'lobby.tokenfall.name': 'TOKEN FALL',
      'lobby.tokenfall.desc': 'Catch tokens · Manage context',
      'lobby.maze.name': 'ATTENTION MAZE',
      'lobby.maze.desc': 'Remember · Attend · Escape',
      'lobby.bestLayer': 'BEST LAYER',
      'lobby.more': 'More games may come later.',
      'lobby.footer': 'Unofficial fan project — not affiliated with DeepSeek.',
      'lobby.aria': 'DeepSeek Arcade game lobby',

      'ui.back': '← Back to Arcade',

      'snake.title': 'Context Snake · DeepSeek Arcade',
      'snake.h1': '🐳 Context Snake',
      'snake.sub': 'Arrows / WASD　·　eat TOKENs to grow your Context　·　P pause',
      'snake.aria': 'Context Snake game canvas',
      'snake.ctx': 'CONTEXT',
      'snake.think': 'DEEP THINK',
      'snake.ready': 'Press an arrow key / swipe to start',
      'snake.hint': 'Arrows · WASD · swipe or D-pad',
      'snake.paused': 'PAUSED',
      'snake.pausedHint': 'Press P to resume',
      'snake.over': 'G A M E   O V E R',
      'snake.restart': 'Press Space / tap to restart',
      'snake.ariaUp': 'Up',
      'snake.ariaDown': 'Down',
      'snake.ariaLeft': 'Left',
      'snake.ariaRight': 'Right',
      'snake.tips': 'Classic snake: eat <b>TOKEN</b>s to grow your Context, and avoid the walls and your own trail. A rare <b>THINK</b> drops you into 4 seconds of <b>DEEP THINK</b> — slower pace, blue glow. Your best score is saved in this browser.',

      'tokenfall.title': 'TOKEN FALL · DeepSeek Arcade',
      'tokenfall.h1': '🐳 TOKEN FALL',
      'tokenfall.sub': '← → / A D to move　·　catch TOKEN & COMPRESS, dodge NOISE　·　P pause　·　M mute',
      'tokenfall.aria': 'Token Fall game canvas',
      'tokenfall.ariaLeft': 'Left',
      'tokenfall.ariaRight': 'Right',
      'tokenfall.score': 'SCORE',
      'tokenfall.ctxLabel': 'CONTEXT',
      'tokenfall.clean': 'CLEAN',
      'tokenfall.think': 'DEEP THINK',
      'tokenfall.thinkName': '<think>',
      'tokenfall.overflow': 'OVERFLOW',
      'tokenfall.over': 'CONTEXT OVERFLOW',
      'tokenfall.gameover': 'GAME OVER',
      'tokenfall.paused': 'PAUSED',
      'tokenfall.pausedHint': 'Press P to resume',
      'tokenfall.pauseBtn': '⏸ Pause',
      'tokenfall.resumeBtn': '▶ Resume',
      'tokenfall.ready': 'Catch tokens, avoid noise, don\'t overflow your context',
      'tokenfall.hint': 'Move with ← → or A D　·　on mobile hold the arrows below　·　or drag the whale',
      'tokenfall.legend': 'TOKEN +32 · COMPRESS −256 · NOISE +128 · <think> slow-mo',
      'tokenfall.start': 'Press Space / tap to start',
      'tokenfall.restart': 'Press Space / tap to restart',

      /* ---------- Attention Maze ---------- */
      'maze.title': 'Attention Maze · DeepSeek Arcade',
      'maze.h1': '🐳 ATTENTION MAZE',
      'maze.titleShort': 'ATTENTION MAZE',
      'maze.sub': 'Arrows / WASD to step　·　SCAN to memorize, FOCUS shows only your surroundings　·　P pause　·　R rescan',
      'maze.desc': 'Remember · Attend · Escape',
      'maze.aria': 'Attention Maze game canvas',
      'maze.ariaUp': 'Up',
      'maze.ariaDown': 'Down',
      'maze.ariaLeft': 'Left',
      'maze.ariaRight': 'Right',
      'maze.layer': 'LAYER',
      'maze.scan': 'ATTENTION SCAN',
      'maze.scanHint': 'Memorize the map: exit, QUERY, KEY, VALUE',
      'maze.focus': 'FOCUS MODE',
      'maze.query': 'QUERY',
      'maze.key': 'KEY',
      'maze.value': 'VALUE',
      'maze.short.q': 'Q',
      'maze.short.k': 'K',
      'maze.short.v': 'V',
      'maze.matched': 'ATTENTION MATCHED',
      'maze.low': 'LOW ATTENTION',
      'maze.multihead': 'MULTI-HEAD ATTENTION',
      'maze.head1': 'HEAD 1',
      'maze.head2': 'HEAD 2',
      'maze.combine': 'Combine the heads',
      'maze.final': 'FINAL ATTENTION',
      'maze.obj.query': 'FIND QUERY',
      'maze.obj.key': 'FIND KEY',
      'maze.obj.value': 'FIND VALUE',
      'maze.obj.exit': 'FIND EXIT',
      'maze.time': 'TIME',
      'maze.moves': 'MOVES',
      'maze.mistakes': 'MISTAKES',
      'maze.rescan': 'RESCAN',
      'maze.paused': 'PAUSED',
      'maze.resume': 'RESUME',
      'maze.restart': 'RESTART',
      'maze.pausedHint': 'All timers are frozen',
      'maze.pauseBtn': '⏸ Pause',
      'maze.resumeBtn': '▶ Resume',
      'maze.rescanBtn': '↻ RESCAN',
      'maze.restartBtn': '⟲ Restart layer',
      'maze.menuBtn': '☰ Layers',
      'maze.resetBtn': 'RESET PROGRESS',
      'maze.resetConfirm': 'CONFIRM RESET?',
      'maze.resetDone': 'Progress cleared',
      'maze.clear': 'LAYER CLEAR',
      'maze.locked': 'LOCKED',
      'maze.best': 'BEST',
      'maze.star1': '1 STAR',
      'maze.star2': '2 STAR',
      'maze.star3': '3 STAR',
      'maze.menuHint': 'Tap a LAYER to start　·　or press 1-9',
      'maze.hasNext': 'Next layer unlocked',
      'maze.allClear': 'All 12 layers clear!',
      'maze.tapNext': 'Tap / Space to continue',
      'maze.rescanNone': 'No RESCAN left',
      'maze.tip.scan': 'Memorize the map — then only your surroundings stay visible',
      'maze.tip.longPath': 'Longer path — memorize how the corridor winds',
      'maze.tip.branches': 'Many branches — remember which columns connect',
      'maze.tip.qkv': 'A QUERY attends to the most relevant KEY',
      'maze.tip.weights': 'Higher weight = the true KEY',
      'maze.tip.value': 'Match the KEY to unlock the VALUE',
      'maze.tip.focus': 'Narrower view now — trust your memory',
      'maze.tip.scanShort': 'Shorter scan — look carefully',
      'maze.tip.multihead': 'Two heads attend to different KEYs',
      'maze.tip.combineHint': 'The KEY both heads prefer is the answer',
      'maze.tip.final': 'FINAL ATTENTION: everything at once',
      'maze.tips': '<b>ATTENTION SCAN</b> reveals the whole map, then <b>FOCUS MODE</b> shows only your surroundings, with a very dim trail of where you have been. Step on a <b>QUERY</b> to reveal its attention lines and weights to every <b>KEY</b>: remember the highest weight, walk there for <b>ATTENTION MATCHED</b>, and the <b>VALUE</b> then the <b>EXIT</b> unlock. Later layers add <b>MULTI-HEAD ATTENTION</b>: two heads give different weights you must combine. A wrong KEY only costs one MISTAKE — there is no game over. <b>RESCAN</b> is available 1-2 times per layer and caps the layer at 2 stars. Progress and stars are saved in this browser.',
      'tokenfall.short.token': 'T',
      'tokenfall.short.compress': 'C',
      'tokenfall.short.noise': 'N',
      'tokenfall.tips': 'Tokens fall from the top: <b>TOKEN</b> (blue) / <b>COMPRESS</b> (cyan) / <b>NOISE</b> (purple) / <b>THINK</b> (gold). A <b>TOKEN</b> scores but costs <b>CONTEXT +32</b>; a <b>COMPRESS</b> gives back <b>CONTEXT −256</b>; <b>NOISE</b> adds <b>CONTEXT +128</b> and no points, so dodge it. <b>THINK</b> is rare — grab it for 4 seconds of <b>DEEP THINK</b> (slower fall + blue glow). Hit 1024 and you get a <b>2-second rescue window</b>: catch a COMPRESS to cancel the overflow. Clean streaks stack up to <b>CLEAN x5</b>. Your best score is saved in this browser.'
    }
  };

  var STORAGE_KEY = 'arcade.lang';
  var LEGACY_KEY = 'whaleRunner.lang';   // 旧版单游戏时代的键：读到就沿用，不丢用户已有选择
  var DEFAULT_LANG = 'zh';
  var listeners = [];

  function readSaved() {
    try {
      if (!global.localStorage) return null;
      return global.localStorage.getItem(STORAGE_KEY) || global.localStorage.getItem(LEGACY_KEY);
    } catch (e) { return null; }
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
    // <title> 也带 data-i18n，所以不用为每个页面写单独的标题逻辑
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