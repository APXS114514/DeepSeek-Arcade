#!/usr/bin/env node
/* ============================================================
 * 把所有 HTML 里的本地 CSS / JS 引用的 ?v= 同步成 shared/version.js 里的版本。
 *
 *   node tools/bump-asset-version.mjs          # 写入
 *   node tools/bump-asset-version.mjs --check  # 只检查，不写（CI 可用）
 *
 * dev-only，不参与运行时。幂等：重复运行不会重复追加参数。
 * 只处理本地 .css / .js；外部 URL、data: URI、目录链接一律不动。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const src = fs.readFileSync(path.join(ROOT, 'shared/version.js'), 'utf8');
const m = /var VERSION = '([^']+)'/.exec(src);
if (!m) { console.error('✗ shared/version.js 里找不到 VERSION'); process.exit(1); }
const VERSION = m[1];

const pages = ['index.html']
  .concat(fs.readdirSync(path.join(ROOT, 'games'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'games', d.name, 'index.html')))
    .map((d) => 'games/' + d.name + '/index.html'));

/* 只给本地 css/js 加版本参数；favicon 是 data: URI，绝不能加 */
const REF = /(<(?:script|link)\b[^>]*?(?:src|href)=")([^"?]+?\.(?:css|js))(?:\?v=[^"]*)?(")/g;

let changed = 0, stale = [];
for (const page of pages) {
  const abs = path.join(ROOT, page);
  const before = fs.readFileSync(abs, 'utf8');

  /* 1) 每个页面都先加载 shared/version.js（以便渲染角标 + 提供版本常量） */
  let out = before;
  if (!/shared\/version\.js/.test(out)) {
    /* 必须匹配**整条闭合标签**，否则会拼出 "<script src=...
<script src=...>"
       这种未闭合结构，浏览器会把两条合并成一条，后面的脚本就再也不加载了。 */
    const anchor = /<script src="([^"]*shared\/i18n\.js)(\?v=[^"]*)?"[^>]*><\/script>/;
    if (anchor.test(out)) {
      out = out.replace(anchor, function (full, p1, p2) {
        const vurl = p1.replace('shared/i18n.js', 'shared/version.js');
        return '<script src="' + vurl + (p2 || '') + '"></script>' + '\n' + full;
      });
    } else {
      console.warn('! ' + page + ' 找不到 shared/i18n.js 锚点，跳过插入 version.js');
    }
  }

  /* 2) 同步 ?v= */
  out = out.replace(REF, (s, a, url, b) => a + url + '?v=' + VERSION + b);

  /* 自检：写盘前确认 script 标签成对，防止再产出损坏结构 */
  const openTags = (out.match(/<script\b/g) || []).length;
  const closeTags = (out.match(/<\/script>/g) || []).length;
  if (openTags !== closeTags) {
    console.error('✗ ' + page + ' 的 <script> 与 </script> 数量不一致（' + openTags + ' vs ' + closeTags + '），已中止，未写盘');
    process.exit(1);
  }
  if (out !== before) {
    if (CHECK) stale.push(page);
    else fs.writeFileSync(abs, out);
    changed++;
  }
}

if (CHECK) {
  if (stale.length) { console.error('✗ 以下页面资源版本不是 ' + VERSION + '：\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('✓ 全部页面资源版本均为 ' + VERSION);
} else {
  console.log('✓ 版本 ' + VERSION + '：更新了 ' + changed + ' 个页面');
}
