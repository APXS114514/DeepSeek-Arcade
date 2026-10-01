/* 角色皮肤系统：Classic Whale / Whale-chan
 *  - 全站共享的 arcade.characterSkin（默认 classic，非法值回退）
 *  - 四款游戏换皮肤只换外观：判定盒 / 网格 / 难度 / 成绩全部不变
 *  - Whale-chan 素材加载失败自动回退经典小鲸鱼，绝不破坏 gameplay
 */
import vm from 'node:vm';
import { harness } from './helpers.mjs';

const SKIN_KEY = 'arcade.characterSkin';
const ASSET_FILES = [
  'whalechan-idle.webp', 'whalechan-move.webp', 'whalechan-jump.webp', 'whalechan-dive.webp',
  'whalechan-think.webp', 'whalechan-startle.webp', 'whalechan-blocked.webp',
  'whalechan-head.webp', 'whalechan-head-think.webp'
];

function fresh(o) { return harness(Object.assign({ page: 'runner', exposeGame: true }, o || {})); }
/* 把 Math.random 钉死，让物理 / 生成完全确定，两个皮肤才好逐帧对比 */
function freezeRandom(b, v) {
  vm.runInContext('Math.random = function () { return ' + v + '; };', b.sandbox);
}
function advance(b, n) { for (let i = 0; i < n; i++) b.tick(1); return b; }
function drewAssets(b) { return b.log.draws.map((d) => String(d.img && d.img.src)).filter(Boolean); }

