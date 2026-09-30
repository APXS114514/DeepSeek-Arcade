/* 一条命令跑完所有测试：  node test/run.mjs   （或 bash test/run.sh） */
import * as collision from './collision.test.mjs';
import * as snake from './snake.test.mjs';
import * as tokenfall from './tokenfall.test.mjs';
import * as attentionmaze from './attentionmaze.test.mjs';
import * as i18n from './i18n.test.mjs';
import * as smoke from './smoke.test.mjs';
import * as paths from './paths.test.mjs';

const suites = [
  ['Whale Runner · 碰撞模型 / 缩放不变性', collision],
  ['Context Snake · 玩法与规则', snake],
  ['Token Fall · 玩法与规则', tokenfall],
  ['Attention Maze · 玩法与规则', attentionmaze],
  ['多语言（五个页面）', i18n],
  ['Whale Runner · 冒烟 + 可玩性', smoke],
  ['静态检查 · 路径与存储键', paths],
];
let total = 0, fail = 0;
for (const s of suites) {
  const results = s[1].run();
  console.log('\n== ' + s[0] + ' ==');
  for (const r of results) {
    total++;
    if (!r.pass) fail++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass || !r.extra ? '' : '   -> ' + r.extra));
  }
}
console.log('\n' + (fail === 0 ? '全部通过' : fail + ' 项失败') + '：' + (total - fail) + '/' + total);
process.exit(fail === 0 ? 0 : 1);
