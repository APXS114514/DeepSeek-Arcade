/* 碰撞模型回归：跳 / 下潜 vs 四类海洋生物，并在多个 PX 下验证缩放不变性。
 * 判定全部走 game.js 的真实代码，测试只负责在正确的时机按键。 */
import { harness } from './helpers.mjs';

const CASES = [
  ['海胆 + 不跳', 'spawnUrchin();', 'stand', 0, 'die'],
  ['海胆 + 跳过', 'spawnUrchin();', 'jump', 7.5, 'survive'],
  ['珊瑚 + 跳过', 'spawnCoral();', 'jump', 7.5, 'survive'],
  ['低浮水母 + 下潜', 'spawnJelly(false);', 'dive', 0, 'die'],
  ['低浮水母 + 跳过', 'spawnJelly(false);', 'jump', 7.5, 'survive'],
  ['中空水母 + 站立', 'spawnJelly(true);', 'stand', 0, 'die'],
  ['中空水母 + 下潜', 'spawnJelly(true);', 'dive', 0, 'survive'],
  ['小鱼 + 站立', 'spawnFish();', 'stand', 0, 'die'],
  ['小鱼 + 下潜', 'spawnFish();', 'dive', 0, 'survive'],
];

export function pass(px, spawn, action, triggerFactor, trials) {
  const b = harness({ px: px, exposeGame: true, spawn: spawn, gap: [150, 170] });
  const S = b.S;
  const PX = 3 * S;
  const playerX = 80 * S;
  /* 鲸鱼判定盒右缘 = PLAYER_X + (dx + w) * PX = 80S + (6 + 17) * PX = 149S */
  const boxRight = 80 * S + (6 + 17) * PX;
  const G = b.G;

  b.key('keydown', ' ', 'Space');
  b.tick(1);

  let phase = 'wait'; let die = 0; let survive = 0; let guard = 0; let ducking = false;
  if (action === 'dive') { b.key('keydown', 'ArrowDown', 'ArrowDown'); ducking = true; }

  while (die + survive < trials && guard++ < 60000) {
    b.tick(1);
    if (G.state === 'over') {
      if (phase === 'acting') { die++; }
      phase = 'wait';
      if (ducking) { b.key('keyup', 'ArrowDown', 'ArrowDown'); ducking = false; }
      b.key('keydown', ' ', 'Space');
      b.key('keyup', ' ', 'Space');
      continue;
    }
    if (action !== 'dive' && ducking) { b.key('keyup', 'ArrowDown', 'ArrowDown'); ducking = false; }
    const o = G.obstacles[0];
    if (!o) { phase = 'wait'; continue; }
    if (phase === 'wait') {
      if (action === 'stand' || action === 'dive') { phase = 'acting'; continue; }
      if (o.x + o.w < playerX) continue;                       // 这个已经游过去了
      const gap = (o.x + 1 * PX) - boxRight;
      if (gap > 0 && gap <= triggerFactor * G.speed && G.player.onGround) {
        b.key('keydown', ' ', 'Space');
        phase = 'acting';
      }
    } else if (o.x + o.w < playerX) { survive++; phase = 'wait'; }
  }
  return { die: die, survive: survive, warns: b.log.warns };
}

export function run() {
  const results = [];
  for (const px of [3, 2, 4]) {
    for (const c of CASES) {
      const r = pass(px, c[1], c[2], c[3], 6);
      const ok = c[4] === 'die' ? (r.die >= 5 && r.survive === 0) : (r.survive >= 5 && r.die === 0);
      results.push({
        name: 'PX=' + px + '  ' + c[0],
        pass: ok && r.warns.length === 0,
        extra: '死=' + r.die + ' 活=' + r.survive + (r.warns.length ? ' 警告=' + r.warns[0] : ''),
      });
    }
  }
  return results;
}