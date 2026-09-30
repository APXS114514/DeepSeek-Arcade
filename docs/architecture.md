# 架构与实现细节

这份文档放 DeepSeek Arcade 的内部实现说明。想快速上手请看 [README](../README.md)，
想了解测试请看 [docs/testing.md](testing.md)。

**中文** · [English](architecture.en.md)

## 设计原则

- **零依赖、零构建、零图片**：四款游戏都是纯 HTML + CSS + 原生 JavaScript（Canvas 2D），
  所有美术（小鲸鱼、迷宫、掉落物、粒子、UI）都是 `fillRect` / `fillText` 画出来的，没有外部图片。
- **不引入打包器 / 框架 / ES Module**：每个页面用普通 `<script src>` 按顺序加载，所以
  「直接双击 HTML」「任意静态服务器」「GitHub Pages 子路径」三种打开方式行为一致。
- **玩法逻辑不跨游戏共享**：只在 `shared/` 放真正通用的东西（文案、音效开关、鲸鱼像素数据），
  不做为了「架构统一」而抽的抽象。

## shared/ 三件套

| 文件 | 作用 |
| --- | --- |
| `shared/i18n.js` | 全站唯一词典（中 / 英）+ 语言检测与切换（`arcade.lang`，兼容旧的 `whaleRunner.lang`）。页面用 `data-i18n` 属性或 `I18N.t('key')`；Canvas 里的文字也走 `I18N.t`，语言切换无需刷新。 |
| `shared/audio.js` | Web Audio 音效工具 + **全站统一 Sound 开关**。`ArcadeAudio.tone({...})` 现场合成音色（不引用任何音频文件）；`isEnabled(legacyKey)` / `setEnabled(on)` / `toggle()` 读写 `arcade.sound`，`audio.js` 在静音时 `tone()` 直接静默。 |
| `shared/whale.js` | DeepSeek 小鲸鱼的**唯一一份**像素素材：`NORMAL_A` / `NORMAL_B`（24×18 游动两帧）、`DIVE_A` / `DIVE_B`（24×13 下潜两帧），外加 `width / height / mirror / rotate` 小工具。Whale Runner、Token Fall、大厅卡片预览都读它。 |

**Sound 优先级（第一次读取时确定）**：`arcade.sound` > 当前游戏自己的旧 key（`whaleRunner.sound` /
`arcade.snake.sound` / `arcade.tokenFall.sound` / `arcade.attentionMaze.sound`）> 默认 `on`。
读到旧 key 会顺手写入 `arcade.sound` 完成迁移，但**不删除**旧 key；迁移只认当前游戏自己的旧 key，
不会把别的游戏的静音状态传染过来。Whale Runner 保留自己那套三段包络 `beep()` 音色，只把开关换成统一的。

## 加载顺序（很重要）

```html
<script src="../../shared/i18n.js"></script>
<script src="../../shared/audio.js"></script>
<script src="../../shared/whale.js"></script>   <!-- 需要鲸鱼素材的页面 -->
<script src="levels.js"></script>               <!-- Attention Maze：关卡数据 -->
<script src="game.js"></script>
```

`shared/whale.js` 必须在游戏脚本之前；Attention Maze 的 `levels.js` 必须在 `game.js` 之前。
缺文件时游戏不会崩，但会在控制台给出明确告警。

## Canvas 与 DPR

四款游戏都是同一个套路：**逻辑坐标恒定**（例如 Whale Runner 用 `PX` 缩放、Token Fall 固定 380×560、
Attention Maze 固定 420×354），DPR 只用来设置 `canvas.width/height` 并 `ctx.scale(dpr, dpr)`，
上限 3 避免高倍屏过度绘制；判定完全在逻辑坐标里做，所以换屏幕 / 换 DPR 不会改变碰撞区域。
画布都设了 `image-rendering: pixelated`，CSS 放大时保持像素硬边。

## localStorage 约定（跨游戏约定）

