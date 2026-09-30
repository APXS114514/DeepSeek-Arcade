/* 一条命令跑完所有测试：  node test/run.mjs   （或 bash test/run.sh） */
import * as collision from './collision.test.mjs';
import * as i18n from './i18n.test.mjs';
import * as smoke from './smoke.test.mjs';

const suites = [['碰撞模型 / 缩放不变性', collision], ['多语言', i18n], ['冒烟 + 可玩性', smoke]];
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
