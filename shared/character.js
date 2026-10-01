/* ============================================================
 * DeepSeek Arcade — 角色皮肤注册表（Classic / YunYue / Pixel）
 *
 * 设计目标：四款游戏只说「语义状态」（idle / walk / think …），
 * 由这张注册表决定当前皮肤该画哪张图、要不要开 imageSmoothing。
 * 游戏代码里不该出现任何素材文件名。
 *
 * 皮肤：
 *   classic  纯代码像素小鲸鱼（不由本模块绘制，draw() 返回 false）
 *   yunyue   YunYueSama/codex-deepseek-pet      —— 高清 Q 版动画，smoothing = true
 *   pixel    chenthreegold/deepseek-whale-pet   —— 像素画，smoothing = false
 *
 * 仍然零依赖 / 零构建 / 零网络请求：
 *   - localStorage key 固定 'arcade.characterSkin'，默认 classic；
 *   - 只预加载「当前皮肤」的素材，其它皮肤等切换或 hover 时再加载；
 *   - 素材没就绪时 draw() 返回 false，调用方照常画经典小鲸鱼，绝不会白屏。
 *
 * 用法：
 *   ArcadeCharacter.getSkin()                     // 'classic' | 'yunyue' | 'pixel'
 *   ArcadeCharacter.setSkin('pixel')              // 立刻写入 localStorage
 *   ArcadeCharacter.cycleSkin()                   // classic -> yunyue -> pixel -> classic
 *   ArcadeCharacter.getSkinInfo()                 // { id, label, smoothing, image, dir }
 *   ArcadeCharacter.measure('walk', 78)           // { w, h } 按素材比例算宽度
 *   ArcadeCharacter.ready('walk')                 // 这套皮肤的这个状态能不能画
 *   ArcadeCharacter.draw(ctx, 'walk', x, y, w, h, { time: ms, flip: true })
 *   ArcadeCharacter.frameIndex('walk', ms)        // 只算帧号，不画
 *   ArcadeCharacter.onChange(fn)                  // fn(skinId, 'skin' | 'assets')
 *   ArcadeCharacter.preloadSkin('pixel')
 *   ArcadeCharacter.preloadNext()                 // hover 时偷跑下一套
 *
 * 动画帧只由时间决定（frame = floor(time / frameMs) % frames.length），
 * time 由调用方给，所以暂停、切标签页时动画会跟着游戏世界一起冻结。
 *
 * 版权：本文件是 DeepSeek Arcade 自己的 MIT 代码；
 * 两套图片素材各有各的授权，见 THIRD_PARTY_NOTICES.md 与各自的 ATTRIBUTION.md。
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'arcade.characterSkin';
  var CLASSIC = 'classic';
  var ORDER = [CLASSIC, 'yunyue', 'pixel'];

  /* 旧版本只存过 'whalechan'（已删除的第三方皮肤）。
   * 用户当初是主动选了「鲸鱼娘」，所以迁到最接近的动画鲸鱼娘而不是退回经典，
   * 但旧素材本身不再加载、不再存在。 */
  var LEGACY = { whalechan: 'yunyue' };

  var STATES = ['idle', 'walk', 'jump', 'dive', 'think', 'startle', 'blocked', 'head', 'headThink'];

  /* 一个状态 = 一组不重复的文件 + 播放顺序 + 每帧毫秒。
   * n === 1 时文件名不带序号（jump.webp / head.webp）。
   * seq 用来表达「同一张图在循环里出现多次」：上游 Pixel 图集的 8 帧跑动其实
   * 只有 3 个不重复姿势，去重后只存 3 个文件，靠 seq 还原原播放顺序。 */
  function state(files, frameMs, ratio, order) {
    return { frames: files, frameMs: frameMs, ratio: ratio, order: order || null };
  }
  function run(prefix, n, frameMs, ratio, order) {
    var files = [];
    for (var i = 0; i < n; i++) files.push(n === 1 ? prefix + '.webp' : prefix + '-' + i + '.webp');
    return state(files, frameMs, ratio, order);
  }
  function one(prefix, frameMs, ratio) { return run(prefix, 1, frameMs, ratio); }
  function len(d) { return d.order ? d.order.length : d.frames.length; }
  function fileAt(d, i) { return d.order ? d.frames[d.order[i]] : d.frames[i]; }

  var YUNYUE_RATIO = 192 / 208;    // 全身画布 192×208
  var PIXEL_RATIO = 72 / 88;       // 原生像素网格 72×88
  var HEAD_RATIO = 1;              // 头像一律正方形

  var SKINS = {
    classic: {
      id: CLASSIC, label: 'skin.classic', smoothing: false,
      dir: null, bodyRatio: 1, image: false, states: null
    },
    yunyue: {
      id: 'yunyue', label: 'skin.yunyue', smoothing: true,
      dir: 'assets/whale-yunyue/', bodyRatio: YUNYUE_RATIO, image: true,
      states: {
        /* motion-idle 0~3：上游 clips.shift / clips.settle 用的轻微换重心 */
        idle: run('idle', 4, 260),
        /* inbetween-walk ＝上游真正在播的整身步态，等间隔取 8 帧，总时长仍是 960ms */
        walk: run('walk', 8, 120),
        jump: one('jump', 400),          // dense-jump 腾空帧
        dive: one('dive', 400),          // dense-jump 落地压缩帧（低姿态）
        think: one('think', 400),        // story-token 工作姿势
        startle: one('startle', 300),    // actions 惊慌帧
        blocked: one('blocked', 400),    // expressions 崩溃帧
        head: one('head', 1000, HEAD_RATIO),
        headThink: one('head-think', 1000, HEAD_RATIO)
      }
    },
    pixel: {
      id: 'pixel', label: 'skin.pixel', smoothing: false,
      dir: 'assets/whale-pixel/', bodyRatio: PIXEL_RATIO, image: true,
      states: {
        /* 上游 idle[dy=0,1,0,-1] 的上下浮动（去重后 3 张图） */
        idle: run('idle', 3, 200, null, [0, 1, 0, 2]),
        /* running-right 的完整一步：3 个姿势 + 2/4px 位移，按上游顺序循环 */
        walk: run('walk', 3, 100, null, [0, 1, 2, 1, 0, 1, 2, 1]),
        /* jumping：蹲 -> 腾空 -> 落地 */
        jump: run('jump', 4, 90, null, [0, 1, 2, 1, 3]),
        dive: one('dive', 400),          // 同一行里最低的姿态
        think: run('think', 2, 260),     // review：arm="think" + sparkle
        startle: run('startle', 2, 180), // waiting：冒号抖动
        blocked: run('blocked', 3, 160, null, [0, 1, 0, 2, 0, 1, 0, 2]),   // failed：垂手 + 汗
        head: one('head', 1000, HEAD_RATIO),
        headThink: one('head-think', 1000, HEAD_RATIO)
      }
    }
  };

  /* ---------------- 素材目录按脚本自己的 URL 推导 ----------------
   * shared/character.js -> <页面根>/assets/whale-<皮肤>/
   * http://、GitHub Pages 项目子路径、file:// 三种情况都能用相对根路径，
   * 绝不写死站点绝对路径 /assets/。 */
  function scriptSrc() {
    try {
      var s = global.document && global.document.currentScript;
      if (s && s.src) return String(s.src);
      var all = global.document && global.document.querySelectorAll ? global.document.querySelectorAll('script[src]') : null;
      for (var i = 0; all && i < all.length; i++) {
        var src = String(all[i].src || '');
        if (/shared\/character\.js(\?.*)?$/.test(src)) return src;
      }
    } catch (e) { /* 忽略 */ }
    return '';
  }
  function detectBase() {
    var src = scriptSrc();
    if (src) return src.replace(/shared\/character\.js(\?.*)?$/, '');
    return '';
  }
  var BASE = detectBase();

  function urlFor(skinId, file) {
    var def = SKINS[skinId];
    return BASE + def.dir + file;
  }

  /* ---------------- 皮肤状态 ---------------- */
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function normalize(v) {
    v = String(v === null || v === undefined ? '' : v).toLowerCase();
    for (var i = 0; i < ORDER.length; i++) if (ORDER[i] === v) return v;
    return LEGACY[v] || null;
  }
  function isLegacy(v) {
    v = String(v === null || v === undefined ? '' : v).toLowerCase();
    return has(LEGACY, v);
  }
  function readRaw() {
    try { return global.localStorage ? global.localStorage.getItem(KEY) : null; }
    catch (e) { return null; }
  }
  function save(skin) {
    try { if (global.localStorage) global.localStorage.setItem(KEY, skin); } catch (e) { /* 隐私模式忽略 */ }
  }

  var raw = readRaw();
  var saved = normalize(raw);
  if (isLegacy(raw)) save(saved);                 // whalechan -> yunyue，写回一次
  var current = saved || CLASSIC;                 // 没存过 / 非法值 -> classic

  var cache = {};        // skinId -> { 文件名: { img, state } }
  var pending = {};      // skinId -> 还在加载的张数
  var listeners = [];

  function fire(skinId, reason) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](skinId, reason); } catch (e) { /* 回调出错不影响切换 */ }
    }
  }

  function isImageSkin(skinId) { return !!(SKINS[skinId] && SKINS[skinId].image); }

  /* ---------------- 懒加载：一次 new Image 就够，切回来不会重复加载 ---------------- */
  function imageCtor() {
    return (typeof global.Image === 'function') ? global.Image : null;
  }
  function finish(entry, skinId, ok) {
    entry.state = (ok && entry.img && entry.img.naturalWidth > 0) ? 'ready' : 'error';
    if (pending[skinId] > 0) pending[skinId]--;
    /* 只有「当前皮肤」的素材到位才需要重画，别的皮肤在后台慢慢下就好 */
    if (pending[skinId] === 0 && skinId === current) fire(skinId, 'assets');
  }
  function preloadSkin(skinId) {
    var def = SKINS[skinId];
    if (!def || !def.states) return false;
    var Img = imageCtor();
    if (!Img) return false;                        // 无 DOM/Image 的环境：全部走 classic 回退
    var bucket = cache[skinId] || (cache[skinId] = {});
    var started = false;
    for (var st in def.states) {
      if (!has(def.states, st)) continue;
      var files = def.states[st].frames;
      for (var i = 0; i < files.length; i++) {
        if (bucket[files[i]]) continue;            // 已经加载过（含失败的）就不再发一次请求
        var entry = { img: new Img(), state: 'loading' };
        bucket[files[i]] = entry;
        pending[skinId] = (pending[skinId] || 0) + 1;
        started = true;
        (function (e, src, id) {
          e.img.onload = function () { finish(e, id, true); };
          e.img.onerror = function () { finish(e, id, false); };
          e.img.src = src;
        })(entry, urlFor(skinId, files[i]), skinId);
      }
    }
    return started;
  }
  function preloadNext() {
    return preloadSkin(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }

  /* ---------------- 当前皮肤 ---------------- */
  function getSkin() { return current; }
  function getSkinInfo(id) {
    var def = SKINS[id || current] || SKINS[CLASSIC];
    return { id: def.id, label: def.label, smoothing: def.smoothing, image: !!def.image, dir: def.dir };
  }
  function setSkin(name) {
    var v = normalize(name) || CLASSIC;
    var changed = v !== current;
    current = v;
    save(v);
    preloadSkin(v);                                // 切过去就开始加载，素材到位会自动重画
    if (changed) fire(v, 'skin');
    return current;
  }
  function nextSkin() { return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]; }
  function cycleSkin() { return setSkin(nextSkin()); }
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* ---------------- 帧查询 ---------------- */
  function stateDef(skinId, state) {
    var def = SKINS[skinId];
    return (def && def.states && def.states[state]) || null;
  }
  function frameCount(skinState, skinId) {
    var d = stateDef(skinId || current, skinState);
    return d ? len(d) : 0;
  }
  function frameMs(state, skinId) {
    var d = stateDef(skinId || current, state);
    return d ? d.frameMs : 0;
  }
  /* 时间 -> 帧号。除以 render 次数是错的做法：60/120/144Hz 会跑出三种速度。 */
  function frameIndex(skinState, time, skinId) {
    var d = stateDef(skinId || current, skinState);
    if (!d) return -1;
    var n = len(d);
    if (n <= 1) return 0;
    var t = Number(time);
    if (!isFinite(t) || t < 0) t = 0;
    return Math.floor(t / d.frameMs) % n;
  }
  function readyFrame(skinState, index, skinId) {
    skinId = skinId || current;
    var d = stateDef(skinId, skinState);
    var bucket = cache[skinId];
    if (!d || !bucket) return null;
    var e = bucket[fileAt(d, index)];
    return (e && e.state === 'ready') ? e : null;
  }
  function anyReadyFrame(state, skinId) {
    skinId = skinId || current;
    var n = frameCount(state, skinId);
    for (var i = 0; i < n; i++) { var e = readyFrame(state, i, skinId); if (e) return e; }
    return null;
  }
  /* 缺一张图不该让整套皮肤消失：目标帧没好就退到第 0 帧，再退到任意可用帧。 */
  function resolveFrame(state, time, skinId) {
    skinId = skinId || current;
    var i = frameIndex(state, time, skinId);
    if (i < 0) return null;
    return readyFrame(state, i, skinId) || readyFrame(state, 0, skinId) || anyReadyFrame(state, skinId);
  }

  /* 这套皮肤的这个状态画得出来吗（至少有一帧解码成功） */
  function ready(state) { return isImageSkin(current) && !!anyReadyFrame(state); }
  /* 当前皮肤是否真的在画图片（不是回退成 classic） */
  function isActive() { return isImageSkin(current) && !!anyReadyFrame('idle'); }
  function ratioOf(state, skinId) {
    var d = stateDef(skinId || current, state);
    if (d && typeof d.ratio === 'number') return d.ratio;
    var def = SKINS[skinId || current];
    return (def && def.bodyRatio) || 1;
  }
  /* 游戏拿不到素材尺寸（还没加载），所以比例由注册表给，避免拉伸变形 */
  function measure(state, height) {
    var r = ratioOf(state);
    return { w: Math.round(height * r), h: height };
  }

  /* ---------------- 绘制 ----------------
   * 返回 false = 没画（当前是 classic / 素材没就绪 / 非法状态），
   * 调用方继续画经典小鲸鱼即可。画完一定把 imageSmoothingEnabled 和
   * globalAlpha 恢复原值，不污染同屏的其它物体。 */
  function draw(ctx, state, x, y, w, h, opts) {
    if (!ctx || typeof ctx.drawImage !== 'function') return false;
    opts = opts || {};
    if (!isImageSkin(current)) return false;
    var entry = resolveFrame(state, opts.time);
    if (!entry) return false;

    var def = SKINS[current];
    var prevSmooth = ctx.imageSmoothingEnabled;
    var prevAlpha = ctx.globalAlpha;
    ctx.imageSmoothingEnabled = def.smoothing;     // 像素画必须关掉双线性，插画必须打开
    if (typeof opts.alpha === 'number') {
      ctx.globalAlpha = (typeof prevAlpha === 'number' ? prevAlpha : 1) * opts.alpha;
    }
    if (opts.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(entry.img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(entry.img, x, y, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.globalAlpha = prevAlpha;
    return true;
  }

  global.ArcadeCharacter = {
    KEY: KEY,
    CLASSIC: CLASSIC,
    SKINS: ORDER.slice(),
    LEGACY: LEGACY,
    STATES: STATES.slice(),
    getSkin: getSkin,
    setSkin: setSkin,
    cycleSkin: cycleSkin,
    nextSkin: nextSkin,
    getSkinInfo: getSkinInfo,
    onChange: onChange,
    preloadSkin: preloadSkin,
    preloadNext: preloadNext,
    ready: ready,
    isActive: isActive,
    frameCount: frameCount,
    frameMs: frameMs,
    frameIndex: frameIndex,
    ratio: ratioOf,
    measure: measure,
    /* 这套皮肤要用到的全部文件名（去重），测试与文档用它核对素材是否存在 */
    files: function (skinId) {
      var def = SKINS[skinId || current];
      if (!def || !def.states) return [];
      var list = [];
      for (var st in def.states) {
        if (!has(def.states, st)) continue;
        var f = def.states[st].frames;
        for (var i = 0; i < f.length; i++) if (list.indexOf(f[i]) < 0) list.push(f[i]);
      }
      return list;
    },
    draw: draw,
    basePath: function () { return BASE; },
    assetUrl: function (skinId, file) { return urlFor(skinId, file); },
    /* 测试用：无 DOM 环境下模拟「素材已就绪」/ 清空缓存 */
    __markReady: function (state, skinId) {
      skinId = skinId || current;
      var d = stateDef(skinId, state);
      if (!d) return false;
      var bucket = cache[skinId] || (cache[skinId] = {});
      for (var i = 0; i < d.frames.length; i++) {
        bucket[d.frames[i]] = bucket[d.frames[i]] || { img: { naturalWidth: 1 }, state: 'ready' };
        bucket[d.frames[i]].state = 'ready';
      }
      pending[skinId] = 0;
      return true;
    },
    __reset: function () { cache = {}; pending = {}; }
  };

  /* 启动时只加载当前皮肤：classic 用户不会为两套鲸鱼娘下载任何一张图。 */
  preloadSkin(current);
})(window);