| 项 | 说明 |
| --- | --- |
| 语言 | `arcade.lang`（`zh`/`en`）；**兼容读取旧的 `whaleRunner.lang`**，老用户的选择不会丢 |
| Whale Runner 最高分 | `whaleRunner.high`（沿用原 key，历史成绩保留） |
| Context Snake 最高分 | `arcade.snake.high` |
| Token Fall 最高分 | `arcade.tokenFall.high` |
| Attention Maze 进度 | `arcade.attentionMaze.progress`（存最高解锁 Layer + 每关星级/最佳时间/步数，不是高分） |
| 音效开关 | Whale Runner：`whaleRunner.sound`；Context Snake：`arcade.snake.sound`；Token Fall：`arcade.tokenFall.sound`；Attention Maze：`arcade.attentionMaze.sound` |
| 文案 | **只在 `shared/i18n.js` 里维护一份**，页面用 `data-i18n` 属性或 `I18N.t('key')` 取值 |
| 音效 | Whale Runner 保留自己那套 `beep()`（三段包络专门调过，不动它），新游戏用 `shared/audio.js` |
| 导航 | 普通 HTML 页面跳转（没有 SPA 路由框架），浏览器返回键正常工作 |

## 导航与 GitHub Pages

普通 HTML 页面跳转，没有 SPA 路由，浏览器返回键正常工作。
所有资源都走**相对路径**，所以放在 `/` 根目录或 `/DeepSeek-Arcade/` 这样的 Project Site 子路径下都能工作
（`test/paths.test.mjs` 会静态校验：没有 `src="/..."` / `href="/..."` 这类绝对路径）。

## 部署

推送到 `main` 就自动发布：`.github/workflows/pages.yml` 用 `actions/configure-pages` +
`upload-pages-artifact` + `deploy-pages`，把仓库根目录作为静态站点发布到
<https://apxs114514.github.io/DeepSeek-Arcade/>。仓库根目录的 `index.html` 就是大厅首页。

## 手机适配

- **窄屏（≤720px）**：去掉卡片留白、画布占满宽度；按钮最小 48px 高；
  禁用下拉刷新（`overscroll-behavior: none`），画布上 `touch-action: none`，玩的时候不会误滚页面。
- **横屏（高度 ≤560px）**：收起标题与说明，把纵向空间让给舞台。
  Whale Runner 会提示「↻ 把手机横过来」并提供 `⛶ 全屏`（顺带尝试锁定横屏）；
  Context Snake 与 Attention Maze 则按高度缩放画布、把操作区压成一行，保证「画布 + 操作盘」一屏放得下、不用滚动。
- **实测（真机尺寸模拟）**：同一台手机跑酷画布竖屏 368×82 → 横屏 784×174（宽 2.2 倍）；
  贪吃蛇横屏为 339×240 且十字键与按钮都在首屏内。
- **触屏输入**：跑酷是跳跃 / 下潜按钮；贪吃蛇是十字键 **+** 画布滑动（阈值 22px，小拖动按点击处理，不会误触转向）；
  Token Fall 是**两个大方向键（按住持续移动）**加**画布左右拖动**，`pointerup` / `pointercancel` / `pointerleave` /
  `lostpointercapture` 与 document 上的兜底都会松手 —— 手指滑出按钮、被系统打断或切走应用都不会让鲸鱼一直跑，
  多指同时按住也会正确合并；`pointerdown` 里 `preventDefault`、按钮上 `touch-action: none`，长按不会滚动页面或触发下拉刷新。
  Attention Maze 是**十字方向键（按住连续走格子，但一帧最多一格）**加画布滑动（滑动只走一格，不会变成一直走），
  内部用「按下的方向栈 + 输入来源」记账，任何一个来源松开都会立刻重新计算，手指在按钮外抬起也有 document 兜底。
- 画布都设了 `image-rendering: pixelated`，被 CSS 放大时保持像素硬边；DPR 上限 3，避免高倍屏过度绘制。

