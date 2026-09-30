/* ATTENTION MAZE：关卡数据自检 + 可解性验证、地图解析、走格子规则、
 * QUERY/KEY/VALUE 链路、注意力权重稳定性、MULTI-HEAD、RESCAN、
 * 暂停冻结、进度与星级、存档容错、重开清理、触屏输入、DPR。
 * 全部走 game.js 真实代码，不复制一份游戏逻辑。 */
import { harness } from './helpers.mjs';

const DIRS = {
  up: ['ArrowUp', 'ArrowUp'],
  down: ['ArrowDown', 'ArrowDown'],
  left: ['ArrowLeft', 'ArrowLeft'],
  right: ['ArrowRight', 'ArrowRight']
};
const KEY = 'arcade.attentionMaze.progress';

function fresh(o) { return harness(Object.assign({ page: 'attentionmaze', exposeGame: true }, o || {})); }

function advance(b, frames) {
  const n = frames || 6;
  for (let i = 0; i < n; i++) b.tick(1);
  return b;
}
/* 按“游戏内时钟”推进（暂停时 now 不走，所以循环会自然停住） */
function advanceMs(b, ms) {
  const G = b.G;
  const target = G.now + ms;
  const limit = Math.ceil(ms / 8) + 80;
  let n = 0;
  while (G.now < target && n++ < limit) b.tick(1);
  return n;
}
function finishDisplay(b) {
  let guard = 0;
  while (b.G.state !== 'playing' && guard++ < 900) b.tick(1);
  return guard;
}
function step(b, dir) {
  const c = DIRS[dir];
  b.key('keydown', c[0], c[1]);
  b.key('keyup', c[0], c[1]);
}
/* 直接站到目标相邻格再走一步：确定性地触发某个节点，不会顺路踩到别的节点 */
function standNextTo(b, target) {
  const G = b.G;
  const cand = [[target.x + 1, target.y], [target.x - 1, target.y], [target.x, target.y + 1], [target.x, target.y - 1]];
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    if (c[0] < 0 || c[1] < 0 || c[0] >= 15 || c[1] >= 11) continue;
    if (G.grid[c[1]][c[0]] === '#') continue;
    G.player.cx = c[0]; G.player.cy = c[1];
    G.player.px = c[0]; G.player.py = c[1];
    const dx = target.x - c[0], dy = target.y - c[1];
    step(b, dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
    return true;
  }
  return false;
}
/* 开局并跳过 ATTENTION SCAN */
function play(b, i) {
  b.G.startLayer(i);
  advanceMs(b, b.G.layer.scanMs + 200);
  return b;
}
function keyById(layer, id) {
  for (let i = 0; i < layer.nodes.keys.length; i++) if (layer.nodes.keys[i].id === id) return layer.nodes.keys[i];
  return null;
}
/* ---------- 关卡数据的独立验证器（纯数据，不依赖运行时） ---------- */
function rows(layer) { return layer.map.map((r) => r.split('')); }
function bfs(layer, from, to) {
  const g = rows(layer);
  const k = (x, y) => x + ',' + y;
  const seen = {}; const prev = {};
  const q = [[from.x, from.y]];
  seen[k(from.x, from.y)] = 1;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (q.length) {
    const cur = q.shift();
    if (cur[0] === to.x && cur[1] === to.y) break;
    for (let i = 0; i < 4; i++) {
      const nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
      if (nx < 0 || ny < 0 || nx >= 15 || ny >= 11) continue;
      if (g[ny][nx] === '#') continue;
      if (seen[k(nx, ny)]) continue;
      seen[k(nx, ny)] = 1;
      prev[k(nx, ny)] = cur;
      q.push([nx, ny]);
    }
  }
  if (from.x === to.x && from.y === to.y) return [];
  let node = [to.x, to.y];
  if (!prev[k(to.x, to.y)]) return null;
  const path = [];
  while (!(node[0] === from.x && node[1] === from.y)) {
    path.unshift({ x: node[0], y: node[1] });
    node = prev[k(node[0], node[1])];
    if (!node) return null;
  }
  return path;
}
function requiredRoute(layer) {
  const n = layer.nodes;
  const route = [n.start];
  if (n.query) route.push(n.query);
  if (n.keys.length) route.push(keyById(layer, layer.answer));
  if (n.value) route.push(n.value);
  route.push(n.exit);
  return route;
}
function routeLength(layer) {
  const route = requiredRoute(layer);
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    if (route[i - 1] == null || route[i] == null) return null;
    const p = bfs(layer, route[i - 1], route[i]);
    if (!p) return null;
    total += p.length;
  }
  return total;
}

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ================= A. 关卡数据自检 + 可解性 ================= */
  {
    const b = fresh();
    const G = b.G;
    const layers = G.layers;
    ok('一共 12 个 Layer', layers.length === 12, String(layers.length));
    ok('每关都有独立的 tip / par / scan / focus', layers.every((l) =>
      typeof l.tip === 'string' && l.parTime > 0 && l.parMoves > 0 && l.scanMs >= 1200 && l.focus >= 2 && l.rescan >= 1));
    ok('每关扫描时长都在 1.2~3.2 秒内', layers.every((l) => l.scanMs >= 1200 && l.scanMs <= 3200),
      layers.map((l) => l.scanMs).join(','));

    let mapOk = true, borderOk = true, nodeOk = true, answerOk = true, parOk = true, solvable = true, routeOk = true;
    let mapBad = '', nodeBad = '', answerBad = '', parBad = '', routeBad = '';
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const id = 'L' + (i + 1);
      if (L.map.length !== 11 || !L.map.every((r) => r.length === 15)) { mapOk = false; mapBad += id + ' '; }
      if (!L.map.every((r) => r.charAt(0) === '#' && r.charAt(14) === '#')) { borderOk = false; }
      if (L.map[0].indexOf('.') >= 0 || L.map[10].indexOf('.') >= 0) { borderOk = false; }
      /* 所有节点必须在可走格上，而且互不重叠 */
      const g = rows(L);
      const cells = {};
      const nodes = [L.nodes.start, L.nodes.exit]
        .concat(L.nodes.query ? [L.nodes.query] : [])
        .concat(L.nodes.value ? [L.nodes.value] : [])
        .concat(L.nodes.keys);
      for (const n of nodes) {
        if (g[n.y][n.x] === '#') { nodeOk = false; nodeBad += id + '@' + n.x + ',' + n.y + ' '; }
        const kk = n.x + ',' + n.y;
        if (cells[kk]) { nodeOk = false; nodeBad += id + ' 重叠 ' + kk + ' '; }
        cells[kk] = 1;
      }
      /* KEY id 唯一、权重合法、answer 指向真实 KEY */
      const ids = L.nodes.keys.map((k) => k.id);
      if (new Set(ids).size !== ids.length) { answerOk = false; answerBad += id + ' id 重复 '; }
      if (!L.nodes.keys.every((k) => typeof k.id === 'string' && k.id.length > 0 && k.w >= 0 && k.w <= 1)) {
        answerOk = false; answerBad += id + ' 权重非法 ';
      }
      if (L.nodes.keys.length && !keyById(L, L.answer)) { answerOk = false; answerBad += id + ' answer 不存在 '; }
      /* 正确 KEY 必须是“注意力最高”的那个：单头看权重，多头看两个头之和 */
      if (L.nodes.keys.length) {
        const table = L.heads ? L.heads : [L.nodes.keys.map((k) => k.w)];
        if (L.heads && (!L.heads[0] || !L.heads[1] || L.heads[0].length !== ids.length || L.heads[1].length !== ids.length)) {
          answerOk = false; answerBad += id + ' head 长度不对 ';
        } else {
          const sums = ids.map((_, idx) => table.reduce((acc, head) => acc + Math.round(head[idx] * 100), 0));
          let best = 0;
          for (let s = 1; s < sums.length; s++) if (sums[s] > sums[best]) best = s;
          sums.sort((a, c) => c - a);
          if (ids[best] !== L.answer) { answerOk = false; answerBad += id + ' 最高分是 ' + ids[best] + ' 不是 ' + L.answer + ' '; }
          if (sums.length > 1 && sums[0] - sums[1] < 5) { answerOk = false; answerBad += id + ' 权重太接近（' + sums[0] + ' vs ' + sums[1] + '）'; }
        }
      }
      /* 可解性：忽略锁定条件，必要节点之间必须连通 */
      const optimal = routeLength(L);
      if (optimal === null) { solvable = false; routeBad += id + ' 不连通 '; }
      else if (optimal > L.parMoves) { parOk = false; parBad += id + '(' + optimal + '>' + L.parMoves + ') '; }
    }
    ok('12 张地图都是 15×11', mapOk, mapBad);
    ok('12 张地图四周封闭', borderOk);
    ok('所有节点都落在可走格上且不重叠', nodeOk, nodeBad);
    ok('answer 就是注意力最高的 KEY（多头按两头之和）', answerOk, answerBad);
    ok('12 关全部可解：起点→QUERY→正确 KEY→VALUE→EXIT 连通', solvable, routeBad);
    ok('parMoves 不小于最短通路（三星可达）', parOk, parBad);
    ok('parMoves 也不能比最短通路宽松太多（<=1.6 倍）', layers.every((l) => {
      const o = routeLength(l);
      return o !== null && l.parMoves <= Math.max(o + 4, Math.ceil(o * 1.6));
    }), layers.map((l) => routeLength(l) + '/' + l.parMoves).join(' '));
    ok('parTime 合理：不短于 0.4s/步、不长于 3s/步', layers.every((l) => {
      const o = routeLength(l);
      return o !== null && l.parTime >= Math.ceil(o * 0.4) && l.parTime <= Math.ceil(o * 3);
    }), layers.map((l) => routeLength(l) + '/' + l.parTime).join(' '));

    /* 机制递进 */
    ok('前 3 关没有 Q/K/V，只教 SCAN → 记住 → 找出口',
      layers.slice(0, 3).every((l) => !l.nodes.query && l.nodes.keys.length === 0 && !l.nodes.value));
    ok('L4 第一次出现 QUERY 与两个 KEY', !!layers[3].nodes.query && layers[3].nodes.keys.length === 2 && !layers[3].nodes.value);
    ok('L5 出现三个 KEY', layers[4].nodes.keys.length === 3);
    ok('L6 第一次出现 VALUE（完整链路）', !!layers[5].nodes.value && layers.slice(0, 5).every((l) => !l.nodes.value));
    ok('L7 起视野收到 2 格', layers[6].focus === 2);
    ok('L8 扫描时间明显变短', layers[7].scanMs <= 1800 && layers[7].scanMs < layers[0].scanMs);
    ok('L9 第一次出现 MULTI-HEAD', !!layers[8].heads && layers.slice(0, 8).every((l) => !l.heads));
    ok('L9~L12 是四个多头关卡', layers.slice(8).every((l) => !!l.heads && l.heads.length === 2));
    ok('L12 是 FINAL ATTENTION，机制最全', !!layers[11].final &&
      !!layers[11].heads && !!layers[11].nodes.query && !!layers[11].nodes.value && layers[11].nodes.keys.length >= 4);
    ok('每关的 tip 都是 maze.* 的 i18n key', layers.every((l) => l.tip.indexOf('maze.') === 0));
    ok('RESCAN 次数：教学关 2 次，中后期固定 1 次',
      layers.slice(0, 5).every((l) => l.rescan === 2) && layers.slice(5).every((l) => l.rescan === 1));
  }

  /* ================= B. 地图解析 / 走格子 ================= */
  {
    const b = fresh();
    const G = b.G;
    ok('初始在菜单', G.state === 'menu', G.state);
    ok('菜单里十字键是隐藏的', b.els.pad.hidden === true && b.els.playbar.hidden === true);
    ok('菜单里显示 RESET PROGRESS', b.els.reset.hidden === false);
    ok('没解锁的 Layer 不能从正常途径进入', G.selectLayer(4) === false && G.state === 'menu' && G.layerIndex === 0);
    ok('选中第 1 关进入 ATTENTION SCAN', G.selectLayer(0) === true && G.state === 'scan', G.state);
    ok('SCAN 期间不能移动', (function () {
      const cx = G.player.cx, cy = G.player.cy;
      step(b, 'right');
      return G.player.cx === cx && G.player.cy === cy && G.moves === 0;
    })());
    finishDisplay(b);
    ok('SCAN 结束进入 playing', G.state === 'playing', G.state);
    ok('十字键出现了', b.els.pad.hidden === false && b.els.playbar.hidden === false);
    const L = G.layer;
    ok('玩家站在起点', G.player.cx === L.nodes.start.x && G.player.cy === L.nodes.start.y);
    ok('格子制：按一次只走一格', (function () {
      const x0 = G.player.cx;
      step(b, 'right');
      return G.player.cx === x0 + 1 && G.player.cy === L.nodes.start.y;
    })(), G.player.cx + ',' + G.player.cy);
    ok('合法移动 MOVES +1', G.moves === 1, String(G.moves));
    ok('走过的格子留下残影', !!G.visited[(L.nodes.start.x + 1) + ',' + L.nodes.start.y]);
    const beforeMoves = G.moves;
    step(b, 'up');                                  // (x,0) 是墙
    ok('撞墙：坐标不变', G.player.cy === L.nodes.start.y, String(G.player.cy));
    ok('撞墙不增加 MOVES', G.moves === beforeMoves, String(G.moves));
    /* 四个方向都合法一次 */
    const dirs = [['down', 0, 1], ['right', 1, 0], ['up', 0, -1], ['left', -1, 0]];
    let allDirs = true;
    for (const d of dirs) {
      const x0 = G.player.cx, y0 = G.player.cy;
      G.player.cx = 7; G.player.cy = 5; G.player.px = 7; G.player.py = 5;   // 放在开阔处
      step(b, d[0]);
      if (G.player.cx !== 7 + d[1] || G.player.cy !== 5 + d[2]) allDirs = false;
    }
    ok('上下左右四个方向都能走一格', allDirs, G.player.cx + ',' + G.player.cy);
    ok('移动不会穿墙（一步步走 BFS 全程合法）', (function () {
      G.startLayer(1);                       // L2 蛇形走廊
      finishDisplay(b);
      const route = requiredRoute(G.layer);
      let guard = 0;
      let cur = { x: G.player.cx, y: G.player.cy };
      for (let s = 1; s < route.length; s++) {
        const p = bfs(G.layer, cur, route[s]);
        if (!p) return false;
        for (const cell of p) {
          const dx = cell.x - G.player.cx, dy = cell.y - G.player.cy;
          if (Math.abs(dx) + Math.abs(dy) !== 1) return false;      // 只能走一格
          step(b, dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
          if (G.player.cx !== cell.x || G.player.cy !== cell.y) return false;
          guard++;
          if (guard > 400) return false;
        }
        cur = route[s];
      }
      return G.state === 'clear';
    })(), G.state);
  }

  /* ================= C. 提前走到 EXIT / VALUE 无效 ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 5);                                     // L6：QUERY + KEY + VALUE + EXIT
    const L = G.layer;
    standNextTo(b, L.nodes.exit);
    ok('Q/K/V 没完成时走到 EXIT 不会过关', G.state === 'playing' && G.starsEarned === 0, G.state);
    standNextTo(b, L.nodes.value);
    ok('KEY 没找对时 VALUE 是锁着的', G.valueDone === false && G.valueUnlocked() === false);
    ok('提前乱撞不会记 MISTAKE', G.mistakes === 0, String(G.mistakes));
  }

  /* ================= D. QUERY → KEY → VALUE → EXIT ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 5);
    const L = G.layer;
    const wrongKey = L.nodes.keys.filter((k) => k.id !== L.answer)[0];
    standNextTo(b, L.nodes.query);
    ok('踩到 QUERY 进入注意力展示', G.state === 'attention_show' && G.queryDone === true, G.state);
    ok('展示时权重表 = 关卡数据（不是随机）',
      JSON.stringify(G.weightTables[0]) === JSON.stringify(L.nodes.keys.map((k) => k.w)),
      JSON.stringify(G.weightTables[0]));
    ok('展示期间不能移动', (function () {
      const x = G.player.cx, y = G.player.cy;
      step(b, 'right');
      return G.player.cx === x && G.player.cy === y;
    })());
    finishDisplay(b);
    ok('展示结束回到 playing', G.state === 'playing', G.state);
    standNextTo(b, wrongKey);
    ok('错误 KEY：记 1 次 MISTAKE', G.mistakes === 1, String(G.mistakes));
    ok('错误 KEY：不会 Game Over / 不会过关', G.state === 'playing' && G.starsEarned === 0);
    ok('错误 KEY：不解锁 VALUE', G.valueUnlocked() === false && G.matchedKeyId === null);
    ok('错误 KEY：此时 EXIT 仍然锁着', G.exitUnlocked() === false);
    standNextTo(b, wrongKey);
    ok('同一个错误 KEY 只记一次 MISTAKE', G.mistakes === 1, String(G.mistakes));
    standNextTo(b, keyById(L, L.answer));
    ok('正确 KEY：ATTENTION MATCHED', G.matchedKeyId === L.answer, String(G.matchedKeyId));
    ok('正确 KEY：解锁 VALUE', G.valueUnlocked() === true);
    ok('正确 KEY：不增加 MISTAKE', G.mistakes === 1, String(G.mistakes));
    ok('拿到 VALUE 前 EXIT 仍未解锁', G.exitUnlocked() === false);
    standNextTo(b, L.nodes.value);
    ok('走到 VALUE：解锁', G.valueDone === true);
    ok('VALUE 之后 EXIT 解锁', G.exitUnlocked() === true);
    standNextTo(b, L.nodes.exit);
    ok('走到 EXIT：LAYER CLEAR', G.state === 'clear', G.state);
    ok('过关给出星级', G.starsEarned >= 1 && G.starsEarned <= 3, String(G.starsEarned));
    ok('过关解锁下一关', G.progress.unlocked >= 7, String(G.progress.unlocked));
  }
  {
    /* 没有 VALUE 的关卡：正确 KEY 之后 EXIT 直接解锁 */
    const b = fresh();
    const G = b.G;
    play(b, 3);                                     // L4
    const L = G.layer;
    ok('L4 没有 VALUE 节点', !L.nodes.value);
    standNextTo(b, L.nodes.query);
    finishDisplay(b);
    standNextTo(b, keyById(L, L.answer));
    ok('L4：正确 KEY 之后 EXIT 直接解锁', G.exitUnlocked() === true && G.valueUnlocked() === true);
  }

  /* ================= E. 权重稳定 / 不随机 ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 6);
    const L = G.layer;
    const before = JSON.stringify(G.weightTables);
    advanceMs(b, 1500);
    ok('同一局里权重不随时间变化', JSON.stringify(G.weightTables) === before);
    standNextTo(b, L.nodes.query);
    ok('触发 QUERY 之后权重还是同一份', JSON.stringify(G.weightTables) === before);
    const expected = JSON.stringify([L.nodes.keys.map((k) => k.w)]);
    ok('单头权重就是关卡里写死的值', JSON.stringify(G.weightTables) === expected, JSON.stringify(G.weightTables));
    finishDisplay(b);
    G.restartLayer();
    ok('重新开始同一关：权重完全一致（不是每次随机）', JSON.stringify(G.weightTables) === before);
  }

  /* ================= F. 暂停冻结一切 ================= */
  {
    const b = fresh();
    const G = b.G;
    G.selectLayer(0);
    advanceMs(b, 300);
    b.key('keydown', 'p', 'KeyP');
    ok('P 可以暂停', G.state === 'paused', G.state);
    const snap = { scan: G.scanMs, now: G.now, time: G.timeMs, moves: G.moves };
    advance(b, 180);
    ok('暂停：SCAN 倒计时不走', G.scanMs === snap.scan, snap.scan + ' -> ' + G.scanMs);
    ok('暂停：动画时钟也不走', G.now === snap.now, snap.now + ' -> ' + G.now);
    ok('暂停：LAYER 时间不走', G.timeMs === snap.time);
    b.key('keydown', 'p', 'KeyP');
    advanceMs(b, 300);
    ok('恢复后 SCAN 继续推进', G.scanMs < snap.scan, String(G.scanMs));
    finishDisplay(b);
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 3);
    standNextTo(b, G.layer.nodes.query);
    ok('多头/单头展示已经开始', G.state === 'attention_show');
    b.key('keydown', 'p', 'KeyP');
    const snap = G.attention.ms;
    advance(b, 200);
    ok('暂停：注意力展示倒计时不走', G.attention.ms === snap, snap + ' -> ' + G.attention.ms);
    b.key('keydown', 'p', 'KeyP');
    advance(b, 20);
    ok('恢复后展示继续', G.attention.ms < snap, String(G.attention.ms));
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    advanceMs(b, 800);
    const t0 = G.timeMs;
    ok('playing 时 TIME 在走', t0 > 0, String(t0));
    b.key('keydown', 'p', 'KeyP');
    advance(b, 200);
    ok('暂停：TIME 停住', G.timeMs === t0, t0 + ' -> ' + G.timeMs);
    b.key('keydown', 'p', 'KeyP');
    advanceMs(b, 400);
    ok('恢复后 TIME 继续', G.timeMs > t0, String(G.timeMs));
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    b.doc.hidden = true; b.fireDoc('visibilitychange');
    ok('切走标签页自动暂停', G.state === 'paused', G.state);
    const t = G.timeMs;
    b.doc.hidden = false; b.fireDoc('visibilitychange'); advance(b, 30);
    ok('回到页面不会自动继续', G.state === 'paused' && G.timeMs === t);
  }

  /* ================= G. RESCAN ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    const total = G.layer.rescan;
    ok('L1 有 2 次 RESCAN', G.rescansLeft === total && total === 2);
    ok('RESCAN 会进入 ATTENTION SCAN', G.doRescan() === true && G.state === 'scan', G.state);
    ok('RESCAN 次数 -1', G.rescansLeft === total - 1, String(G.rescansLeft));
    ok('RESCAN 使用被记下来（会影响星级）', G.rescansUsed === 1);
    finishDisplay(b);
    ok('RESCAN 之后回到 playing', G.state === 'playing', G.state);
    ok('再 RESCAN 一次', G.doRescan() === true && G.rescansLeft === 0);
    finishDisplay(b);
    ok('用完之后不能再 RESCAN', G.doRescan() === false && G.state === 'playing' && G.rescansLeft === 0);
    ok('HUD 按钮显示 RESCAN 0', b.els.rescan.textContent.indexOf('0') >= 0, b.els.rescan.textContent);
  }

  /* ================= H. 星级 / 进度 / 存档 ================= */
  function clearLayer(b, opts) {
    const G = b.G;
    const L = G.layer;
    if (opts && opts.timeMs) G.timeMs = opts.timeMs;   // 无 QUERY 的关卡一踩 EXIT 就过关，必须先设
    standNextTo(b, L.nodes.query ? L.nodes.query : L.nodes.exit);
    finishDisplay(b);
    if (L.nodes.query) {
      if (opts && opts.wrongKey) {
        const wrong = L.nodes.keys.filter((k) => k.id !== L.answer)[0];
        if (wrong) standNextTo(b, wrong);
      }
      standNextTo(b, keyById(L, L.answer));
      finishDisplay(b);
      if (L.nodes.value) standNextTo(b, L.nodes.value);
    }
    standNextTo(b, L.nodes.exit);
    return G.state === 'clear';
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    ok('完美通关（0 MISTAKE、没 RESCAN、时间步数达标）', clearLayer(b));
    ok('完美通关 = 3 星', G.starsEarned === 3, String(G.starsEarned));
    ok('过关解锁 LAYER 02', G.progress.unlocked === 2, String(G.progress.unlocked));
    ok('星级写进 localStorage', JSON.parse(b.store.get(KEY)).stars['1'] === 3, b.store.get(KEY));
    ok('最佳成绩写进 localStorage', JSON.parse(b.store.get(KEY)).best['1'].m === G.moves, b.store.get(KEY));
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    G.doRescan();
    finishDisplay(b);
    ok('用过 RESCAN 后完美通关', clearLayer(b));
    ok('用过 RESCAN 最多 2 星', G.starsEarned === 2, String(G.starsEarned));
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 3);
    ok('L4 通关（带 1 次错误 KEY）', clearLayer(b, { wrongKey: true }));
    ok('1 次错误 KEY = 2 星', G.starsEarned === 2, G.starsEarned + ' / mistakes=' + G.mistakes);
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    ok('拖很久再通关', clearLayer(b, { timeMs: 200000 }));
    ok('耗时很久 = 1 星（仍然算过关）', G.starsEarned === 1 && G.state === 'clear', String(G.starsEarned));
  }
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    clearLayer(b, { timeMs: 3000 });
    const best = JSON.parse(b.store.get(KEY)).best['1'];
    G.restartLayer();
    finishDisplay(b);
    ok('重开后再通关一次（更差）', clearLayer(b, { timeMs: 90000 }));
    const best2 = JSON.parse(b.store.get(KEY)).best['1'];
    ok('更差的成绩不会覆盖最佳时间', best2.t === best.t, best.t + ' -> ' + best2.t);
    ok('星星取最好的一次', JSON.parse(b.store.get(KEY)).stars['1'] === 3);
    ok('更差的一局只拿 1 星（但不会掉星）', G.starsEarned === 1, String(G.starsEarned));
  }
  {
    const b = fresh();
    const G = b.G;
    G.progress.unlocked = 8;
    ok('已解锁的 Layer 可以重玩', G.selectLayer(6) === true && G.layerIndex === 6, String(G.layerIndex));
    ok('超出 12 的层不存在', G.selectLayer(12) === false);
    ok('负数层不存在', G.selectLayer(-1) === false);
  }
  {
    const b = fresh();
    const G = b.G;
    G.progress.unlocked = 12;
    play(b, 11);                                    // 最后一关
    clearLayer(b);
    ok('LAST LAYER 通关后 unlocked 不会超过 12', G.progress.unlocked === 12, String(G.progress.unlocked));
  }
  {
    /* 存档容错 */
    const bad = fresh({ saved: { [KEY]: '{这不是 JSON' } });
    ok('损坏的存档不会崩溃', bad.errors.length === 0, bad.errors[0]);
    ok('损坏的存档回退到默认进度', bad.G.progress.unlocked === 1, String(bad.G.progress.unlocked));
    ok('损坏存档下仍然能正常开局', (function () {
      bad.G.selectLayer(0);
      return bad.G.state === 'scan';
    })());
    const weird = fresh({ saved: { [KEY]: JSON.stringify({ v: 1, unlocked: 999, stars: { 1: 99, 2: 'x' }, best: { 1: { t: -5, m: 0 }, 2: { t: 20, m: 30 } } }) } });
    ok('异常字段会被夹到合法范围', weird.G.progress.unlocked === 12 &&
      weird.G.progress.stars['1'] === 3 && weird.G.progress.stars['2'] === undefined, JSON.stringify(weird.G.progress));
    ok('异常的最佳成绩被丢弃', !weird.G.progress.best['1'] && weird.G.progress.best['2'].t === 20, JSON.stringify(weird.G.progress.best));
    const half = fresh({ saved: { [KEY]: 'null' } });
    ok('存档是 null 也不崩', half.errors.length === 0 && half.G.progress.unlocked === 1);
  }
  {
    /* RESET PROGRESS 需要二次确认 */
    const b = fresh();
    const G = b.G;
    play(b, 0);
    clearLayer(b);
    G.toMenu();
    b.els.reset.fire('click');
    ok('第一次点 RESET 只是进入确认状态', G.progress.unlocked === 2 && G.resetConfirmMs > 0, String(G.resetConfirmMs));
    ok('确认态下按钮文案变了', b.els.reset.textContent.indexOf('CONFIRM') >= 0 || b.els.reset.textContent.indexOf('确认') >= 0, b.els.reset.textContent);
    b.els.reset.fire('click');
    ok('第二次点才真的清空', G.progress.unlocked === 1 && Object.keys(G.progress.stars).length === 0, JSON.stringify(G.progress));
    ok('清空后写回 localStorage', JSON.parse(b.store.get(KEY)).unlocked === 1, b.store.get(KEY));
  }

  /* ================= I. MULTI-HEAD ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 8);                                     // L9
    const L = G.layer;
    ok('L9 是两个头', G.headsCount === 2, String(G.headsCount));
    ok('两个头的权重表都与关卡数据一致',
      JSON.stringify(G.weightTables) === JSON.stringify(L.heads), JSON.stringify(G.weightTables));
    const sums = L.nodes.keys.map((k, i) => Math.round(L.heads[0][i] * 100) + Math.round(L.heads[1][i] * 100));
    let bestI = 0;
    for (let i = 1; i < sums.length; i++) if (sums[i] > sums[bestI]) bestI = i;
    ok('两个头都关注的那个 KEY 才是答案', L.nodes.keys[bestI].id === L.answer,
      'sums=' + sums.join(',') + ' answer=' + L.answer);
    standNextTo(b, L.nodes.query);
    ok('多头展示从 HEAD 1 开始', G.state === 'multihead_show' && G.attention.phase === 'head1' && G.attention.head === 0, G.attention.phase);
    ok('HUD 显示 HEAD 1', (b.clearLog(), b.tick(2), b.log.texts.join('|').indexOf('HEAD 1') >= 0), b.log.texts.join('|').slice(0, 60));
    finishDisplay(b);
    ok('两个头展示完回到 playing（不会卡在展示态）', G.state === 'playing', G.state);
    const wrong = L.nodes.keys.filter((k) => k.id !== L.answer)[0];
    standNextTo(b, wrong);
    ok('多头关卡走错 KEY 也是只记 MISTAKE', G.mistakes === 1 && G.matchedKeyId === null && G.state === 'playing', String(G.mistakes));
    standNextTo(b, keyById(L, L.answer));
    ok('多头关卡走对 KEY 才 ATTENTION MATCHED', G.matchedKeyId === L.answer);
  }
  {
    /* HEAD 顺序与 combine 提示（用 tick 一段段看状态机） */
    const b = fresh();
    const G = b.G;
    play(b, 9);                                     // L10：多头 + VALUE
    standNextTo(b, G.layer.nodes.query);
    const phases = [];
    let guard = 0;
    while (G.state !== 'playing' && guard++ < 900) {
      phases.push(G.attention.phase);
      b.tick(1);
    }
    const uniq = phases.filter((p, i) => phases.indexOf(p) === i);
    ok('展示顺序是 HEAD 1 → HEAD 2 → combine', uniq.join('>') === 'head1>head2>combine', uniq.join('>'));
    ok('L10 有 VALUE 且需要它', !!G.layer.nodes.value);
  }

  /* ================= J. 重开清理 ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 5);
    const L = G.layer;
    standNextTo(b, L.nodes.query);
    finishDisplay(b);
    standNextTo(b, L.nodes.keys.filter((k) => k.id !== L.answer)[0]);
    standNextTo(b, keyById(L, L.answer));
    standNextTo(b, L.nodes.value);
    G.doRescan();
    finishDisplay(b);
    const dirty = G.queryDone && G.matchedKeyId !== null && G.valueDone && G.mistakes > 0 && G.rescansUsed > 0;
    ok('重开前确实积累了一堆状态', dirty, [G.queryDone, G.matchedKeyId, G.valueDone, G.mistakes, G.rescansUsed].join('|'));
    ok('重开本关', G.restartLayer() === true && G.state === 'scan');
    ok('重开后 QUERY 未激活', G.queryDone === false);
    ok('重开后没有匹配的 KEY', G.matchedKeyId === null);
    ok('重开后 VALUE 未拿', G.valueDone === false);
    ok('重开后 MISTAKES 归零', G.mistakes === 0, String(G.mistakes));
    ok('重开后 RESCAN 复位', G.rescansLeft === L.rescan && G.rescansUsed === 0, G.rescansLeft + '/' + G.rescansUsed);
    ok('重开后计时归零', G.timeMs === 0 && G.scanMs === L.scanMs && G.now >= 0);
    ok('重开后注意力状态清空', G.attention.phase === 'idle' && G.attention.ms === 0);
    ok('重开后玩家回到起点', G.player.cx === L.nodes.start.x && G.player.cy === L.nodes.start.y);
    ok('重开后 triedKeys / 残影清空', Object.keys(G.triedKeys).length === 0 &&
      Object.keys(G.visited).length === 1 && !!G.visited[L.nodes.start.x + ',' + L.nodes.start.y]);
    ok('重开后没有残留粒子', G.particles.length === 0, String(G.particles.length));
    ok('重开后 MOVES 归零', G.moves === 0);
    ok('重开过程无异常', b.errors.length === 0, b.errors[0]);
  }

  /* ================= K. 触屏 / 输入 ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 0);
    const x0 = G.player.cx;
    b.els.right.fire('pointerdown', { pointerId: 1 });
    ok('按住方向键先走一格', G.player.cx === x0 + 1, String(G.player.cx));
    advanceMs(b, 500);
    ok('按住会持续走（有重复间隔）', G.player.cx >= x0 + 2, String(G.player.cx));
    b.els.right.fire('pointerup', { pointerId: 1, preventDefault() {} });
    const x1 = G.player.cx;
    advanceMs(b, 600);
    ok('松手后立刻停下', G.player.cx === x1, x1 + ' -> ' + G.player.cx);
    b.els.right.fire('pointerdown', { pointerId: 2 });
    b.els.right.fire('pointercancel', { pointerId: 2, preventDefault() {} });
    advanceMs(b, 600);
    const x2 = G.player.cx;
    ok('pointercancel 会松开（不会一直走）', G.player.cx === x2, String(G.player.cx));
    b.els.up.fire('pointerdown', { pointerId: 3 });
    b.els.up.fire('pointerleave', { pointerId: 3, preventDefault() {} });
    advanceMs(b, 600);
    const p3 = G.player.cx + ',' + G.player.cy;
    ok('pointerleave 会松开（手指滑出按钮）', (G.player.cx + ',' + G.player.cy) === p3, p3);
    /* 手指在按钮外面抬起：走 document 兜底 */
    b.els.left.fire('pointerdown', { pointerId: 4 });
    advanceMs(b, 300);
    const x4 = G.player.cx;
    b.fireDoc('pointerup', { pointerId: 4, preventDefault() {} });
    advanceMs(b, 600);
    ok('document 兜底松手后也会停（不会卡住）', G.player.cx === x4, x4 + ' -> ' + G.player.cx);
    /* 多指 */
    b.els.right.fire('pointerdown', { pointerId: 5 });
    b.els.left.fire('pointerdown', { pointerId: 6 });
    const x5 = G.player.cx;
    advanceMs(b, 400);
    ok('两个方向同时按住时，最后按下的方向生效', G.player.cx < x5, x5 + ' -> ' + G.player.cx);
    b.els.left.fire('pointerup', { pointerId: 6, preventDefault() {} });
    const xRel = G.player.cx;
    advanceMs(b, 400);
    const x6 = G.player.cx;
    ok('松开最后按下的方向后，回到还按着的方向', x6 > xRel, xRel + ' -> ' + x6);
    b.els.right.fire('pointerup', { pointerId: 5, preventDefault() {} });
    advanceMs(b, 500);
    const x7 = G.player.cx;
    advanceMs(b, 400);
    ok('全部松开后彻底停下', G.player.cx === x7, x7 + ' -> ' + G.player.cx);
    /* 失焦 */
    b.els.up.fire('pointerdown', { pointerId: 7 });
    b.fireWin('blur');
    advanceMs(b, 500);
    const p8 = G.player.cx + ',' + G.player.cy;
    advanceMs(b, 400);
    ok('窗口失焦也会松开（不会卡住）', (G.player.cx + ',' + G.player.cy) === p8, p8);
  }
  {
    /* 键盘：按住连走 / 松手停 / 撞墙不刷 MOVES */
    const b = fresh();
    const G = b.G;
    play(b, 0);
    const x0 = G.player.cx;
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    ok('键盘按一次走一格', G.player.cx === x0 + 1);
    advanceMs(b, 500);
    ok('键盘按住也会连走', G.player.cx > x0 + 1, String(G.player.cx));
    b.key('keyup', 'ArrowRight', 'ArrowRight');
    const x1 = G.player.cx;
    advanceMs(b, 800);
    ok('键盘松手后停下', G.player.cx === x1, x1 + ' -> ' + G.player.cx);
    /* 贴墙按住：MOVES 不再增加 */
    G.player.cx = 1; G.player.cy = 1;
    const m0 = G.moves;
    b.key('keydown', 'ArrowLeft', 'ArrowLeft');
    advanceMs(b, 800);
    b.key('keyup', 'ArrowLeft', 'ArrowLeft');
    ok('顶着墙按住不会刷 MOVES', G.moves === m0, m0 + ' -> ' + G.moves + ' x=' + G.player.cx);
  }
  {
    /* 画布滑动 = 一格（辅助操作） */
    const b = fresh();
    const G = b.G;
    play(b, 0);
    const x0 = G.player.cx;
    b.els.game.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 9, preventDefault() {} });
    b.els.game.fire('pointermove', { clientX: 180, clientY: 100, pointerId: 9, preventDefault() {} });
    ok('画布上右滑走一格', G.player.cx === x0 + 1, String(G.player.cx));
    b.els.game.fire('pointerup', { clientX: 180, clientY: 100, pointerId: 9, preventDefault() {} });
    advanceMs(b, 600);
    ok('滑动不会变成一直走', G.player.cx === x0 + 1, String(G.player.cx));
  }
  {
    /* 菜单点格子选关（用暴露的 selectLayer，等价于点命中） */
    const b = fresh();
    const G = b.G;
    G.progress.unlocked = 4;
    b.tick(3);
    ok('菜单画了 12 个可点区域', G.menuTiles.length === 12, String(G.menuTiles.length));
    ok('点已解锁的层能开局', G.selectLayer(2) === true && G.state === 'scan' && G.layerIndex === 2, G.state);
    G.toMenu();
    ok('回到菜单', G.state === 'menu');
    G.progress.unlocked = 3;
    ok('点未解锁的层确实进不去', G.selectLayer(3) === false && G.layerIndex === 2, G.layerIndex + '/' + G.state);
    ok('菜单高亮跟着当前关走', G.selected === 2, String(G.selected));
  }
  {
    /* 数字键 / 空格 / 按钮 */
    const b = fresh();
    const G = b.G;
    G.progress.unlocked = 12;
    b.key('keydown', '5', 'Digit5');
    ok('数字键 5 直接开第 5 关', G.layerIndex === 4 && G.state === 'scan', G.layerIndex + '/' + G.state);
    G.toMenu();
    b.key('keydown', ' ', 'Space');
    ok('菜单里空格开当前选中的层', G.state === 'scan', G.state);
    b.els.pause.fire('click');
    ok('暂停按钮可用', G.state === 'paused', G.state);
    ok('暂停按钮文案变成继续', b.els.pause.textContent === '▶ 继续', b.els.pause.textContent);
    b.els.pause.fire('click');
    ok('再点恢复', G.state === 'scan', G.state);
    b.els.menu.fire('click');
    ok('选关按钮回到菜单', G.state === 'menu', G.state);
  }

  /* ================= K2. 画布点击命中 Layer Select ================= */
  {
    const b = fresh();
    const G = b.G;
    G.progress.unlocked = 4;
    b.tick(3);
    /* 测试桩 canvas 的 rect 是 360x200，按同样比例把格子中心换算回 client 坐标 */
    const rect = b.els.game.getBoundingClientRect();
    const toClient = (tile) => ({
      clientX: (tile.x + tile.w / 2) * (rect.width / 420),
      clientY: (tile.y + tile.h / 2) * (rect.height / 354)
    });
    const open = G.menuTiles[2];
    const locked = G.menuTiles[10];
    const p1 = toClient(locked);
    b.els.game.fire('pointerdown', { clientX: p1.clientX, clientY: p1.clientY, pointerId: 21, preventDefault() {} });
    ok('点未解锁的格子不会开局', G.state === 'menu' && G.layerIndex === 0, G.state + '/' + G.layerIndex);
    const p2 = toClient(open);
    b.els.game.fire('pointerdown', { clientX: p2.clientX, clientY: p2.clientY, pointerId: 22, preventDefault() {} });
    ok('点已解锁的格子直接开那一关', G.state === 'scan' && G.layerIndex === 2, G.state + '/' + G.layerIndex);
  }

  /* ================= L. 渲染 / DPR / 音效 ================= */
  {
    const b = fresh();
    const G = b.G;
    play(b, 5);
    const before = b.log.texts.length;
    advance(b, 300);
    ok('连续运行 5 秒无异常', b.errors.length === 0, b.errors[0]);
    ok('确有绘制发生', b.log.rects > 2000, String(b.log.rects));
    ok('HUD 有 LAYER / TIME / MOVES / MISTAKES / RESCAN',
      (function () {
        const t = b.log.texts.join('|');
        return t.indexOf('LAYER') >= 0 && t.indexOf('TIME') >= 0 && t.indexOf('MOVES') >= 0 &&
          t.indexOf('MISTAKES') >= 0 && t.indexOf('RESCAN') >= 0;
      })(), b.log.texts.slice(before, before + 6).join('|'));
  }
  {
    const results = [1, 2, 3].map(function (dpr) {
      const b = fresh({ dpr: dpr });
      b.G.progress.unlocked = 12;
      play(b, 0);
      const start = { x: b.G.player.cx, y: b.G.player.cy };
      step(b, 'right'); step(b, 'down'); step(b, 'right');
      return { x: b.G.player.cx, y: b.G.player.cy, moves: b.G.moves, backing: b.window.document.getElementById('game').width, start: start };
    });
    ok('DPR 不影响走格子（1/2/3 结果一致）',
      results[0].x === results[1].x && results[0].x === results[2].x &&
      results[0].y === results[1].y && results[0].moves === results[1].moves && results[1].moves === results[2].moves,
      JSON.stringify(results));
    ok('DPR 只改画布分辨率（背板更清晰）',
      results[0].backing === 420 && results[1].backing === 840 && results[2].backing === 1260,
      results.map((r) => r.backing).join(','));
  }
  {
    const b = fresh();
    b.els.sound.fire('click');
    ok('静音写入全站统一的 arcade.sound', b.store.get('arcade.sound') === 'off', String(b.store.get('arcade.sound')));
    ok('不再单独写自己的旧 key', !b.store.has('arcade.attentionMaze.sound'));
    ok('没有碰其他游戏的静音 key', !b.store.has('whaleRunner.sound') && !b.store.has('arcade.snake.sound') && !b.store.has('arcade.tokenFall.sound'));
    b.els.sound.fire('click');
    ok('可以再打开音效', b.store.get('arcade.sound') === 'on', String(b.store.get('arcade.sound')));
    ok('无声环境里也不报错', b.errors.length === 0, b.errors[0]);
  }

  return out;
}
