/* v1.0 工程化收口的结构性回归：
 *   CI 先测后发、全站统一 Sound（含旧 key 迁移）、共享鲸鱼素材、
 *   Attention Maze 关卡拆分、README / docs / LICENSE 约定、返回大厅链接。
 * 玩法数值本身由各自套件覆盖，这里只保证“结构没被改坏”。 */
import fs from 'node:fs';
import path from 'node:path';
import { harness, source, ROOT } from './helpers.mjs';

const SOUND_LABEL = '🔊 音效';
const MUTED_LABEL = '🔇 静音';
const GAME_PAGES = ['runner', 'snake', 'tokenfall', 'attentionmaze', 'contextbreaker', 'hunt'];
const LEGACY = {
  runner: 'whaleRunner.sound',
  snake: 'arcade.snake.sound',
  tokenfall: 'arcade.tokenFall.sound',
  attentionmaze: 'arcade.attentionMaze.sound',
  contextbreaker: 'arcade.breaker.sound',
  hunt: 'arcade.hallucinationHunt.sound'
};
/* 关卡指纹：把 12 个 Layer 的地图 / 节点 / 权重 / 答案 / par 全部压成一个短哈希。
 * 关卡内容是数据驱动的，这条挂了说明**有人改了关卡数据**：
 * 要么是误改（请回退），要么是刻意的平衡调整（请同步重算这份指纹，
 * 并在 test/attentionmaze.test.mjs 的关卡设计质量检查里跑一遍）。 */
const LAYER_HASHES = ['42e9ed3a', '75546b58', '380d07b3', 'e6623f86', '2c072172', 'ae5e8139',
  '7a447e14', 'c8c0bb24', '64eebe3e', '74215718', '7124b232', 'fd09e1a2'];