## 想改点什么（调参入口）

- **Whale Runner 难度**：`START_SPEED` / `MAX_SPEED` / `ACCEL`；**手感**：`GRAVITY` / `JUMP_V` / `FAST_FALL`。
- **Whale Runner 外形**：`WHALE_A` / `WHALE_B` / `WHALE_DIVE_A` / `WHALE_DIVE_B` / `URCHIN` / `CORAL` / `JELLY_*` / `FISH_*`
  都是字符画（`X` 主色、`o` 肚皮、`.` 透明），直接改字符即可。
- **Whale Runner 配色**：`PAL` 每项是 `[浅海 RGB, 深海 RGB]`；注意 `PAL.belly` 的深海值刻意贴近 `PAL.whale`（太亮会在暗海里变成白斑）。
- **Context Snake 手感**：`BASE_STEP_MS`（起始速度）/ `STEP_DEC`（每个 TOKEN 提速）/ `MIN_STEP_MS`（速度上限）/
  `THINK_MS` / `THINK_SLOW` / `THINK_CHANCE` / `THINK_COOLDOWN` / `CTX_PER_TOKEN`。
- **Token Fall 平衡**：`MAX_CONTEXT`（1024）/ `CTX_TOKEN` / `CTX_COMPRESS` / `CTX_NOISE` / `CTX_THINK` /
  `OVERFLOW_MS`（抢救时间）/ `SPEED_START`~`SPEED_MAX` / `SPAWN_START`~`SPAWN_MIN` / `ACTIVE_MAX`（同屏上限）/
  `NOISE_MIN`~`NOISE_MAX` / `COMPRESS_URGE_MS`、`COMPRESS_RESCUE_MS`（保底）/ `COMBO_STEP`、`COMBO_MAX`（CLEAN 倍率）。
- **Token Fall 手感**：`PLAYER_SPEED` / `PLAYER_ACCEL`（平滑移动）、`PLAYER_HIT` 与 `HIT`（判定盒内缩量，越小越宽松）。
- **Attention Maze 关卡**：`LAYERS` 数组就是全部内容 —— 每关 `map`（15×11 的 `#` / `.`）、`nodes`（start/exit/query/keys/value 的明确坐标）、
  `keys[].w`（单头权重）或 `heads`（两个注意力头）、`answer`（正确 KEY 的 id）、`scanMs` / `focus` / `rescan` / `parTime` / `parMoves` / `tip`。
  加一关只要往 `LAYERS` 里追一条数据，测试会自动替你验证「节点在可走格上、answer 就是注意力最高的 KEY、起点→QUERY→正确 KEY→VALUE→EXIT 连通、par 合理」。
- **Attention Maze 节奏**：`ATT_MS`（单头展示）/ `HEAD_MS`（每个头）/ `COMBINE_MS`（混合提示）/ `RESCAN_MS` / `MOVE_REPEAT_DELAY`、
  `MOVE_REPEAT_EVERY`（按住连走的间隔）/ `TWEEN_MS`（纯视觉插值，不影响判定）/ `starsFor()` 里的星级门槛。
- **文案**：加到 `shared/i18n.js` 的 `DICT.zh` / `DICT.en`（key 必须两边都有，测试会检查），HTML 用 `data-i18n`。
- 改完跑一次 `bash test/run.sh`。

## 四款游戏的实现细节

## 🐳 Whale Runner — `games/runner/`

玩法就是 Chrome 断网小恐龙那一套，把沙漠换成了海底：

| Chrome 断网小恐龙 | 这个版本 |
| --- | --- |
| 小恐龙 | **DeepSeek 小鲸鱼**（造型取自官方 logo） |
| 仙人掌 | 海床上的 **海胆 / 珊瑚 / 低浮水母** |
| 翼龙（低飞 / 中空） | **小鱼**（跳过去）/ **中空水母**（下潜躲开） |
| 跳跃 / 下蹲 | 上浮跳跃 / 下潜 |
| 昼夜黑白反转 | 浅海 ⇄ 深海（颜色渐变 + 发光浮游生物） |
| 分数 + 最高分 | 一样，另加音效、中英双语、手机适配 |

