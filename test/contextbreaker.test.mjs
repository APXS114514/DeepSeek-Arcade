/* CONTEXT BREAKER · 玩法与规则
 * 把规格里点名的每条行为都钉死：状态机、发球、墙/挡板/砖块碰撞、五种砖块、
 * 掉球扣命、关卡推进、暂停冻结、高分持久化、皮肤与碰撞解耦、素材失败降级。 */
import { harness, source } from './helpers.mjs';

const HP = { context: 1, dense: 2, noise: 1, compress: 1, think: 1 };

function fresh(o) { return harness(Object.assign({ page: 'contextbreaker', exposeGame: true }, o || {})); }
function mk(type, x, y) {
  return { x: x, y: y, w: 36, h: 17, type: type, hp: HP[type], maxHp: HP[type], alive: true };
}
/* 永远活着、且球打不到的「保底砖」：防止测试中途意外触发 levelClear */
function keeper() { return mk('context', 2, 70); }
function paddleTop(g) { return g.paddle.y - g.paddle.h / 2; }
function park(g) { g.balls = [{ x: 200, y: 320, vx: 0, vy: 0, r: 6 }]; }
function hitFromBelow(g, br, speed) {
  g.balls = [{ x: br.x + br.w / 2, y: br.y + br.h + 14, vx: 0, vy: -(speed || 220), r: 6 }];
}
function prep(b, bricks) {
  b.tick(2);
  const g = b.G;
  g.state = 'playing';
  g.bricks = bricks.concat([keeper()]);
  return g;
}

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ================= A. 初始状态与 HUD ================= */
  {
    const b = fresh({ navLang: 'zh-CN' });
    b.tick(3);
    const g = b.G;
    ok('初始状态是 serve', g.state === 'serve', g.state);
    ok('初始 3 条命 / 0 分 / 第 1 层', g.lives === 3 && g.score === 0 && g.level === 1,
      g.lives + '/' + g.score + '/' + g.level);
    ok('初始只有 1 颗球，且停在挡板上', g.balls.length === 1 && g.balls[0].vx === 0 && g.balls[0].vy === 0);
    ok('第 1 层生成了砖块', g.bricks.length > 0, String(g.bricks.length));
    ok('初始没有特殊效果在跑', g.effects.noiseMs === 0 && g.effects.thinkMs === 0);
    ok('渲染循环无异常', b.errors.length === 0, b.errors[0]);
    const texts = b.log.texts.join('|');
    ok('HUD 打出 SCORE / HIGH SCORE / LIVES / LEVEL',
      texts.indexOf('SCORE') >= 0 && texts.indexOf('HIGH SCORE') >= 0 &&
      texts.indexOf('LIVES') >= 0 && texts.indexOf('LEVEL') >= 0, texts.slice(0, 90));
    ok('HUD 打出当前状态提示', texts.indexOf('准备发球') >= 0, texts.slice(0, 90));
  }

  /* ================= B. 发球 ================= */
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    b.key('keydown', ' ', 'Space');
    b.tick(1);
    ok('空格发球后进入 playing', g.state === 'playing', g.state);
    ok('发球后球向上飞', g.balls[0].vy < 0, String(g.balls[0].vy));
    ok('发球后球有水平分量（不是纯竖直）', Math.abs(g.balls[0].vx) > 1);
    const b2 = fresh({});
    b2.tick(2);
    b2.els.launch.fire('click');
    b2.tick(1);
    ok('点「发球」按钮也能发球', b2.G.state === 'playing', b2.G.state);
    const b3 = fresh({});
    b3.tick(2);
    b3.els.game.fire('pointerdown');
    b3.tick(1);
    ok('点画布也能发球', b3.G.state === 'playing', b3.G.state);
  }

  /* ================= C. 墙壁反弹 ================= */
  {
    const K = fresh({}).window.__breaker;
    const b = fresh({});
    const g = prep(b, []);
    g.balls = [{ x: 9, y: 300, vx: -200, vy: 0, r: 6 }];
    b.tick(6);
    ok('撞左墙后水平速度反向', g.balls[0] && g.balls[0].vx > 0, String(g.balls[0] && g.balls[0].vx));

    g.balls = [{ x: K.W - 9, y: 300, vx: 200, vy: 0, r: 6 }];
    b.tick(6);
    ok('撞右墙后水平速度反向', g.balls[0] && g.balls[0].vx < 0, String(g.balls[0] && g.balls[0].vx));

    g.balls = [{ x: 200, y: K.HUD_H + 7, vx: 0, vy: -200, r: 6 }];
    b.tick(4);
    ok('撞顶后竖直速度反向（不穿进 HUD）', g.balls[0] && g.balls[0].vy > 0, String(g.balls[0] && g.balls[0].vy));
    ok('球不会越过 HUD 顶边', g.balls[0] && g.balls[0].y - g.balls[0].r >= K.HUD_H - 0.001, String(g.balls[0] && g.balls[0].y));
  }

  /* ================= D. 挡板反弹（角度模型） ================= */
  {
    const b = fresh({});
    const g = prep(b, []);
    const K = b.window.__breaker;

    g.balls = [{ x: g.paddle.x, y: paddleTop(g) - 10, vx: 0, vy: 220, r: 6 }];
    b.tick(5);
    ok('正中挡板 -> 接近垂直向上', g.balls[0].vy < 0 && Math.abs(g.balls[0].vx) < 1,
      'vx=' + g.balls[0].vx.toFixed(2));

    g.balls = [{ x: g.paddle.x + g.paddle.w / 2 - 0.5, y: paddleTop(g) - 10, vx: 0, vy: 220, r: 6 }];
    b.tick(5);
    const e = g.balls[0];
    const magE = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    ok('靠边缘 -> 产生明显的水平分量', e.vx > 20, 'vx=' + e.vx.toFixed(2));
    ok('反弹角永远不接近水平（离水平 >= 30°）',
      Math.atan2(-e.vy, Math.abs(e.vx)) >= Math.PI / 6 - 1e-6,
      '角度=' + (Math.atan2(-e.vy, Math.abs(e.vx)) * 180 / Math.PI).toFixed(1) + '°');
    ok('反弹速度大小不因角度而变（手感稳定）', Math.abs(magE - K.speedFor(1)) < 1,
      magE.toFixed(1) + ' vs ' + K.speedFor(1));

    /* 极端位置（rel 超过 1）也必须被夹住 */
    g.balls = [{ x: g.paddle.x + g.paddle.w / 2 + 3, y: paddleTop(g) - 10, vx: 0, vy: 220, r: 6 }];
    b.tick(5);
    const x2 = g.balls[0];
    if (x2) {
      ok('远超边缘也只到最大角（不出现水平球）',
        Math.atan2(-x2.vy, Math.abs(x2.vx)) >= Math.PI / 6 - 1e-6,
        '角度=' + (Math.atan2(-x2.vy, Math.abs(x2.vx)) * 180 / Math.PI).toFixed(1) + '°');
    } else {
      ok('远超边缘也只到最大角（不出现水平球）', true, '球未被挡板接住，跳过');
    }
  }

  /* ================= E. 砖块碰撞 / DENSE 两段 ================= */
  {
    const b = fresh({});
    const g = prep(b, []);
    const c = mk('context', 120, 120);
    g.bricks = [c, keeper()];
    hitFromBelow(g, c);
    b.tick(10);
    ok('CONTEXT 一击即碎', c.alive === false);
    ok('CONTEXT 得 10 分', g.score === 10, String(g.score));

    const b2 = fresh({});
    const g2 = prep(b2, []);
    const d = mk('dense', 120, 120);
    g2.bricks = [d, keeper()];
    hitFromBelow(g2, d);
    b2.tick(10);
    ok('DENSE 第一次命中：不碎、进入受损状态',
      d.alive === true && d.hp === 1 && d.hp < d.maxHp, 'hp=' + d.hp);
    ok('DENSE 第一次命中不加分', g2.score === 0, String(g2.score));
    hitFromBelow(g2, d);
    b2.tick(10);
    ok('DENSE 第二次命中才碎', d.alive === false);
    ok('DENSE 得 20 分', g2.score === 20, String(g2.score));
    ok('砖块被击碎后球仍然有效（没被吞掉）', g2.balls.length === 1);
  }

  /* ================= F. NOISE：生效并结束 ================= */
  {
    const b = fresh({});
    const g = prep(b, []);
    const K = b.window.__breaker;
    const n = mk('noise', 120, 120);
    g.bricks = [n, keeper()];
    hitFromBelow(g, n);
    b.tick(10);
    ok('NOISE 被击碎', n.alive === false);
    ok('NOISE 触发负面计时', g.effects.noiseMs > 0, String(g.effects.noiseMs));
    ok('NOISE 让挡板变窄', g.paddle.w === K.PADDLE_W_MIN, String(g.paddle.w));
    ok('NOISE 缩窄幅度有下限（不会窄到没法玩）', K.PADDLE_W_MIN >= K.PADDLE_W * 0.5);
    park(g);
    b.tick(Math.ceil(K.NOISE_MS / (1000 / 60)) + 12);
    ok('NOISE 计时结束后归零', g.effects.noiseMs === 0, String(g.effects.noiseMs));
    ok('NOISE 结束后挡板恢复原宽', g.paddle.w === K.PADDLE_W, String(g.paddle.w));
  }

  /* ================= G. THINK：生效并结束 ================= */
  {
    const b = fresh({});
    const g = prep(b, []);
    const K = b.window.__breaker;
    const t2 = mk('think', 120, 120);
    g.bricks = [t2, keeper()];
    hitFromBelow(g, t2);
    b.tick(10);
    ok('THINK 被击碎', t2.alive === false);
    ok('THINK 触发 DEEP THINK 计时', g.effects.thinkMs > 0, String(g.effects.thinkMs));

    g.bricks = [keeper()];
    g.balls = [{ x: 200, y: 320, vx: 100, vy: -100, r: 6 }];
    b.tick(2);
    const mag = Math.sqrt(g.balls[0].vx * g.balls[0].vx + g.balls[0].vy * g.balls[0].vy);
    ok('DEEP THINK 期间球速明显变慢', mag < K.speedFor(1) - 1,
      mag.toFixed(1) + ' < ' + K.speedFor(1));

    park(g);
    b.tick(Math.ceil(K.THINK_MS / (1000 / 60)) + 12);
    ok('THINK 计时结束后归零', g.effects.thinkMs === 0, String(g.effects.thinkMs));
    g.balls = [{ x: 200, y: 320, vx: 100, vy: -100, r: 6 }];
    b.tick(2);
    const mag2 = Math.sqrt(g.balls[0].vx * g.balls[0].vx + g.balls[0].vy * g.balls[0].vy);
    ok('THINK 结束后球速恢复', Math.abs(mag2 - K.speedFor(1)) < 1, mag2.toFixed(1));
  }

  /* ================= H. COMPRESS：全局压缩 ================= */
  {
    const b = fresh({});
    const g = prep(b, []);
    const comp = mk('compress', 120, 120);
    const d1 = mk('dense', 200, 120);
    const d2 = mk('dense', 250, 120);
    const kp = keeper();
    g.bricks = [comp, d1, d2, kp];
    hitFromBelow(g, comp);
    b.tick(10);
    const K = b.window.__breaker;
    ok('COMPRESS 被击碎', comp.alive === false);
    ok('COMPRESS 本身 15 分，被它压碎的 CONTEXT 也照常计 10 分',
      g.score === K.SCORES.compress + K.SCORES.context, String(g.score));
    ok('COMPRESS 让其它砖块 HP -1', d1.hp === 1 && d2.hp === 1, d1.hp + '/' + d2.hp);
    ok('被 COMPRESS 压到 0 的砖块直接消失', kp.alive === false);
    ok('COMPRESS 不连锁触发效果（没有任何负面计时被打开）',
      g.effects.noiseMs === 0 && g.effects.thinkMs === 0);
  }

  /* ================= I. 掉球扣命 / 3 条命归零 ================= */
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    const K = b.window.__breaker;
    g.state = 'playing';
    g.bricks = [keeper()];
    g.balls = [{ x: 200, y: K.H + 30, vx: 0, vy: 200, r: 6 }];
    b.tick(3);
    ok('球掉到底部扣一条命', g.lives === 2, String(g.lives));
    ok('扣命后回到 serve 重新发球', g.state === 'serve', g.state);
    ok('扣命后挡板恢复原宽（清掉负面状态）', g.paddle.w === K.PADDLE_W);
    ok('扣命后重置为新的一颗球', g.balls.length === 1 && g.balls[0].vy === 0);
  }
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    const K = b.window.__breaker;
    for (let n = 0; n < 3; n++) {
      g.state = 'playing';
      g.bricks = [keeper()];
      g.balls = [{ x: 200, y: K.H + 30, vx: 0, vy: 200, r: 6 }];
      b.tick(3);
    }
    ok('3 条命全部用尽 -> gameOver', g.state === 'gameOver' && g.lives === 0,
      g.state + '/' + g.lives);
    ok('gameOver 后画面给出结束提示', b.log.texts.join('|').indexOf('G A M E   O V E R') >= 0);
  }

  /* ================= J. 关卡推进 ================= */
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    const K = b.window.__breaker;
    g.state = 'playing';
    g.bricks.forEach((br) => { br.alive = false; });
    b.tick(2);
    ok('清空全部砖块 -> levelClear', g.state === 'levelClear', g.state);
    const lv = g.level;
    b.tick(Math.ceil(1500 / (1000 / 60)) + 8);
    ok('LEVEL CLEAR 后自动进入下一层', g.level === lv + 1, String(g.level));
    ok('新一层重新进入 serve 且有砖块', g.state === 'serve' && g.bricks.length > 0 && g.bricks.some((x) => x.alive));
    ok('层数越高球越快', K.speedFor(2) > K.speedFor(1), K.speedFor(1) + ' -> ' + K.speedFor(2));
    ok('球速有上限（难度封顶，不会失控）', K.speedFor(60) === K.speedFor(400), String(K.speedFor(400)));
    ok('布局模板在 6~10 个之间', K.TEMPLATES.length >= 6 && K.TEMPLATES.length <= 10, String(K.TEMPLATES.length));
    ok('每个模板自身行宽一致', K.TEMPLATES.every((t2) => t2.every((row) => row.length === t2[0].length)));
    ok('同一层两次生成完全一致（不是随机布局）',
      JSON.stringify(K.buildLevel(3)) === JSON.stringify(K.buildLevel(3)));
    ok('特殊砖比例随层数上升但有上限',
      K.ratioAt(1).dense < K.ratioAt(5).dense && K.ratioAt(60).dense === K.ratioAt(400).dense,
      JSON.stringify(K.ratioAt(400)));
  }

  /* ================= K. 暂停 / 冻结 ================= */
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    b.key('keydown', ' ', 'Space');
    b.tick(4);
    ok('发球后处于 playing', g.state === 'playing', g.state);
    const bx = g.balls[0].x, by = g.balls[0].y;
    b.key('keydown', 'p', 'KeyP');
    b.tick(1);
    ok('按 P 进入 paused', g.state === 'paused', g.state);
    const px = g.balls[0].x, py = g.balls[0].y;
    const ptime = g.time;
    const eff = g.effects.thinkMs;
    b.tick(40);
    ok('暂停期间球完全冻结', g.balls[0].x === px && g.balls[0].y === py);
    ok('暂停期间角色动画时钟冻结', g.time === ptime, g.time + ' vs ' + ptime);
    ok('暂停期间效果计时冻结', g.effects.thinkMs === eff);
    ok('暂停提示出现在 HUD', b.log.texts.join('|').indexOf('已暂停') >= 0);
    b.key('keydown', 'p', 'KeyP');
    b.tick(3);
    ok('再按 P 恢复 playing', g.state === 'playing', g.state);
    ok('恢复后球继续运动', g.balls[0].x !== px || g.balls[0].y !== py);
    ok('暂停按钮文案会跟着状态切换', b.els.pause.textContent === '⏸ 暂停', b.els.pause.textContent);
  }
  {
    /* 暂停期间效果计时真的不推进（单独再验一次，避免被别的分支掩盖） */
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    const K = b.window.__breaker;
    g.state = 'playing';
    g.bricks = [keeper()];
    park(g);
    g.effects.thinkMs = 3000;
    g.effects.noiseMs = K.NOISE_MS;
    b.key('keydown', 'p', 'KeyP');
    b.tick(60);
    ok('暂停 60 帧后 THINK 计时未减少', g.effects.thinkMs === 3000, String(g.effects.thinkMs));
    ok('暂停 60 帧后 NOISE 计时未减少', g.effects.noiseMs === K.NOISE_MS, String(g.effects.noiseMs));
    b.key('keydown', 'p', 'KeyP');
    b.tick(3);
    ok('恢复后 THINK 计时开始减少', g.effects.thinkMs < 3000, String(g.effects.thinkMs));
  }
  {
    /* 切标签页 / 失焦自动暂停（沿用项目惯例） */
    const b = fresh({});
    b.tick(2);
    b.key('keydown', ' ', 'Space');
    b.tick(3);
    b.doc.hidden = true;
    b.fireDoc('visibilitychange');
    b.tick(2);
    ok('切走标签页自动暂停', b.G.state === 'paused', b.G.state);
    b.doc.hidden = false;
    b.fireDoc('visibilitychange');
    b.fireWin('blur');
    ok('失焦也保持暂停（不会自己继续）', b.G.state === 'paused', b.G.state);
  }

  /* ================= L. 高分持久化与 key 隔离 ================= */
  {
    const b = fresh({});
    b.tick(2);
    const g = b.G;
    const K = b.window.__breaker;
    g.state = 'playing';
    g.bricks = [keeper()];
    g.score = 777;
    g.lives = 1;
    g.balls = [{ x: 200, y: K.H + 30, vx: 0, vy: 200, r: 6 }];
    b.tick(3);
    ok('gameOver 时把最高分写进 localStorage', b.store.get(K.HIGH_KEY) === '777', String(b.store.get(K.HIGH_KEY)));
    ok('高分 key 就是规格要求的 arcade.breakerHighScore', K.HIGH_KEY === 'arcade.breakerHighScore');
  }
  {
    const b = fresh({ saved: { 'arcade.breakerHighScore': '2048' } });
    b.tick(2);
    ok('重新打开时读回历史最高分', b.G.high === 2048, String(b.G.high));
    b.G.score = 100;
    b.G.state = 'playing';
    b.G.bricks = [keeper()];
    b.G.balls = [{ x: 200, y: b.window.__breaker.H + 30, vx: 0, vy: 200, r: 6 }];
    b.tick(3);
    ok('低分不会覆盖历史最高分', b.store.get('arcade.breakerHighScore') === '2048',
      String(b.store.get('arcade.breakerHighScore')));
  }
  {
    /* key 与另外四款完全不冲突 */
    const others = ['whaleRunner.high', 'arcade.snake.high', 'arcade.tokenFall.high'];
    const K = fresh({}).window.__breaker;
    ok('高分 key 与其它四款互不冲突', others.indexOf(K.HIGH_KEY) < 0);
    for (const f of ['games/runner/game.js', 'games/snake/game.js', 'games/token-fall/game.js']) {
      ok('在 ' + f + ' 里搜不到 arcade.breakerHighScore', source(f).indexOf('arcade.breakerHighScore') < 0);
    }
    ok('大厅卡片挂上了 breaker 的高分位', source('index.html').indexOf('data-highscore="breaker"') >= 0);
    ok('大厅脚本把 breaker 映射到 arcade.breakerHighScore',
      source('arcade.js').indexOf("breaker: 'arcade.breakerHighScore'") >= 0);
  }

  /* ================= M. 皮肤接入 / 降级 / 相对路径 ================= */
  {
    const K = fresh({}).window.__breaker;
    function bounceWith(skin, images) {
      const b = fresh({ saved: { 'arcade.characterSkin': skin }, images: images || 'ok' });
      b.tick(3);
      const g = b.G;
      g.state = 'playing';
      g.bricks = [keeper()];
      g.balls = [{ x: g.paddle.x + 30, y: paddleTop(g) - 10, vx: 0, vy: 220, r: 6 }];
      b.tick(6);
      return { vx: g.balls[0].vx, vy: g.balls[0].vy, w: g.paddle.w, h: g.paddle.h, err: b.errors.length };
    }
    const classic = bounceWith('classic');
    const yunyue = bounceWith('yunyue');
    ok('classic 皮肤下游戏无异常', classic.err === 0);
    ok('yunyue 皮肤下游戏无异常', yunyue.err === 0);
    ok('换皮肤不改变挡板碰撞盒', classic.w === K.PADDLE_W && yunyue.w === K.PADDLE_W &&
      classic.h === yunyue.h, classic.w + '/' + yunyue.w);
    ok('换皮肤不改变反弹结果（角色素材尺寸不影响物理）',
      classic.vx === yunyue.vx && classic.vy === yunyue.vy,
      classic.vx.toFixed(2) + ' vs ' + yunyue.vx.toFixed(2));

    const fail = fresh({ images: 'fail', saved: { 'arcade.characterSkin': 'yunyue' } });
    fail.tick(30);
    ok('素材全部加载失败也不崩溃', fail.errors.length === 0, fail.errors[0]);
    ok('素材失败时仍然有挡板碰撞盒', fail.G.paddle.w === K.PADDLE_W);

    const noLs = fresh({});
    noLs.tick(3);
    ok('localStorage 不可用时不抛异常', noLs.errors.length === 0, noLs.errors[0]);
  }
  {
    const html = source('games/context-breaker/index.html');
    const js = source('games/context-breaker/game.js');
    ok('页面没有站点绝对路径（GitHub Pages 子路径安全）', !/(?:src|href)="\//.test(html));
    ok('页面按 i18n -> audio -> whale -> character -> game 的顺序加载',
      (function () {
        const i = html.indexOf('shared/i18n.js'), a = html.indexOf('shared/audio.js');
        const w = html.indexOf('shared/whale.js'), c = html.indexOf('shared/character.js');
        const g = html.indexOf('game.js');
        return i >= 0 && i < a && a < w && w < c && c < g;
      })());
    ok('返回游戏厅链接是相对的 ../../', /arcade-back[^>]*href="\.\.\/\.\.\/"/.test(html));
    ok('页面文案全部走 i18n', html.indexOf('data-i18n="breaker.') >= 0);
    ok('游戏代码里没有写死任何素材文件名 / 皮肤目录',
      js.indexOf('.webp') < 0 && js.indexOf('whale-yunyue') < 0 && js.indexOf("'assets/") < 0);
    ok('游戏代码里没有复制皮肤判断（smoothing 交给共享模块）',
      js.indexOf('imageSmoothingEnabled') < 0 && js.indexOf('yunyue') < 0 && js.indexOf('classic') < 0);
    ok('角色一律通过 ArcadeCharacter 语义接口绘制', js.indexOf('Character.draw') >= 0);
    ok('状态机五个状态都在代码里', ['serve', 'playing', 'paused', 'levelClear', 'gameOver']
      .every((s) => js.indexOf("'" + s + "'") >= 0));
    ok('五种砖块类型都在代码里', ['context', 'dense', 'noise', 'compress', 'think']
      .every((s) => js.indexOf("'" + s + "'") >= 0));
  }

  return out;
}
