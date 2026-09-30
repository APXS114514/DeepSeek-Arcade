# DeepSeek Arcade

一个 **DeepSeek 同人小游戏合集**（非官方）—— 从最初那只「仿 Chrome 断网小恐龙」的小鲸鱼跑酷，
长成了一个带游戏大厅的小 Arcade。

> **在线试玩：<https://apxs114514.github.io/DeepSeek-Arcade/>**
> 首页是游戏大厅，选一款开始；每个游戏页左上角都有 **← 返回游戏厅**。

全部是纯 **HTML + CSS + 原生 JavaScript（Canvas 2D）**：**零依赖、零构建、零图片**。
clone 下来双击 `index.html`，或用任意静态服务器打开就能玩。

## 收录的游戏

| 游戏 | 一句话 | 状态 |
| --- | --- | --- |
| 🐳 **Whale Runner** | 跑酷：上浮 / 下潜躲开海洋生物 | ✅ 可玩 |
| 🐳 **Context Snake** | 贪吃蛇：吃 TOKEN 让 CONTEXT 变长 | ✅ 可玩 |
| 🐳 **Token Fall** | 接物：接住 Token · 管理上下文 | ✅ 可玩 |
| ATTENTION MAZE | 占位卡片 | 🔜 敬请期待 |

---

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

## 目录结构

```
.
├── index.html                  游戏大厅（GitHub Pages 首页）
├── arcade.css / arcade.js      大厅样式与脚本（最高分展示、卡片预览像素画）
├── shared/                     真正共用的部分
│   ├── arcade.css              设计变量 + 页面外壳（body/卡片/按钮/返回入口）
│   ├── i18n.js                 全站唯一词典（中 / 英）+ 语言检测与切换
│   └── audio.js                WebAudio 音效工具（Context Snake / Token Fall 用）
├── games/
│   ├── runner/                 小鲸鱼跑酷：index.html / style.css / game.js
│   ├── snake/                  Context Snake：index.html / style.css / game.js
│   └── token-fall/             Token Fall：index.html / style.css / game.js
├── test/                       无头回归测试（桩 DOM + 桩 Canvas，不需要浏览器）
│   ├── run.mjs / run.sh        一条命令跑全部：bash test/run.sh
│   ├── helpers.mjs             测试环境（按页面装配 DOM）
│   ├── collision.test.mjs      Whale Runner 碰撞模型 + 缩放不变性
│   ├── snake.test.mjs          Context Snake 玩法规则
│   ├── tokenfall.test.mjs      Token Fall 玩法、Overflow 抢救、暂停与触屏
│   ├── i18n.test.mjs           四个页面的中英切换 + 词典完整性
│   ├── smoke.test.mjs          Whale Runner 冒烟 + AI 长跑可玩性
│   └── paths.test.mjs          死链 / 绝对路径 / localStorage key 冲突
├── .github/workflows/pages.yml GitHub Pages 自动部署
└── README.md
```

## 运行方式

任选一种：

1. **直接双击** `index.html`（无需服务器）
2. 本地静态服务器（行为与线上一致）：
   ```bash
   python3 -m http.server 8080
   # 打开 http://localhost:8080/
   ```

> 所有资源都走**相对路径**，所以放在 `/` 根目录或 `/DeepSeek-Arcade/` 之类的子路径下都能正常工作
> （测试里的 `paths.test.mjs` 会静态校验这一点）。

## 测试

```bash
bash test/run.sh          # 等价于 node test/run.mjs（会自动回退到 DSH 自带的 node）
```

目前 **366 项**，六个套件：

| 套件 | 覆盖 |
| --- | --- |
| Whale Runner · 碰撞 | 跳/潜 vs 四类海洋生物，且在 **PX=2/3/4** 三档缩放下都成立 |
| Context Snake · 玩法 | 移动、禁止反向（含快速连按）、吃 TOKEN 增长、撞墙、撞自身、最高分、速度上限、THINK 触发与结束、触屏输入、离开页面停循环 |
| Token Fall · 玩法 | 四类掉落物结算、CONTEXT 不低于 0、Overflow 2 秒抢救与取消（含「救回来不再判死」回归）、DEEP THINK 触发/到期/物理减速、Combo 增长与 x5 封顶、难度上限、高 Context 的 COMPRESS 保底、NOISE 不成墙、暂停时所有计时冻结、键盘 / 触屏 / 多指 / 拖动、切走标签页与失焦会松开输入、bfcache 返回后循环能接回来、重开清理、最高分 key、DPR 不影响判定 |
| 多语言 | 四个页面的中英切换与持久化、旧的 `whaleRunner.lang` 兼容、**全站词典 key 一一对应且无遗漏**、Token Fall 要求的 31 个 key 中英齐全 |
| Whale Runner · 冒烟 | 生命周期、暂停/静音/隐藏、判定盒几何自检、AI 连跑 20000 帧零死亡 |
| 静态检查 | 所有 `src`/`href` 都能解析到真实文件、没有站点绝对路径、三款游戏的 localStorage key 互不冲突 |