**操作**：`空格` / `↑` / `W` 上浮跳跃（点画面也行）· `↓` / `S` 下潜（空中按 = 加速下坠）·
`P` 暂停 · `M` 静音 · 触屏：跳跃 / 下潜按钮、`🌐` 切换语言、`⛶` 全屏（仅触屏显示）

**规则**：撞到任何海洋生物即结束；游得越远速度越快；每 100 分提示音一响，每 700 分浅海 ⇄ 深海。
最高分存在 `localStorage: whaleRunner.high`。

### 小鲸鱼的来历

不是随手画的像素图，而是把 **DeepSeek 官方 logo 的那条 cubic 路径**光栅化来的：

- **本体**：路径渲染成 24×18 像素网格（镜像成朝右），所以游戏里的鲸鱼和浏览器标签页上的图标是同一个形状。
- **摆尾两帧** `WHALE_A` / `WHALE_B`：尾鳍在 logo 里和主体轮廓属于同一条子路径、没法单独旋转，
  于是对整条路径做**沿 x 的平滑剪切**（身体处位移为 0，越靠尾鳍越大）后重新光栅化，两帧身体位置逐格对齐。
- **下潜两帧** `WHALE_DIVE_A` / `WHALE_DIVE_B`：整条路径纵向压扁到 0.72（24×13 的滑行姿态），再叠加同样的尾鳍剪切。

### 值得知道的技术点

- `PX` 是**整个世界缩放的总开关**：画布、重力/初速/速度、判定盒、字号都跟着 `S = PX/3` 走，
  所以把 `PX` 从 3 改成 2 或 4 是等比放大缩小，玩法不变（测试里有 2/3/4 三档回归）。
- 判定盒用「精灵格子 × PX」表达（`BOX` / `MID_BOTTOM` / `LOW_BOTTOM`），三者的咬合关系是
  `下潜盒上沿 11 格 < 中层障碍盒下沿 13 格 < 站立盒上沿 16 格`；**启动时会自检**，破了会在控制台告警。

---

## 🐳 Context Snake — `games/snake/`

经典贪吃蛇，蓝色像素海域。你是一只小鲸鱼头，吃 **TOKEN** 让身后的 **CONTEXT** 越来越长。

- **TOKEN**：发光蓝色像素方块。吃一个 → 身体 +1 节、`CONTEXT +8`。
- **THINK**（低概率特殊物品）：吃到进入 **4 秒 DEEP THINK** —— 每格耗时 ×1.7（明显但克制的减速），
  场地泛蓝光、HUD 出现倒计时条。吃过 3 个 TOKEN 之后才有机会出现，两次之间至少隔 26 格，不会刷屏。
- **速度**：起始每格 150ms，每吃一个 TOKEN 快 4ms，**封顶 72ms**（第 20 个 TOKEN 到顶），越玩越紧但不失控。
- **禁止 180° 反向**：输入用长度 2 的队列，并且拿"最后一个已排队方向"做校验 ——
  所以快速连按（右→上→左）也不会出现非法掉头。
- **结束条件**：撞墙或咬到自己。
- **操作**：`方向键` / `WASD` · 触屏**十字键**与**画布滑动**都支持 · 点画面 = 开始 / 暂停 / 重开 · `P` 暂停 · `M` 静音
- **最高分**：`arcade.snake.high`（与 Whale Runner 的 `whaleRunner.high` 完全分开，互不覆盖）

> 视觉全部由代码绘制：鲸鱼头是一个 8×8 字符画精灵（按方向旋转 90° 整数倍），
> 身体是发光像素块（越靠尾越暗越细），TOKEN / THINK / 网格 / 粒子都是 `fillRect` 拼的，没有任何图片。

