/* v1.0 工程化收口的结构性回归：
 *   CI 先测后发、全站统一 Sound（含旧 key 迁移）、共享鲸鱼素材、
 *   Attention Maze 关卡拆分、README / docs / LICENSE 约定、返回大厅链接。
 * 玩法数值本身由各自套件覆盖，这里只保证“结构没被改坏”。 */
import fs from 'node:fs';
import path from 'node:path';
import { harness, source, ROOT } from './helpers.mjs';

const SOUND_LABEL = '🔊 音效';
const MUTED_LABEL = '🔇 静音';
const GAME_PAGES = ['runner', 'snake', 'tokenfall', 'attentionmaze'];
const LEGACY = {
  runner: 'whaleRunner.sound',
  snake: 'arcade.snake.sound',
  tokenfall: 'arcade.tokenFall.sound',
  attentionmaze: 'arcade.attentionMaze.sound'
};
/* 关卡指纹：把 12 个 Layer 的地图 / 节点 / 权重 / 答案 / par 全部压成一个短哈希。
 * 拆分文件前后必须一模一样 —— 这条挂了说明有人动了关卡内容或平衡。 */
const LAYER_HASHES = ['42e9ed3a', '75546b58', '380d07b3', '9caa1dc0', '9fe130f6', 'e7d5415',
  '43cd73b5', 'a27338d0', '1c3931ec', '584cddc', 'b7534dea', '15b4654d'];
const LAYER_ANSWERS = ['-', '-', '-', 'K2', 'K2', 'K3', 'K2', 'K2', 'K3', 'K2', 'K2', 'K1'];

