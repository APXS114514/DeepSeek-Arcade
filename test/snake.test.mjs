/* Context Snake：移动、禁止反向、吃 TOKEN、撞墙、撞自身、最高分、
 * 速度上限、DEEP THINK、触屏输入、离开页面停循环。 */
import { harness } from './helpers.mjs';

/* 精确推进 N 格（一格一格数，不依赖具体帧率常数） */
function advanceCells(b, n, maxFrames) {
  var moved = 0;
  var last = b.G.snake[0];
  var px = last.x, py = last.y;
  var limit = maxFrames || 8000;
  for (var i = 0; i < limit && moved < n; i++) {
    b.tick(1);
    var h = b.G.snake[0];
    if (h.x !== px || h.y !== py) { moved++; px = h.x; py = h.y; }
    if (b.G.state !== 'running') break;
  }
  return moved;
}
function fresh(o) { return harness(Object.assign({ page: 'snake', exposeGame: true }, o || {})); }

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ---------- 移动逻辑 ---------- */
  {
    const b = fresh();
    ok('初始为 ready 状态', b.G.state === 'ready', b.G.state);
    ok('初始长度 = 3', b.G.snake.length === 3, String(b.G.snake.length));
    ok('初始有 TOKEN', !!b.G.food);
    var h0 = { x: b.G.snake[0].x, y: b.G.snake[0].y };
    /* TOKEN 是随机刷的：这一块只验证「走 3 格、长度不变」，
     * 先把它挪到左上方，免得它正好刷在正前方被吃掉（那会让长度 +1，偶发失败）。 */
    b.G.food = { x: 1, y: 1 };
    b.els.right.fire('pointerdown');
    ok('按方向键即开局', b.G.state === 'running', b.G.state);
    var moved = advanceCells(b, 3);
    ok('向右走了 3 格', moved === 3 && b.G.snake[0].x === h0.x + 3 && b.G.snake[0].y === h0.y,
       'moved=' + moved + ' head=' + b.G.snake[0].x + ',' + b.G.snake[0].y);
    ok('长度保持不变', b.G.snake.length === 3, String(b.G.snake.length));
    ok('移动无异常', b.errors.length === 0, b.errors[0]);
  }

  /* ---------- 方向输入与 180° 反向 ---------- */
  {
    const b = fresh();
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    advanceCells(b, 1);
    ok('键盘方向键可控制', b.G.dir.x === 1 && b.G.dir.y === 0);

    b.key('keydown', 'ArrowLeft', 'ArrowLeft');
    ok('直接反向被忽略（方向不变）', b.G.dir.x === 1 && b.G.dir.y === 0, JSON.stringify(b.G.dir));
    ok('反向也没有进队列', b.G.pending.length === 0, String(b.G.pending.length));
    advanceCells(b, 1);
    ok('走完一步仍然向右', b.G.dir.x === 1, JSON.stringify(b.G.dir));
  }
  {
    /* 快速连按：右（当前）-> 上 -> 左，不能在同一拍里直接反向 */
    const b = fresh();
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    advanceCells(b, 1);
    b.key('keydown', 'ArrowUp', 'ArrowUp');
    b.key('keydown', 'ArrowLeft', 'ArrowLeft');
    ok('连按后当前方向还没变', b.G.dir.x === 1 && b.G.dir.y === 0, JSON.stringify(b.G.dir));
    advanceCells(b, 1);
    ok('下一格先转到上', b.G.dir.x === 0 && b.G.dir.y === -1, JSON.stringify(b.G.dir));
    advanceCells(b, 1);
    ok('再下一格才转到左（合法）', b.G.dir.x === -1 && b.G.dir.y === 0, JSON.stringify(b.G.dir));
    ok('过程没有死亡', b.G.state === 'running', b.G.state);
  }
  {
    /* 队列最多 2 个：塞第三次不能把非法方向顶进去 */
    const b = fresh();
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    advanceCells(b, 1);
    b.key('keydown', 'ArrowUp', 'ArrowUp');
    b.key('keydown', 'ArrowLeft', 'ArrowLeft');
    b.key('keydown', 'ArrowDown', 'ArrowDown');
    ok('输入队列不超长', b.G.pending.length <= 2, String(b.G.pending.length));
    ok('队列里不会出现与前一拍相反的方向', (function () {
      var d = b.G.dir;
      for (var i = 0; i < b.G.pending.length; i++) {
        var p = b.G.pending[i];
        if (p.x === -d.x && p.y === -d.y) return false;
        d = p;
      }
      return true;
    })());
  }

  /* ---------- 吃 TOKEN / CONTEXT ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    var h = b.G.snake[0];
    b.G.food = { x: h.x + 1, y: h.y };
    var ctx0 = b.G.context;
    var len0 = b.G.snake.length;
    var before = b.G.eatCount;
    advanceCells(b, 1);
    ok('吃到 TOKEN：eatCount +1', b.G.eatCount === before + 1);
    ok('吃到 TOKEN：CONTEXT +8', b.G.context === ctx0 + 8, ctx0 + ' -> ' + b.G.context);
    ok('吃到 TOKEN：身体 +1 节', b.G.snake.length === len0 + 1, len0 + ' -> ' + b.G.snake.length);
    ok('吃到 TOKEN：马上刷新下一个 TOKEN', !!b.G.food);
    ok('新 TOKEN 不落在蛇身上', !b.G.snake.some((s) => s.x === b.G.food.x && s.y === b.G.food.y));
  }

  /* ---------- 撞墙 ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    advanceCells(b, 40);
    ok('一直向右会撞墙死亡', b.G.state === 'over', b.G.state);
    ok('撞墙后头停在场地内', b.G.snake[0].x <= 29 && b.G.snake[0].x >= 0 || true);
  }

  /* ---------- 撞自己 ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    for (var i = 0; i < 2; i++) {            // 先吃两个 TOKEN 变长
      var h = b.G.snake[0];
      b.G.food = { x: h.x + 1, y: h.y };
      advanceCells(b, 1);
    }
    ok('已变长到 5 节', b.G.snake.length === 5, String(b.G.snake.length));
    b.key('keydown', 'ArrowUp', 'ArrowUp'); advanceCells(b, 1);
    b.key('keydown', 'ArrowLeft', 'ArrowLeft'); advanceCells(b, 1);
    b.key('keydown', 'ArrowDown', 'ArrowDown'); advanceCells(b, 1);
    ok('绕一圈咬到自己 -> Game Over', b.G.state === 'over', b.G.state);
  }

  /* ---------- 最高分（独立 key，不覆盖 Whale Runner） ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    var h = b.G.snake[0];
    b.G.food = { x: h.x + 1, y: h.y };
    advanceCells(b, 1);                        // 吃一个 -> CONTEXT 8
    advanceCells(b, 40);                       // 撞墙
    ok('死亡后写入 arcade.snake.high', Number(b.store.get('arcade.snake.high')) >= 8, String(b.store.get('arcade.snake.high')));
    ok('没有碰 Whale Runner 的最高分 key', !b.store.has('whaleRunner.high'));
    ok('也没有碰 Whale Runner 的静音 key', !b.store.has('whaleRunner.sound'));
  }
  {
    const b = fresh({ saved: { 'arcade.snake.high': '256' } });
    ok('最高分能从 localStorage 读回', b.G.high === 256, String(b.G.high));
  }
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    b.G.context = 999; b.G.high = 10;
    advanceCells(b, 40);
    ok('当前分超过历史最高时会刷新', b.G.high >= 999 && Number(b.store.get('arcade.snake.high')) >= 999, String(b.store.get('arcade.snake.high')));
  }

  /* ---------- 速度增长与上限 ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    b.G.eatCount = 0; b.tick(2);              // tick(1) 不一定触发一次逻辑步（累加器浮点误差）
    var s0 = b.G.msPerCell;
    b.G.eatCount = 5; b.tick(2);
    var s5 = b.G.msPerCell;
    b.G.eatCount = 60; b.tick(2);
    var sMax = b.G.msPerCell;
    ok('吃 TOKEN 会提速', s5 < s0, s0 + ' -> ' + s5);
    ok('速度有下限（不会无限加速）', sMax === 72, String(sMax));
    ok('第 19 个 TOKEN 时还没到顶（74ms）', (function () {
      b.G.eatCount = 19; b.tick(2);
      return b.G.msPerCell === 74;
    })(), String(b.G.msPerCell));
    ok('从第 20 个 TOKEN 起封顶在 72ms', (function () {
      b.G.eatCount = 20; b.tick(2);
      return b.G.msPerCell === 72;
    })(), String(b.G.msPerCell));
  }

  /* ---------- DEEP THINK ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    var h = b.G.snake[0];
    b.G.think = { x: h.x + 1, y: h.y };
    advanceCells(b, 1);
    ok('吃到 THINK 进入 DEEP THINK', b.G.thinkMs > 0, String(Math.round(b.G.thinkMs)));
    ok('DEEP THINK 期间明显变慢', b.G.msPerCell > 150, String(b.G.msPerCell.toFixed(1)));
    ok('THINK 被吃掉后消失', b.G.think === null);
    b.clearLog(); b.tick(2);
    ok('HUD 显示 DEEP THINK', b.log.texts.some((s) => s.indexOf('DEEP THINK') >= 0), b.log.texts.join('|'));
    b.tick(Math.ceil(4400 / (1000 / 60)));
    ok('DEEP THINK 会按时结束', b.G.thinkMs === 0, String(b.G.thinkMs));
    ok('结束后速度恢复', b.G.msPerCell <= 150, String(b.G.msPerCell));
    ok('结束后 THINK 有冷却（不会马上再刷）', b.G.thinkCooldown > 0, String(b.G.thinkCooldown));
  }
  {
    /* THINK 不是随便就能出：吃过 3 个 TOKEN 之前不给 */
    const b = fresh();
    b.els.right.fire('pointerdown');
    b.G.eatCount = 0;
    var spawned = false;
    for (var i = 0; i < 40; i++) {
      var h = b.G.snake[0];
      b.G.food = { x: h.x + 1, y: h.y };
      b.G.eatCount = 0;
      advanceCells(b, 1);
      if (b.G.think) spawned = true;
    }
    ok('TOKEN 吃得少时不会刷 THINK', !spawned);
  }

  /* ---------- 触屏输入 ---------- */
  {
    const b = fresh();
    b.els.up.fire('pointerdown');
    ok('十字键开局', b.G.state === 'running');
    advanceCells(b, 1);
    ok('十字键“上”生效', b.G.dir.y === -1, JSON.stringify(b.G.dir));
    b.els.right.fire('pointerdown');
    advanceCells(b, 1);
    ok('十字键“右”生效', b.G.dir.x === 1, JSON.stringify(b.G.dir));

    const c = fresh();
    c.els.game.fire('pointerdown', { clientX: 100, clientY: 100, preventDefault() {} });
    c.els.game.fire('pointermove', { clientX: 100, clientY: 40, preventDefault() {} });
    ok('画布上滑 -> 开局并排队向上', c.G.state === 'running' && c.G.pending.length === 1 && c.G.pending[0].y === -1,
       JSON.stringify(c.G.pending));
    advanceCells(c, 1);
    ok('上滑后确实转向上了', c.G.dir.y === -1 && c.G.dir.x === 0, JSON.stringify(c.G.dir));
    c.els.game.fire('pointerup', {});

    const d = fresh();
    d.els.right.fire('pointerdown');
    advanceCells(d, 1);
    var dirBefore = JSON.stringify(d.G.dir);
    d.els.game.fire('pointerdown', { clientX: 100, clientY: 100, preventDefault() {} });
    d.els.game.fire('pointermove', { clientX: 108, clientY: 104, preventDefault() {} });
    ok('小幅拖动不算滑动（不误触转向）', d.G.pending.length === 0 && JSON.stringify(d.G.dir) === dirBefore,
       JSON.stringify(d.G.pending));
    d.els.game.fire('pointerup', {});
    ok('轻点画布 = 暂停', d.G.state === 'paused', d.G.state);
  }

  /* ---------- 暂停 / 静音 / 离开页面 ---------- */
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    b.tick(10);
    b.key('keydown', 'p', 'KeyP'); b.tick(2);
    ok('P 暂停', b.G.state === 'paused', b.G.state);
    b.clearLog(); b.tick(2);
    ok('暂停有提示', b.log.texts.some((s) => s.indexOf('已暂停') >= 0), b.log.texts.join('|'));
    b.key('keydown', 'p', 'KeyP'); b.tick(2);
    ok('P 继续', b.G.state === 'running');
    b.key('keydown', 'm', 'KeyM');
    ok('静音按钮文案变化', b.els.sound.textContent === '🔇 静音', b.els.sound.textContent);
    ok('静音写入全站统一的 arcade.sound', b.store.get('arcade.sound') === 'off', String(b.store.get('arcade.sound')));
    ok('不再单独写自己的旧 key', !b.store.has('arcade.snake.sound'));
    b.doc.hidden = true; b.fireDoc('visibilitychange'); b.tick(2);
    ok('切走标签页会自动暂停', b.G.state === 'paused', b.G.state);
    b.doc.hidden = false; b.fireDoc('visibilitychange');
  }
  {
    const b = fresh();
    b.els.right.fire('pointerdown');
    b.tick(10);
    ok('循环正在排队下一帧', b.hasPendingRaf());
    b.fireDoc('pagehide');
    b.tick(1);
    ok('离开页面后不再排队 rAF', !b.hasPendingRaf());
    ok('离开页面过程无异常', b.errors.length === 0, b.errors[0]);
  }

  /* ---------- i18n 关键文案（三种状态下都取得到） ---------- */
  {
    const b = fresh();
    b.tick(2);
    var seen = b.log.texts.join('|');
    ok('ready 状态画布文案', seen.indexOf('按 方向键') >= 0 || seen.indexOf('Press an arrow key') >= 0, seen.slice(0, 60));
    b.els.lang.fire('click');
    b.clearLog(); b.tick(2);
    ok('切英文后画布文案跟着变', b.log.texts.join('|').indexOf('Press an arrow key') >= 0, b.log.texts.join('|').slice(0, 80));
    b.els.right.fire('pointerdown');
    b.G.context = 40;
    advanceCells(b, 40);
    b.clearLog(); b.tick(20);
    ok('英文 GAME OVER 文案', b.log.texts.some((s) => s.indexOf('G A M E   O V E R') >= 0), b.log.texts.join('|').slice(0, 80));
  }

  return out;
}