---

## 🐳 Token Fall — `games/token-fall/`

竖向接物游戏。屏幕顶部落下不同类型的 Token，你控制海底的小鲸鱼左右移动去接：
**这不是「全部接住」的游戏，而是一边拿分、一边管理有限的 Context Window。**

| 掉落物 | 颜色 | 接到以后 | 该不该接 |
| --- | --- | --- | --- |
| **TOKEN** | DeepSeek 蓝 | `SCORE +10`、`CONTEXT +32` | 该接（最常见） |
| **COMPRESS** | 亮青色 | `SCORE +20`、`CONTEXT −256`（最低 0） | Context 高时的救命稻草 |
| **NOISE** | 紫红 | `SCORE +0`、`CONTEXT +128` | 必须躲开 |
| **THINK** | 金色（`<think>`） | `SCORE +30`、`CONTEXT +16`、4 秒 DEEP THINK | 低概率，看到就接 |

- **HUD**：`CONTEXT 384 / 1024` 常驻显示，上面还有 `SCORE` / `CLEAN xN` / `HI`；上限第一版固定 **1024**。
- **DEEP THINK**：所有掉落物下落速度 ×0.6，全屏克制的蓝色像素泛光 + 顶边剩余时间条。
  出现概率很低（单次 5%、两次之间至少隔 9 秒、开局 5 秒内不刷），不会让玩家一直慢动作。
- **CONTEXT OVERFLOW**：Context 到达 1024 时**不会瞬间死亡**，而是进入 **2 秒抢救时间**：
  HUD 闪 `OVERFLOW`、场地顶部有琥珀色倒计时条。这 2 秒内接到 **COMPRESS** 把 Context 压回 1024 以下就取消溢出；
  时间走完仍然溢出才 Game Over，结束原因显示 **`CONTEXT OVERFLOW`（上下文溢出）**，而不是普通 GAME OVER。
- **CLEAN 连击**：连续接到 TOKEN / COMPRESS / THINK 累计 Combo，每 3 连 +1 倍、**封顶 x5**；
  接到 NOISE 立刻清零。漏掉 TOKEN / COMPRESS 不结束游戏、也不清 Combo —— 核心是**选择**而不是全接。
- **难度**：随时间提高下落速度（95 → **230 px/s 封顶**）、生成间隔（1150 → **520ms 封顶**）、
  同屏数量（1 → **4 个封顶**）与 NOISE 概率（0.13 → **0.30 封顶**）；前 10 秒很轻松，几十秒后开始有压力，但不会失控。
- **生成保底**（避免无解局面）：Context > 85% 且 3.2 秒没给过 COMPRESS → 下一次必定生成 COMPRESS；
  Context > 95% 且场上没有 COMPRESS → 1.4 秒内保底生成一个。保底 COMPRESS 也**不会直接放在玩家头顶**，
  仍然要玩家自己过去接；NOISE 也**不会连出 3 个**形成几乎必接的墙。
- **压力反馈**：60% 起 Context 条变亮，85% 起轻微脉冲，95% 起屏幕边缘出现克制的琥珀色边框
  （不用刺眼红闪，也不影响可玩性）；鲸鱼背上还有一条很轻的 Context Buffer 小槽。
- **操作**：`←` `→` / `A` `D` 按住平滑移动（有加速度，不是瞬移一格）· 手机屏幕下方两个大方向键
  **按住持续移动** · 也可以直接在画布上左右拖动鲸鱼 · 轻点画布 / `P` / `⏸` 暂停 · `M` 静音。
- **暂停与切页**：暂停时掉落物、DEEP THINK、Overflow 倒计时、分数、难度计时全部冻结；
  切走标签页自动暂停、回来不自动继续；时间差过大（切页回来）会被钳住，掉落物不会瞬移。
- **最高分**：`arcade.tokenFall.high`；静音开关 `arcade.tokenFall.sound`（与另外两款完全分开）。

