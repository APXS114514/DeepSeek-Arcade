/* 静态检查：没有死链接、没有只能部署在域名根目录的绝对路径。
 * 直接在文件系统里按相对路径解析，等价于 GitHub Pages 的 /whale-runner/ 子路径。 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const PAGES = ['index.html', 'games/runner/index.html', 'games/snake/index.html', 'games/token-fall/index.html'];
const SCRIPTS = ['arcade.js', 'shared/i18n.js', 'shared/audio.js',
  'games/runner/game.js', 'games/snake/game.js', 'games/token-fall/game.js'];

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
    const bad = src.match(/['"]\/[A-Za-z][A-Za-z0-9._/-]*\.(?:js|css|png|jpg|svg|json)['"]/g);
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

  /* 语言 key 全站共享同一个存储键 */
  const i18n = fs.readFileSync(path.join(ROOT, 'shared/i18n.js'), 'utf8');
  ok('语言存储键统一为 arcade.lang', i18n.indexOf("var STORAGE_KEY = 'arcade.lang';") >= 0);
  ok('兼容旧的语言键 whaleRunner.lang', i18n.indexOf('LEGACY_KEY') >= 0);

  return out;
}
