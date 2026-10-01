/* TOKEN FALL：四类掉落物 / CONTEXT 上限与 Overflow 抢救 / DEEP THINK /
 * Combo / 难度上限 / 生成保底 / 暂停 / 触屏与多指 / 重开清理 / 最高分。
 * 全部走 game.js 真实代码：只操纵状态和输入，不复制一份游戏逻辑。
 *
 * 注意：固定步长累加器有浮点误差，tick(1) 不一定会推进一次逻辑步，
 * 所以这里用 advance()/advanceMs() 按"帧数/游戏内时间"推进，而不是数 tick。 */
import { harness, source } from './helpers.mjs';

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
    ok('HUD 显示当前难度阶段（LOAD 1）', txt.indexOf('LOAD 1') >= 0, txt.slice(0, 160));
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
    /* LOAD 1 + Context > 75%：C 是满效果 −256 */
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;
    feed(b, 'compress');
    ok('COMPRESS（LOAD 1 / 高 Context）：CONTEXT −256', G.context === 744, String(G.context));
    ok('COMPRESS：+20 分', G.score === 20, String(G.score));
  }
  {
    /* Context 只有 50%：收益 ×0.8，256 × 0.8 = 204.8 -> 按 16 取整 = 208 */
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 512;
    feed(b, 'compress');
    ok('COMPRESS：中段 Context 收益下降（−208）', G.context === 304, String(G.context));
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
    ok('NOISE（LOAD 1）：CONTEXT +128', G.context === 128, String(G.context));
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
    ok('已经进入最后一个难度阶段 LOAD 5', G.load === 5, String(G.load));
    ok('下落速度有上限（230px/s）', G.speed === 230, String(G.speed));
    ok('生成间隔有下限（520ms）', G.spawnInterval === 520, String(G.spawnInterval));
    ok('同屏数量有上限（4 个）', G.maxActive === 4, String(G.maxActive));
    ok('NOISE 概率有上限（≤0.32）', G.noiseChance <= 0.32 + 1e-9 && G.noiseChance > 0.3, String(G.noiseChance));
  }

  /* ================= F. 生成保底（不让玩家遇到无解局面） ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 880;                                    // 86%：LOAD 1 的保底区间
    G.sinceCompressMs = 99999;
    G.tokens.length = 0;
    G.spawnTimer = 0;
    advance(b, 10);
    ok('LOAD 1：高 CONTEXT 且久未给 COMPRESS -> 下一次必定是 COMPRESS',
       G.tokens.some((t) => t.type === 'compress'), G.tokens.map((t) => t.type).join(','));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;                                   // 97.6%：LOAD 1 抢救区间
    G.tokens.length = 0;
    G.spawnTimer = 1e9;                                 // 关掉普通生成，只看保底
    G.rescueMs = 600;
    advance(b, 60);
    const comps = G.tokens.filter((t) => t.type === 'compress');
    ok('LOAD 1：95% 以上且场上没有 COMPRESS -> 限时保底生成', comps.length >= 1,
       G.tokens.map((t) => t.type).join(','));
    ok('保底 COMPRESS 不会出现在玩家头顶',
       comps.length > 0 && Math.abs(comps[0].x + 17 - (G.player.x + G.playerW / 2)) >= 60,
       comps.length ? 'x=' + Math.round(comps[0].x) : 'none');
  }
  {
    /* LOAD 5：只保留极端保底 —— 98% 已经算「极限」，久未给 C 仍然会触发 */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 1e7;
    advance(b, 3);
    ok('长时间存活后停在 LOAD 5', G.load === 5, String(G.load));
    G.context = 1024 * 0.98;                            // 98%：LOAD 5 的 urge 区间
    G.sinceCompressMs = 99999;
    G.tokens.length = 0;
    G.spawnTimer = 0;
    advance(b, 4);
    ok('LOAD 5：极端保底依然存在（避免纯 RNG 无解局）',
       G.tokens.some((t) => t.type === 'compress'), G.tokens.map((t) => t.type).join(','));
  }
  {
    /* 长时间运行：NOISE 不会连成"墙"（在最高难度 LOAD 5 上验证） */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 1e7;                                  // 最高难度：NOISE 概率最大
    const seen = new Set(); const order = [];
    for (let i = 0; i < 1200; i++) {
      b.tick(1);
      G.context = 300;                                  // 钉在低 Context：排除 C 保底的干扰
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
    ok('LOAD 5 长时间运行生成了足够的掉落物（' + order.length + ' 个）', order.length >= 12, String(order.length));
    ok('NOISE 最长连号 <= 2（不会形成几乎必接的墙）', maxRun <= 2, order.join(','));
    ok('LOAD 5 的生成序列里 HEAVY TOKEN 确实会出现', order.indexOf('heavy') >= 0,
       Array.from(new Set(order)).join(','));
  }

  /* ================= G. 暂停 ================= */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.spawnTimer = 1e9; G.tokens.length = 0;
    G.thinkMs = 3000;
    G.context = 1100;                                   // 直接进入 Overflow
    G.score = 42;
    G.compressStreak = 2;                               // 顺便验证 Fatigue 恢复计时也会冻结
    G.compressSinceMs = 250;
    const t = place(b, 'token', 20, 100, 0.0001);
    advance(b, 12);
    b.key('keydown', 'p', 'KeyP');
    b.tick(1);
    ok('P 可以暂停', G.state === 'paused', G.state);
    const snap = { think: G.thinkMs, ovf: G.overflowMs, ctx: G.context, score: G.score,
                   elapsed: G.elapsedMs, ty: t.y, px: G.player.x,
                   streak: G.compressStreak, since: G.compressSinceMs };
    b.tick(120);                                        // 暂停中空跑 2 秒
    ok('暂停：DEEP THINK 计时停止', G.thinkMs === snap.think, snap.think + ' -> ' + G.thinkMs);
    ok('暂停：Overflow 计时停止', G.overflowMs === snap.ovf, snap.ovf + ' -> ' + G.overflowMs);
    ok('暂停：Compression Fatigue 恢复计时停止', G.compressSinceMs === snap.since,
       snap.since + ' -> ' + G.compressSinceMs);
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
    ok('静音写入全站统一的 arcade.sound', b.store.get('arcade.sound') === 'off', String(b.store.get('arcade.sound')));
    ok('不再单独写自己的旧 key', !b.store.has('arcade.tokenFall.sound'));
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
    G.elapsedMs = 200000;                               // 先跑到 LOAD 5
    b.tick(1);
    G.compressStreak = 2;                               // 制造 Fatigue / HEAVY / Overlay 残留
    G.compressSinceMs = 200;
    G.heavyCaught = 3;
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
    ok('重开后 LOAD 回到 1', G.load === 1 && G.loadIndex === 0, G.load + '/' + G.loadIndex);
    ok('重开后 Compression Fatigue 清零', G.compressStreak === 0 && G.compressSinceMs === 0,
       G.compressStreak + '/' + G.compressSinceMs);
    ok('重开后 HEAVY TOKEN 状态清零', G.heavyCaught === 0, String(G.heavyCaught));
    ok('重开后浮动数值清空', G.floats.length === 0, String(G.floats.length));
    ok('重开后阶段横幅清空', G.loadBannerMs === 0, String(G.loadBannerMs));
    ok('重开后游戏速度恢复初始值',
       G.speed < 120 && G.spawnInterval > 1000 && G.maxActive === 1,
       G.speed + '/' + G.spawnInterval + '/' + G.maxActive);
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
       results[0].ctx === 304 && results[1].ctx === 304 && results[2].ctx === 304,
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
    ok('切英文后画布文案立刻变化', txt.indexOf('Catch TOKENs') >= 0, txt.slice(0, 120));
    ok('英文 HUD 仍是 CONTEXT', txt.indexOf('CONTEXT') >= 0);
    b.els.lang.fire('click');
    b.clearLog(); advance(b, 4);
    ok('切回中文立刻生效', b.log.texts.join('|').indexOf('接住 TOKEN') >= 0);
  }


  /* ================= Q. LOAD 难度阶段（纯规则 + 实际行为） =================
   * 规则全部走 game.js 暴露的 TokenFallRules 纯函数：
   * 验证数值和权重，而不是「随机一万次看比例对不对」那种脆弱写法。 */
  const R = fresh().window.TokenFallRules;
  ok('暴露了纯规则 API（可以脱离随机采样测试数值）',
     !!R && typeof R.getDropWeights === 'function' && typeof R.compressAmount === 'function');

  /* ---- Q1. 阶段划分 ---- */
  {
    const marks = [0, 1, 29999, 30000, 59999, 60000, 99999, 100000, 149999, 150000, 600000, 1e9];
    const want = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5];
    ok('LOAD 按存活时间正确切换（0 / 30 / 60 / 100 / 150 秒）',
       marks.every((m, i) => R.loadForElapsed(m) === want[i]),
       marks.map((m) => m + '->' + R.loadForElapsed(m)).join(','));
    ok('LOAD 5 之后不会继续提升到 LOAD 6',
       R.loadForElapsed(1e9) === 5 && R.loadForElapsed(3600 * 1000 * 5) === 5 && R.LOADS.length === 5);
    ok('阶段边界与设计一致（30s / 60s / 100s / 150s）',
       R.LOAD_STARTS.join(',') === '0,30000,60000,100000,150000', R.LOAD_STARTS.join(','));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    const seen = [];
    const at = (ms) => { G.elapsedMs = ms; advance(b, 3); seen.push(G.load); };
    at(0); at(29000); at(31000); at(61000); at(101000); at(151000); at(1e7);
    ok('游戏内 LOAD 随存活时间推进到 5', seen.join(',') === '1,1,2,3,4,5,5', seen.join(','));
    b.clearLog(); b.tick(2);
    ok('HUD 显示当前阶段 LOAD 5', b.log.texts.some((s) => s === 'LOAD 5'), b.log.texts.join('|').slice(0, 200));
  }
  {
    /* 阶段切换横幅：短暂提示 + 约 1 秒后自动结束 */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 30000;
    advance(b, 3);
    ok('切换阶段时置起横幅计时', G.loadBannerMs > 0 && G.loadBannerLoad === 2,
       G.loadBannerMs + ' / ' + G.loadBannerLoad);
    b.clearLog(); advance(b, 3);
    ok('横幅显示 LOAD 2 + 压力提示',
       b.log.texts.some((s) => s === 'LOAD 2') && b.log.texts.some((s) => s === '压力上升'),
       b.log.texts.join('|').slice(0, 200));
    var bannerFrames = 0;
    while (G.loadBannerMs > 0 && bannerFrames++ < 400) b.tick(1);
    ok('横幅约 1 秒后自动结束（不做长时间遮挡）', G.loadBannerMs === 0 && bannerFrames < 100,
       G.loadBannerMs + ' / frames=' + bannerFrames);
  }

  /* ---- Q2. COMPRESS 随 LOAD 变弱 ---- */
  {
    const base = [1, 2, 3, 4, 5].map((l) => R.LOADS[l - 1].compressCtx);
    ok('COMPRESS 基础值随 LOAD 递减（256/224/192/160/128）',
       base.join(',') === '256,224,192,160,128', base.join(','));
    ok('每个 LOAD 的 COMPRESS 基础值都严格低于上一个',
       base.every((v, i) => i === 0 || v < base[i - 1]), base.join(','));
    const full = [1, 2, 3, 4, 5].map((l) => R.compressAmount(l, 1024, 0));
    ok('满 Context / 无 Fatigue 时实际压缩量 = 基础值', full.join(',') === base.join(','), full.join(','));
    const c1 = R.compressAmount(5, 1024, 0);
    const c2 = R.compressAmount(5, 1024 - c1, 1);
    ok('LOAD 5 一个 C 清不掉四分之一 Context', c1 < 1024 / 4, String(c1));
    ok('LOAD 5 连续两个 C 也回不到「非常安全」（共 ' + (c1 + c2) + ' < 512）',
       c1 + c2 < 1024 * 0.5, String(c1 + c2));
  }
  {
    /* 实际接住时用当前 LOAD 的数值，并且浮动文字显示的是真实生效值 */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 150000; advance(b, 3);                 // LOAD 5
    G.context = 900;
    feed(b, 'compress');
    ok('LOAD 5 + 高 Context：实际压缩 −128', G.context === 772, String(G.context));
    b.clearLog(); b.tick(1);
    ok('Canvas 浮动文字显示真实压缩值（COMPRESS -128）',
       b.log.texts.some((s) => s === 'COMPRESS -128'), b.log.texts.join('|').slice(0, 200));
  }

  /* ---- Q3. NOISE 随 LOAD 变危险 ---- */
  {
    const noise = [1, 2, 3, 4, 5].map((l) => R.LOADS[l - 1].noiseCtx);
    ok('NOISE 惩罚随 LOAD 加重（128/144/160/192/224）',
       noise.join(',') === '128,144,160,192,224', noise.join(','));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 150000; advance(b, 3);                 // LOAD 5
    feed(b, 'noise');
    ok('LOAD 5 接到 NOISE：CONTEXT +224', G.context === 224, String(G.context));
    b.clearLog(); b.tick(1);
    ok('Canvas 浮动文字显示真实 NOISE 数值（NOISE +224）',
       b.log.texts.some((s) => s === 'NOISE +224'), b.log.texts.join('|').slice(0, 200));
  }

  /* ---- Q4. HEAVY TOKEN ---- */
  {
    ok('LOAD 1 不出现 HEAVY TOKEN', R.getDropWeights(1, 0).heavy === 0, String(R.getDropWeights(1, 0).heavy));
    ok('LOAD 2 开始出现 HEAVY TOKEN', R.getDropWeights(2, 0).heavy > 0, String(R.getDropWeights(2, 0).heavy));
    ok('HEAVY 概率随 LOAD 提高（0 / 0.08 / 0.15 / 0.20 / 0.22）',
       [1, 2, 3, 4, 5].map((l) => R.getDropWeights(l, 0).heavy).join(',') === '0,0.08,0.15,0.2,0.22',
       [1, 2, 3, 4, 5].map((l) => R.getDropWeights(l, 0).heavy).join(','));
    ok('HEAVY 权重始终少于普通 TOKEN（TOKEN 仍是主要得分来源）',
       [1, 2, 3, 4, 5].every((l) => {
         const w = R.getDropWeights(l, 0.5);
         return w.heavy < w.token;
       }));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 60000; advance(b, 3);                  // LOAD 3
    feed(b, 'heavy');
    ok('HEAVY TOKEN：CONTEXT +96（明显更危险）', G.context === 96, String(G.context));
    ok('HEAVY TOKEN：+35 分（高于普通 TOKEN 的 10）', G.score === 35, String(G.score));
    ok('HEAVY TOKEN：算作有效 Token，CLEAN 连击继续',
       G.combo === 1 && G.multiplier === 1, G.combo + '/' + G.multiplier);
    ok('HEAVY TOKEN：本局计数 +1', G.heavyCaught === 1, String(G.heavyCaught));
    b.clearLog(); b.tick(1);
    ok('Canvas 浮动文字显示 HEAVY TOKEN +96',
       b.log.texts.some((s) => s === 'HEAVY TOKEN +96'), b.log.texts.join('|').slice(0, 200));
  }
  {
    /* 连吃 HEAVY 不会清 Combo：形成「高分 vs Context 风险」的选择 */
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 100000; advance(b, 3);                 // LOAD 4
    feed(b, 'token'); feed(b, 'heavy'); feed(b, 'token');
    ok('TOKEN -> HEAVY -> TOKEN 连击不中断', G.combo === 3 && G.multiplier === 2,
       G.combo + '/' + G.multiplier);
    ok('LOAD 4 三个有效 Token 共 +40+96+40 = 176 Context', G.context === 176, String(G.context));
  }

  /* ---- Q5. COMPRESSION FATIGUE ---- */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 1000;                                    // > 75%：Context Efficiency = 100%
    feed(b, 'compress');
    ok('第 1 个 C：满效果 −256', G.context === 744, String(G.context));
    feed(b, 'compress');
    ok('短期第 2 个 C：Fatigue ×0.75 叠加中段 Context ×0.8 = −160', G.context === 584, String(G.context));
    feed(b, 'compress');
    ok('短期第 3 个 C：Fatigue ×0.5 继续递减（−96）', G.context === 488, String(G.context));
    ok('Fatigue 计数封顶（不会永久累积）', G.compressStreak === 2, String(G.compressStreak));
    ok('三个 C 的总压缩量明显少于 3 × 基础值',
       1000 - G.context < 3 * R.LOADS[0].compressCtx, String(1000 - G.context));

    G.context = 500;                                     // 压到保底线以下，等待期间不会刷出 C
    G.compressSinceMs = 0;
    advanceMs(b, 7200);
    ok('超过 7 秒没再接 COMPRESS -> Fatigue 重置', G.compressStreak === 0, String(G.compressStreak));
    G.context = 1000;
    feed(b, 'compress');
    ok('重置后再接 C 恢复满效果（−256）', G.context === 744, String(G.context));
  }
  {
    const ok1 = R.fatigueMultiplier(0), ok2 = R.fatigueMultiplier(1), ok3 = R.fatigueMultiplier(2);
    ok('Fatigue 倍率依次为 100% / 75% / 50%', ok1 === 1 && ok2 === 0.75 && ok3 === 0.5,
       ok1 + '/' + ok2 + '/' + ok3);
    ok('Fatigue 倍率不会继续变小（第 4 个仍是 50%）', R.fatigueMultiplier(9) === 0.5, String(R.fatigueMultiplier(9)));
    ok('恢复窗口设计为 7 秒', R.FATIGUE_WINDOW_MS === 7000, String(R.FATIGUE_WINDOW_MS));
    ok('固定 100% Context Efficiency 时 Fatigue 依次为 256 / 192 / 128',
       [0, 1, 2].map((f) => R.compressAmount(1, 1024, f)).join(',') === '256,192,128',
       [0, 1, 2].map((f) => R.compressAmount(1, 1024, f)).join(','));
  }

  /* ---- Q6. Context Efficiency ---- */
  {
    ok('Context > 75%：C 使用 100% 效果', R.contextEfficiency(0.9) === 1, String(R.contextEfficiency(0.9)));
    ok('Context 40%~75%：C 使用 80% 效果', R.contextEfficiency(0.5) === 0.8, String(R.contextEfficiency(0.5)));
    ok('Context < 40%：C 使用 50% 效果', R.contextEfficiency(0.2) === 0.5, String(R.contextEfficiency(0.2)));
    const hi = R.compressAmount(3, 1000, 0);
    const mid = R.compressAmount(3, 600, 0);
    const lo = R.compressAmount(3, 300, 0);
    ok('同 LOAD 同 Fatigue 下：Context 越低压缩越少（' + hi + ' / ' + mid + ' / ' + lo + '）',
       hi > mid && mid > lo, hi + ' / ' + mid + ' / ' + lo);
  }
  {
    /* 最终压缩量取整 / 下限 / 不越界 */
    ok('压缩量按 16 取整（不会出现 -61.382）',
       [1, 2, 3, 4, 5].every((l) => [0, 1, 2].every((f) => {
         const v = R.compressAmount(l, 900, f);
         return v % 16 === 0;
       })));
    ok('压缩量有下限 64（低 Context 时 C 仍然有意义）',
       R.compressAmount(5, 500, 2) === 64, String(R.compressAmount(5, 500, 2)));
    ok('Context 少于下限时按实际 Context 压缩（不出现负数）',
       R.compressAmount(1, 10, 0) === 10 && R.compressAmount(1, 0, 0) === 0,
       R.compressAmount(1, 10, 0) + '/' + R.compressAmount(1, 0, 0));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.context = 5;
    feed(b, 'compress');
    ok('极低 Context：接到 COMPRESS 也不会把 CONTEXT 压成负数', G.context === 0, String(G.context));
  }

  /* ---- Q7. 自然概率随 LOAD 变化（权重是纯函数，不做随机采样） ---- */
  {
    const w = [1, 2, 3, 4, 5].map((l) => R.getDropWeights(l, 0.5));
    ok('自然 COMPRESS 概率随 LOAD 下降（0.18 -> 0.05）',
       w.map((x) => x.compress).join(',') === '0.18,0.14,0.1,0.07,0.05',
       w.map((x) => x.compress).join(','));
    ok('LOAD 1 的 COMPRESS 比较容易看到（>= 15%）', w[0].compress >= 0.15, String(w[0].compress));
    ok('LOAD 3 起 COMPRESS 明显珍贵（<= 10%）', w[2].compress <= 0.10, String(w[2].compress));
    ok('LOAD 5 不能指望「等下肯定又来一个 C」（<= 5%）', w[4].compress <= 0.05, String(w[4].compress));
    ok('NOISE 概率随 LOAD 上升', [0, 1, 2, 3].every((i) => w[i + 1].noise > w[i].noise),
       w.map((x) => x.noise).join(','));
    ok('四项权重之和恒为 1',
       w.every((x) => Math.abs(x.token + x.heavy + x.compress + x.noise - 1) < 1e-12));
    ok('任何 LOAD / 任何 Context 下权重都不为负',
       [1, 2, 3, 4, 5].every((l) => [0, 0.5, 0.9, 1].every((r) => {
         const x = R.getDropWeights(l, r);
         return x.token >= 0 && x.heavy >= 0 && x.compress >= 0 && x.noise >= 0;
       })));
    ok('THINK 出现率随 LOAD 略降，但永不取消',
       R.LOADS.every((p, i) => p.thinkChance > 0 && (i === 0 || p.thinkChance <= R.LOADS[i - 1].thinkChance)),
       R.LOADS.map((p) => p.thinkChance).join(','));
  }

  /* ---- Q8. COMPRESS 保底随 LOAD 收紧 ---- */
  {
    const urge = R.LOADS.map((p) => p.urgeRatio);
    const rescue = R.LOADS.map((p) => p.rescueRatio);
    ok('保底触发阈值随 LOAD 逐渐严格（urge）', urge.every((v, i) => i === 0 || v > urge[i - 1]), urge.join(','));
    ok('抢救触发阈值随 LOAD 逐渐严格（rescue）', rescue.every((v, i) => i === 0 || v > rescue[i - 1]), rescue.join(','));
    ok('保底等待时间随 LOAD 变长',
       R.LOADS.map((p) => p.urgeMs).every((v, i, a) => i === 0 || v > a[i - 1]),
       R.LOADS.map((p) => p.urgeMs).join(','));
    ok('抢救等待时间随 LOAD 变长',
       R.LOADS.map((p) => p.rescueMs).every((v, i, a) => i === 0 || v > a[i - 1]),
       R.LOADS.map((p) => p.rescueMs).join(','));
    ok('LOAD 5 只保留极端保底（urge >= 97% / rescue >= 99%）',
       R.LOADS[4].urgeRatio >= 0.97 && R.LOADS[4].rescueRatio >= 0.99,
       R.LOADS[4].urgeRatio + '/' + R.LOADS[4].rescueRatio);
    ok('LOAD 5 不会在 95% 这种「还没到极限」时救玩家', R.LOADS[4].rescueRatio > 0.95);
    ok('LOAD 1 仍然保留比较积极的保底（新手不会被纯随机打死）',
       R.LOADS[0].urgeRatio <= 0.86 && R.LOADS[0].rescueRatio <= 0.95,
       R.LOADS[0].urgeRatio + '/' + R.LOADS[0].rescueRatio);
  }

  /* ---- Q9. Overflow Grace Period 随 LOAD 收紧 ---- */
  {
    const g = R.LOADS.map((p) => p.overflowMs);
    ok('抢救时间随 LOAD 收紧（2000/1800/1600/1400/1200）',
       g.join(',') === '2000,1800,1600,1400,1200', g.join(','));
    ok('抢救时间不低于设计下限 1.2 秒', R.OVERFLOW_FLOOR_MS === 1200 && g.every((v) => v >= 1200),
       R.OVERFLOW_FLOOR_MS + '/' + g.join(','));
  }
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 150000; advance(b, 3);
    G.context = 1024; advance(b, 3);
    ok('LOAD 5：进入 Overflow 时抢救时间约 1.2 秒',
       G.overflowActive === true && G.overflowMs > 1100 && G.overflowMs <= 1200,
       String(Math.round(G.overflowMs)));
    G.context = 900;                                    // 压回上限以下
    advance(b, 3);
    ok('抢救回来（Context 被压回上限以下）立刻取消 Overflow',
       G.overflowActive === false && G.overflowMs === 0, G.overflowActive + '/' + G.overflowMs);
  }

  /* ---- Q10. Pause 冻结 LOAD / Overflow / Fatigue ---- */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 20000;
    G.compressStreak = 2;
    G.compressSinceMs = 3000;
    advance(b, 3);
    ok('暂停前还在 LOAD 1', G.load === 1, String(G.load));
    G.context = 1100;                                   // 让它在暂停前进入 Overflow
    advance(b, 3);
    ok('暂停前已经进入 Overflow', G.overflowActive === true, String(G.overflowActive));
    b.key('keydown', 'p', 'KeyP');
    b.tick(1);
    const snap = { elapsed: G.elapsedMs, load: G.load, ovf: G.overflowMs,
                   since: G.compressSinceMs, streak: G.compressStreak };
    b.tick(300);                                        // 暂停中空跑 5 秒
    ok('暂停：LOAD 计时完全停止', G.elapsedMs === snap.elapsed && G.load === snap.load,
       snap.elapsed + ' -> ' + G.elapsedMs);
    ok('暂停：Overflow 计时冻结', G.overflowMs === snap.ovf, snap.ovf + ' -> ' + G.overflowMs);
    ok('暂停：Compression Fatigue 恢复计时冻结', G.compressSinceMs === snap.since,
       snap.since + ' -> ' + G.compressSinceMs);
    ok('暂停中不会因为时间流逝被判死', G.state === 'paused', G.state);
    b.key('keydown', 'p', 'KeyP');
    b.tick(2);
    ok('继续后 LOAD 计时恢复推进', G.elapsedMs > snap.elapsed, String(G.elapsedMs));
    ok('继续后 Overflow 计时恢复推进', G.overflowMs < snap.ovf, String(G.overflowMs));
  }

  /* ---- Q11. 切标签页回来不会瞬间跳多个 LOAD ---- */
  {
    const b = startIdle(fresh());
    const G = b.G;
    G.elapsedMs = 20000;
    advance(b, 3);
    ok('切走前是 LOAD 1', G.load === 1, String(G.load));
    b.doc.hidden = true; b.fireDoc('visibilitychange');
    ok('切走标签页自动暂停', G.state === 'paused', G.state);
    b.jump(120000);                                     // 假装离开了两分钟
    b.tick(1);
    ok('切回来仍然停在 LOAD 1（大 dt 被钳住，不会瞬间跳阶段）', G.load === 1, String(G.load));
    b.doc.hidden = false; b.fireDoc('visibilitychange');
    b.key('keydown', 'p', 'KeyP');                      // 手动继续
    b.tick(3);
    ok('继续后不会瞬间跳到高 LOAD', G.load === 1, String(G.load));
    ok('继续后 LOAD 计时从暂停处接着走', G.elapsedMs < 25000, String(G.elapsedMs));
  }

  /* ---- Q12. LOAD 5 是「很难」而不是「数学上必死」 ---- */
  {
    const p5 = R.paceAt(150000), p6 = R.paceAt(3600 * 1000);
    ok('150 秒之后节奏封顶、不再继续上涨',
       p5.speed === p6.speed && p5.spawn === p6.spawn && p5.active === p6.active,
       JSON.stringify(p5) + ' / ' + JSON.stringify(p6));
    ok('速度 / 生成间隔 / 同屏数量都有硬上限',
       p6.speed === 230 && p6.spawn === 520 && p6.active === 4, JSON.stringify(p6));
    ok('开局节奏明显更宽松（前 30 秒是新手阶段）',
       R.paceAt(0).speed === 95 && R.paceAt(0).active === 1 && R.paceAt(0).spawn === 1150,
       JSON.stringify(R.paceAt(0)));
    ok('节奏在阶段内连续变化（不会出现瞬移式加速）',
       (function () {
         let prev = R.paceAt(0).speed;
         for (let t = 500; t <= 160000; t += 500) {
           const s = R.paceAt(t).speed;
           if (s < prev - 1e-9 || s - prev > 2) return false;
           prev = s;
         }
         return true;
       })());
  }

  /* ================= 掉落物的标签必须看得清 =================
   * 只读 game.js 里的 LOOK 调色板，算 WCAG 对比度。
   * 这条是真实踩过的坑：heavy / compress / think 曾经用比内芯更深的字色
   * （#04303f 画在 #0a4a61 上），H / C / <think> 基本看不见。 */
  {
    const src = source('games/token-fall/game.js');
    const from = src.indexOf('var LOOK = {');
    const to = src.indexOf('};', from);
    ok('能在 game.js 里找到掉落物调色板', from > 0 && to > from);
    const LOOK = new Function('return (' + src.slice(from + 'var LOOK = '.length, to + 1) + ');')();
    const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
    };
    const ratio = (a, b) => {
      const la = lum(a), lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const types = ['token', 'heavy', 'compress', 'noise', 'think'];
    ok('五种掉落物都有配色', types.every((t) => LOOK[t] && LOOK[t].body && LOOK[t].text), Object.keys(LOOK).join(','));
    for (const t of types) {
      /* THINK 没有深色内芯，字直接画在金色主体上 */
      const bg = LOOK[t].core || LOOK[t].body;
      const cr = ratio(LOOK[t].text, bg);
      ok('掉落物 ' + t + ' 的标签对比度 ≥ 4.5:1（' + cr.toFixed(2) + ':1）', cr >= 4.5, cr.toFixed(2));
    }
    ok('THINK 不画深色内芯（<think> 有 7 个字符，22px 的芯里写不下）',
      LOOK.think.core === null || LOOK.think.core === undefined, String(LOOK.think.core));
  }

  return out;
}
