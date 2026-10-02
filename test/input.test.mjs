/* 键盘归属：焦点在按钮 / 链接 / 输入框里时，gameplay 快捷键不能抢键。
 *
 * 这是**行为测试**，不是源码 regex：harness 现在有 parentNode 链、focus /
 * document.activeElement 和从焦点元素冒泡到 document 的按键派发，事件对象的
 * preventDefault 是真的会置 defaultPrevented —— 所以可以断言「游戏有没有被误触发」
 * 以及「有没有抢掉浏览器原生行为」。
 *
 * Node 这层负责逻辑；真实浏览器那一层交给 test/browser-smoke.mjs。 */
import { harness, source } from './helpers.mjs';

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });
  const I = (b) => b.window.ArcadeInput;
  const ev = (target) => ({ target: target });

  /* ================= A. 归属判断本身（shared/input.js） ================= */
  {
    const b = harness({ page: 'hunt' });
    const api = I(b);
    ok('shared/input.js 暴露 ArcadeInput.yieldsToControl', !!(api && typeof api.yieldsToControl === 'function'));

    ok('目标不是交互控件时不接管按键', api.yieldsToControl(ev(b.body), 'Space') === false);
    ok('按钮上的 Space 交给控件', api.yieldsToControl(ev(b.els.sound), 'Space') === true);
    ok('按钮上的 Enter 交给控件', api.yieldsToControl(ev(b.els.sound), 'Enter') === true);
    ok('按钮上的方向键交给控件', api.yieldsToControl(ev(b.els.sound), 'ArrowLeft') === true);
    ok('按钮上的字母键交给控件（p / m / r / n）',
      ['p', 'm', 'r', 'n'].every((k) => api.yieldsToControl(ev(b.els.sound), k) === true));
    ok('链接上的 Enter 交给控件', api.yieldsToControl(ev(b.els.back), 'Enter') === true);
    ok('Escape 仍留给游戏（关菜单 / 退暂停是全局语义）',
      api.yieldsToControl(ev(b.els.sound), 'Escape') === false);

    /* 只判 e.target.tagName 会漏掉控件内部的子元素 */
    const inner = { tagName: 'SPAN', parentNode: b.els.sound };
    ok('按钮内部的 <span> 也算交互控件（沿 parentNode 上溯）',
      api.isInteractiveTarget(ev(inner)) === true);

    ok('textarea 是文字输入目标', api.isTextEntryTarget(ev(b.els['share-out'])) === true);
    const editable = b.els.hud;
    editable.isContentEditable = true;
    ok('contenteditable 是文字输入目标', api.isTextEntryTarget(ev(editable)) === true);
    ok('contenteditable 上的字母键交给控件', api.yieldsToControl(ev(editable), 'm') === true);
  }

  /* ================= B. Hunt：intro 的 Daily Challenge ================= */
  {
    const b = harness({ page: 'hunt' });
    const H = b.window.HuntGame;
    ok('Hunt 初始停在 intro', H.game.state === 'intro', H.game.state);

    /* Tab 到 Daily Challenge 后按 Enter */
    b.els['btn-daily'].focus();
    const e1 = b.key('keydown', 'Enter', 'Enter');
    ok('焦点在 Daily Challenge 上按 Enter：没有被 preventDefault（原生激活不被抢）',
      e1.defaultPrevented === false);
    ok('焦点在 Daily Challenge 上按 Enter：state 仍是 intro（document handler 没有强制 start）',
      H.game.state === 'intro', H.game.state);

    b.els['btn-start'].focus();
    const e2 = b.key('keydown', ' ', 'Space');
    ok('焦点在 Endless 按钮上按 Space：同样不抢', e2.defaultPrevented === false && H.game.state === 'intro', H.game.state);

    /* 控件自己的路径必须仍然有效 */
    b.els['btn-daily'].fire('click');
    ok('点 Daily Challenge 按钮真的进 Daily（控件自身行为没被破坏）',
      H.game.mode === 'daily' && H.game.state !== 'intro', H.game.state + '/' + H.game.mode);
  }
  {
    /* 反向：焦点不在控件上时，键盘快捷键必须照旧可用 */
    const b = harness({ page: 'hunt' });
    const H = b.window.HuntGame;
    b.body.focus();
    const e = b.key('keydown', 'Enter', 'Enter');
    ok('焦点在页面上时 Enter 仍然启动 Endless 且由 gameplay 自己 preventDefault',
      H.game.state !== 'intro' && H.game.mode === 'endless' && e.defaultPrevented === true,
      H.game.state + '/' + H.game.mode + '/prevented=' + e.defaultPrevented);
  }

  /* ================= C. Context Breaker：「返回游戏厅」链接 ================= */
  {
    const b = harness({ page: 'contextbreaker', exposeGame: true });
    const g = b.window.__game;
    ok('Breaker 初始停在 serve', g.state === 'serve', g.state);

    b.els.back.focus();
    const e1 = b.key('keydown', 'Enter', 'Enter');
    ok('焦点在返回链接上按 Enter：没被 preventDefault（导航不会被拦）', e1.defaultPrevented === false);
    ok('焦点在返回链接上按 Enter：没有 launchBall（state 仍 serve）', g.state === 'serve', g.state);
    const e2 = b.key('keydown', ' ', 'Space');
    ok('焦点在返回链接上按 Space：同样不会变 playing', e2.defaultPrevented === false && g.state === 'serve', g.state);
  }
  {
    const b = harness({ page: 'contextbreaker', exposeGame: true });
    const g = b.window.__game;
    b.body.focus();
    b.key('keydown', 'Enter', 'Enter');
    ok('焦点不在控件上时 Enter 仍然发球（快捷键没被修坏）', g.state === 'playing', g.state);
  }

  /* ================= D. 传统游戏：焦点在按钮上按 Space / 方向键 ================= */
  {
    const b = harness({ page: 'runner', exposeGame: true });
    ok('Runner 初始停在 ready', b.G.state === 'ready', b.G.state);
    b.els.sound.focus();
    const e = b.key('keydown', ' ', 'Space');
    ok('Runner：焦点在音效按钮上按 Space 不起跑 / 不跳跃',
      e.defaultPrevented === false && b.G.state === 'ready', b.G.state);
  }
  {
    const b = harness({ page: 'runner', exposeGame: true });
    b.body.focus();
    b.key('keydown', ' ', 'Space');
    ok('Runner：焦点不在控件上时 Space 照旧起跑', b.G.state === 'running', b.G.state);
  }
  {
    const b = harness({ page: 'snake', exposeGame: true });
    b.els.up.focus();
    const e = b.key('keydown', 'ArrowRight', 'ArrowRight');
    ok('Snake：焦点在十字键按钮上按方向键不启动游戏、也不 preventDefault',
      e.defaultPrevented === false && b.G.state === 'ready', b.G.state);
  }
  {
    const b = harness({ page: 'snake', exposeGame: true });
    b.body.focus();
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    ok('Snake：焦点不在控件上时方向键照旧启动游戏', b.G.state === 'running', b.G.state);
  }
  {
    const b = harness({ page: 'tokenfall', exposeGame: true });
    b.els.pause.focus();
    const e = b.key('keydown', ' ', 'Space');
    ok('Token Fall：焦点在按钮上按 Space 不触发 tapAction',
      e.defaultPrevented === false && b.G.state === 'ready', b.G.state);
  }
  {
    const b = harness({ page: 'tokenfall', exposeGame: true });
    b.body.focus();
    b.key('keydown', ' ', 'Space');
    ok('Token Fall：焦点不在控件上时 Space 照旧生效', b.G.state === 'running', b.G.state);
  }
  {
    const b = harness({ page: 'attentionmaze', exposeGame: true });
    b.els.rescan.focus();
    const e = b.key('keydown', 'r', 'KeyR');
    ok('Attention Maze：焦点在 RESCAN 按钮上按 R 不触发 rescan',
      e.defaultPrevented === false, 'prevented=' + e.defaultPrevented);
    const e2 = b.key('keydown', 'ArrowRight', 'ArrowRight');
    ok('Attention Maze：焦点在按钮上按方向键也不被抢', e2.defaultPrevented === false);
  }

  /* ================= E. 文字输入：字母键绝不能被当成快捷键 ================= */
  {
    const b = harness({ page: 'hunt' });
    const sound = b.els.sound;
    const label = () => sound.textContent;
    const ta = b.els['share-out'];

    const before = label();
    ta.focus();
    const eM = b.key('keydown', 'm', 'KeyM');
    ok('textarea 里输入 m：没被 preventDefault', eM.defaultPrevented === false);
    ok('textarea 里输入 m：没有静音（音效标签没变）', label() === before, before + ' -> ' + label());
    const eP = b.key('keydown', 'p', 'KeyP');
    ok('textarea 里输入 p：没被 preventDefault（不会变成暂停）', eP.defaultPrevented === false);
    const eN = b.key('keydown', 'n', 'KeyN');
    ok('textarea 里输入 n：没被 preventDefault（不会变成 NO HALLUCINATION）', eN.defaultPrevented === false);

    /* 对照组：焦点离开输入框后，M 必须照旧静音 */
    b.body.focus();
    b.key('keydown', 'm', 'KeyM');
    ok('焦点不在输入框时 M 照旧静音（快捷键没被修坏）', label() !== before, before + ' -> ' + label());
  }
  {
    const b = harness({ page: 'contextbreaker', exposeGame: true });
    const sound = b.els.sound;
    const label = () => sound.textContent;
    const editable = b.els.game;
    editable.isContentEditable = true;
    const before = label();
    editable.focus();
    const e = b.key('keydown', 'm', 'KeyM');
    ok('contenteditable 里输入 m：没被 preventDefault、也没静音',
      e.defaultPrevented === false && label() === before, before + ' -> ' + label());
  }

  /* ================= F. 焦点卫生：点过的控件不能继续吃键盘 ================= */
  {
    const b = harness({ page: 'hunt' });
    const btn = b.els['btn-daily'];
    btn.focus();
    b.fireDoc('pointerup', { target: btn });
    ok('鼠标点过的按钮在 pointerup 后自动失焦（否则点一次暂停键盘就失灵）',
      b.doc.activeElement !== btn, b.doc.activeElement.tagName);
  }
  {
    const b = harness({ page: 'hunt' });
    const ta = b.els['share-out'];
    ta.focus();
    b.fireDoc('pointerup', { target: ta });
    ok('输入框的焦点不会被 pointerup 抢走', b.doc.activeElement === ta, b.doc.activeElement.tagName);
  }

  /* ================= G. 六款游戏都接了同一个判断（补充守卫） ================= */
  {
    const GAMES = ['games/runner/game.js', 'games/snake/game.js', 'games/token-fall/game.js',
      'games/attention-maze/game.js', 'games/context-breaker/game.js', 'games/hallucination-hunt/game.js'];
    for (const f of GAMES) {
      ok(f + ' 的键盘入口接了 ArcadeInput.yieldsToControl',
        source(f).indexOf('ArcadeInput.yieldsToControl') >= 0);
    }
    ok('六款游戏都从 window.ArcadeInput 取（脚本缺失时退化为不拦截，而不是崩）',
      GAMES.every((f) => source(f).indexOf('window.ArcadeInput ||') >= 0));
  }

  return out;
}
