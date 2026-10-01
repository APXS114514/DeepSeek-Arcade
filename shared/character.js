/* ============================================================
 * DeepSeek Arcade — 全站角色皮肤（Classic Whale / Whale-chan）
 *
 * 只做三件事，继续保持零依赖、零构建：
 *   1. 记住玩家选的角色（localStorage: arcade.characterSkin，默认 classic）；
 *   2. 预加载 Whale-chan 的 WebP 素材（一次性，之后只从缓存里取）；
 *   3. 给游戏提供一个「画不出来就返回 false」的绘制入口，
 *      素材 404 / 解码失败时调用方直接退回经典小鲸鱼，绝不破坏玩法。
 *
 * 用法：
 *   ArcadeCharacter.getSkin()        // "classic" | "whalechan"
 *   ArcadeCharacter.setSkin("whalechan")
 *   ArcadeCharacter.toggleSkin()
 *   ArcadeCharacter.isWhaleChan()
 *   ArcadeCharacter.onChange(fn)     // 换皮肤 / 素材加载完成都会回调
 *   ArcadeCharacter.ready("idle")    // 这张图能不能画
 *   ArcadeCharacter.draw(ctx, "idle", x, y, w, h, { flip: true })
 *
 * 角色皮肤**只影响视觉**：不碰最高分、进度、音效开关、语言。
 * Whale-chan 图片是第三方素材（CC BY 4.0，作者 Er1c0v0），
 * 不属于本项目的 MIT 授权 —— 见 assets/whale-chan/ATTRIBUTION.md。
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'arcade.characterSkin';
  var CLASSIC = 'classic';
  var CHAN = 'whalechan';
  var SKINS = [CLASSIC, CHAN];

  /* 运行时素材：全部是上游 CC BY 4.0 素材的派生 WebP（去背 / 裁切 / 等比缩放）。
   * 同一组身体素材共用一张 300×340 画布，所以换帧不会错位。 */
  var FILES = {
    idle: 'whalechan-idle.webp',
    move: 'whalechan-move.webp',
    jump: 'whalechan-jump.webp',
    dive: 'whalechan-dive.webp',
    think: 'whalechan-think.webp',
    startle: 'whalechan-startle.webp',
    blocked: 'whalechan-blocked.webp',
    head: 'whalechan-head.webp',
    headThink: 'whalechan-head-think.webp'
  };

  /* 素材目录按脚本自己的 URL 推导：shared/character.js -> ../assets/whale-chan/
   * 这样 http://、GitHub Pages 子路径、file:// 三种情况都用相对路径，不写死 /assets/。 */
  function detectBase() {
    try {
      var s = global.document && global.document.currentScript;
      if (s && s.src) return String(s.src).replace(/shared\/character\.js(\?.*)?$/, 'assets/whale-chan/');
    } catch (e) { /* 忽略 */ }
    return 'assets/whale-chan/';
  }
  var BASE = detectBase();

  var assets = {};        // name -> { img, state: "loading" | "ready" | "error" }
  var listeners = [];
  var pendingReady = 0;

  /* ---------------- 皮肤状态 ---------------- */
  function normalize(v) {
    v = String(v || '').toLowerCase();
    if (v === CHAN) return CHAN;
    if (v === CLASSIC) return CLASSIC;
    return null;
  }
  function readSaved() {
    try { return normalize(global.localStorage && global.localStorage.getItem(KEY)); }
    catch (e) { return null; }
  }
  function save(skin) {
    try { if (global.localStorage) global.localStorage.setItem(KEY, skin); } catch (e) { /* 隐私模式忽略 */ }
  }

  var current = readSaved() || CLASSIC;    // 非法值 / 没存过 -> classic，老玩家不会被突然换角色

  function fire(reason) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](current, reason); } catch (e) { /* 回调出错不影响切换 */ }
    }
  }

  function getSkin() { return current; }
  function setSkin(name) {
    var v = normalize(name) || CLASSIC;
    var changed = v !== current;
    current = v;
    save(v);
    preload();                              // 切到 whalechan 时确保素材在加载
    if (changed) fire('skin');
    return current;
  }
  function toggleSkin() { return setSkin(current === CHAN ? CLASSIC : CHAN); }
  function isWhaleChan() { return current === CHAN; }
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* ---------------- 素材预加载（只做一次，绝不在 render 里 new Image） ---------------- */
  function imageCtor() {
    if (typeof global.Image === 'function') return global.Image;
    return null;                            // 无 DOM/Image 的环境：全部走 classic 回退
  }
  function preload() {
    var Img = imageCtor();
    if (!Img) return false;
    for (var name in FILES) {
      if (!Object.prototype.hasOwnProperty.call(FILES, name)) continue;
      if (assets[name]) continue;
      var entry = { img: new Img(), state: 'loading' };
      assets[name] = entry;
      pendingReady++;
      (function (e, fileName) {
        e.img.onload = function () {
          /* 解码成功但尺寸为 0 的伪成功也算失败，避免画出一个空白角色 */
          e.state = (e.img.naturalWidth === 0) ? 'error' : 'ready';
          pendingReady--;
          if (pendingReady <= 0) fire('assets');
        };
        e.img.onerror = function () {
          e.state = 'error';
          pendingReady--;
          if (pendingReady <= 0) fire('assets');
        };
        e.img.src = BASE + fileName;
      })(entry, FILES[name]);
    }
    return true;
  }

  /* 某张素材能不能画：必须已经解码完成。加载中/失败都返回 false，
   * 调用方据此回退到经典小鲸鱼 —— 加载失败绝不会让角色消失或报错。 */
  function ready(name) {
    var e = assets[name];
    return !!(e && e.state === 'ready');
  }
  function anyReady() {
    for (var name in FILES) if (ready(name)) return true;
    return false;
  }
  /* 是否「whalechan 素材可用」：当前皮肤是 whalechan 且至少有一张已就绪 */
  function active() { return current === CHAN && anyReady(); }

  /* ---------------- 绘制入口 ----------------
   * 返回 false = 没画（调用方自己画经典小鲸鱼）。
   * Whale-chan 是插画不是像素画：这里临时打开 imageSmoothing，
   * 画完恢复原状态，不会把同屏的像素物体糊掉。 */
  function draw(ctx, name, x, y, w, h, opts) {
    if (!ctx || !ctx.drawImage || !ready(name)) return false;
    opts = opts || {};
    var e = assets[name];
    var prevSmooth = ctx.imageSmoothingEnabled;
    var prevAlpha = ctx.globalAlpha;
    ctx.imageSmoothingEnabled = true;
    if (typeof opts.alpha === 'number') ctx.globalAlpha = prevAlpha * opts.alpha;
    if (opts.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(e.img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(e.img, x, y, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.globalAlpha = prevAlpha;
    return true;
  }

  global.ArcadeCharacter = {
    KEY: KEY,
    CLASSIC: CLASSIC,
    WHALECHAN: CHAN,
    SKINS: SKINS,
    FILES: FILES,
    getSkin: getSkin,
    setSkin: setSkin,
    toggleSkin: toggleSkin,
    isWhaleChan: isWhaleChan,
    isActive: active,
    onChange: onChange,
    ready: ready,
    draw: draw,
    preload: preload,
    basePath: function () { return BASE; },
    /* 测试用：把素材标记成已就绪（无 DOM 环境下模拟加载成功） */
    __markReady: function (name) { assets[name] = assets[name] || { img: null }; assets[name].state = 'ready'; },
    __reset: function () { assets = {}; pendingReady = 0; }
  };

  /* 立刻开始预加载：new Image() + src 本身不阻塞渲染，浏览器会并行下载这 9 张
   * 小图（合计 ~180KB），这样大厅一按切换就能立刻换人，不用等下一次交互。 */
  preload();
})(window);
