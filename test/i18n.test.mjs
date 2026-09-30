/* 多语言：中英切换、持久化、浏览器语言检测、画布文案跟随。 */
import { harness, source } from './helpers.mjs';

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  {
    const b = harness({ navLang: 'zh-CN' });
    const h1 = b.byI18n('data-i18n', 'h1');
    const tips = b.byI18n('data-i18n-html', 'tips');
    ok('默认中文 h1', h1.textContent === '🐳 小鲸鱼跑酷', h1.textContent);
    ok('默认中文 tips 保留 <b> 标签', tips.innerHTML.indexOf('<b>海胆') > 0, tips.innerHTML.slice(0, 20));
    ok('默认中文 canvas aria-label', b.els.game.getAttribute('aria-label') === '小鲸鱼跑酷游戏画面');
    ok('默认中文 document.title', b.doc.title === '小鲸鱼跑酷 · DeepSeek Whale Runner', b.doc.title);
    ok('html lang=zh-CN', b.doc.documentElement.getAttribute('lang') === 'zh-CN');
    ok('语言按钮显示的是目标语言', b.els.lang.textContent === '🌐 English', b.els.lang.textContent);
    b.tick(3);
    ok('画布中文开场提示', b.log.texts.some((s) => s.indexOf('按 空格 / 点击画面 开始游动') >= 0));
    ok('画布 HI 前缀', b.log.texts.some((s) => s.indexOf('HI 00000') >= 0));

    b.els.lang.fire('click');
    ok('点击后切到 en', b.I18N.lang === 'en', b.I18N.lang);
    ok('英文 h1', h1.textContent === '🐳 Whale Runner', h1.textContent);
    ok('英文 tips', tips.innerHTML.indexOf('urchins') >= 0);
    ok('英文 canvas aria-label', b.els.game.getAttribute('aria-label') === 'Whale Runner game canvas');
    ok('英文 document.title', b.doc.title === 'Whale Runner · DeepSeek Whale', b.doc.title);
    ok('html lang=en', b.doc.documentElement.getAttribute('lang') === 'en');
    ok('语言按钮变中文', b.els.lang.textContent === '🌐 中文', b.els.lang.textContent);
    ok('音效按钮跟着变', b.els.sound.textContent === '🔊 Sound', b.els.sound.textContent);
    ok('全屏按钮跟着变', b.els.fullscreen.textContent === '⛶ Fullscreen', b.els.fullscreen.textContent);
    ok('选择写入 localStorage', b.store.get('whaleRunner.lang') === 'en');
    b.clearLog(); b.tick(3);
    ok('画布英文开场提示', b.log.texts.some((s) => s.indexOf('Press Space / tap to start') >= 0));

    b.els.lang.fire('click');
    ok('再点切回中文', b.I18N.lang === 'zh' && h1.textContent === '🐳 小鲸鱼跑酷', b.I18N.lang);
    ok('切回后写入 zh', b.store.get('whaleRunner.lang') === 'zh');
  }

  {
    const b = harness({ navLang: 'zh-CN' });
    b.els.lang.fire('click');
    b.tick(12);                        // ready 态：画布上会画开场提示与操作说明
    b.key('keydown', ' ', 'Space');
    b.key('keyup', ' ', 'Space');
    b.tick(1600);
    ok('英文 GAME OVER', b.log.texts.some((s) => s.indexOf('G A M E   O V E R') >= 0));
    ok('英文重开提示', b.log.texts.some((s) => s.indexOf('Press Space / tap to restart') >= 0));
    ok('英文提示行含 jump/dive', b.log.texts.some((s) => s.indexOf('jump') >= 0 && s.indexOf('dive') >= 0));
  }

  {
    const b = harness({ savedLang: 'en', navLang: 'zh-CN' });
    const h1 = b.byI18n('data-i18n', 'h1');
    ok('localStorage 优先于浏览器语言', b.I18N.lang === 'en' && h1.textContent === '🐳 Whale Runner', h1.textContent);
  }
  ok('navigator=en-US -> en', harness({ navLang: 'en-US' }).I18N.lang === 'en');
  ok('navigator=zh-TW -> zh', harness({ navLang: 'zh-TW' }).I18N.lang === 'zh');
  ok('未知语言回落中文', harness({ navLang: 'fr-FR' }).I18N.lang === 'zh');

  /* 词典完整性：中英 key 必须一一对应，且代码里用到的 key 都得有翻译 */
  {
    const dict = source('i18n.js');
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
      const reT = /T\('([^']+)'\)/g;
      const g = source('game.js');
      while ((m = reT.exec(g))) used.add(m[1]);
      const reA = /data-i18n(?:-html|-aria)?="([^"]+)"/g;
      const html = source('index.html');
      while ((m = reA.exec(html))) used.add(m[1]);
      const miss = [...used].filter((k) => !zh.has(k));
      ok('代码里用到的 ' + used.size + ' 个 key 都有翻译', miss.length === 0, '缺=' + miss.join(','));
    }
  }

  return out;
}