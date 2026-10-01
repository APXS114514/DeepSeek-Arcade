/* 角色皮肤系统：Classic Whale / Whale Girl
 *  - 全站共享 arcade.characterSkin（默认 classic；非法值回退 classic；
 *    旧值 whalechan 自动迁移到 yunyue 并写回）
 *  - 四款游戏换皮肤只换外观：判定盒 / 网格 / 难度 / 成绩全部不变
 *  - 素材懒加载，动画帧只由时间决定，加载失败自动回退经典小鲸鱼
 */
import vm from 'node:vm';
import { harness } from './helpers.mjs';

const SKIN_KEY = 'arcade.characterSkin';
const YUNYUE_DIR = 'assets/whale-yunyue/';

function fresh(o) { return harness(Object.assign({ page: 'runner', exposeGame: true }, o || {})); }
/* 把 Math.random 钉死，让物理 / 生成完全确定，不同皮肤才好逐帧对比 */
function freezeRandom(b, v) {
  vm.runInContext('Math.random = function () { return ' + v + '; };', b.sandbox);
}
function advance(b, n) { for (let i = 0; i < n; i++) b.tick(1); return b; }
function drewAssets(b) { return b.log.draws.map((d) => String(d.img && d.img.src)).filter(Boolean); }
function assetNames(b) { return drewAssets(b).map((s) => s.split('/').pop()); }
function requested(b) { return b.images.map((im) => String(im.src)); }
/* 一套皮肤真正要下载的文件数（去重后的文件名数，不是播放序列长度） */
function countFiles(A, skin) { return A.files(skin).length; }
/* 独立的假 ctx：直接观察绘制期间 / 之后的 ctx 状态，不受页面渲染干扰 */
function fakeCtx(smooth) {
  const calls = [];
  const c = {
    imageSmoothingEnabled: smooth === undefined ? true : smooth,
    globalAlpha: 1,
    save() {}, restore() {}, translate() {}, scale() {},
    drawImage(img) { calls.push({ img: String(img && img.src), smooth: c.imageSmoothingEnabled, alpha: c.globalAlpha }); },
  };
  return { ctx: c, calls: calls };
}
function ready(skin) { return harness({ page: 'lobby', saved: { [SKIN_KEY]: skin } }); }

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
    ok('皮肤列表正好是 classic / yunyue', C.SKINS.join(',') === 'classic,yunyue', C.SKINS.join(','));
    ok('已经删掉的 pixel 皮肤不在列表里', C.SKINS.indexOf('pixel') < 0);

    C.setSkin('yunyue');
    ok('setSkin("yunyue") 立刻写入 arcade.characterSkin', b.store.get(SKIN_KEY) === 'yunyue', String(b.store.get(SKIN_KEY)));
    ok('setSkin("yunyue") 后 getSkin 一致', C.getSkin() === 'yunyue');

    C.setSkin('classic');
    ok('cycleSkin() classic -> yunyue', C.cycleSkin() === 'yunyue' && b.store.get(SKIN_KEY) === 'yunyue');
    ok('cycleSkin() yunyue -> classic', C.cycleSkin() === 'classic' && b.store.get(SKIN_KEY) === 'classic');
    ok('只有两套皮肤，循环能一直来回切', C.cycleSkin() === 'yunyue' && C.cycleSkin() === 'classic');

    C.setSkin('abc');
    ok('非法皮肤值回退 classic', C.getSkin() === 'classic' && b.store.get(SKIN_KEY) === 'classic', C.getSkin());
    C.setSkin('');
    ok('空值回退 classic', C.getSkin() === 'classic');

    let hits = 0;
    C.onChange(function () { hits++; });
    C.setSkin('yunyue');
    ok('onChange 在换皮肤时回调', hits === 1, String(hits));
    C.setSkin('yunyue');
    ok('皮肤没变时不重复回调', hits === 1, String(hits));
  }
  {
    /* 旧值迁移：whalechan 是已删除的第三方皮肤，但用户当初主动选过「鲸鱼娘」 */
    const b = harness({ page: 'runner', saved: { [SKIN_KEY]: 'whalechan' } });
    const C = b.window.ArcadeCharacter;
    ok('旧值 whalechan 被解释成 yunyue', C.getSkin() === 'yunyue', C.getSkin());
    ok('旧值 whalechan 会被写回 arcade.characterSkin', b.store.get(SKIN_KEY) === 'yunyue', String(b.store.get(SKIN_KEY)));
  }
  {
    const b = harness({ page: 'runner', saved: { [SKIN_KEY]: 'WHALECHAN' } });
    ok('皮肤值大小写不敏感', b.window.ArcadeCharacter.getSkin() === 'yunyue', b.window.ArcadeCharacter.getSkin());
  }
  {
    const b = harness({ page: 'runner', saved: { [SKIN_KEY]: 'yunyue' } });
    ok('重新进页面能读回 yunyue', b.window.ArcadeCharacter.getSkin() === 'yunyue');
  }
  {
    /* 被删掉的 pixel 皮肤留下的旧值：不再是合法皮肤，按非法值回退 classic */
    const b = harness({ page: 'runner', saved: { [SKIN_KEY]: 'pixel' } });
    ok('已删除的 pixel 皮肤值按非法值回退 classic', b.window.ArcadeCharacter.getSkin() === 'classic');
  }
  {
    const b = harness({ page: 'runner', saved: { [SKIN_KEY]: 'nonsense' } });
    ok('存储里是非法值时回退 classic', b.window.ArcadeCharacter.getSkin() === 'classic');
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
    ok('大厅切换角色后 arcade.characterSkin = yunyue', b.store.get(SKIN_KEY) === 'yunyue');
    const keys = Object.keys(before);
    ok('切换角色不会改动任何成绩 / 进度 / 音效 / 语言 key',
      keys.every((k) => b.store.get(k) === before[k]),
      keys.map((k) => k + '=' + b.store.get(k)).join(' '));
    ok('切换角色不会新增别的存储 key',
      [...b.store.keys()].filter((k) => k !== SKIN_KEY).length === keys.length,
      [...b.store.keys()].join(','));
    b.els.skin.fire('click');
    b.els.skin.fire('click');
    ok('来回切一圈后仍然只有 arcade.characterSkin 被写',
      [...b.store.keys()].filter((k) => k !== SKIN_KEY).length === keys.length &&
      keys.every((k) => b.store.get(k) === before[k]));
  }
  {
    /* 按钮文案：中英都要对 */
    const b = harness({ page: 'lobby', navLang: 'zh-CN' });
    ok('大厅角色按钮默认文案', b.els.skin.textContent === '🐳 经典鲸鱼', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('第一次点击 -> 鲸鱼娘', b.els.skin.textContent === '🐳 鲸鱼娘', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('第二次点击 -> 回到经典鲸鱼', b.els.skin.textContent === '🐳 经典鲸鱼', b.els.skin.textContent);
    ok('按钮带 aria-label（可访问性）', (b.els.skin.getAttribute('aria-label') || '').length > 0,
      b.els.skin.getAttribute('aria-label'));
    b.els.lang.fire('click');
    ok('切英文后按钮文案同步', b.els.skin.textContent === '🐳 Classic Whale', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('英文下点击 -> Whale Girl', b.els.skin.textContent === '🐳 Whale Girl', b.els.skin.textContent);
    b.els.skin.fire('click');
    ok('英文下再点一次 -> 回到 Classic Whale', b.els.skin.textContent === '🐳 Classic Whale', b.els.skin.textContent);
  }
  {
    const b = harness({ page: 'lobby', navLang: 'zh-CN' });
    const seen = [b.els.skin.textContent];
    for (let i = 0; i < 2; i++) { b.els.skin.fire('click'); seen.push(b.els.skin.textContent); }
    ok('两套皮肤文案互不相同且都写明是哪一套',
      new Set(seen.slice(0, 2)).size === 2 && seen.every((s) => s.indexOf('鲸鱼') !== -1),
      seen.join(' | '));
  }

  /* ================= C. 四款游戏的视觉替换 + 判定不变 ================= */
  {
    const b = fresh({ images: 'ok' });
    b.window.ArcadeCharacter.setSkin('yunyue');
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');   // 起跑后才推进动画时钟
    b.log.draws.length = 0;
    advance(b, 40);
    const names = assetNames(b);
    ok('Whale Runner 的鲸鱼娘皮肤用 drawImage 画出来（不是像素精灵）',
      names.some((s) => /^walk-\d+\.webp$/.test(s)), names.slice(0, 3).join('|'));
    ok('Whale Runner 的地面状态在用 walk 多帧循环',
      new Set(names.filter((s) => /^walk-\d+\.webp$/.test(s))).size >= 4,
      [...new Set(names)].join(','));
    const d = b.log.draws[b.log.draws.length - 1];
    ok('鲸鱼娘绘制尺寸保持素材比例（宽/高 ≈ 192/208）',
      !!d && Math.abs((d.w / d.h) - (192 / 208)) < 0.02, d ? (d.w / d.h).toFixed(3) : 'none');
  }
  {
    /* 同一段确定性剧本，两套皮肤必须跑到同一帧才 Game Over（判定盒没变） */
    function runOnce(skin) {
      const b = harness({ page: 'runner', exposeGame: true, saved: { [SKIN_KEY]: skin } });
      freezeRandom(b, 0.5);
      b.key('keydown', ' ', 'Space');
      b.key('keyup', ' ', 'Space');
      let frames = 0;
      for (let i = 0; i < 900; i++) { b.tick(1); frames++; if (b.G.state === 'over') break; }
      return { frames: frames, score: b.G.score, over: b.G.state === 'over' };
    }
    const a = runOnce('classic');
    const c = runOnce('yunyue');
    ok('Whale Runner：换皮肤后同一帧碰撞、同一分数（判定盒不变）',
      JSON.stringify(a) === JSON.stringify(c), JSON.stringify(a) + ' / ' + JSON.stringify(c));
  }
  {
    /* Token Fall：直接把掉落物喂到嘴边，换皮肤后结算必须完全一样 */
    function feedOnce(skin) {
      const b = harness({ page: 'tokenfall', exposeGame: true, saved: { [SKIN_KEY]: skin } });
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
    const c = feedOnce('yunyue');
    ok('Token Fall：换皮肤后接物判定与结算完全一致（玩家 72×54 不变）',
      JSON.stringify(a) === JSON.stringify(c) && a.w === 72 && a.h === 54 && a.caught,
      JSON.stringify(a) + ' / ' + JSON.stringify(c));
  }
  {
    /* Context Snake：蛇头换脸，但网格坐标与移动完全一样 */
    function snakeOnce(skin) {
      const b = harness({ page: 'snake', exposeGame: true, saved: { [SKIN_KEY]: skin } });
      freezeRandom(b, 0.5);
      b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
      const G = b.G;
      let g = 0;
      while (G.state !== 'running' && g++ < 200) b.tick(1);
      b.log.draws.length = 0;
      advance(b, 60);
      return { head: G.snake[0].x + ',' + G.snake[0].y, len: G.snake.length, score: G.score, drew: b.log.draws.length };
    }
    const a = snakeOnce('classic');
    const c = snakeOnce('yunyue');
    ok('Context Snake：换皮肤后蛇头格子 / 长度 / 分数完全一样',
      a.head === c.head && a.len === c.len && a.score === c.score,
      JSON.stringify(a) + ' / ' + JSON.stringify(c));
    ok('Context Snake：鲸鱼娘模式下确实画了头像素材', c.drew > 0, String(c.drew));
  }
  {
    /* Attention Maze：格子制，换皮肤不改玩家所在格 */
    function mazeOnce(skin) {
      const b = harness({ page: 'attentionmaze', exposeGame: true, saved: { [SKIN_KEY]: skin } });
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
    const c = mazeOnce('yunyue');
    ok('Attention Maze：换皮肤后玩家格子与 MOVES 完全一样',
      a.cell === c.cell && a.moves === c.moves, JSON.stringify(a) + ' / ' + JSON.stringify(c));
    ok('Attention Maze：鲸鱼娘模式下确实画了头像素材', c.drew > 0, String(c.drew));
  }
  {
    /* 大厅四张预览：切皮肤后都要跟着换角色，并且不刷新页面 */
    const b = harness({ page: 'lobby' });
    b.log.draws.length = 0;
    b.els.skin.fire('click');
    ok('大厅切换后 arcade.characterSkin 立刻保存', b.store.get(SKIN_KEY) === 'yunyue');
    ok('大厅切换后四张预览都重画（Runner / Snake / Token Fall / Maze 一起换）',
      b.log.draws.length >= 4, String(b.log.draws.length));
    const srcs = drewAssets(b);
    ok('Runner 预览用到了鲸鱼娘 walk 素材', srcs.some((s) => s.indexOf(YUNYUE_DIR + 'walk-') >= 0), srcs.join('|'));
    ok('Snake / Maze 预览用到了鲸鱼娘头像素材', srcs.some((s) => s.indexOf(YUNYUE_DIR + 'head.webp') >= 0), srcs.join('|'));
    b.log.draws.length = 0;
    b.els.skin.fire('click');
    ok('切回经典后预览不再画任何图片素材',
      b.store.get(SKIN_KEY) === 'classic' && drewAssets(b).length === 0, drewAssets(b).join('|'));
  }

  /* ================= D. 动画：多帧、由时间决定、暂停冻结 ================= */
  {
    const b = ready('yunyue');
    const A = b.window.ArcadeCharacter;
    ok('鲸鱼娘 walk 一共 8 帧', A.frameCount('walk') === 8, String(A.frameCount('walk')));
    ok('鲸鱼娘 walk 帧时长 120ms', A.frameMs('walk') === 120, String(A.frameMs('walk')));
    const seq = [0, 100, 120, 240, 360, 480, 840, 960, 1080].map((t) => A.frameIndex('walk', t));
    ok('鲸鱼娘 walk 帧号随时间前进并回环（0,0,1,2,3,4,7,0,1）',
      seq.join(',') === '0,0,1,2,3,4,7,0,1', seq.join(','));

    const f = fakeCtx();
    for (let i = 0; i < 50; i++) A.draw(f.ctx, 'walk', 0, 0, 10, 10, { time: 0 });
    ok('同一时间画 50 次仍是同一帧（动画不由 render 次数推进）',
      new Set(f.calls.map((c) => c.img)).size === 1, [...new Set(f.calls.map((c) => c.img))].join('|'));
    const g = fakeCtx();
    for (const t of [0, 120, 240, 360]) A.draw(g.ctx, 'walk', 0, 0, 10, 10, { time: t });
    ok('不同时间画出来的确实是不同帧（真正的多帧 walk cycle）',
      new Set(g.calls.map((c) => c.img)).size === 4,
      g.calls.map((c) => c.img.split('/').pop()).join(','));
    ok('帧号是时间的纯函数（60Hz / 144Hz 到同一时刻必然是同一帧）',
      A.frameIndex('walk', 1000) === A.frameIndex('walk', 1000) && A.frameIndex('walk', 1000) === 0);
  }
  {
    /* 多帧不靠模块自身「记住状态」：同一时刻反复调用拿到同一帧，
     * 这一点让 60 / 120 / 144Hz 屏幕不可能跑出不同速度。 */
    const b = ready('yunyue');
    const A = b.window.ArcadeCharacter;
    const t = 1234;                     // floor(1234/120) % 8 = 2
    ok('frameIndex 与调用次数无关（同一时间恒定同一帧）',
      A.frameIndex('walk', t) === 2 && A.frameIndex('walk', t) === A.frameIndex('walk', t),
      String(A.frameIndex('walk', t)));
  }
  {
    /* 语义状态必须齐全：四款游戏只用这些名字 */
    const A = ready('yunyue').window.ArcadeCharacter;
    const states = ['idle', 'walk', 'jump', 'dive', 'think', 'startle', 'blocked', 'head', 'headThink'];
    ok('注册表的状态列表就是游戏认识的语义状态',
      A.STATES.slice().sort().join(',') === states.slice().sort().join(','), A.STATES.join(','));
    const missing = states.filter((s) => A.frameCount(s) <= 0);
    ok('每个语义状态都真的有帧', missing.length === 0, missing.join(','));
    const nofiles = states.filter((s) => A.ratio(s, 'yunyue') <= 0);
    ok('每个语义状态都有可用的宽高比（measure 不会算出 0 宽）', nofiles.length === 0, nofiles.join(','));
    ok('全身状态用同一个画布比例（换状态不会突然变形）',
      ['idle', 'walk', 'jump', 'dive', 'think', 'startle', 'blocked']
        .every((s) => Math.abs(A.ratio(s, 'yunyue') - 192 / 208) < 1e-9));
    ok('头像是正方形（Snake / Maze 只用 head / headThink）',
      A.ratio('head', 'yunyue') === 1 && A.ratio('headThink', 'yunyue') === 1);
  }
  {
    /* 暂停：Whale Runner 的角色动画时钟只在 running 时推进 */
    const b = harness({ page: 'runner', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    freezeRandom(b, 0.5);
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');
    advance(b, 40);
    b.log.draws.length = 0;
    advance(b, 2);
    const runningFrame = assetNames(b).slice(-1)[0];
    b.key('keydown', 'p', 'KeyP');       // 暂停
    advance(b, 1);
    ok('Whale Runner 暂停生效', b.G.state === 'paused', b.G.state);
    const beforePause = b.G.animMs;
    b.log.draws.length = 0;
    advance(b, 300);                     // 暂停期间画了 300 帧
    ok('暂停后角色动画时钟完全冻结',
      b.G.animMs === beforePause, beforePause + ' -> ' + b.G.animMs);
    const pausedFrames = new Set(assetNames(b));
    ok('暂停后角色动画不再换帧（画再多帧也不推进）',
      pausedFrames.size === 1, [...pausedFrames].join('|'));
    ok('暂停前的运行帧确实是 walk 序列', /walk-\d+\.webp/.test(runningFrame || ''), String(runningFrame));
  }
  {
    /* 暂停：Token Fall 用只在 step() 里累加的 wobbleMs */
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    advance(b, 24);
    b.key('keydown', 'p', 'KeyP');
    advance(b, 2);
    ok('Token Fall 暂停生效', b.G.state === 'paused', b.G.state);
    const ms0 = b.G.player.wobbleMs;
    b.log.draws.length = 0;
    advance(b, 240);
    ok('Token Fall 暂停后角色动画时钟冻结',
      b.G.player.wobbleMs === ms0, ms0 + ' -> ' + b.G.player.wobbleMs);
    ok('Token Fall 暂停后角色动画不再换帧',
      new Set(assetNames(b)).size === 1, [...new Set(assetNames(b))].join('|'));
  }
  {
    /* 移动中播 walk，站住回到 idle（Token Fall） */
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    b.key('keydown', 'ArrowRight', 'ArrowRight');
    advance(b, 6);
    b.log.draws.length = 0;
    advance(b, 20);
    ok('Token Fall 移动时画 walk 序列',
      new Set(assetNames(b).filter((s) => /^walk-\d+/.test(s))).size >= 2, [...new Set(assetNames(b))].join('|'));
    b.key('keyup', 'ArrowRight', 'ArrowRight');
    advance(b, 60);
    b.log.draws.length = 0;
    advance(b, 20);
    ok('Token Fall 停下后回到 idle 序列',
      assetNames(b).some((s) => /^idle-\d+/.test(s)) && !assetNames(b).some((s) => /^walk-\d+/.test(s)),
      [...new Set(assetNames(b))].join('|'));
  }
  {
    /* 重开一局：动画时间必须复位 */
    const b = harness({ page: 'runner', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    freezeRandom(b, 0.5);
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');
    advance(b, 30);
    const t0 = b.G.animMs;
    ok('开跑后动画时钟在走', t0 > 0, String(t0));
    b.G.state = 'over';
    b.G.overCooldown = 0;
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');   // Game Over 后按跳跃重开
    ok('重开后动画时钟立刻复位（不会接着上一局的相位）',
      b.G.state === 'running' && b.G.animMs === 0, b.G.state + '/' + b.G.animMs);
  }

  /* ================= E. 朝向：素材本体朝右，朝左才镜像 ================= */
  {
    const b = fresh({ images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    b.log.scales.length = 0;
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');
    advance(b, 10);
    ok('Whale Runner：鲸鱼娘一直朝右游，不做镜像',
      !b.log.scales.some((s) => s[0] === -1), JSON.stringify(b.log.scales.slice(0, 3)));

    const d = fresh({ images: 'ok', saved: { [SKIN_KEY]: 'classic' } });
    d.log.scales.length = 0;
    d.key('keydown', ' ', 'Space'); d.key('keyup', ' ', 'Space');
    advance(d, 10);
    ok('Whale Runner：经典像素小鲸鱼不会被镜像（行为不变）',
      d.log.scales.length === 0, JSON.stringify(d.log.scales.slice(0, 3)));
  }
  {
    function tokenFallFace(dir) {
      const b = harness({ page: 'tokenfall', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
      b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
      advance(b, 6);
      if (dir) {
        b.key('keydown', dir, dir); advance(b, 40); b.key('keyup', dir, dir);
      }
      advance(b, 6);
      b.log.scales.length = 0;
      advance(b, 3);
      return b.log.scales.some((s) => s[0] === -1);
    }
    ok('Token Fall：往右移动时鲸鱼娘不镜像（素材本来就朝右）', tokenFallFace('ArrowRight') === false);
    ok('Token Fall：往左移动时鲸鱼娘被镜像', tokenFallFace('ArrowLeft') === true);
    ok('Token Fall：开局静止时保持朝右', tokenFallFace(null) === false);
  }
  {
    function snakeFace(dir) {
      const b = harness({ page: 'snake', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
      b.key('keydown', 'ArrowUp', 'ArrowUp'); b.key('keyup', 'ArrowUp', 'ArrowUp');
      advance(b, 6);
      b.key('keydown', dir, dir); b.key('keyup', dir, dir);
      advance(b, 30);
      b.log.scales.length = 0;
      advance(b, 10);
      return b.log.scales.some((s) => s[0] === -1);
    }
    ok('Context Snake：往右走时头像不镜像', snakeFace('ArrowRight') === false);
    ok('Context Snake：往左走时头像被镜像', snakeFace('ArrowLeft') === true);
  }
  {
    function mazeFace(dir, tx) {
      const b = harness({ page: 'attentionmaze', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
      const G = b.G;
      G.startLayer(0);
      let g = 0;
      while (G.state !== 'playing' && g++ < 600) b.tick(1);
      G.player.cx = tx; G.player.cy = 5; G.player.px = tx; G.player.py = 5;
      b.key('keydown', dir, dir); b.key('keyup', dir, dir);
      advance(b, 20);
      b.log.scales.length = 0;
      advance(b, 6);
      return b.log.scales.some((s) => s[0] === -1);
    }
    ok('Attention Maze：往右走时头像不镜像', mazeFace('ArrowRight', 5) === false);
    ok('Attention Maze：往左走时头像被镜像', mazeFace('ArrowLeft', 7) === true);
  }

  /* ================= F. smoothing：插画开、画完必须还原 ================= */
  {
    const b = ready('yunyue');
    const A = b.window.ArcadeCharacter;
    const y = fakeCtx(true);
    ok('鲸鱼娘画得出来', A.draw(y.ctx, 'walk', 0, 0, 10, 10, { time: 0 }) === true);
    ok('鲸鱼娘绘制期间 imageSmoothingEnabled = true', y.calls[0].smooth === true);
    ok('鲸鱼娘：draw 结束后 ctx 状态还原', y.ctx.imageSmoothingEnabled === true && y.ctx.globalAlpha === 1);

    const y2 = fakeCtx(false);
    A.draw(y2.ctx, 'walk', 0, 0, 10, 10, { time: 0 });
    ok('鲸鱼娘：原本 smoothing 关闭时，画完仍然关闭', y2.ctx.imageSmoothingEnabled === false);

    const al = fakeCtx(true);
    al.ctx.globalAlpha = 0.4;
    A.draw(al.ctx, 'walk', 0, 0, 10, 10, { time: 0, alpha: 0.5 });
    ok('opts.alpha 是乘在原有 globalAlpha 上的', Math.abs(al.calls[0].alpha - 0.2) < 1e-9, String(al.calls[0].alpha));
    ok('draw 结束后 globalAlpha 也还原', al.ctx.globalAlpha === 0.4, String(al.ctx.globalAlpha));

    const info = A.getSkinInfo();
    ok('皮肤注册表声明鲸鱼娘 smoothing = true', info.smoothing === true && info.image === true);
    ok('皮肤注册表声明 Classic 不是图片皮肤', A.getSkinInfo('classic').image === false);
    ok('注册表里只有两套皮肤（不会有第三套幽灵皮肤）', A.SKINS.length === 2, A.SKINS.join(','));
  }

  /* ================= G. 懒加载与缓存 ================= */
  {
    const b = harness({ page: 'lobby' });
    ok('Classic 启动时一张图片皮肤素材都不加载', b.images.length === 0, String(b.images.length));
    const r = harness({ page: 'runner' });
    ok('游戏页 Classic 启动时也不加载图片皮肤素材', r.images.length === 0, String(r.images.length));
  }
  {
    const b = harness({ page: 'lobby' });
    const A = b.window.ArcadeCharacter;
    const expect = countFiles(A, 'yunyue');
    A.setSkin('yunyue');
    const srcs = requested(b);
    ok('切到鲸鱼娘只请求鲸鱼娘的素材',
      srcs.length > 0 && srcs.every((s) => s.indexOf(YUNYUE_DIR) >= 0), srcs.slice(0, 2).join('|'));
    ok('素材数量与注册表一致（' + expect + ' 张）', srcs.length === expect, String(srcs.length));
    ok('素材路径是相对路径（不含站点绝对 /assets/）', srcs.every((s) => s.indexOf('/assets/') < 0));
    ok('不会再请求已经删掉的像素皮肤素材', srcs.every((s) => s.indexOf('whale-' + 'pixel') < 0));
    const n0 = b.images.length;
    A.setSkin('yunyue');
    ok('重复 setSkin 同一套不会重复 new Image', b.images.length === n0, String(b.images.length));
    A.setSkin('classic');
    A.setSkin('yunyue');
    ok('切走再切回来不会重新加载（走缓存）', b.images.length === n0, n0 + ' -> ' + b.images.length);
  }
  {
    /* hover 预加载：经典状态下把鲸鱼娘拉起来，但不改当前选择 */
    const b = harness({ page: 'lobby' });
    b.els.skin.fire('pointerenter');
    const srcs = requested(b);
    ok('hover 皮肤按钮时预加载鲸鱼娘素材',
      srcs.length > 0 && srcs.every((s) => s.indexOf(YUNYUE_DIR) >= 0), srcs.slice(0, 2).join('|'));
    ok('预加载不会偷偷改掉当前皮肤', b.store.get(SKIN_KEY) === undefined);
  }
  {
    /* 预加载只做一次：跑多少帧都不该再 new Image */
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'ok', saved: { [SKIN_KEY]: 'yunyue' } });
    const n0 = b.images.length;
    advance(b, 200);
    ok('预加载只创建一次 Image（不在 render 里 new Image）',
      b.images.length === n0, n0 + ' -> ' + b.images.length);
  }

  /* ================= H. 素材失败 / 未就绪 -> 回退经典 ================= */
  {
    const b = harness({ page: 'runner', exposeGame: true, images: 'fail', saved: { [SKIN_KEY]: 'yunyue' } });
    ok('皮肤是 yunyue 但素材全部失败时不认为素材可用',
      b.window.ArcadeCharacter.getSkin() === 'yunyue' && b.window.ArcadeCharacter.ready('walk') === false);
    b.key('keydown', ' ', 'Space');
    b.key('keyup', ' ', 'Space');
    b.log.draws.length = 0;
    advance(b, 30);
    ok('素材 404：不会画任何图片皮肤', drewAssets(b).length === 0, drewAssets(b).join('|'));
    ok('素材 404：游戏照常运行', b.G.state === 'running', b.G.state);
    ok('素材 404：没有异常', b.errors.length === 0, b.errors[0]);
    ok('素材 404：经典小鲸鱼仍然在画（fillRect 有输出）', b.log.rects > 200, String(b.log.rects));
  }
  {
    /* 只有一张 404：整套皮肤不能消失，游戏更不能崩 */
    const b = harness({
      page: 'runner', exposeGame: true, images: 'ok', failMatch: 'walk-3.webp',
      saved: { [SKIN_KEY]: 'yunyue' },
    });
    ok('单张素材 404：其它帧仍然可用', b.window.ArcadeCharacter.ready('walk') === true);
    b.key('keydown', ' ', 'Space'); b.key('keyup', ' ', 'Space');
    b.log.draws.length = 0;
    advance(b, 60);
    const names = assetNames(b);
    ok('单张素材 404：角色仍然在画（并跳过坏帧）',
      names.length > 0 && !names.some((s) => s === 'walk-3.webp'), [...new Set(names)].join('|'));
    ok('单张素材 404：游戏照常运行且没有异常',
      b.G.state === 'running' && b.errors.length === 0, b.G.state + '/' + b.errors[0]);
  }
  {
    const b = harness({ page: 'tokenfall', exposeGame: true, images: 'pending', saved: { [SKIN_KEY]: 'yunyue' } });
    b.key('keydown', 'ArrowRight', 'ArrowRight'); b.key('keyup', 'ArrowRight', 'ArrowRight');
    advance(b, 40);
    ok('素材还在加载时游戏正常运行（先画经典，不崩）',
      b.G.state === 'running' && b.errors.length === 0, b.errors[0] + '/' + b.G.state);
    ok('素材还没就绪时 ready() 为 false，调用方据此回退',
      b.window.ArcadeCharacter.ready('walk') === false);
  }
  {
    const b = harness({ page: 'lobby', images: 'fail' });
    const A = b.window.ArcadeCharacter;
    A.setSkin('yunyue');
    ok('素材全挂时 isActive() 为 false（预览会继续画经典）', A.isActive() === false);
    ok('素材全挂时也不会抛错', b.errors.length === 0, b.errors[0]);
  }

  /* ================= I. 经典小鲸鱼完全没被改动 ================= */
  {
    const b = harness({ page: 'runner' });
    const W = b.window.ArcadeWhale;
    ok('Classic Whale 素材还在（NORMAL_A/B + DIVE_A/B，24×18）',
      !!W && !!W.NORMAL_A && !!W.NORMAL_B && !!W.DIVE_A && !!W.DIVE_B && W.WIDTH === 24 && W.HEIGHT === 18);
    ok('没有 arcade.characterSkin 时就是经典小鲸鱼', b.window.ArcadeCharacter.getSkin() === 'classic');
    ok('Classic 皮肤 draw() 永远返回 false（由游戏自己画）',
      b.window.ArcadeCharacter.draw(fakeCtx().ctx, 'walk', 0, 0, 10, 10, { time: 0 }) === false);
  }

  return out;
}