## 跨游戏约定

| 项 | 说明 |
| --- | --- |
| 语言 | `arcade.lang`（`zh`/`en`）；**兼容读取旧的 `whaleRunner.lang`**，老用户的选择不会丢 |
| Whale Runner 最高分 | `whaleRunner.high`（沿用原 key，历史成绩保留） |
| Context Snake 最高分 | `arcade.snake.high` |
| Token Fall 最高分 | `arcade.tokenFall.high` |
| 音效开关 | Whale Runner：`whaleRunner.sound`；Context Snake：`arcade.snake.sound`；Token Fall：`arcade.tokenFall.sound` |
| 文案 | **只在 `shared/i18n.js` 里维护一份**，页面用 `data-i18n` 属性或 `I18N.t('key')` 取值 |
| 音效 | Whale Runner 保留自己那套 `beep()`（三段包络专门调过，不动它），新游戏用 `shared/audio.js` |
| 导航 | 普通 HTML 页面跳转（没有 SPA 路由框架），浏览器返回键正常工作 |

## 手机适配

- **窄屏（≤720px）**：去掉卡片留白、画布占满宽度；按钮最小 48px 高；
  禁用下拉刷新（`overscroll-behavior: none`），画布上 `touch-action: none`，玩的时候不会误滚页面。
- **横屏（高度 ≤560px）**：收起标题与说明，把纵向空间让给舞台。
  Whale Runner 会提示「↻ 把手机横过来」并提供 `⛶ 全屏`（顺带尝试锁定横屏）；
  Context Snake 则按高度缩放画布、把十字键压成一行，保证「画布 + 操作盘」一屏放得下、不用滚动。
- **实测（真机尺寸模拟）**：同一台手机跑酷画布竖屏 368×82 → 横屏 784×174（宽 2.2 倍）；
  贪吃蛇横屏为 339×240 且十字键与按钮都在首屏内。
- **触屏输入**：跑酷是跳跃 / 下潜按钮；贪吃蛇是十字键 **+** 画布滑动（阈值 22px，小拖动按点击处理，不会误触转向）；
  Token Fall 是**两个大方向键（按住持续移动）**加**画布左右拖动**，`pointerup` / `pointercancel` / `pointerleave` /
  `lostpointercapture` 与 document 上的兜底都会松手 —— 手指滑出按钮、被系统打断或切走应用都不会让鲸鱼一直跑，
  多指同时按住也会正确合并；`pointerdown` 里 `preventDefault`、按钮上 `touch-action: none`，长按不会滚动页面或触发下拉刷新。
- 画布都设了 `image-rendering: pixelated`，被 CSS 放大时保持像素硬边；DPR 上限 3，避免高倍屏过度绘制。

## 想改点什么

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
- **文案**：加到 `shared/i18n.js` 的 `DICT.zh` / `DICT.en`（key 必须两边都有，测试会检查），HTML 用 `data-i18n`。
- 改完跑一次 `bash test/run.sh`。

## 部署

推送到 `main` 就自动发布：`.github/workflows/pages.yml` 用 `actions/configure-pages` +
`upload-pages-artifact` + `deploy-pages`，把仓库根目录作为静态站点发布到
<https://apxs114514.github.io/DeepSeek-Arcade/>。仓库根目录的 `index.html` 就是大厅首页。

## 说明

- **非官方同人作品**，与 DeepSeek 官方无关联；玩法致敬 Chrome 断网小恐龙。
- 小鲸鱼造型来自 **DeepSeek 官方 logo**，相关商标与图形版权归各自所有者。
- 代码零依赖、无构建，可以随便拿去改成别的角色或加新游戏。