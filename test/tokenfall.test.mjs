/* TOKEN FALL：四类掉落物 / CONTEXT 上限与 Overflow 抢救 / DEEP THINK /
 * Combo / 难度上限 / 生成保底 / 暂停 / 触屏与多指 / 重开清理 / 最高分。
 * 全部走 game.js 真实代码：只操纵状态和输入，不复制一份游戏逻辑。
 *
 * 注意：固定步长累加器有浮点误差，tick(1) 不一定会推进一次逻辑步，
 * 所以这里用 advance()/advanceMs() 按"帧数/游戏内时间"推进，而不是数 tick。 */
import { harness } from './helpers.mjs';

function fresh(o) { return harness(Object.assign({ page: 'tokenfall', exposeGame: true }, o || {})); }

/* 开局并立刻松开方向键：鲸鱼停在原地，方便确定性地做碰撞测试 */
function startIdle(b) {
  b.key('keydown', 'ArrowRight', 'ArrowRight');
  b.key('keyup', 'ArrowRight', 'ArrowRight');
  return b;
}

/* 多推几帧（约 7 个逻辑步），确保状态真的更新过 */
function advance(b, frames) {
  const n = frames || 12;
  for (let i = 0; i < n; i++) b.tick(1);
  return b;
}

/* 按"游戏内时间"推进（只在 running 时有效；死亡会立即停下） */
function advanceMs(b, ms) {
  const G = b.G;
  const target = G.elapsedMs + ms;
  const limit = Math.ceil(ms / 8) + 40;
  let n = 0;
  while (G.elapsedMs < target && n++ < limit) {
    b.tick(1);
    if (G.state !== 'running') break;
  }
  return n;
}

/* 把掉落物直接送到鲸鱼嘴里：一直推到被接到，再多推几帧让状态落定 */
function feed(b, type) {
  const G = b.G;
  G.tokens.length = 0;
  G.spawnTimer = 1e9;                       // 测试期间不要自动生成，避免干扰
  G.tokens.push({ type: type, x: G.player.x + 8, y: 520, w: 34, h: 34, speed: 0.0001 });
  let guard = 0;
  while (G.tokens.length > 0 && guard++ < 40) b.tick(1);   // 直到被接到
  advance(b, 12);
}

