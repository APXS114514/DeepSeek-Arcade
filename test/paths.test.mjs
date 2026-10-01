/* 静态检查：没有死链接、没有只能部署在域名根目录的绝对路径。
 * 直接在文件系统里按相对路径解析，等价于 GitHub Pages 的 /whale-runner/ 子路径。 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, harness } from './helpers.mjs';

const PAGES = ['index.html', 'games/runner/index.html', 'games/snake/index.html',
  'games/token-fall/index.html', 'games/attention-maze/index.html'];
const SCRIPTS = ['arcade.js', 'shared/i18n.js', 'shared/audio.js',
  'games/runner/game.js', 'games/snake/game.js', 'games/token-fall/game.js',
  'games/attention-maze/game.js'];

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  for (const page of PAGES) {
    const abs = path.join(ROOT, page);
    ok(page + ' 存在', fs.existsSync(abs));
    if (!fs.existsSync(abs)) continue;
    const html = fs.readFileSync(abs, 'utf8');
    const refs = [];
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) refs.push(m[1]);
    ok(page + ' 至少引用了 1 个本地资源', refs.some((r) => !/^(https?:|mailto:|#|data:)/.test(r)), refs.join(','));
    for (const ref of refs) {
      if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
      const target = path.resolve(path.dirname(abs), ref);
      const isDir = ref.endsWith('/');
      const exists = isDir ? fs.existsSync(path.join(target, 'index.html')) : fs.existsSync(target);
      ok(page + ' -> ' + ref, exists, '解析到 ' + target);
    }
  }

  for (const f of SCRIPTS) {
    const abs = path.join(ROOT, f);
    ok(f + ' 存在', fs.existsSync(abs));
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, 'utf8');
    /* 站点绝对路径（以 / 开头）在 GitHub Pages 子路径下会 404 */
    const bad = src.match(/['"]\/[A-Za-z][A-Za-z0-9._/-]*\.(?:js|css|png|jpg|svg|webp|json)['"]/g);
    ok(f + ' 不含站点绝对路径', !bad, bad ? bad.join(',') : '');
    /* 也不该引用不存在的同级文件 */
    const refs = src.match(/['"]([A-Za-z0-9._/-]+\.(?:js|css|png|jpg|svg))['"]/g) || [];
    for (const r of refs) {
      const rel = r.slice(1, -1);
      const target = path.resolve(path.dirname(abs), rel);
      ok(f + ' 引用 ' + rel, fs.existsSync(target), '解析到 ' + target);
    }
  }

  /* 三个游戏的 localStorage key 必须分开 */
  const runner = fs.readFileSync(path.join(ROOT, 'games/runner/game.js'), 'utf8');
  const snake = fs.readFileSync(path.join(ROOT, 'games/snake/game.js'), 'utf8');
  const tokenFall = fs.readFileSync(path.join(ROOT, 'games/token-fall/game.js'), 'utf8');
  const runnerKeys = new Set((runner.match(/'(whaleRunner\.[a-z.]+)'/g) || []).map((s) => s.slice(1, -1)));
  const snakeKeys = new Set((snake.match(/'(arcade\.[a-z.]+)'/g) || []).map((s) => s.slice(1, -1)));
  const tfKeys = new Set((tokenFall.match(/'(arcade\.[A-Za-z.]+)'/g) || []).map((s) => s.slice(1, -1)));
  ok('Whale Runner 用自己的 localStorage key', [...runnerKeys].every((k) => k.indexOf('whaleRunner.') === 0), [...runnerKeys].join(','));
  ok('Context Snake 用 arcade.* 命名空间', [...snakeKeys].every((k) => k.indexOf('arcade.') === 0), [...snakeKeys].join(','));
  ok('Token Fall 用 arcade.* 命名空间', tfKeys.size > 0 && [...tfKeys].every((k) => k.indexOf('arcade.') === 0), [...tfKeys].join(','));
  ok('Whale Runner 与另外两款没有 key 交集',
     [...runnerKeys].every((k) => !snakeKeys.has(k) && !tfKeys.has(k)), [...tfKeys].join(','));
  ok('Context Snake 与 Token Fall 没有 key 交集',
     [...snakeKeys].every((k) => !tfKeys.has(k)), 'snake=' + [...snakeKeys].join(',') + ' tokenfall=' + [...tfKeys].join(','));
  ok('Token Fall 没有借用 Whale Runner 的 key', tokenFall.indexOf("'whaleRunner.") < 0);
  ok('最高分 key 明确：whaleRunner.high / arcade.snake.high / arcade.tokenFall.high',
     runner.indexOf("'whaleRunner.high'") >= 0 && snake.indexOf("'arcade.snake.high'") >= 0 &&
     tokenFall.indexOf("'arcade.tokenFall.high'") >= 0);
  ok('Token Fall 的静音 key 独立', tokenFall.indexOf("'arcade.tokenFall.sound'") >= 0);

  /* Attention Maze 存的是关卡进度（不是高分） */
  const maze = fs.readFileSync(path.join(ROOT, 'games/attention-maze/game.js'), 'utf8');
  const mazeKeys = new Set((maze.match(/'(arcade\.[A-Za-z.]+)'/g) || []).map((s) => s.slice(1, -1)));
  ok('Attention Maze 用 arcade.* 命名空间', mazeKeys.size > 0 && [...mazeKeys].every((k) => k.indexOf('arcade.') === 0), [...mazeKeys].join(','));
  ok('Attention Maze 的进度 key 独立', maze.indexOf("'arcade.attentionMaze.progress'") >= 0);
  ok('Attention Maze 的静音 key 独立', maze.indexOf("'arcade.attentionMaze.sound'") >= 0);
  ok('四款游戏没有任何 key 冲突',
     [...mazeKeys].every((k) => !runnerKeys.has(k) && !snakeKeys.has(k) && !tfKeys.has(k)) &&
     [...tfKeys].every((k) => !runnerKeys.has(k) && !snakeKeys.has(k)) &&
     [...snakeKeys].every((k) => !runnerKeys.has(k)),
     'runner=' + [...runnerKeys].join(',') + ' snake=' + [...snakeKeys].join(',') + ' tf=' + [...tfKeys].join(',') + ' maze=' + [...mazeKeys].join(','));
  ok('大厅读的正是 Attention Maze 的进度 key', fs.readFileSync(path.join(ROOT, 'arcade.js'), 'utf8').indexOf("arcade.attentionMaze.progress") >= 0);

  /* 角色皮肤：素材必须走相对/派生路径，且真的存在 */
  const charSrc = fs.readFileSync(path.join(ROOT, 'shared/character.js'), 'utf8');
  ok('shared/character.js 暴露 ArcadeCharacter', charSrc.indexOf('global.ArcadeCharacter') >= 0);
  ok('角色皮肤统一的 localStorage key 是 arcade.characterSkin', charSrc.indexOf("'arcade.characterSkin'") >= 0);
  ok('角色皮肤不写死 /assets/ 这类站点绝对路径',
     !/['"`]\/assets\//.test(charSrc) && charSrc.indexOf("'assets/whale-yunyue/'") >= 0, '');
  /* 被删掉的像素皮肤名字拆开拼接，保持仓库里连字符串都不残留 */
  const REMOVED_SKIN_SLUG = 'whale-' + 'pixel';
  ok('角色注册表里已经没有像素皮肤', charSrc.indexOf("'pixel'") < 0 && charSrc.indexOf(REMOVED_SKIN_SLUG) < 0);
  ok('旧的第三方角色素材目录已经彻底不存在',
     !fs.existsSync(path.join(ROOT, 'assets/whale-' + 'chan')));
  ok('已经删掉的像素皮肤素材目录不存在', !fs.existsSync(path.join(ROOT, 'assets/' + REMOVED_SKIN_SLUG)));
  ok('没有素材再使用的 CC BY 4.0 全文已被删除（不留无引用 License）',
     !fs.existsSync(path.join(ROOT, 'LICENSES/CC-BY-4.0.txt')));
  ok('没有素材再使用的像素皮肤 MIT 全文已被删除（不留无引用 License）',
     !fs.existsSync(path.join(ROOT, 'LICENSES/CHEN' + 'THREEGOLD-WHALE-PET-MIT.txt')));
  ok('LICENSES/ 里剩下的都是真有素材在用的许可',
     fs.readdirSync(path.join(ROOT, 'LICENSES')).sort().join(',') === 'YUNYUE-WHALE-PET-LICENSE.txt',
     fs.readdirSync(path.join(ROOT, 'LICENSES')).join(','));

  const chb = harness({ page: 'runner' });
  const A = chb.window.ArcadeCharacter;
  ok('classic 皮肤不使用任何图片素材', A.files('classic').length === 0);
  for (const skin of A.SKINS.filter((s) => s !== 'classic')) {
    const info = A.getSkinInfo(skin);
    const files = A.files(skin);
    const dir = path.join(ROOT, info.dir);
    const missing = files.filter((f) => !fs.existsSync(path.join(dir, f)));
    ok('角色皮肤 ' + skin + ' 注册的 ' + files.length + ' 张素材都真实存在', missing.length === 0, missing.join(','));
    const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.webp$/.test(f)) : [];
    ok('角色皮肤 ' + skin + ' 目录里没有多余 / 漏登记的 WebP',
       onDisk.length === files.length && onDisk.every((f) => files.includes(f)),
       'disk=' + onDisk.length + ' registry=' + files.length);
    ok('角色皮肤 ' + skin + ' 的素材目录名清晰且长期可维护（不用 whale-chan2 这类临时名字）',
       info.dir === 'assets/whale-' + skin + '/', info.dir);
  }

  ok('每个页面都按 i18n -> audio -> (whale) -> character -> game 的顺序加载角色模块',
     PAGES.every((p) => {
       const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
       const ci = html.indexOf('shared/character.js');
       const gi = Math.max(html.indexOf('game.js'), html.indexOf('arcade.js'));
       return ci !== -1 && ci < gi;
     }));

  /* 语言 key 全站共享同一个存储键 */
  const i18n = fs.readFileSync(path.join(ROOT, 'shared/i18n.js'), 'utf8');
  ok('语言存储键统一为 arcade.lang', i18n.indexOf("var STORAGE_KEY = 'arcade.lang';") >= 0);
  ok('兼容旧的语言键 whaleRunner.lang', i18n.indexOf('LEGACY_KEY') >= 0);

  return out;
}
