/* 多语言：三个页面（大厅 / Whale Runner / Context Snake）的切换、持久化、
 * 浏览器语言检测、画布文案跟随，以及全站词典的完整性。 */
import { harness, source } from './helpers.mjs';

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ---------- Whale Runner 页面 ---------- */
  {
    const b = harness({ page: 'runner', navLang: 'zh-CN' });
    const h1 = b.byI18n('data-i18n', 'h1');
    const tips = b.byI18n('data-i18n-html', 'tips');
    ok('runner 默认中文 h1', h1.textContent === '🐳 小鲸鱼跑酷', h1.textContent);
    ok('runner tips 保留 <b> 标签', tips.innerHTML.indexOf('<b>海胆') > 0, tips.innerHTML.slice(0, 20));
    ok('runner canvas aria-label', b.els.game.getAttribute('aria-label') === '小鲸鱼跑酷游戏画面');
    ok('runner document.title', b.doc.title === '小鲸鱼跑酷 · DeepSeek Whale Runner', b.doc.title);
    ok('runner 返回按钮文案', b.els.back.textContent === '← 返回游戏厅', b.els.back.textContent);
    ok('html lang=zh-CN', b.doc.documentElement.getAttribute('lang') === 'zh-CN');
    ok('语言按钮显示目标语言', b.els.lang.textContent === '🌐 English', b.els.lang.textContent);
    b.tick(3);
    ok('runner 画布中文开场提示', b.log.texts.some((s) => s.indexOf('按 空格 / 点击画面 开始游动') >= 0));
    ok('runner 画布 HI 前缀', b.log.texts.some((s) => s.indexOf('HI 00000') >= 0));

    b.els.lang.fire('click');
    ok('切换后 I18N.lang=en', b.I18N.lang === 'en', b.I18N.lang);
    ok('runner 英文 h1', h1.textContent === '🐳 Whale Runner', h1.textContent);
    ok('runner 英文 tips', tips.innerHTML.indexOf('urchins') >= 0);
    ok('runner 英文 canvas aria-label', b.els.game.getAttribute('aria-label') === 'Whale Runner game canvas');
    ok('runner 英文 document.title', b.doc.title === 'Whale Runner · DeepSeek Arcade', b.doc.title);
    ok('runner 英文返回按钮', b.els.back.textContent === '← Back to Arcade', b.els.back.textContent);
    ok('html lang=en', b.doc.documentElement.getAttribute('lang') === 'en');
    ok('语言按钮变中文', b.els.lang.textContent === '🌐 中文', b.els.lang.textContent);
    ok('音效按钮跟着变', b.els.sound.textContent === '🔊 Sound', b.els.sound.textContent);
    ok('全屏按钮跟着变', b.els.fullscreen.textContent === '⛶ Fullscreen', b.els.fullscreen.textContent);
    ok('选择写入 localStorage(arcade.lang)', b.store.get('arcade.lang') === 'en', String(b.store.get('arcade.lang')));
    b.clearLog(); b.tick(3);
    ok('runner 画布英文开场提示', b.log.texts.some((s) => s.indexOf('Press Space / tap to start') >= 0));

    b.els.lang.fire('click');
    ok('再点切回中文', b.I18N.lang === 'zh' && h1.textContent === '🐳 小鲸鱼跑酷', b.I18N.lang);
    ok('切回后写入 zh', b.store.get('arcade.lang') === 'zh');
  }

  {
    const b = harness({ page: 'runner', navLang: 'zh-CN' });
    b.els.lang.fire('click');
    b.tick(12);
    b.key('keydown', ' ', 'Space');
    b.key('keyup', ' ', 'Space');
    b.tick(1600);
    ok('runner 英文 GAME OVER', b.log.texts.some((s) => s.indexOf('G A M E   O V E R') >= 0));
    ok('runner 英文重开提示', b.log.texts.some((s) => s.indexOf('Press Space / tap to restart') >= 0));
    ok('runner 英文提示行含 jump/dive', b.log.texts.some((s) => s.indexOf('jump') >= 0 && s.indexOf('dive') >= 0));
  }

  /* ---------- 大厅页面 ---------- */
  {
    const b = harness({ page: 'lobby', navLang: 'zh-CN',
      saved: { 'whaleRunner.high': '321', 'arcade.snake.high': '48', 'arcade.tokenFall.high': '77' } });
    const title = b.byI18n('data-i18n', 'lobby.title');
    ok('大厅标题', title.textContent === 'DEEPSEEK ARCADE', title.textContent);
    ok('大厅副标题中文', b.byI18n('data-i18n', 'lobby.sub').textContent.indexOf('同人') >= 0);
    ok('大厅 document.title', b.doc.title === 'DEEPSEEK ARCADE', b.doc.title);
    ok('大厅显示三处最高分', b.all.filter((e) => e.getAttribute('data-highscore')).every((e) => /\d/.test(e.textContent)),
       b.all.filter((e) => e.getAttribute('data-highscore')).map((e) => e.textContent).join('|'));
    ok('大厅读到 Whale Runner 的最高分', b.byI18n('data-highscore', 'runner').textContent === '321',
       b.byI18n('data-highscore', 'runner').textContent);
    ok('大厅读到 Context Snake 的最高分', b.byI18n('data-highscore', 'snake').textContent === '48',
       b.byI18n('data-highscore', 'snake').textContent);
    ok('大厅读到 Token Fall 的最高分', b.byI18n('data-highscore', 'tokenFall').textContent === '77',
       b.byI18n('data-highscore', 'tokenFall').textContent);
    ok('大厅有 3 个 PLAY 按钮文案（三款游戏都可玩）',
       b.all.filter((e) => e.getAttribute('data-i18n') === 'lobby.play').length === 3);
    ok('Token Fall 卡片描述（中文）', b.byI18n('data-i18n', 'lobby.tokenfall.desc').textContent === '接住 Token · 管理上下文',
       b.byI18n('data-i18n', 'lobby.tokenfall.desc').textContent);
    b.els.lang.fire('click');
    ok('大厅切英文', b.byI18n('data-i18n', 'lobby.sub').textContent.indexOf('DeepSeek-inspired') >= 0);
    ok('Token Fall 卡片描述（英文）', b.byI18n('data-i18n', 'lobby.tokenfall.desc').textContent === 'Catch tokens · Manage context',
       b.byI18n('data-i18n', 'lobby.tokenfall.desc').textContent);
    ok('大厅英文 COMING SOON', b.byI18n('data-i18n', 'lobby.soon').textContent === 'COMING SOON');
  }
  {
    const b = harness({ page: 'lobby', navLang: 'zh-CN' });
    ok('大厅无最高分时显示占位', b.all.filter((e) => e.getAttribute('data-highscore')).every((e) => e.textContent === '—'),
       b.all.filter((e) => e.getAttribute('data-highscore')).map((e) => e.textContent).join('|'));
  }

  /* ---------- Context Snake 页面 ---------- */
  {
    const b = harness({ page: 'snake', navLang: 'zh-CN' });
    ok('snake 中文标题', b.doc.title === 'Context 贪吃蛇 · DeepSeek Arcade', b.doc.title);
    ok('snake 中文 h1', b.byI18n('data-i18n', 'snake.h1').textContent === '🐳 Context 贪吃蛇');
    ok('snake canvas aria-label', b.els.game.getAttribute('aria-label') === 'Context Snake 游戏画面');
    ok('snake 十字键中文 aria', b.els.up.getAttribute('aria-label') === '向上', b.els.up.getAttribute('aria-label'));
    b.els.lang.fire('click');
    ok('snake 英文 h1', b.byI18n('data-i18n', 'snake.h1').textContent === '🐳 Context Snake');
    ok('snake 英文十字键 aria', b.els.up.getAttribute('aria-label') === 'Up', b.els.up.getAttribute('aria-label'));
    ok('snake 英文 tips', b.byI18n('data-i18n-html', 'snake.tips').innerHTML.indexOf('DEEP THINK') >= 0);
  }

  /* ---------- Token Fall 页面 ---------- */
  {
    const b = harness({ page: 'tokenfall', navLang: 'zh-CN' });
    ok('tokenfall 中文标题', b.doc.title === 'TOKEN FALL · DeepSeek Arcade', b.doc.title);
    ok('tokenfall 中文 h1', b.byI18n('data-i18n', 'tokenfall.h1').textContent === '🐳 TOKEN FALL');
    ok('tokenfall canvas aria-label', b.els.game.getAttribute('aria-label') === 'TOKEN FALL 游戏画面');
    ok('tokenfall 方向键中文 aria', b.els.left.getAttribute('aria-label') === '向左', b.els.left.getAttribute('aria-label'));
    ok('tokenfall 返回按钮文案', b.els.back.textContent === '← 返回游戏厅', b.els.back.textContent);
    ok('tokenfall 暂停按钮默认中文', b.els.pause.textContent === '⏸ 暂停', b.els.pause.textContent);
    b.els.lang.fire('click');
    ok('tokenfall 英文 h1', b.byI18n('data-i18n', 'tokenfall.h1').textContent === '🐳 TOKEN FALL');
    ok('tokenfall 英文 canvas aria-label', b.els.game.getAttribute('aria-label') === 'Token Fall game canvas');
    ok('tokenfall 英文方向键 aria', b.els.right.getAttribute('aria-label') === 'Right', b.els.right.getAttribute('aria-label'));
    ok('tokenfall 英文暂停按钮', b.els.pause.textContent === '⏸ Pause', b.els.pause.textContent);
    ok('tokenfall 英文返回按钮', b.els.back.textContent === '← Back to Arcade', b.els.back.textContent);
    ok('tokenfall 英文 tips 含玩法关键词',
       (function () {
         const html = b.byI18n('data-i18n-html', 'tokenfall.tips').innerHTML;
         return html.indexOf('COMPRESS') >= 0 && html.indexOf('NOISE') >= 0 && html.indexOf('DEEP THINK') >= 0;
       })(), b.byI18n('data-i18n-html', 'tokenfall.tips').innerHTML.slice(0, 60));
    b.tick(2);
    ok('tokenfall 英文画布文案', b.log.texts.some((s) => s.indexOf('Catch tokens') >= 0), b.log.texts.join('|').slice(0, 80));
  }

  /* ---------- 存储与检测 ---------- */
  {
    const b = harness({ page: 'runner', savedLang: 'en', navLang: 'zh-CN' });
    const h1 = b.byI18n('data-i18n', 'h1');
    ok('localStorage 优先于浏览器语言', b.I18N.lang === 'en' && h1.textContent === '🐳 Whale Runner', h1.textContent);
  }
  {
    const b = harness({ page: 'runner', saved: { 'whaleRunner.lang': 'en' }, navLang: 'zh-CN' });
    ok('兼容旧键 whaleRunner.lang', b.I18N.lang === 'en', b.I18N.lang);
  }
  ok('navigator=en-US -> en', harness({ navLang: 'en-US' }).I18N.lang === 'en');
  ok('navigator=zh-TW -> zh', harness({ navLang: 'zh-TW' }).I18N.lang === 'zh');
  ok('未知语言回落中文', harness({ navLang: 'fr-FR' }).I18N.lang === 'zh');

  /* ---------- 全站词典完整性 ---------- */
  {
    const dict = source('shared/i18n.js');
    const pick = (block) => {
      const set = new Set();
      let m; const re = /'([A-Za-z][A-Za-z0-9_.]*)':/g;
      while ((m = re.exec(block))) set.add(m[1]);
      return set;
    };
    const zhM = dict.match(/zh: \{([\s\S]*?)\n    \},/);
    const enM = dict.match(/en: \{([\s\S]*?)\n    \}\n/);
    ok('能解析出中英词表', !!zhM && !!enM);
    if (zhM && enM) {
      const zh = pick(zhM[1]); const en = pick(enM[1]);
      const missEn = [...zh].filter((k) => !en.has(k));
      const missZh = [...en].filter((k) => !zh.has(k));
      ok('中英词表 key 一一对应（' + zh.size + ' 条）', missEn.length === 0 && missZh.length === 0,
         '缺英文=' + missEn.join(',') + ' 缺中文=' + missZh.join(','));
      const used = new Set();
      let m;
      const addFrom = (text, re) => { let mm; while ((mm = re.exec(text))) used.add(mm[1]); };
      addFrom(source('games/runner/game.js'), /T\('([^']+)'\)/g);
      addFrom(source('games/snake/game.js'), /T\('([^']+)'\)/g);
      addFrom(source('games/token-fall/game.js'), /T\('([^']+)'\)/g);
      const reA = /data-i18n(?:-html|-aria)?="([^"]+)"/g;
      for (const f of ['index.html', 'games/runner/index.html', 'games/snake/index.html', 'games/token-fall/index.html']) {
        addFrom(source(f), reA);
      }
      const miss = [...used].filter((k) => !zh.has(k));
      ok('四个页面用到的 ' + used.size + ' 个 key 都有翻译', miss.length === 0, '缺=' + miss.join(','));

      /* TOKEN FALL 要求覆盖的文案一个都不能少（中英都要有） */
      const need = ['tokenfall.title', 'tokenfall.h1', 'tokenfall.sub', 'tokenfall.aria', 'tokenfall.ariaLeft',
        'tokenfall.ariaRight', 'tokenfall.score', 'tokenfall.ctxLabel', 'tokenfall.clean', 'tokenfall.think',
        'tokenfall.thinkName', 'tokenfall.overflow', 'tokenfall.over', 'tokenfall.gameover', 'tokenfall.paused',
        'tokenfall.pausedHint', 'tokenfall.pauseBtn', 'tokenfall.resumeBtn', 'tokenfall.ready', 'tokenfall.hint',
        'tokenfall.legend', 'tokenfall.start', 'tokenfall.restart', 'tokenfall.tips', 'tokenfall.short.token',
        'tokenfall.short.compress', 'tokenfall.short.noise', 'lobby.tokenfall.name', 'lobby.tokenfall.desc',
        'ui.back', 'hud.hi'];
      const miss2 = need.filter((k) => !zh.has(k) || !en.has(k));
      ok('TOKEN FALL 要求的 ' + need.length + ' 个 i18n key 中英齐全', miss2.length === 0, '缺=' + miss2.join(','));
    }
  }

  return out;
}