function layerSignature(L) {
  const n = L.nodes;
  const keys = n.keys.map((k) => k.id + '@' + k.x + ',' + k.y + ':' + k.w.toFixed(2)).join(' ');
  return [
    L.map.join('/'),
    'S' + n.start.x + ',' + n.start.y,
    'E' + n.exit.x + ',' + n.exit.y,
    n.query ? 'Q' + n.query.x + ',' + n.query.y : 'Q-',
    n.value ? 'V' + n.value.x + ',' + n.value.y : 'V-',
    keys,
    'A=' + (L.answer || '-'),
    L.heads ? 'H=' + L.heads.map((h) => h.join(',')).join('|') : 'H-',
    'scan' + L.scanMs + ' focus' + L.focus + ' rescan' + L.rescan + ' par' + L.parTime + '/' + L.parMoves,
    L.tip || '-'
  ].join(' ; ');
}
function layerHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function soundPage(page, saved) {
  return harness({ page: page, navLang: 'zh-CN', saved: saved });
}

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ================= A. CI：先测后发 ================= */
  {
    const wfPath = path.join(ROOT, '.github/workflows/pages.yml');
    ok('workflow 文件存在', fs.existsSync(wfPath));
    const wf = source('.github/workflows/pages.yml');
    ok('用 GitHub 官方 actions/setup-node@v4', /actions\/setup-node@v4/.test(wf));
    ok('Node 版本固定在 20', /node-version:\s*'20'/.test(wf));
    ok('CI 跑的就是本地那条命令（node test/run.mjs）', /run:\s*node test\/run\.mjs/.test(wf));
    ok('有独立的 test job', /^  test:/m.test(wf));
    ok('有独立的 deploy job', /^  deploy:/m.test(wf));
    ok('deploy 依赖 test（needs: test）→ 测试不过就不部署', /needs:\s*test\b/.test(wf));
    ok('test job 排在 deploy 之前', wf.indexOf('  test:') < wf.indexOf('  deploy:'));
    ok('保留 push main 与 workflow_dispatch', /branches:\s*\[main\]/.test(wf) && /workflow_dispatch:/.test(wf));
    ok('Pages 三件套没被破坏',
      /actions\/configure-pages@v5/.test(wf) && /actions\/upload-pages-artifact@v3/.test(wf) && /actions\/deploy-pages@v4/.test(wf));
    ok('零依赖：workflow 里没有 npm install', !/npm\s+(install|ci)/.test(wf));
    ok('零依赖：仓库没有 package.json', !fs.existsSync(path.join(ROOT, 'package.json')));
    const badLines = wf.split('\n').filter((l) => /\t/.test(l) || (/^\s*\S/.test(l) && l.match(/^ */)[0].length % 2 === 1));
    ok('YAML 结构正常（无 tab、缩进为 2 的倍数）', badLines.length === 0, badLines[0]);
  }

  /* ================= B. 全站统一 Sound ================= */
  {
    for (const page of GAME_PAGES.concat(['lobby'])) {
      const b = soundPage(page);
      ok(page + '：默认 Sound = on', b.els.sound.textContent === SOUND_LABEL, b.els.sound.textContent);
      ok(page + '：按钮 aria-pressed 同步', b.els.sound.getAttribute('aria-pressed') === 'true');
      b.els.sound.fire('click');
      ok(page + '：点击写入统一 key arcade.sound=off', b.store.get('arcade.sound') === 'off', String(b.store.get('arcade.sound')));
      ok(page + '：按钮文案变成静音', b.els.sound.textContent === MUTED_LABEL, b.els.sound.textContent);
      if (LEGACY[page]) ok(page + '：不再写自己的旧 key', !b.store.has(LEGACY[page]), String(b.store.get(LEGACY[page])));
      b.els.sound.fire('click');
      ok(page + '：再点回到 on', b.store.get('arcade.sound') === 'on' && b.els.sound.textContent === SOUND_LABEL);
    }
  }
  {
    /* 全站同步：在 Whale Runner 静音 → 另外四款（含大厅）读到 off */
    const a = soundPage('runner');
    a.els.sound.fire('click');
    const saved = { 'arcade.sound': a.store.get('arcade.sound') };
    ok('Whale Runner 里静音后写到 arcade.sound', saved['arcade.sound'] === 'off');
    for (const page of ['snake', 'tokenfall', 'attentionmaze', 'lobby']) {
      const b = soundPage(page, saved);
      ok('切到 ' + page + ' 仍然是静音（全站同步）', b.els.sound.textContent === MUTED_LABEL, b.els.sound.textContent);
    }
  }
  {
    /* 旧 key 迁移 */
    for (const page of GAME_PAGES) {
      const old = LEGACY[page];
      const off = soundPage(page, { [old]: 'off' });
      ok(page + '：旧 key ' + old + '=off 会被迁移', off.els.sound.textContent === MUTED_LABEL && off.store.get('arcade.sound') === 'off',
        off.store.get('arcade.sound'));
      ok(page + '：迁移后旧 key 仍然保留（不删）', off.store.get(old) === 'off');
      const on = soundPage(page, { [old]: 'on' });
      ok(page + '：旧 key=on 也迁移成 on', on.store.get('arcade.sound') === 'on' && on.els.sound.textContent === SOUND_LABEL);
    }
  }
  {
    /* 优先级：arcade.sound > 本游戏旧 key > 默认 on */
    const b = soundPage('snake', { 'arcade.sound': 'on', 'arcade.snake.sound': 'off' });
    ok('统一 key 优先于本游戏的旧 key', b.els.sound.textContent === SOUND_LABEL && b.store.get('arcade.sound') === 'on');
    const c = soundPage('runner', { 'arcade.snake.sound': 'off' });
    ok('别的游戏的旧 key 不会把本游戏静音', c.els.sound.textContent === SOUND_LABEL, c.els.sound.textContent);
    const d = soundPage('runner', { 'arcade.sound': 'on', 'whaleRunner.sound': 'off' });
    ok('统一 key=on 时旧 key=off 不生效', d.els.sound.textContent === SOUND_LABEL);
  }
  {
    /* 语言切换后按钮文字仍然正确 */
    const b = soundPage('snake');
    b.els.lang.fire('click');
    ok('切英文后音效按钮文案变成 Sound', b.els.sound.textContent === '🔊 Sound', b.els.sound.textContent);
    b.els.sound.fire('click');
    ok('切英文后静音文案也对', b.els.sound.textContent === '🔇 Muted', b.els.sound.textContent);
    const lobby = harness({ page: 'lobby' });
    lobby.els.lang.fire('click');
    ok('大厅音效按钮也跟着语言变', lobby.els.sound.textContent === '🔊 Sound', lobby.els.sound.textContent);
  }

  /* ================= C. 共享鲸鱼素材 ================= */
  {
    const whalePath = path.join(ROOT, 'shared/whale.js');
    ok('shared/whale.js 存在', fs.existsSync(whalePath));
    const w = source('shared/whale.js');
    ok('暴露 NORMAL_A / NORMAL_B / DIVE_A / DIVE_B',
      ['NORMAL_A', 'NORMAL_B', 'DIVE_A', 'DIVE_B'].every((k) => w.indexOf(k) !== -1));
    ok('带几何小工具 width / height / mirror / rotate',
      ['function width', 'function height', 'function mirror', 'function rotate'].every((k) => w.indexOf(k) !== -1));

    const b = harness({ page: 'runner' });
    const AW = b.window.ArcadeWhale;
    ok('运行时能拿到 ArcadeWhale', !!AW);
    if (AW) {
      ok('尺寸没变：游动 24×18、下潜 24×13',
        AW.WIDTH === 24 && AW.HEIGHT === 18 && AW.DIVE_HEIGHT === 13,
        AW.WIDTH + 'x' + AW.HEIGHT + ' / dive ' + AW.DIVE_HEIGHT);
      ok('两帧逐格对齐（同宽同高）',
        AW.NORMAL_A.length === AW.NORMAL_B.length && AW.NORMAL_A[0].length === AW.NORMAL_B[0].length);
      ok('mirror / rotate 可用',
        AW.mirror(['ab', 'cd']).join('/') === 'ba/dc' && AW.rotate(['ab', 'cd'], 1).join('/') === 'ca/db');
      const sig = AW.NORMAL_A[0];
      ok('共享文件里就是那只鲸鱼', w.indexOf("'" + sig + "'") !== -1);
      for (const f of ['games/runner/game.js', 'games/token-fall/game.js', 'arcade.js']) {
        ok(f + ' 不再自带鲸鱼像素数据', source(f).indexOf("'" + sig + "'") === -1);
        ok(f + ' 改为从 ArcadeWhale 取素材', source(f).indexOf('ArcadeWhale') !== -1);
      }
      ok('大厅预览用的是共享素材',
        source('arcade.js').indexOf('ArcadeWhale.NORMAL_A') !== -1 || source('arcade.js').indexOf('ArcadeWhale && window.ArcadeWhale.NORMAL_A') !== -1);
    }
    const order = (html) => {
      const i = html.indexOf('shared/whale.js');
      const j = Math.max(html.indexOf('game.js'), html.indexOf('arcade.js'));
      return i !== -1 && j !== -1 && i < j;
    };
    ok('runner 页面先 whale.js 再 game.js', order(source('games/runner/index.html')));
    ok('token-fall 页面先 whale.js 再 game.js', order(source('games/token-fall/index.html')));
    ok('大厅先 whale.js 再 arcade.js', order(source('index.html')));

    const tf = harness({ page: 'tokenfall', exposeGame: true });
    ok('Token Fall 鲸鱼尺寸仍然是 72×54', tf.G.playerW === 72 && tf.G.playerH === 54, tf.G.playerW + 'x' + tf.G.playerH);
    for (const px of [2, 3, 4]) {
      const r = harness({ page: 'runner', px: px });
      r.tick(3);
      ok('PX=' + px + '：Whale Runner 判定盒几何自检仍然通过', r.log.warns.length === 0, r.log.warns[0]);
    }
  }

  /* ================= D. Attention Maze 关卡拆分 ================= */
  {
    const lvPath = path.join(ROOT, 'games/attention-maze/levels.js');
    ok('games/attention-maze/levels.js 存在', fs.existsSync(lvPath));
    const lv = source('games/attention-maze/levels.js');
    const gm = source('games/attention-maze/game.js');
    ok('levels.js 暴露 ATTENTION_MAZE_LAYERS', lv.indexOf('ATTENTION_MAZE_LAYERS') !== -1);
    ok('levels.js 里 12 张地图齐全', (lv.match(/'###############'/g) || []).length === 24, String((lv.match(/'###############'/g) || []).length));
    ok('game.js 不再内嵌地图数据', gm.indexOf("'###############'") === -1 && gm.indexOf('map: [') === -1);
    ok('game.js 从 levels.js 取关卡', gm.indexOf('ATTENTION_MAZE_LAYERS') !== -1);
    const ih = source('games/attention-maze/index.html');
    ok('页面先加载 levels.js 再 game.js', ih.indexOf('levels.js') !== -1 && ih.indexOf('levels.js') < ih.indexOf('game.js'));
    ok('页面加载了 shared/audio.js', ih.indexOf('shared/audio.js') !== -1);

    const b = harness({ page: 'attentionmaze', exposeGame: true });
    ok('关卡数量仍然是 12', b.G.layers.length === 12, String(b.G.layers.length));
    ok('12 关的地图 / 节点 / 权重 / par 与拆分前逐字节一致（指纹）',
      JSON.stringify(b.G.layers.map((L) => layerHash(layerSignature(L)))) === JSON.stringify(LAYER_HASHES),
      JSON.stringify(b.G.layers.map((L) => layerHash(layerSignature(L)))));
    ok('12 关的答案没变（Q/K/V 与 MULTI-HEAD）',
      JSON.stringify(b.G.layers.map((L) => L.answer || '-')) === JSON.stringify(LAYER_ANSWERS),
      JSON.stringify(b.G.layers.map((L) => L.answer || '-')));
    ok('MAX_LAYERS 由关卡数据推导（12）', b.G.layers.length === 12);
  }

  /* ================= E. README / docs / LICENSE ================= */
  {
    const readme = source('README.md');
    ok('README 第一屏就点到四款游戏',
      ['Whale Runner', 'Context Snake', 'Token Fall', 'Attention Maze'].every((n) => readme.indexOf(n) !== -1));
    ok('README 在线试玩地址正确', readme.indexOf('https://apxs114514.github.io/DeepSeek-Arcade/') !== -1);
    ok('README 没有过时描述（coming soon / 三款 / 第三款 …）',
      !/coming soon|third game|only two games|三款游戏|第三款|敬请期待|暂未上线/i.test(readme));
    ok('README 链接到 docs（文件都存在）',
      fs.existsSync(path.join(ROOT, 'docs/architecture.md')) && fs.existsSync(path.join(ROOT, 'docs/testing.md')) &&
      readme.indexOf('docs/architecture.md') !== -1 && readme.indexOf('docs/testing.md') !== -1);
    /* 英文版（README.en.md + docs/*.en.md）：同一套事实、双向语言链接 */
    const readmeEnPath = path.join(ROOT, 'README.en.md');
    ok('README.en.md 存在', fs.existsSync(readmeEnPath));
    const readmeEn = source('README.en.md');
    ok('英文 README 与中文版一一对应（四款游戏都在）',
      ['Whale Runner', 'Context Snake', 'Token Fall', 'Attention Maze'].every((n) => readmeEn.indexOf(n) !== -1));
    ok('英文 README 在线地址正确', readmeEn.indexOf('https://apxs114514.github.io/DeepSeek-Arcade/') !== -1);
    ok('英文 README 也说明 MIT 与非官方',
      readmeEn.indexOf('MIT License') !== -1 && /unofficial fan project/i.test(readmeEn) &&
      /NOT covered by the MIT license/i.test(readmeEn));
    ok('英文 README 没有过时描述', !/coming soon|third game|only two games/i.test(readmeEn));
    ok('中英 README 互相链接',
      readme.indexOf('README.en.md') !== -1 && readmeEn.indexOf('README.md') !== -1);
    ok('英文 README 链接到英文 docs',
      readmeEn.indexOf('docs/architecture.en.md') !== -1 && readmeEn.indexOf('docs/testing.en.md') !== -1);
    for (const [zhDoc, enDoc] of [['docs/architecture.md', 'docs/architecture.en.md'], ['docs/testing.md', 'docs/testing.en.md']]) {
      ok(enDoc + ' 存在', fs.existsSync(path.join(ROOT, enDoc)));
      ok(zhDoc + ' 顶部链接到英文版', source(zhDoc).indexOf(enDoc.split('/').pop()) !== -1);
      ok(enDoc + ' 顶部链接回中文版', source(enDoc).indexOf(zhDoc.split('/').pop()) !== -1);
    }

    ok('README 说明 MIT 与非官方关系',
      readme.indexOf('MIT License') !== -1 && readme.indexOf('非官方') !== -1 &&
      /不包含在 MIT 授权内/.test(readme));

    const licPath = path.join(ROOT, 'LICENSE');
    ok('LICENSE 存在', fs.existsSync(licPath));
    const lic = source('LICENSE');
    ok('LICENSE 是 MIT', /^MIT License/m.test(lic) && /Permission is hereby granted, free of charge/.test(lic));
    ok('LICENSE 作者是 APXS114514、年份 2026', /Copyright \(c\) 2026 APXS114514/.test(lic));
    ok('LICENSE 明确 DeepSeek 品牌不在 MIT 授权内',
      /NOT part of this license/i.test(lic) && /unofficial fan project/i.test(lic));
    ok('文档没有过时描述',
      !/coming soon|third game|三款|敬请期待/i.test(source('docs/architecture.md')));
  }

  /* ================= F. 导航与 Pages 安全性 ================= */
  {
    const pages = ['index.html', 'games/runner/index.html', 'games/snake/index.html',
      'games/token-fall/index.html', 'games/attention-maze/index.html'];
    for (const p of pages) {
      ok(p + '：没有站点绝对路径（GitHub Pages 子路径安全）', !/(?:src|href)="\//.test(source(p)), p);
    }
    for (const p of ['games/runner/index.html', 'games/snake/index.html',
      'games/token-fall/index.html', 'games/attention-maze/index.html']) {
      ok(p + '：返回游戏厅链接是相对的 ../../', /arcade-back[^>]*href="\.\.\/\.\.\/"/.test(source(p)), p);
    }
    const lobby = source('index.html');
    for (const u of ['games/runner/', 'games/snake/', 'games/token-fall/', 'games/attention-maze/']) {
      ok('大厅链接到 ' + u, lobby.indexOf('href="' + u + '"') !== -1);
    }
    ok('大厅没有多余的假卡片（COMING SOON 已清空）',
      !/敬请期待|COMING SOON|class="game soon"/.test(lobby) && (lobby.match(/class="game"/g) || []).length === 4,
      String((lobby.match(/class="game"/g) || []).length));
  }

  return out;
}