function place(b, type, x, y, speed) {
  const t = { type: type, x: x, y: y, w: 34, h: 34, speed: speed === undefined ? 0.0001 : speed };
  b.G.tokens.push(t);
  return t;
}

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ================= A. 初始状态与 HUD ================= */
  {
    const b = fresh();
    const G = b.G;
    ok('初始为 ready', G.state === 'ready', G.state);
    ok('初始 CONTEXT = 0', G.context === 0, String(G.context));
    ok('初始分数 = 0', G.score === 0, String(G.score));
    ok('初始没有掉落物', G.tokens.length === 0, String(G.tokens.length));
    ok('CONTEXT 上限固定为 1024', G.contextMax === 1024, String(G.contextMax));
    ok('初始没有 Overflow / DEEP THINK', G.overflowActive === false && G.thinkMs === 0);
    b.clearLog(); advance(b, 6);
    const txt = b.log.texts.join('|');
    ok('HUD 显示 CONTEXT / 1024', txt.indexOf('CONTEXT 0 / 1024') >= 0, txt.slice(0, 120));
    ok('HUD 显示 SCORE', txt.indexOf('SCORE') >= 0);
    ok('HUD 显示 HI', txt.indexOf('HI') >= 0);
    ok('开场说明出现', txt.indexOf('接住 TOKEN') >= 0 || txt.indexOf('Catch tokens') >= 0, txt.slice(0, 120));
  }
  {
    const b = startIdle(fresh());
    b.G.context = 384;
    b.clearLog(); advance(b, 4);
    ok('HUD 形如 CONTEXT 384 / 1024',
       b.log.texts.some((s) => s === 'CONTEXT 384 / 1024'), b.log.texts.join('|').slice(0, 160));
  }

  /* ================= B. 四类掉落物 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    feed(b, 'token');
    ok('TOKEN：CONTEXT +32', G.context === 32, String(G.context));
    ok('TOKEN：+10 分', G.score === 10, String(G.score));
    ok('TOKEN：Combo 开始累计', G.combo === 1 && G.multiplier === 1, G.combo + '/' + G.multiplier);
    ok('TOKEN：接到后从场上移除', G.tokens.length === 0, String(G.tokens.length));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 512;
    feed(b, 'compress');
    ok('COMPRESS：CONTEXT −256', G.context === 256, String(G.context));
    ok('COMPRESS：+20 分', G.score === 20, String(G.score));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 100;
    feed(b, 'compress');
    ok('COMPRESS：CONTEXT 不会低于 0', G.context === 0, String(G.context));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.score = 500; G.combo = 4; G.multiplier = 2;
    feed(b, 'noise');
    ok('NOISE：CONTEXT +128', G.context === 128, String(G.context));
    ok('NOISE：不给分', G.score === 500, String(G.score));
    ok('NOISE：Combo 清零', G.combo === 0 && G.multiplier === 1, G.combo + '/' + G.multiplier);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    feed(b, 'think');
    ok('THINK：CONTEXT 只 +16', G.context === 16, String(G.context));
    ok('THINK：+30 分', G.score === 30, String(G.score));
    ok('THINK：进入 DEEP THINK（约 4 秒）', G.thinkMs > 3500 && G.thinkMs <= 4000, String(G.thinkMs));
    ok('DEEP THINK：下落速度 ×0.6', G.speedScale === 0.6, String(G.speedScale));
    ok('THINK：有冷却，不会连着刷', G.thinkCooldownMs > 0, String(G.thinkCooldownMs));
    b.clearLog(); advance(b, 4);
    ok('DEEP THINK：HUD 显示 DEEP THINK',
       b.log.texts.some((s) => s.indexOf('DEEP THINK') >= 0), b.log.texts.join('|').slice(0, 120));
    advanceMs(b, 4600);
    ok('DEEP THINK：到期正常结束（不会永久存在）', G.thinkMs === 0, String(G.thinkMs));
    ok('DEEP THINK：结束后速度恢复正常', G.speedScale === 1, String(G.speedScale));
  }
  {
    /* 物理层面确认：同样的帧数，DEEP THINK 期间掉得明显更少 */
    const b = startIdle(fresh());
    const G = b.G;
    G.spawnTimer = 1e9; G.tokens.length = 0;
    const t1 = place(b, 'token', 20, 100, 120);
    advance(b, 30);
    const normal = t1.y - 100;
    G.tokens.length = 0;
    const t2 = place(b, 'token', 20, 100, 120);
    G.thinkMs = 4000;
    advance(b, 30);
    const slow = t2.y - 100;
    ok('DEEP THINK 期间掉落物确实更慢（约为 0.6 倍）', slow > 0 && slow < normal * 0.8,
       'slow=' + slow.toFixed(2) + ' normal=' + normal.toFixed(2));
  }

  /* ================= C. CONTEXT 溢出与抢救 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;
    b.clearLog();
    feed(b, 'token');                                   // 1000 + 32 = 1032 > 1024
    ok('CONTEXT 超过上限 -> 进入 Overflow', G.context === 1032 && G.overflowActive === true,
       G.context + '/' + G.overflowActive);
    ok('Overflow 有约 2 秒抢救时间', G.overflowMs > 1500 && G.overflowMs <= 2000, String(Math.round(G.overflowMs)));
    ok('Overflow 不是立刻死亡', G.state === 'running', G.state);
    advance(b, 4);
    ok('HUD 显示 OVERFLOW', b.log.texts.some((s) => s.indexOf('OVERFLOW') >= 0), b.log.texts.join('|').slice(0, 120));
    advanceMs(b, 700);                                  // 抢救时间走掉一部分
    ok('Grace Period 内还活着', G.state === 'running', G.state);
    feed(b, 'compress');                                // 1032 − 256 = 776
    ok('抢救：COMPRESS 把 CONTEXT 压回上限以下', G.context === 776, String(G.context));
    ok('抢救：Overflow 被取消', G.overflowActive === false && G.overflowMs === 0,
       G.overflowActive + '/' + G.overflowMs);
    advanceMs(b, 3200);                                 // 再跑 3 秒多
    ok('救回来之后不会因为残留计时器错误死亡', G.state === 'running', G.state);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;
    feed(b, 'token');
    b.clearLog();
    advanceMs(b, 2600);                                 // 超过 2 秒抢救时间
    ok('Grace Period 结束仍然超限 -> 游戏结束', G.state === 'over', G.state);
    ok('结束原因是上下文溢出', G.overReason === 'overflow', G.overReason);
    ok('显示 CONTEXT OVERFLOW 中文文案', b.log.texts.some((s) => s.indexOf('上下文溢出') >= 0),
       b.log.texts.join('|').slice(0, 120));
    ok('不是只显示普通 GAME OVER',
       b.log.texts.some((s) => s.indexOf('游戏结束') >= 0) && b.log.texts.some((s) => s.indexOf('上下文溢出') >= 0));
  }

  /* ================= D. Combo / CLEAN ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    feed(b, 'token'); feed(b, 'token'); feed(b, 'token');
    ok('Combo 可以增长', G.combo === 3, String(G.combo));
    ok('3 连之后倍率 x2', G.multiplier === 2, String(G.multiplier));
    b.clearLog(); advance(b, 4);
    ok('HUD 显示 CLEAN x2', b.log.texts.some((s) => s.indexOf('CLEAN x2') >= 0), b.log.texts.join('|').slice(0, 120));
    feed(b, 'token'); feed(b, 'token'); feed(b, 'token');
    ok('6 连之后倍率 x3', G.multiplier === 3, String(G.multiplier));
    ok('倍率参与结算（10+10+10+20+20+20 = 90）', G.score === 90, String(G.score));
    feed(b, 'noise');
    ok('接到 NOISE 后 Combo 清零', G.combo === 0 && G.multiplier === 1, G.combo + '/' + G.multiplier);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.combo = 96; G.multiplier = 5;
    feed(b, 'token');
    ok('Combo 倍率封顶 x5', G.multiplier === 5, String(G.multiplier));
    ok('封顶后按 x5 结算（+50）', G.score === 50, String(G.score));
  }

  /* ================= E. 难度增长与上限 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    advance(b, 10);
    const s0 = G.speed, i0 = G.spawnInterval, a0 = G.maxActive;
    ok('开局掉落很慢（<120px/s）', s0 < 120, String(s0));
    ok('开局同屏只掉 1 个', a0 === 1, String(a0));
    G.elapsedMs = 30000; advance(b, 10);
    ok('难度随时间上升：更快 + 更密', G.speed > s0 && G.spawnInterval < i0,
       s0.toFixed(1) + '->' + G.speed.toFixed(1) + ' / ' + i0 + '->' + G.spawnInterval);
    ok('同屏数量随时间上升', G.maxActive > a0, String(G.maxActive));
    G.elapsedMs = 1e7; advance(b, 10);
    ok('下落速度有上限（230px/s）', G.speed === 230, String(G.speed));
    ok('生成间隔有下限（520ms）', G.spawnInterval === 520, String(G.spawnInterval));
    ok('同屏数量有上限（4 个）', G.maxActive === 4, String(G.maxActive));
    ok('NOISE 概率有上限（0.30）', Math.abs(G.noiseChance - 0.30) < 1e-9, String(G.noiseChance));
  }

  /* ================= F. 生成保底（不让玩家遇到无解局面） ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 880;                                    // 86%：该给 COMPRESS 了
    G.sinceCompressMs = 99999;
    G.tokens.length = 0;
    G.spawnTimer = 0;
    advance(b, 10);
    ok('高 CONTEXT 且久未给 COMPRESS -> 下一次必定是 COMPRESS',
       G.tokens.some((t) => t.type === 'compress'), G.tokens.map((t) => t.type).join(','));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;                                   // 97.6%：抢救区间
    G.tokens.length = 0;
    G.spawnTimer = 1e9;                                 // 关掉普通生成，只看保底
    G.rescueMs = 600;
    advance(b, 60);
    const comps = G.tokens.filter((t) => t.type === 'compress');
    ok('95% 以上且场上没有 COMPRESS -> 限时保底生成', comps.length >= 1,
       G.tokens.map((t) => t.type).join(','));
    ok('保底 COMPRESS 不会出现在玩家头顶',
       comps.length > 0 && Math.abs(comps[0].x + 17 - (G.player.x + G.playerW / 2)) >= 60,
       comps.length ? 'x=' + Math.round(comps[0].x) : 'none');
  }
  {
    /* 长时间运行：NOISE 不会连成"墙" */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 1e7;                                  // 最高难度：NOISE 概率最大
    const seen = new Set(); const order = [];
    for (let i = 0; i < 1200; i++) {
      b.tick(1);
      G.context = 880;                                  // 钉在 86%：COMPRESS 保底必定触发，观察确定性生成序列
      for (let j = 0; j < G.tokens.length; j++) {
        const t = G.tokens[j];
        if (!seen.has(t)) { seen.add(t); order.push(t.type); }
      }
    }
    let run = 0, maxRun = 0;
    for (let k = 0; k < order.length; k++) {
      run = order[k] === 'noise' ? run + 1 : 0;
      if (run > maxRun) maxRun = run;
    }
    ok('长时间运行生成了足够的掉落物（' + order.length + ' 个）', order.length >= 12, String(order.length));
    ok('NOISE 最长连号 <= 2（不会形成几乎必接的墙）', maxRun <= 2, order.join(','));
    ok('86% 区间里 COMPRESS 保底生效（生成序列里一定有 C）',
       order.indexOf('compress') >= 0, Array.from(new Set(order)).join(','));
  }

  /* ================= G. 暂停 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.spawnTimer = 1e9; G.tokens.length = 0;
    G.thinkMs = 3000;
    G.context = 1100;                                   // 直接进入 Overflow
    G.score = 42;
    const t = place(b, 'token', 20, 100, 0.0001);
    advance(b, 12);
    b.key('keydown', 'p', 'KeyP');
    b.tick(1);
    ok('P 可以暂停', G.state === 'paused', G.state);
    const snap = { think: G.thinkMs, ovf: G.overflowMs, ctx: G.context, score: G.score,
                   elapsed: G.elapsedMs, ty: t.y, px: G.player.x };
    b.tick(120);                                        // 暂停中空跑 2 秒
    ok('暂停：DEEP THINK 计时停止', G.thinkMs === snap.think, snap.think + ' -> ' + G.thinkMs);
    ok('暂停：Overflow 计时停止', G.overflowMs === snap.ovf, snap.ovf + ' -> ' + G.overflowMs);
    ok('暂停：掉落物停止运动', t.y === snap.ty, snap.ty + ' -> ' + t.y);
    ok('暂停：分数停止', G.score === snap.score, String(G.score));
    ok('暂停：难度计时停止', G.elapsedMs === snap.elapsed, String(G.elapsedMs));
    ok('暂停：CONTEXT 不变', G.context === snap.ctx, String(G.context));
    b.clearLog(); b.tick(2);
    ok('暂停有提示', b.log.texts.some((s) => s.indexOf('已暂停') >= 0), b.log.texts.join('|').slice(0, 80));
    b.key('keydown', 'p', 'KeyP');
    advance(b, 12);
    ok('P 可以继续', G.state === 'running', G.state);
    ok('继续后 Overflow 计时重新推进', G.overflowMs < snap.ovf, String(G.overflowMs));
  }

  /* ================= H. 标签页切换 / 页面离开 / 大 dt ================= */
  {
    const b = startIdle(fresh());
    advance(b, 6);
    b.doc.hidden = true; b.fireDoc('visibilitychange');
    ok('切走标签页自动暂停', b.G.state === 'paused', b.G.state);
    b.doc.hidden = false; b.fireDoc('visibilitychange'); b.tick(2);
    ok('回到页面不会自动继续', b.G.state === 'paused', b.G.state);
  }
  {
    const b = startIdle(fresh());
    advance(b, 6);
    ok('循环正在排队下一帧', b.hasPendingRaf());
    b.fireDoc('pagehide');
    b.tick(1);
    ok('离开页面后不再排队 rAF', !b.hasPendingRaf());
    ok('离开页面过程无异常', b.errors.length === 0, b.errors[0]);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.spawnTimer = 1e9; G.tokens.length = 0;
    const t = place(b, 'token', 200, 100, 90);
    b.tick(1);
    const y0 = t.y;
    b.jump(5000);                                       // 切走 5 秒后回来
    b.tick(1);
    ok('时间差过大不会让掉落物瞬移', t.y - y0 < 8, 'Δy=' + (t.y - y0).toFixed(2));
  }
  /* ---- 切走标签页 / 失焦：输入必须松手，循环必须能接回来 ---- */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 170; G.player.vx = 0;
    b.els.right.fire('pointerdown', { pointerId: 31 });
    advance(b, 20);
    ok('按住 → 按钮时确实在移动', G.player.x > 170, String(G.player.x));
    b.doc.hidden = true; b.fireDoc('visibilitychange');
    ok('切走自动暂停', G.state === 'paused', G.state);
    b.doc.hidden = false; b.fireDoc('visibilitychange');
    b.key('keydown', 'p', 'KeyP');                      // 手动继续
    advance(b, 30);
    const x1 = G.player.x;
    advance(b, 30);
    ok('切走再回来不会继续往一边跑（按住状态已清空）', Math.abs(G.player.x - x1) < 0.01, x1 + ' -> ' + G.player.x);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 40; G.player.vx = 0;
    b.els.game.fire('pointerdown', { clientX: 200, clientY: 300, pointerId: 41, preventDefault() {} });
    b.els.game.fire('pointermove', { clientX: 300, clientY: 300, pointerId: 41, preventDefault() {} });
    advance(b, 40);
    b.doc.hidden = true; b.fireDoc('visibilitychange');
    b.doc.hidden = false; b.fireDoc('visibilitychange');
    b.key('keydown', 'p', 'KeyP');
    advance(b, 40);
    const x1 = G.player.x;
    advance(b, 40);
    ok('拖动到一半切走应用 -> 回来不会继续滑', Math.abs(G.player.x - x1) < 0.01, x1 + ' -> ' + G.player.x);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 170; G.player.vx = 0;
    b.key('keydown', 'ArrowLeft', 'ArrowLeft');
    advance(b, 20);
    ok('按住 ← 键在移动', G.player.x < 170, String(G.player.x));
    b.fireWin('blur');                                  // 窗口失焦兜底
    advance(b, 40);
    const x1 = G.player.x;
    advance(b, 20);
    ok('窗口失焦后键盘方向被松开（不会卡住）', Math.abs(G.player.x - x1) < 0.01, x1 + ' -> ' + G.player.x);
  }
  {
    const b = startIdle(fresh());
    advance(b, 20);
    const el0 = b.G.elapsedMs;
    b.fireDoc('pagehide'); b.fireWin('pagehide');
    b.tick(1);
    ok('离开页面后 rAF 停掉', !b.hasPendingRaf());
    b.fireWin('pageshow', { persisted: true });         // 前进/后退从 bfcache 恢复
    ok('从 bfcache 回来会重新启动循环', b.hasPendingRaf());
    advance(b, 30);
    ok('恢复后游戏继续推进（不是永远冻结的画面）', b.G.elapsedMs > el0, el0 + ' -> ' + b.G.elapsedMs);
    ok('恢复过程无异常', b.errors.length === 0, b.errors[0]);
  }

  /* ================= I. 键盘操作 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    const reset = () => { G.player.x = 170; G.player.vx = 0; };
    reset();
    b.key('keydown', 'ArrowLeft', 'ArrowLeft'); advance(b, 12);
    ok('← 向左移动', G.player.x < 170, String(G.player.x));
    b.key('keyup', 'ArrowLeft', 'ArrowLeft'); advance(b, 40);
    const xa = G.player.x;
    advance(b, 30);
    ok('松开方向键后停下（不会一直滑）', Math.abs(G.player.x - xa) < 0.01, xa + ' -> ' + G.player.x);
    reset();
    b.key('keydown', 'a', 'KeyA'); advance(b, 12); b.key('keyup', 'a', 'KeyA'); advance(b, 30);
    ok('A 也能向左', G.player.x < 170, String(G.player.x));
    reset();
    b.key('keydown', 'ArrowRight', 'ArrowRight'); advance(b, 12);
    ok('→ 向右移动', G.player.x > 170, String(G.player.x));
    b.key('keyup', 'ArrowRight', 'ArrowRight'); advance(b, 30);
    reset();
    b.key('keydown', 'd', 'KeyD'); advance(b, 12); b.key('keyup', 'd', 'KeyD'); advance(b, 30);
    ok('D 也能向右', G.player.x > 170, String(G.player.x));
    ok('键盘操作全程无异常', b.errors.length === 0, b.errors[0]);
  }

  /* ================= J. 触屏方向键 / 多指 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 170; G.player.vx = 0;
    b.els.left.fire('pointerdown', { pointerId: 1 });
    advance(b, 20);
    ok('按住 ← 按钮持续移动', G.player.x < 170, String(G.player.x));
    b.els.left.fire('pointerup', { pointerId: 1, preventDefault() {} });
    advance(b, 40);
    const xa = G.player.x;
    advance(b, 30);
    ok('松开 ← 按钮后停下', Math.abs(G.player.x - xa) < 0.01, xa + ' -> ' + G.player.x);

    b.els.left.fire('pointerdown', { pointerId: 2 });
    b.els.left.fire('pointercancel', { pointerId: 2, preventDefault() {} });
    advance(b, 40);
    const xb = G.player.x;
    advance(b, 20);
    ok('pointercancel 会松开（手指被系统打断不会卡住）', Math.abs(G.player.x - xb) < 0.01, xb + ' -> ' + G.player.x);

    b.els.right.fire('pointerdown', { pointerId: 3 });
    b.els.right.fire('pointerleave', { pointerId: 3, preventDefault() {} });
    advance(b, 40);
    const xc = G.player.x;
    advance(b, 20);
    ok('pointerleave 会松开（手指滑出按钮不会一直跑）', Math.abs(G.player.x - xc) < 0.01, xc + ' -> ' + G.player.x);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 170; G.player.vx = 0;
    b.els.left.fire('pointerdown', { pointerId: 11 });
    b.els.right.fire('pointerdown', { pointerId: 22 });
    advance(b, 20);
    ok('左右同时按住 -> 原地不动', Math.abs(G.player.x - 170) < 1, String(G.player.x));
    b.els.right.fire('pointerup', { pointerId: 22, preventDefault() {} });
    advance(b, 20);
    ok('松开右手后按左手方向继续移动', G.player.x < 170, String(G.player.x));
    b.fireDoc('pointerup', { pointerId: 11, preventDefault() {} });   // 手指在别处抬起
    advance(b, 40);
    const xa = G.player.x;
    advance(b, 20);
    ok('多指全部抬起后角色停下（不会持续移动）', Math.abs(G.player.x - xa) < 0.01, xa + ' -> ' + G.player.x);
  }

  /* ================= K. 画布拖动 / 轻点 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.player.x = 40; G.player.vx = 0;
    b.els.game.fire('pointerdown', { clientX: 200, clientY: 300, pointerId: 7, preventDefault() {} });
    b.els.game.fire('pointermove', { clientX: 260, clientY: 300, pointerId: 7, preventDefault() {} });
    advance(b, 90);
    ok('画布左右拖动可以带动鲸鱼', G.player.x > 60, String(G.player.x));
    b.els.game.fire('pointerup', { clientX: 260, clientY: 300, pointerId: 7, preventDefault() {} });
    ok('拖动结束不会误触暂停', G.state === 'running', G.state);
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    b.els.game.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 8, preventDefault() {} });
    b.els.game.fire('pointerup', { clientX: 100, clientY: 100, pointerId: 8, preventDefault() {} });
    ok('轻点画布 = 暂停', G.state === 'paused', G.state);
    b.els.game.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 9, preventDefault() {} });
    b.els.game.fire('pointerup', { clientX: 100, clientY: 100, pointerId: 9, preventDefault() {} });
    ok('再轻点 = 继续', G.state === 'running', G.state);
  }
  {
    const b = fresh();
    b.els.game.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 5, preventDefault() {} });
    b.els.game.fire('pointerup', { clientX: 100, clientY: 100, pointerId: 5, preventDefault() {} });
    ok('ready 时轻点画布开局（不会紧接着又被暂停）', b.G.state === 'running', b.G.state);
  }
  {
    const b = startIdle(fresh());
    b.els.pause.fire('click');
    ok('暂停按钮可用', b.G.state === 'paused', b.G.state);
    ok('暂停按钮文案变成继续', b.els.pause.textContent === '▶ 继续', b.els.pause.textContent);
    b.els.pause.fire('click');
    ok('再点恢复运行', b.G.state === 'running', b.G.state);
    ok('恢复后按钮文案变回暂停', b.els.pause.textContent === '⏸ 暂停', b.els.pause.textContent);
  }

  /* ================= L. 音效开关 ================= */
  {
    const b = fresh();
    b.els.sound.fire('click');
    ok('静音写入自己的 key', b.store.get('arcade.tokenFall.sound') === 'off', String(b.store.get('arcade.tokenFall.sound')));
    ok('静音按钮文案变化', b.els.sound.textContent === '🔇 静音', b.els.sound.textContent);
    ok('没有碰 Whale Runner 的静音 key', !b.store.has('whaleRunner.sound'));
    ok('没有碰 Context Snake 的静音 key', !b.store.has('arcade.snake.sound'));
    ok('静音后操作不报错', b.errors.length === 0, b.errors[0]);
  }

  /* ================= M. 最高分 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;
    feed(b, 'token');                                   // +10 分
    advanceMs(b, 2600);                                 // 溢出结束
    ok('最高分写入 arcade.tokenFall.high',
       Number(b.store.get('arcade.tokenFall.high')) === 10, String(b.store.get('arcade.tokenFall.high')));
    ok('没有碰 Whale Runner 的最高分 key', !b.store.has('whaleRunner.high'));
    ok('没有碰 Context Snake 的最高分 key', !b.store.has('arcade.snake.high'));
  }
  {
    const b = fresh({ saved: { 'arcade.tokenFall.high': '4321' } });
    ok('最高分能从 localStorage 读回', b.G.high === 4321, String(b.G.high));
  }

  /* ================= N. 重开清理 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;
    feed(b, 'token');
    advanceMs(b, 2600);                                 // 溢出死亡
    b.tick(60);                                         // 等死亡冷却结束
    place(b, 'token', 10, 60, 0);                       // 重开前先堆几个“旧掉落物”，验证 reset 真清场
    place(b, 'noise', 300, 40, 0);
    place(b, 'think', 150, 120, 0);
    const stale = G.tokens.length;
    ok('Game Over 后能重新开始', (function () {
      b.key('keydown', ' ', 'Space');
      b.key('keyup', ' ', 'Space');
      advance(b, 30);
      return G.state === 'running';
    })(), G.state);
    ok('重开后 CONTEXT 归零', G.context === 0, String(G.context));
    ok('重开后分数归零', G.score === 0, String(G.score));
    ok('重开后 Combo / 倍率归零', G.combo === 0 && G.multiplier === 1, G.combo + '/' + G.multiplier);
    ok('重开后 Overflow 状态清空', G.overflowActive === false && G.overflowMs === 0,
       G.overflowActive + '/' + G.overflowMs);
    ok('重开后 DEEP THINK 状态清空', G.thinkMs === 0 && G.speedScale === 1, G.thinkMs + '/' + G.speedScale);
    ok('重开后旧掉落物被清掉（清场前 ' + stale + ' 个）', stale >= 3 && G.tokens.length === 0, String(G.tokens.length));
    ok('重开没有异常', b.errors.length === 0, b.errors[0]);
  }

  /* ================= O. DPR 与渲染 ================= */
  {
    const results = [1, 2, 3].map(function (dpr) {
      const b = startIdle(fresh({ dpr: dpr }));
      b.G.player.x = 100;
      b.key('keydown', 'ArrowRight', 'ArrowRight');
      advance(b, 20);
      b.key('keyup', 'ArrowRight', 'ArrowRight');
      advance(b, 12);
      const x = b.G.player.x;
      b.G.context = 512;
      feed(b, 'compress');
      return { x: x, ctx: b.G.context, score: b.G.score };
    });
    ok('DPR 不影响移动与判定（1/2/3 三档一致）',
       Math.abs(results[0].x - results[1].x) < 1e-9 && Math.abs(results[0].x - results[2].x) < 1e-9 &&
       results[0].ctx === 256 && results[1].ctx === 256 && results[2].ctx === 256,
       JSON.stringify(results));
  }
  {
    const b = startIdle(fresh({ dpr: 3 }));
    advance(b, 300);
    ok('连续运行 5 秒无异常', b.errors.length === 0, b.errors[0]);
    ok('确实有绘制发生', b.log.rects > 500, String(b.log.rects));
  }

  /* ================= P. 画布文案随语言实时切换 ================= */
  {
    const b = fresh();
    advance(b, 4);
    ok('中文开场文案', b.log.texts.some((s) => s.indexOf('接住 TOKEN') >= 0), b.log.texts.join('|').slice(0, 100));
    b.els.lang.fire('click');
    b.clearLog(); advance(b, 4);
    const txt = b.log.texts.join('|');
    ok('切英文后画布文案立刻变化', txt.indexOf('Catch tokens') >= 0, txt.slice(0, 120));
    ok('英文 HUD 仍是 CONTEXT', txt.indexOf('CONTEXT') >= 0);
    b.els.lang.fire('click');
    b.clearLog(); advance(b, 4);
    ok('切回中文立刻生效', b.log.texts.join('|').indexOf('接住 TOKEN') >= 0);
  }

  return out;
}