> 同样零图片：小鲸鱼和 Whale Runner 是同一只 —— 由 **DeepSeek 官方 logo 路径**光栅化出的 24×18 字符画精灵
> （两帧摆尾，向左游时镜像；判定盒同样按精灵格子内缩，透明区域不算碰撞）。四类掉落物、背景数据粒子、网格、HUD、
> 发光效果全部用 `fillRect` / `fillText` 画出来。音效用 `shared/audio.js` 现场合成
> （TOKEN 短促提示音、COMPRESS 压缩下坠音、NOISE 错误音、THINK 上行音、Overflow 警告音、Game Over 音）。

---

## 🐳 Attention Maze — `games/attention-maze/`

以 **Transformer Attention** 为灵感的像素迷宫解谜（不懂机器学习也能玩，规则全靠关卡内视觉提示教会你）。
每关叫一个 **LAYER**，一共 12 关，全部手工设计；核心循环是：

**ATTENTION SCAN（看清整张图）→ FOCUS MODE（只剩身边一圈）→ 记住 → 走到 EXIT**

- **ATTENTION SCAN**：每关开始整张迷宫亮 2~3 秒，出口、QUERY、KEY、VALUE 一览无余；扫描期间不能移动，
  就是让你记。之后进入 **FOCUS MODE**：只有**曼哈顿距离 2~3 格**的注意力窗口是亮的（窗口边界会描出来），
  远处被深蓝遮罩盖住（不是纯黑），走过的格子留一点很暗的残影 —— 后期关卡视野收到 2 格、扫描缩到 1.7 秒。
- **QUERY / KEY / VALUE**：踩到 `Q` 会亮起它到每个 `K` 的**注意力连线与权重数字**（约 1.8 秒后消失）。
  低权重线又细又暗，高权重线更粗更亮，**最高权重那条还会多几个亮点**、数字也最亮 —— 不只靠颜色区分。
  权重是**关卡数据里写死的**，同一局、重开同一关都完全一致，绝不随机。
  走对权重最高的 KEY → **ATTENTION MATCHED**；走错只记 1 次 **MISTAKE** 并提示 **LOW ATTENTION**（同一个错 KEY 只记一次），
  不会 Game Over —— 这是解谜，不是惩罚。找对 KEY 才解锁 `V`，拿到 VALUE 才解锁 **EXIT**。
- **MULTI-HEAD ATTENTION**（LAYER 09~12）：踩到 QUERY 后先亮 **HEAD 1**、再亮 **HEAD 2**，两个头关注的 KEY 不一样，
  两轮都看完只给一句 **「综合两个注意力头」** 的提示（不给答案），**两个头加起来最高**的那个 KEY 才对。
  两个头用不同线型区分（HEAD 1 实线、HEAD 2 点状像素线），不是只靠颜色。
- **12 个 LAYER 的机制递进**：01 扫描找出口 → 02 更长的蛇形长廊 → 03 岔路与梳齿 → 04 第一次 QUERY/两个 KEY →
  05 三个 KEY + 权重 → 06 完整的 QUERY→KEY→VALUE→EXIT → 07 更绕的迷宫 + 视野收到 2 格 → 08 扫描时间砍到 1.7 秒 →
  09 第一次 MULTI-HEAD → 10 MULTI-HEAD + VALUE → 11 两个头各自最高的都不是答案 → 12 **FINAL ATTENTION**（全部机制一起上）。
  每关都是**一定可解**的：测试里用 BFS 逐个验证 起点→QUERY→正确 KEY→VALUE→EXIT 全程连通。
- **没有死亡**：走错 KEY、绕远、忘记路线只影响 TIME / MOVES / MISTAKES；只有你自己点 **RESTART** 才会重开本关。
- **RESCAN**：每关可以主动重看一次整张地图（教学关 2 次，中后期 1 次，HUD 显示 `RESCAN 1`）。
  用了不算 MISTAKE，但**本关最高只能拿 2 星** —— 卡住不用重开，想三星就得真记住。
