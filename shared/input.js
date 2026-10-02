/* ============================================================
 * DeepSeek Arcade — 键盘事件的「归属判断」（公共）
 *
 * 六款游戏都把 gameplay 快捷键挂在 document 上。如果不看事件目标，键盘用户
 * Tab 到按钮 / 链接 / 输入框之后再按 Space、Enter、方向键或字母，就会被
 * gameplay handler 抢走，而且往往还顺手 preventDefault 掉浏览器原生行为。
 *
 * 这个文件只回答一个问题：**这次按键该不该让给控件自己？**
 * 它不接管任何事件、不注册 gameplay 监听，只提供判断 + 一条焦点卫生规则。
 *
 * 用法（各游戏的 document keydown / keyup 开头）：
 *     if (ArcadeInput.yieldsToControl(e, k)) return;
 *
 * 规则：
 *   - Escape 永远留给游戏（关菜单 / 退出暂停是全局语义，任何焦点下都要能用）；
 *   - 焦点在 input / textarea / select / contenteditable 里时，一切按键都不抢
 *     —— 用户正在输入 p / m / n / r 这些字母，不能被当成 Pause / Mute / None / Rescan；
 *   - 焦点在 button / a / summary 等交互控件上时，Space / Enter / 方向键 / 字母
 *     都交给控件自身，避免「Tab 到按钮后按空格变成游戏动作」。
 * ============================================================ */
(function (global) {
  'use strict';

  var doc = global.document;

  /* 键盘能激活 / 需要键盘输入的元素 */
  var INTERACTIVE = { BUTTON: 1, A: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, SUMMARY: 1, OPTION: 1 };
  /* 正在做「文字 / 选项输入」的元素：连字母数字快捷键都不能抢 */
  var TEXT_ENTRY = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };

  function tagNameOf(node) {
    return node && node.tagName ? String(node.tagName).toUpperCase() : '';
  }

  function isInteractiveNode(node) {
    if (!node) return false;
    if (INTERACTIVE[tagNameOf(node)] === 1) return true;
    return node.isContentEditable === true;
  }

  function isTextEntryNode(node) {
    if (!node) return false;
    if (TEXT_ENTRY[tagNameOf(node)] === 1) return true;
    return node.isContentEditable === true;
  }

  /* 事件目标常常是控件内部的子元素（<button><span>…</span></button>），
   * 所以只判 e.target.tagName 是不够的，必须沿 parentNode 往上找。 */
  function ascend(node, predicate) {
    var t = node;
    while (t) {
      if (predicate(t)) return t;
      t = t.parentNode;
    }
    return null;
  }

  /* keydown 的 target 就是当前焦点元素；但合成事件 / 直接在 document 上派发的事件
   * 可能没有可用 target，那就退回 document.activeElement。 */
  function eventTarget(e) {
    var t = e && e.target;
    if (!t || !t.tagName) {
      var active = doc && doc.activeElement;
      if (active && active.tagName) t = active;
    }
    return t || null;
  }

  function isInteractiveTarget(e) {
    return !!ascend(eventTarget(e), isInteractiveNode);
  }

  function isTextEntryTarget(e) {
    return !!ascend(eventTarget(e), isTextEntryNode);
  }

  function yieldsToControl(e, key) {
    if (key === 'Escape' || key === 'Esc') return false;
    var target = eventTarget(e);
    if (!target) return false;
    if (ascend(target, isTextEntryNode)) return true;
    if (ascend(target, isInteractiveNode)) return true;
    return false;
  }

  /* ---------------- 焦点卫生 ----------------
   * 「焦点在控件上就不抢键」有个副作用：click 型的控件（暂停 / 音效 / 语言 / 开始…）
   * 被鼠标点过之后浏览器会把焦点留在它身上，于是方向键、跳跃键就全被让给控件，
   * 键盘玩家点一次暂停之后就再也操作不了游戏。
   * 各游戏的十字键本来就用 pointerdown + preventDefault 抢先、拿不到焦点；
   * 这里给剩下的 click 型控件补同一条规则：pointerup 时把焦点交还页面。
   * 只处理非文字输入控件，输入框 / 下拉框的焦点一律保留。 */
  var wired = false;
  function releaseFocusOnPointer() {
    if (wired || !doc || !doc.addEventListener) return;
    wired = true;
    doc.addEventListener('pointerup', function (e) {
      var ctrl = ascend(eventTarget(e), isInteractiveNode);
      if (!ctrl || isTextEntryNode(ctrl)) return;
      if (ctrl.blur) ctrl.blur();
    }, true);
  }
  releaseFocusOnPointer();

  global.ArcadeInput = {
    isInteractiveNode: isInteractiveNode,
    isTextEntryNode: isTextEntryNode,
    isInteractiveTarget: isInteractiveTarget,
    isTextEntryTarget: isTextEntryTarget,
    yieldsToControl: yieldsToControl,
    releaseFocusOnPointer: releaseFocusOnPointer
  };
})(window);
