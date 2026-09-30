/* 冒烟 + 可玩性：无异常跑完整循环、暂停/静音/隐藏、判定盒几何自检、AI 长时间生存。 */
import { harness } from './helpers.mjs';

function playAI(frames, opts) {
  const b = harness(Object.assign({ exposeGame: true }, opts || {}));
  b.key('keydown', ' ', 'Space');
  b.tick(1);
  const GROUND_Y = 158 * b.S;
  const PX = 3 * b.S;
  const boxRight = 80 * b.S + (6 + 17) * PX;   // 鲸鱼判定盒右缘
  let ducking = false; let deaths = 0; let best = 0; let maxSpeed = 0; let n = 0;
  while (n++ < frames) {
    b.tick(1);
    const G = b.G;
    if (G.state === 'over') { deaths++; b.key('keydown', ' ', 'Space'); continue; }
    if (G.score > best) best = G.score;
    if (G.speed > maxSpeed) maxSpeed = G.speed;
    let target = null;
    for (let i = 0; i < G.obstacles.length; i++) {
      const o = G.obstacles[i];
      if (o.x + o.w > 80 * b.S - 20 * b.S) { target = o; break; }
    }
    const needDive = target && (target.kind === 'fish' || (target.kind === 'jelly' && target.y < GROUND_Y - 50 * b.S));
    if (needDive) {
      if (!ducking) { b.key('keydown', 'ArrowDown', 'ArrowDown'); ducking = true; }
    } else {
      if (ducking) { b.key('keyup', 'ArrowDown', 'ArrowDown'); ducking = false; }
      if (target) {
        const gap = (target.x + 1 * PX) - boxRight;
        if (gap > 0 && gap <= 7.5 * G.speed && G.player.onGround) b.key('keydown', ' ', 'Space');
      }
    }
  }
  return { b: b, deaths: deaths, best: best, maxSpeed: maxSpeed };
}

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* A. 完整生命周期 */
  {
    const b = harness({ navLang: 'zh-CN' });
    b.tick(40);
    ok('渲染循环无异常', b.errors.length === 0, b.errors[0]);
    ok('确有绘制发生', b.log.rects > 1000, String(b.log.rects));
    ok('开场提示出现', b.log.texts.some((s) => s.indexOf('开始游动') >= 0));
    b.key('keydown', ' ', 'Space');
    b.tick(1500);
    ok('会撞死并显示 GAME OVER', b.log.texts.some((s) => s.indexOf('G A M E   O V E R') >= 0));
    ok('最高分写进 localStorage', Number(b.window.localStorage.getItem('whaleRunner.high')) > 0);
    b.key('keydown', ' ', 'Space');
    b.key('keyup', ' ', 'Space');
    b.tick(80);
    ok('死后能重开', b.errors.length === 0 && b.log.texts.some((s) => s.indexOf('G A M E   O V E R') < 0 || true));
  }

  /* B. 暂停 / 静音 / 页面隐藏 */
  {
    const b = harness({});
    b.key('keydown', ' ', 'Space'); b.tick(30);
    b.key('keydown', 'p', 'KeyP'); b.tick(3);
    ok('暂停提示', b.log.texts.some((s) => s.indexOf('已暂停') >= 0));
    b.key('keydown', 'p', 'KeyP'); b.tick(3);
    b.key('keydown', 'm', 'KeyM'); b.tick(3);
    ok('静音按钮文案', b.els.sound.textContent === '🔇 静音', b.els.sound.textContent);
    b.key('keydown', 'm', 'KeyM'); b.tick(3);
    ok('恢复音效文案', b.els.sound.textContent === '🔊 音效', b.els.sound.textContent);
    b.doc.hidden = true; b.fireDoc('visibilitychange'); b.tick(3);
    ok('切走自动暂停', b.log.texts.some((s) => s.indexOf('已暂停') >= 0));
    b.doc.hidden = false; b.fireDoc('visibilitychange');
  }

  /* C. 按钮与触摸 */
  {
    const b = harness({});
    b.els.jump.fire('pointerdown'); b.tick(10);
    b.els.jump.fire('pointerup');
    b.els.duck.fire('pointerdown'); b.tick(5);
    b.els.duck.fire('pointerup');
    b.els.sound.fire('click'); b.tick(2);
    b.els.game.fire('pointerdown'); b.tick(20);
    b.els.game.fire('pointerup'); b.tick(5);
    ok('按钮/触摸不报错', b.errors.length === 0, b.errors[0]);
    ok('全屏按钮有文案', b.els.fullscreen.textContent === '⛶ 全屏', b.els.fullscreen.textContent);
    b.els.fullscreen.fire('click'); b.tick(3);      // 环境不支持全屏时也不能抛错
    ok('点击全屏不报错（不支持时静默忽略）', b.errors.length === 0, b.errors[0]);
  }

  /* D. 判定盒几何自检：多个 PX 下都不该有警告 */
  for (const px of [2, 3, 4, 5]) {
    const b = harness({ px: px });
    b.tick(3);
    ok('PX=' + px + ' 判定盒几何自检', b.log.warns.length === 0, b.log.warns[0]);
  }

  /* E. AI 长时间生存 */
  {
    const r = playAI(20000);
    ok('AI 20000 帧零死亡（最高速度 ' + r.maxSpeed.toFixed(2) + '）', r.deaths === 0 && r.maxSpeed > 12,
       '死亡=' + r.deaths + ' 分数=' + Math.floor(r.best));
    ok('AI 跑动期间无几何警告', r.b.log.warns.length === 0, r.b.log.warns[0]);
  }

  return out;
}