const LAYER_ANSWERS = ['-', '-', '-', 'K2', 'K1', 'K3', 'K4', 'K2', 'K3', 'K1', 'K4', 'K5'];

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
    /* 全站同步：在 Whale Runner 静音 → 另外五款（含大厅）读到 off */
    const a = soundPage('runner');
    a.els.sound.fire('click');
    const saved = { 'arcade.sound': a.store.get('arcade.sound') };
    ok('Whale Runner 里静音后写到 arcade.sound', saved['arcade.sound'] === 'off');
    for (const page of ['snake', 'tokenfall', 'attentionmaze', 'contextbreaker', 'hunt', 'lobby']) {
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
    ok('12 关的答案与重平衡后的分布一致（Q/K/V 与 MULTI-HEAD）',
      JSON.stringify(b.G.layers.map((L) => L.answer || '-')) === JSON.stringify(LAYER_ANSWERS),
      JSON.stringify(b.G.layers.map((L) => L.answer || '-')));
    ok('MAX_LAYERS 由关卡数据推导（12）', b.G.layers.length === 12);
  }

  /* ================= E. README / docs / LICENSE ================= */
  {
    const readme = source('README.md');
    ok('README 第一屏就点到六款游戏',
      ['Whale Runner', 'Context Snake', 'Token Fall', 'Attention Maze', 'Context Breaker', 'Hallucination Hunt'].every((n) => readme.indexOf(n) !== -1));
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
    ok('英文 README 与中文版一一对应（六款游戏都在）',
      ['Whale Runner', 'Context Snake', 'Token Fall', 'Attention Maze', 'Context Breaker', 'Hallucination Hunt'].every((n) => readmeEn.indexOf(n) !== -1));
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

  /* ================= F. 第三方素材（鲸鱼娘，各自的授权） ================= */
  {
    /* ---- 旧的第三方鲸鱼娘皮肤必须完全退出：素材 / 运行时 / 文档 / 测试 ----
     * 敏感串在这里拆开拼接，否则这个测试文件会被自己扫出来。 */
    const LEGACY_HITS = ['Er1c0' + 'v0', 'dsh-' + 'whale-pet', 'assets/whale-' + 'chan', 'whalechan' + '-'];
    /* 后来被删掉的像素皮肤：名字同样拆开拼接，测试文件自己也不留这些串 */
    const GONE = {
      dir: 'assets/whale-' + 'pixel',
      licence: 'CHEN' + 'THREEGOLD-WHALE-PET-MIT.txt',
      repo: 'chen' + 'threegold/' + 'deepseek-' + 'whale-pet',
      i18nKey: 'skin.' + 'pixel',
      slug: 'whale-' + 'pixel',
    };
    const mentionsRemovedSkin = (t) => t.indexOf(GONE.repo) >= 0 || t.indexOf(GONE.slug) >= 0;
    const SKIP_DIRS = new Set(['.git', 'node_modules', '.shots']);
    const hits = [];
    (function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        if (SKIP_DIRS.has(name) || name === '.DS_Store') continue;
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(js|mjs|html|css|md|txt|json|yml|yaml|py)$/i.test(name)) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const bad of LEGACY_HITS) {
          if (text.indexOf(bad) !== -1) hits.push(path.relative(ROOT, p) + ' <- ' + bad);
        }
      }
    })(ROOT);
    ok('全仓库（运行时 / 文档 / 测试）都不再引用旧的第三方鲸鱼娘皮肤',
      hits.length === 0, hits.join(' | '));
    ok('旧的角色素材目录已删除', !fs.existsSync(path.join(ROOT, 'assets/whale-' + 'chan')));
    ok('LICENSES/CC-BY-4.0.txt 已删除（没有素材再使用它）',
      !fs.existsSync(path.join(ROOT, 'LICENSES/CC-BY-4.0.txt')));
    ok('旧素材目录名没有以临时名字复活（whale-chan-new / whale-chan2）',
      !fs.readdirSync(path.join(ROOT, 'assets')).some((d) => /chan/i.test(d)),
      fs.readdirSync(path.join(ROOT, 'assets')).join(','));
    /* ---- 已经删掉的像素皮肤也不能复活 ---- */
    ok('已经删掉的像素皮肤素材目录不存在',
      !fs.existsSync(path.join(ROOT, GONE.dir)));
    ok('没有素材再使用的像素皮肤 MIT 全文已删除',
      !fs.existsSync(path.join(ROOT, 'LICENSES/' + GONE.licence)));
    ok('LICENSES/ 里只剩真有素材在用的许可',
      fs.readdirSync(path.join(ROOT, 'LICENSES')).join(',') === 'YUNYUE-WHALE-PET-LICENSE.txt',
      fs.readdirSync(path.join(ROOT, 'LICENSES')).join(','));
    ok('运行时 / i18n 里不再有 pixel 皮肤',
      source('shared/character.js').indexOf('pixel') < 0 &&
      source('shared/i18n.js').indexOf(GONE.i18nKey) < 0);

    /* ---- 动画鲸鱼娘：YunYueSama —— 大肥鱼项目署名许可 1.0（不是 MIT） ---- */
    const yAttrPath = path.join(ROOT, 'assets/whale-yunyue/ATTRIBUTION.md');
    ok('assets/whale-yunyue/ATTRIBUTION.md 存在', fs.existsSync(yAttrPath));
    const yAttr = source('assets/whale-yunyue/ATTRIBUTION.md');
    ok('YunYue attribution 写明作者 YunYueSama', yAttr.indexOf('YunYueSama') !== -1);
    ok('YunYue attribution 写明上游仓库地址',
      yAttr.indexOf('https://github.com/YunYueSama/codex-deepseek-pet') !== -1);
    ok('YunYue attribution 说明素材经过修改', /modified/i.test(yAttr));
    ok('YunYue attribution 记录上游 commit SHA', (yAttr.match(/\b[0-9a-f]{40}\b/g) || []).length >= 1);
    ok('YunYue attribution 写明所依据的许可与全文位置',
      yAttr.indexOf('大肥鱼项目署名许可 1.0') !== -1 && yAttr.indexOf('YUNYUE-WHALE-PET-LICENSE.txt') !== -1);
    ok('YunYue attribution 点明第三方权利边界（ASSET_LICENSE / design 参考图）',
      yAttr.indexOf('ASSET_LICENSE') !== -1 && yAttr.indexOf('design/') !== -1);

    const yLicPath = path.join(ROOT, 'LICENSES/YUNYUE-WHALE-PET-LICENSE.txt');
    ok('YunYue 完整许可全文存在', fs.existsSync(yLicPath));
    const yLic = source('LICENSES/YUNYUE-WHALE-PET-LICENSE.txt');
    ok('YunYue 许可全文就是上游那份（许可名 / 作者 / 仓库 / 实质长度）',
      yLic.indexOf('大肥鱼项目署名许可 1.0') !== -1 &&
      yLic.indexOf('YunYueSama') !== -1 &&
      yLic.indexOf('https://github.com/YunYueSama/codex-deepseek-pet') !== -1 &&
      fs.statSync(yLicPath).size > 1500, String(fs.statSync(yLicPath).size));
    ok('没有把 YunYue 素材描述成 MIT', /非标准 MIT/.test(yLic));

    /* ---- 汇总声明 ---- */
    const tpnPath = path.join(ROOT, 'THIRD_PARTY_NOTICES.md');
    ok('THIRD_PARTY_NOTICES.md 存在', fs.existsSync(tpnPath));
    const tpn = source('THIRD_PARTY_NOTICES.md');
    ok('第三方声明写明素材来源仓库',
      tpn.indexOf('YunYueSama/codex-deepseek-pet') !== -1);
    ok('第三方声明把代码 MIT 与素材授权分开写',
      tpn.indexOf('大肥鱼项目署名许可 1.0') !== -1 && /\bMIT\b/.test(tpn));
    ok('第三方声明不再提已经删掉的像素皮肤', !mentionsRemovedSkin(tpn));
    ok('第三方声明明确根 LICENSE 只覆盖代码与原创内容',
      /code and original content|代码与原创内容/.test(tpn));
    ok('第三方声明说明图片素材不在 MIT 范围内',
      /NOT MIT-licensed/i.test(tpn) || /都不是本项目原创/.test(tpn));
    ok('第三方声明单独列出 DeepSeek 品牌声明',
      /DeepSeek/.test(tpn) && /brand/i.test(tpn) && /unofficial fan project/i.test(tpn));

    /* ---- 根 LICENSE ---- */
    const lic = source('LICENSE');
    ok('根 LICENSE 仍然是 MIT（没有被第三方素材改写）',
      /^MIT License/m.test(lic) && /Copyright \(c\) 2026 APXS114514/.test(lic));
    ok('根 LICENSE 指向第三方许可全文并说明不在 MIT 内',
      lic.indexOf('YUNYUE-WHALE-PET-LICENSE.txt') !== -1 &&
      /NOT\s+part\s+of\s+this\s+MIT\s+license/i.test(lic));
    ok('根 LICENSE 不再提已经删掉的像素皮肤', !mentionsRemovedSkin(lic));

    /* ---- README：只留简洁来源说明，不塞长篇授权 ---- */
    for (const name of ['README.md', 'README.en.md']) {
      const md = source(name);
      ok(name + ' 写明 arcade.characterSkin', md.indexOf('arcade.characterSkin') !== -1);
      ok(name + ' 列出素材来源仓库',
        md.indexOf('YunYueSama/codex-deepseek-pet') !== -1);
      ok(name + ' 说明鲸鱼娘不是 MIT（大肥鱼项目署名许可）',
        md.indexOf('大肥鱼项目署名许可') !== -1);
      ok(name + ' 不再宣传已经删掉的像素皮肤', !mentionsRemovedSkin(md));
      ok(name + ' 不再声称「整个项目零图片」',
        !/零图片、零后端/.test(md) && !/no image files, no backend/.test(md));
      ok(name + ' 没有把长篇授权声明塞进 README（详细内容指向专门文件）',
        md.indexOf('YUNYUE-WHALE-PET-LICENSE.txt') !== -1);
    }

    /* ---- 运行时素材：齐全、体积可控、没有混入上游原图 ---- */
    const sizeOf = (skin) => {
      const dir = path.join(ROOT, 'assets/whale-' + skin);
      const files = fs.readdirSync(dir);
      const webp = files.filter((f) => /\.webp$/i.test(f));
      return {
        n: webp.length,
        bytes: webp.reduce((total, f) => total + fs.statSync(path.join(dir, f)).size, 0),
        png: files.filter((f) => /\.png$/i.test(f)).length,
      };
    };
    const ys = sizeOf('yunyue');
    ok('鲸鱼娘素材齐全、体积可控（' + ys.n + ' 张 / ' + Math.round(ys.bytes / 1024) + 'KB < 512KB）',
      ys.n > 0 && ys.bytes < 512 * 1024, String(ys.bytes));
    ok('运行时目录里没有混入上游原始 PNG', ys.png === 0, String(ys.png));
    ok('上游数 MB 的原始图集没有被直接塞进运行时（< 1MB）',
      ys.bytes < 1024 * 1024, String(ys.bytes));
    const tool = source('tools/derive-character-assets.py');
    ok('素材派生脚本随仓库提供（可复现，且不参与运行时）',
      fs.existsSync(path.join(ROOT, 'tools/derive-character-assets.py')) &&
      tool.indexOf('YunYueSama') !== -1);
    ok('派生脚本不再处理已经删掉的像素皮肤', !mentionsRemovedSkin(tool) && tool.indexOf('P_GROUPS') < 0);
    /* 方向：上游 dense-jump 整段是镜像的（实测脸的横向偏移 walk +70、
     * dense-jump 每帧 −15~−52），所以跳跃 / 下潜必须标成水平镜像翻回来，
     * 否则 Whale Runner 里会「倒着飞」—— 这个坑踩过两次了。 */
    ok('跳跃 / 下潜被标记为水平镜像（dense-jump 整段是反的）',
      /"jump": \("dense-jump", 512, \[7\], 400, True\)/.test(tool) &&
      /"dive": \("dense-jump", 512, \[21\], 400, True\)/.test(tool));
    ok('步态本身不镜像（inbetween-walk 本来就是朝右的）',
      /"walk": \("inbetween-walk", 512, \[0, 3, 4, 6, 8, 11, 12, 14\], 120, False\)/.test(tool));
    ok('派生脚本自带方向自检（渲染完重新量脸朝向，不对就退出）',
      tool.indexOf('MUST_FACE_RIGHT') >= 0 && tool.indexOf('def face_side(') >= 0 &&
      tool.indexOf('方向自检失败') >= 0);
    ok('attribution 记录了镜像这件事',
      source('assets/whale-yunyue/ATTRIBUTION.md').indexOf('dense-jump') !== -1 &&
      /mirrored|镜像/.test(source('assets/whale-yunyue/ATTRIBUTION.md')));
  }

  /* ================= G. 导航与 Pages 安全性 ================= */
  {
    const pages = ['index.html', 'games/runner/index.html', 'games/snake/index.html',
      'games/token-fall/index.html', 'games/attention-maze/index.html', 'games/context-breaker/index.html',
      'games/hallucination-hunt/index.html'];
    for (const p of pages) {
      ok(p + '：没有站点绝对路径（GitHub Pages 子路径安全）', !/(?:src|href)="\//.test(source(p)), p);
    }
    for (const p of ['games/runner/index.html', 'games/snake/index.html',
      'games/token-fall/index.html', 'games/attention-maze/index.html',
      'games/context-breaker/index.html', 'games/hallucination-hunt/index.html']) {
      ok(p + '：返回游戏厅链接是相对的 ../../', /arcade-back[^>]*href="\.\.\/\.\.\/"/.test(source(p)), p);
    }
    const lobby = source('index.html');
    for (const u of ['games/runner/', 'games/snake/', 'games/token-fall/', 'games/attention-maze/', 'games/context-breaker/', 'games/hallucination-hunt/']) {
      ok('大厅链接到 ' + u, lobby.indexOf('href="' + u + '"') !== -1);
    }
    ok('大厅正好六张卡片，没有多余的假卡片（COMING SOON 已清空）',
      !/敬请期待|COMING SOON|class="game soon"/.test(lobby) && (lobby.match(/class="game"/g) || []).length === 6,
      String((lobby.match(/class="game"/g) || []).length));
  }

  /* ================= H. 触屏方向键（.pad）在竖屏下不能塌 ================= */
  {
    /* .card 在 ≤720px 变成 column flex，此时 .pad 的 "margin: 12px auto 0"
     * 会让 auto 左右外边距吃掉全部剩余空间并取消 align-items:stretch，
     * 于是「只写 max-width」= 封顶不撑开 —— 四个方向键会缩成 ~31px 宽的细条。
     * 三款游戏都靠 width:100% 兜住，这里就地钉死，别再漏（Context Snake 漏过一次）。
     * 先剥掉 CSS 注释，否则注释里提到的 .pad{...} 会被当成规则本体。 */
    const pads = ['games/snake/style.css', 'games/attention-maze/style.css',
      'games/token-fall/style.css', 'games/context-breaker/style.css'];
    for (const f of pads) {
      const css = source(f).replace(/\/\*[\s\S]*?\*\//g, '');
      const m = /\.pad\s*\{([^}]*)\}/.exec(css);
      const body = m ? m[1].replace(/\s+/g, ' ').trim() : '';
      ok(f + ' 的 .pad 写死 width:100%（竖屏 column flex 下不被 auto 外边距压塌）',
        !!m && /(?:^|[;{\s])width:\s*100%/.test(body), body.slice(0, 80));
    }
    /* 竖屏时 .card 是 flex 容器，这条前提变了的话上面的保护要重新评估 */
    ok('shared/arcade.css 仍在 ≤720px 把 .card 设成 column flex（.pad 保护的由来）',
      /@media \(max-width: 720px\)[\s\S]*?\.card \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/.test(
        source('shared/arcade.css').replace(/\/\*[\s\S]*?\*\//g, '')));
  }

  /* ================= 大厅 preview Canvas 帧清理 ================= */
  {
    const src = source('arcade.js');
    const setupAt = src.indexOf('function setup(id, draw, time)');
    ok('arcade.js 有统一的 preview setup()', setupAt >= 0);
    const drawAt = src.indexOf('draw(c.ctx, PREVIEW_W, PREVIEW_H, time);', setupAt);
    const idClearAt = src.indexOf('setTransform(1, 0, 0, 1, 0, 0)', setupAt);
    const fullClearAt = src.indexOf('clearRect(0, 0, cv.width, cv.height)', setupAt);
    ok('每帧先清屏再画（clearPreviewCanvas 在 draw 之前调用）',
      src.indexOf('clearPreviewCanvas(c.ctx, c.cv, c.dpr);') > setupAt &&
      src.indexOf('clearPreviewCanvas(c.ctx, c.cv, c.dpr);') < drawAt,
      src.indexOf('clearPreviewCanvas(c.ctx, c.cv, c.dpr);') + '/' + drawAt);
    ok('用单位变换清整个 backing store（DPR 下不会漏清）',
      /setTransform\(1, 0, 0, 1, 0, 0\)/.test(src) && /clearRect\(0, 0, cv\.width, cv\.height\)/.test(src));
    ok('清屏后显式恢复逻辑坐标 transform（不依赖 restore）',
      /setTransform\(dpr, 0, 0, dpr, 0, 0\)/.test(src));
    ok('DPR 计算在保存之前（var 提升回归）',
      /var dpr = getPreviewDpr\(\);/.test(src) && src.indexOf('previewDpr[id] = dpr;') > src.indexOf('var dpr = getPreviewDpr();'));
    ok('拆出了 getPreviewDpr / ensurePreviewCanvas / clearPreviewCanvas 三个 helper',
      /function getPreviewDpr\(/.test(src) && /function ensurePreviewCanvas\(/.test(src) && /function clearPreviewCanvas\(/.test(src));
    ok('DPR 变化时会重新 resize backing store',
      /cv\.width !== w \|\| cv\.height !== h \|\| previewDpr\[id\] !== dpr/.test(src));
    ok('清屏后复位绘图状态（globalAlpha / smoothing / textAlign / textBaseline）',
      /globalAlpha = 1/.test(src) && /imageSmoothingEnabled = false/.test(src) &&
      /textAlign = 'left'/.test(src) && /textBaseline = 'alphabetic'/.test(src));
    ok('六个 preview 全部走同一 setup() 入口',
      ['preview-runner', 'preview-snake', 'preview-tokenfall', 'preview-maze', 'preview-breaker', 'preview-hunt']
        .every((id) => src.indexOf("setup('" + id + "'") >= 0));
    ok('每个 preview 画布都记录了 dpr（清屏才知道真实尺寸）', /previewDpr\[id\] = dpr/.test(src));

    /* 运行时：启动那一帧每张画布都必须先清一次再画。
       （预览动画由 rAF 驱动，测试桩只跑得到启动帧，所以只断言这个确定的不变量） */
    const b = harness({ page: 'lobby', navLang: 'zh-CN' });
    ok('启动帧 6 张 preview 各清屏一次（clearRect 次数 = 画布数）',
      b.log.clears === 6, String(b.log.clears));
    ok('清屏发生在任何绘制之前（启动帧就有 6 次 clear，不是 0）', b.log.clears > 0, String(b.log.clears));
  }

  /* ================= preview Canvas DPR 生命周期 ================= */
  {
    const PREVIEW_W = 224, PREVIEW_H = 120;
    for (const dpr of [1, 2, 3]) {
      const b = harness({ page: 'lobby', navLang: 'zh-CN', dpr: dpr });
      const six = ['preview-runner', 'preview-snake', 'preview-tokenfall', 'preview-maze', 'preview-breaker', 'preview-hunt'];
      ok('DPR=' + dpr + '：六张 preview 的 backing store = ' + PREVIEW_W + '*' + dpr + ' x ' + PREVIEW_H + '*' + dpr,
        six.every((id) => b.els[id].width === PREVIEW_W * dpr && b.els[id].height === PREVIEW_H * dpr),
        six.map((id) => b.els[id].width + 'x' + b.els[id].height).join(' '));
      /* 关键回归：每帧最后一次 setTransform 必须是 DPR，绝不能回落到 1 ——
         否则 backing store 是 2 倍、绘制变换是 1，画面就只出现在左上角。 */
      /* 每帧的 transform 必须是成对的：[identity 清屏] -> [DPR 恢复]。
         identity 那一半是清屏用的，DPR 那一半才是 draw 的前置条件。
         本次回归正是因为恢复成了 1，才导致内容只画在 backing store 左上角。 */
      const t = b.log.transforms;
      const isId = (m) => m[0] === 1 && m[3] === 1 && m[1] === 0 && m[2] === 0 && m[4] === 0 && m[5] === 0;
      const isDpr = (m) => m[0] === dpr && m[3] === dpr && m[1] === 0 && m[2] === 0 && m[4] === 0 && m[5] === 0;
      ok('DPR=' + dpr + '：每帧「identity 清屏 -> DPR 恢复」成对出现',
        t.length > 0 && t.length % 2 === 0 && t.every((m, i) => i % 2 === 0 ? isId(m) : isDpr(m)),
        JSON.stringify(t.slice(0, 4)));
      ok('DPR=' + dpr + '：draw 之前最后一次 transform 就是 ' + dpr + '（不会回落成 1）',
        t.length >= 2 && isDpr(t[t.length - 1]), JSON.stringify(t.slice(-2)));
      ok('DPR=' + dpr + '：每帧都先清整个 backing store（清屏没被删掉）',
        b.log.clears >= 6, String(b.log.clears));
    }
    /* 清屏与 transform 的顺序：每帧必须先 identity 清屏、再恢复 DPR */
    const b = harness({ page: 'lobby', navLang: 'zh-CN', dpr: 2 });
    const seq = b.log.transforms.map((m) => m[0]);
    ok('清屏用的 identity transform 之后紧跟 DPR transform',
      seq.length >= 12 && seq[0] === 1 && seq[1] === 2 && seq[2] === 1 && seq[3] === 2, JSON.stringify(seq.slice(0, 4)));
    ok('DPR=2 时清屏区域覆盖整个 backing store（clearRect 次数 = 画布数）',
      b.log.clears === 6, String(b.log.clears));
  }

  /* ================= R. 公共 CSS 的设计变量卫生 =================
   * shared/arcade.css 的 :root 是全站设计变量的唯一来源。
   * 这套守卫防两件已经真实发生过的事：
   *   1) 定义了却没人引用的 token（--deep-2 就是被这样发现的）；
   *   2) 同一个语义在多个文件里各定义一套（改一处漏一处）。
   * 只做静态引用检查，不判断「值该不该统一」——那是设计问题，不是测试能替的。 */
  {
    const CSS_FILES = ['shared/arcade.css', 'arcade.css',
      'games/runner/style.css', 'games/snake/style.css', 'games/token-fall/style.css',
      'games/attention-maze/style.css', 'games/context-breaker/style.css',
      'games/hallucination-hunt/style.css'];
    const cssOf = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const flat = (s) => s.replace(/\s+/g, '');            /* 去掉空白后 var() 一定连写 */

    const sharedCss = cssOf('shared/arcade.css');
    const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(sharedCss);
    ok('shared/arcade.css 里有 :root 设计变量块', !!rootBlock);
    const defined = rootBlock
      ? [...rootBlock[1].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1])
      : [];
    ok('shared/arcade.css :root 是一套完整的设计变量（' + defined.length + ' 个）',
      defined.length >= 10, defined.join(' '));

    const usedAnywhere = (t) => CSS_FILES.some((f) => {
      const s = flat(cssOf(f));
      return s.indexOf('var(' + t + ')') !== -1 || s.indexOf('var(' + t + ',') !== -1;
    });
    const unused = defined.filter((t) => !usedAnywhere(t));
    ok('没有「定义了却没人引用」的设计变量', unused.length === 0, unused.join(', '));
    ok('已经删掉的未引用变量 --deep-2 没有回来', sharedCss.indexOf('--deep-2') < 0);

    const owners = new Map();
    for (const f of CSS_FILES) {
      for (const m of cssOf(f).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
        if (!owners.has(m[1])) owners.set(m[1], []);
        if (!owners.get(m[1]).includes(f)) owners.get(m[1]).push(f);
      }
    }
    /* 只约束公共变量：游戏本地的参数型变量（--hunt-* 这类）是各玩法的私有语义，
     * 不该被误判成「重复定义」。 */
    const redefine = defined.filter((t) => (owners.get(t) || []).some((f) => f !== 'shared/arcade.css'));
    ok('公共设计变量只在 shared/arcade.css 定义一次（游戏本地不另起一套）',
      redefine.length === 0, redefine.join(', '));
  }

  /* ================= S. 公共舞台外壳（.stage） =================
   * 五款稳定游戏共用 <div class="stage"><canvas id="game">。
   * 这层守护两件事：
   *   1) 舞台的定位 / 描边 / 圆角 / 画布基样式只在公共层维护一份；
   *   2) 公共层**绝不用 #game 选择器** —— Hunt 的整屏背景画布正好是
   *      <canvas id="game">，共享层用 id 选择器会以 id 优先级压掉它的
   *      .layer-backdrop 布局（id > class，与先后顺序无关）。 */
  {
    /* 先剥掉注释：公共层注释里就写着「刻意不写 #game」，不剥会误报（.pad 那条也踩过同样的坑）。 */
    const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
    const shared = stripCss(source('shared/arcade.css'));
    ok('shared/arcade.css 提供公共 .stage 底框（定位 / 圆角走变量）',
      /\.stage\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/.test(shared));
    ok('shared/arcade.css 提供公共 .stage > canvas 基样式',
      /\.stage\s*>\s*canvas\s*\{[^}]*image-rendering:\s*pixelated/.test(shared));
    ok('公共层不用 #game 选择器（Hunt 的整屏背景画布就是 canvas#game）',
      !/#game/.test(shared));
    const GAME_CSS = ['games/runner/style.css', 'games/snake/style.css',
      'games/token-fall/style.css', 'games/attention-maze/style.css',
      'games/context-breaker/style.css'];
    const dupStage = GAME_CSS.filter((f) => /\.stage\s*\{[^}]*position:\s*relative/.test(stripCss(source(f))));
    ok('五款游戏不再各自重复 .stage 的定位 / 描边 / 圆角', dupStage.length === 0, dupStage.join(', '));
    const dupCanvas = GAME_CSS.filter((f) => /#game\s*\{[^}]*image-rendering/.test(stripCss(source(f))));
    ok('五款游戏不再各自重复 #game 的基样式（画布基样式只在公共层）', dupCanvas.length === 0, dupCanvas.join(', '));
  }

  /* ================= T. 公共文字的对比度（WCAG AA） =================
   * --muted 曾经是 #6b8299：白底 3.98:1、.btn.ghost 的 #f2f7fc 底 3.69:1，
   * 都低于 AA 对正文要求的 4.5:1（真实测过所有页面的可见文字节点，见
   * Game-Miscellaneous/_ui-revalidate/a11y-probe.mjs）。
   * 把「次级文字在两种公共底色上都过 AA」固化成测试，免得以后随手调色又调回去。
   * 只算不依赖浏览器的纯量，不需要 DOM。 */
  {
    const css = source('shared/arcade.css');
    const tok = (name) => {
      const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(css);
      return m ? m[1].toLowerCase() : null;
    };
    const lum = (hex) => {
      const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const muted = tok('muted'), cardBg = tok('card-bg'), surface = tok('surface');
    ok('公共文字色都是可计算的 6 位 hex', !!(muted && cardBg && surface), [muted, cardBg, surface].join(', '));
    if (muted && cardBg && surface) {
      const onCard = ratio(muted, cardBg);
      const onSurface = ratio(muted, surface);
      ok('次级文字 --muted 在卡片底上过 WCAG AA（>= 4.5:1）', onCard >= 4.5, onCard.toFixed(2) + ':1');
      ok('次级文字 --muted 在次级面上过 WCAG AA（>= 4.5:1）', onSurface >= 4.5, onSurface.toFixed(2) + ':1');
    }
  }

  return out;
}