- **星级与进度**：到达 EXIT 就算过关，1 星不是失败。时间和步数都在 par 内且 0 MISTAKE、没用 RESCAN = **3 星**；
  基本达标 = 2 星；其余 = 1 星。每关的最佳星级 / 时间 / 步数都存本地，完成一关解锁下一关，
  主界面是 12 个格子的 **Layer Select**（未解锁显示锁），可以随时重玩已解锁的关卡。
- **操作**：`方向键` / `WASD` 走格子（按住会连着走，但一帧最多一格）· 手机**十字方向键**（按住持续移动，
  松手/滑出/被系统打断都会立刻停）· 画布滑动也能走一格（辅助）· `P` 暂停 · `R` RESCAN · `M` 静音。
- **暂停**：扫描倒计时、注意力展示倒计时、MULTI-HEAD 展示、LAYER 计时、动画时钟全部冻结；切走标签页自动暂停，
  回来不会自动继续。
- **进度**：`arcade.attentionMaze.progress`（JSON：最高解锁层 + 每关最佳星级/时间/步数，存档损坏会自动回退默认值）。

> 零图片：迷宫、俯视小鲸鱼（对字符画做 90° 整数旋转出上下左右四个朝向）、Q/K/V 节点、注意力连线
> （自己画的像素线，粗细 = 权重）、遮罩、HUD 全部 `fillRect`；音效用 `shared/audio.js` 现场合成，音量很克制。

## 目录结构（完整）

```text
.
├── index.html / arcade.css / arcade.js   游戏大厅（GitHub Pages 首页）
├── shared/                               真正共用的部分
│   ├── i18n.js                           中英词典 + 语言切换
│   ├── audio.js                          Web Audio 音色 + 全站统一 Sound 开关
│   ├── whale.js                          DeepSeek 小鲸鱼像素素材（唯一一份）
│   └── arcade.css                        设计变量 + 页面外壳（body / 卡片 / 按钮 / 返回入口）
├── games/
│   ├── runner/                           Whale Runner：index.html / style.css / game.js
│   ├── snake/                            Context Snake：index.html / style.css / game.js
│   ├── token-fall/                       Token Fall：index.html / style.css / game.js
│   └── attention-maze/                   Attention Maze：index.html / style.css / levels.js + game.js
├── test/                                 无头回归测试（桩 DOM + 桩 Canvas，不需要浏览器）
│   ├── run.mjs / run.sh                  一条命令跑全部：bash test/run.sh
│   ├── helpers.mjs                       测试环境（按页面装配 DOM）
│   ├── collision.test.mjs                Whale Runner 碰撞模型 + 缩放不变性
│   ├── smoke.test.mjs                    Whale Runner 冒烟 + AI 长跑可玩性
│   ├── snake.test.mjs                    Context Snake 玩法规则
│   ├── tokenfall.test.mjs                Token Fall 玩法、Overflow 抢救、暂停与触屏
│   ├── attentionmaze.test.mjs            12 关可解性、Q/K/V、MULTI-HEAD、进度星级
│   ├── engineering.test.mjs              v1.0 结构：CI、统一音效、共享素材、关卡拆分
│   ├── i18n.test.mjs                     五个页面的中英切换 + 词典完整性
│   └── paths.test.mjs                    死链 / 绝对路径 / localStorage key 冲突
├── docs/                                 architecture.md · testing.md（各有 .en.md 英文版）
├── LICENSE                               MIT（代码）
├── README.md / README.en.md              项目说明（中文 / English）
└── .github/workflows/pages.yml           先测试、再部署 GitHub Pages
```

> 注：`docs/` 是文档，`test/` 是无头测试，两者都不参与线上页面，但会随 Pages 一起发布（体积很小）。

> 注：`docs/` 是文档，`test/` 是无头测试，两者都不参与线上页面，但会随 Pages 一起发布（体积很小）。