export function run() {
  const out = [];
  const ok = (name, pass, extra) => out.push({ name: name, pass: !!pass, extra: extra === undefined ? '' : extra });

  /* ================= A. 皮肤状态与 localStorage ================= */
  {
    const b = fresh();
    const C = b.window.ArcadeCharacter;
    ok('shared/character.js 暴露了 ArcadeCharacter', !!C);
    ok('默认皮肤是 classic', C.getSkin() === 'classic', C.getSkin());
    ok('没存过时不会写入 arcade.characterSkin（老玩家不被改设置）', !b.store.has(SKIN_KEY), String(b.store.get(SKIN_KEY)));
    ok('皮肤列表只有 classic / whalechan', C.SKINS.join(',') === 'classic,whalechan', C.SKINS.join(','));
    ok('isWhaleChan() 默认 false', C.isWhaleChan() === false);

    C.setSkin('whalechan');
    ok('setSkin 立刻写入 arcade.characterSkin', b.store.get(SKIN_KEY) === 'whalechan', String(b.store.get(SKIN_KEY)));
    ok('setSkin 后 isWhaleChan() 为 true', C.isWhaleChan() === true);
    ok('toggleSkin() 能切回 classic', C.toggleSkin() === 'classic' && b.store.get(SKIN_KEY) === 'classic');
    ok('toggleSkin() 再切回 whalechan', C.toggleSkin() === 'whalechan' && b.store.get(SKIN_KEY) === 'whalechan');

    C.setSkin('abc');
    ok('非法皮肤值回退 classic', C.getSkin() === 'classic' && b.store.get(SKIN_KEY) === 'classic', C.getSkin());

    let hits = 0;
    C.onChange(function () { hits++; });
    C.setSkin('whalechan');
    ok('onChange 在换皮肤时回调', hits === 1, String(hits));
    C.setSkin('whalechan');
    ok('皮肤没变时不重复回调', hits === 1, String(hits));
  }
  {
    const b = harness({ page: 'runner', saved: { 'arcade.characterSkin': 'whalechan' } });
    ok('重新进页面能读回 whalechan', b.window.ArcadeCharacter.getSkin() === 'whalechan', b.window.ArcadeCharacter.getSkin());
  }
  {
    const b = harness({ page: 'runner', saved: { 'arcade.characterSkin': 'WHALECHAN' } });
    ok('皮肤值大小写不敏感', b.window.ArcadeCharacter.getSkin() === 'whalechan');
  }

  /* ================= B. 换皮肤不碰任何游戏数据 ================= */
  {
    const before = {
      'whaleRunner.high': '111', 'arcade.snake.high': '222', 'arcade.tokenFall.high': '333',
      'arcade.attentionMaze.progress': '{"v":1,"unlocked":5,"stars":{"1":3},"best":{}}',
      'arcade.sound': 'on', 'arcade.lang': 'en'
    };
    const b = harness({ page: 'lobby', saved: before });
    b.els.skin.fire('click');
    ok('大厅切换角色后 arcade.characterSkin = whalechan', b.store.get(SKIN_KEY) === 'whalechan');
    const keys = Object.keys(before);
    ok('切换角色不会改动任何成绩 / 进度 / 音效 / 语言 key',
      keys.every((k) => b.store.get(k) === before[k]),
      keys.map((k) => k + '=' + b.store.get(k)).join(' '));
    ok('切换角色不会新增别的存储 key',
      [...b.store.keys()].filter((k) => k !== SKIN_KEY).length === keys.length,
      [...b.store.keys()].join(','));
  }
  {
    /* 按钮文案：中英都要对 */
    const b = harness({ page: 'lobby', navLang: 'zh-CN' });
    ok('大厅角色按钮中文默认文案', b.els.skin.textContent === '🐳 经典鲸鱼', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('切到鲸鱼娘后的中文文案', b.els.skin.textContent === '🐳 鲸鱼娘', b.els.skin.textContent);
    ok('按钮带 aria-label（可访问性）', (b.els.skin.getAttribute('aria-label') || '').length > 0,
      b.els.skin.getAttribute('aria-label'));
    b.els.lang.fire('click');
    ok('切英文后按钮文案同步', b.els.skin.textContent === '🐳 Whale-chan', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('英文下切回经典文案', b.els.skin.textContent === '🐳 Classic', b.els.skin.textContent);
  }

  /* ================= C. 四款游戏的视觉替换 + 判定不变 ================= */
  {
    const b = fresh({ images: 'ok' });
    b.window.ArcadeCharacter.setSkin('whalechan');
    b.log.draws.length = 0;
    advance(b, 8);
    const drawn = drewAssets(b);
    ok('Whale Runner 的 Whale-chan 用 drawImage 画出来（不是像素精灵）',
      drawn.some((s) => s.indexOf('whalechan-') >= 0), drawn.slice(0, 3).join('|'));
    const d = b.log.draws[b.log.draws.length - 1];
    ok('Whale-chan 绘制尺寸保持素材比例（宽/高 ≈ 300/340）',
      !!d && Math.abs((d.w / d.h) - (300 / 340)) < 0.02, d ? (d.w / d.h).toFixed(3) : 'none');
  }
  {
    /* 同一段确定性剧本，两个皮肤必须跑到同一帧才 Game Over（判定盒没变） */
    function runOnce(skin) {
      const b = harness({ page: 'runner', exposeGame: true, saved: { 'arcade.characterSkin': skin } });
      freezeRandom(b, 0.5);
      b.key('keydown', ' ', 'Space');
      b.key('keyup', ' ', 'Space');
      let frames = 0;
      for (let i = 0; i < 900; i++) { b.tick(1); frames++; if (b.G.state === 'over') break; }
      return { frames: frames, score: b.G.score, over: b.G.state === 'over' };
    }
    const a = runOnce('classic');
    const c = runOnce('whalechan');
    ok('Whale Runner：换皮肤后同一帧碰撞、同一分数（判定盒不变）',
      JSON.stringify(a) === JSON.stringify(c), JSON.stringify(a) + ' / ' + JSON.stringify(c));
  }
  {
    /* Token Fall：直接把掉落物喂到嘴边，换皮肤后结算必须完全一样 */
    function feedOnce(skin) {
      const b = harness({ page: 'tokenfall', exposeGame: true, saved: { 'arcade.characterSkin': skin } });
      freezeRandom(b, 0.5);
      b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
      const G = b.G;
      G.tokens.length = 0; G.spawnTimer = 1e9;
      G.tokens.push({ type: 'token', x: G.player.x + 8, y: 520, w: 34, h: 34, speed: 0.0001 });
      let guard = 0;
      while (G.tokens.length > 0 && guard++ < 40) b.tick(1);
      advance(b, 6);
      return { ctx: G.context, score: G.score, w: G.playerW, h: G.playerH, caught: guard < 40 };
    }
    const a = feedOnce('classic');
    const c = feedOnce('whalechan');
    ok('Token Fall：换皮肤后接物判定与结算完全一致（玩家 72×54 不变）',
      JSON.stringify(a) === JSON.stringify(c) && a.w === 72 && a.h === 54,
      JSON.stringify(a) + ' / ' + JSON.stringify(c));
  }
  {
    /* Context Snake：蛇头换脸，但网格坐标与移动完全一样 */
    function snakeOnce(skin) {
      const b = harness({ page: 'snake', exposeGame: true, saved: { 'arcade.characterSkin': skin } });
      freezeRandom(b, 0.5);          // 蛇的 TOKEN 是随机刷的，不钉死 Math.random 这个对比会偶发不一致
      b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
      const G = b.G;
      let g = 0;
      while (G.state !== 'running' && g++ < 200) b.tick(1);
      b.log.draws.length = 0;
      advance(b, 60);
      return { head: G.snake[0].x + ',' + G.snake[0].y, len: G.snake.length, score: G.score, drew: b.log.draws.length };
    }
    const a = snakeOnce('classic');
    const c = snakeOnce('whalechan');
    ok('Context Snake：换皮肤后蛇头格子 / 长度 / 分数完全一样',
      a.head === c.head && a.len === c.len && a.score === c.score,
      JSON.stringify(a) + ' / ' + JSON.stringify(c));
    ok('Context Snake：Whale-chan 模式下确实画了头像素材', c.drew > 0, String(c.drew));
  }
  {
    /* Attention Maze：格子制，换皮肤不改玩家所在格 */
    function mazeOnce(skin) {
      const b = harness({ page: 'attentionmaze', exposeGame: true, saved: { 'arcade.characterSkin': skin } });
      freezeRandom(b, 0.5);
      const G = b.G;
      G.startLayer(0);
      let g = 0;
      while (G.state !== 'playing' && g++ < 600) b.tick(1);
      b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
      advance(b, 30);
      b.log.draws.length = 0;
      advance(b, 4);
      return { cell: G.player.cx + ',' + G.player.cy, moves: G.moves, drew: b.log.draws.length };
    }
    const a = mazeOnce('classic');
    const c = mazeOnce('whalechan');
    ok('Attention Maze：换皮肤后玩家格子与 MOVES 完全一样',
      a.cell === c.cell && a.moves === c.moves, JSON.stringify(a) + ' / ' + JSON.stringify(c));
    ok('Attention Maze：Whale-chan 模式下确实画了头像素材', c.drew > 0, String(c.drew));
  }
  {
    /* 大厅四张预览：切皮肤后都要跟着换角色 */
    const b = harness({ page: 'lobby' });
    b.log.draws.length = 0;
    b.els.skin.fire('click');
    ok('大厅切换后 arcade.characterSkin 立刻保存', b.store.get(SKIN_KEY) === 'whalechan');
    ok('大厅切换后四张预览都重画（Runner / Snake / Token Fall / Maze 一起换）',
      b.log.draws.length >= 4, String(b.log.draws.length));
    const srcs = drewAssets(b);
    ok('Runner 预览用到了 whalechan 素材', srcs.some((s) => s.indexOf('whalechan-idle') >= 0), srcs.join('|'));
    ok('Snake / Maze 预览用到了 whalechan 头像素材', srcs.some((s) => s.indexOf('whalechan-head') >= 0), srcs.join('|'));
    b.log.draws.length = 0;
    b.els.skin.fire('click');
    ok('切回经典后预览不再画 Whale-chan 素材',
      b.store.get(SKIN_KEY) === 'classic' && drewAssets(b).length === 0, drewAssets(b).join('|'));
  }

  /* ================= D. 素材加载失败 -> 回退经典 ================= */
  {
    const b = harness({ page: 'runner', exposeGame: true, images: 'fail', saved: { 'arcade.characterSkin': 'whalechan' } });
    ok('皮肤是 whalechan 但素材失败时不认为素材可用',
      b.window.ArcadeCharacter.isWhaleChan() === true && b.window.ArcadeCharacter.ready('idle') === false);
    b.key('keydown', ' ', 'Space');
    b.key('keyup', ' ', 'Space');
    b.log.draws.length = 0;
    advance(b, 30);
    ok('素材 404：不会画 Whale-chan', drewAssets(b).length === 0, drewAssets(b).join('|'));
    ok('素材 404：游戏照常运行', b.G.state === 'running', b.G.state);
    ok('素材 404：没有异常', b.errors.length === 0, b.errors[0]);
    ok('素材 404：经典小鲸鱼仍然在画（fillRect 有输出）', b.log.rects > 200, String(b.log.rects));
  }
  {
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'pending', saved: { 'arcade.characterSkin': 'whalechan' } });
    b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
    advance(b, 40);
    ok('素材还在加载时游戏正常运行（先画经典，不崩）',
      b.G.state === 'running' && b.errors.length === 0, b.errors[0] + '/' + b.G.state);
  }
  {
    /* 预加载只做一次：跑多少帧都不该再 new Image */
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'ok', saved: { 'arcade.characterSkin': 'whalechan' } });
    const n0 = b.images.length;
    advance(b, 200);
    ok('预加载只创建一次 Image（不在 render 里 new Image）',
      b.images.length === n0, n0 + ' -> ' + b.images.length);
    ok('九张 Whale-chan 素材都发起了请求', n0 === ASSET_FILES.length, String(n0));
    ok('素材路径全部是相对路径（不含 /assets/ 这种根路径）',
      b.images.every((im) => im.src.indexOf('whalechan-') >= 0 && im.src.indexOf('/assets/') < 0),
      b.images.map((im) => im.src).slice(0, 2).join('|'));
  }

  /* ================= E. 经典小鲸鱼仍然存在 ================= */
  {
    const b = harness({ page: 'runner' });
    const W = b.window.ArcadeWhale;
    ok('Classic Whale 素材还在（NORMAL_A/B + DIVE_A/B，24×18）',
      !!W && !!W.NORMAL_A && !!W.NORMAL_B && !!W.DIVE_A && !!W.DIVE_B && W.WIDTH === 24 && W.HEIGHT === 18);
    ok('没有 arcade.characterSkin 时就是经典小鲸鱼', b.window.ArcadeCharacter.isWhaleChan() === false);
  }

  return out;
}

