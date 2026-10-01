# DeepSeek Arcade

**四款 DeepSeek-inspired 像素小游戏合集**（非官方同人）：Whale Runner · Context Snake · Token Fall · Attention Maze。
纯 HTML + CSS + 原生 JavaScript（Canvas 2D）——**零依赖、零构建、零后端、零运行时外部请求**。
经典形态的美术（小鲸鱼、迷宫、掉落物、粒子、UI）全部由 Canvas 代码绘制；
另外还有一套可选的角色皮肤（鲸鱼娘），用的是仓库自带的第三方素材（来源与授权见下文）。

**中文** · [English](README.en.md)

> **在线试玩：<https://apxs114514.github.io/DeepSeek-Arcade/>**
> 首页是游戏大厅，选一款开始；每个游戏页左上角都有 **← 返回游戏厅**。

## 四款游戏

| 游戏 | 类型 | 一句话 |
| --- | --- | --- |
| 🐳 **Whale Runner** | 跑酷 | 上浮 / 下潜躲开海洋生物，游得越远越快 |
| 🐳 **Context Snake** | 贪吃蛇 | 吃 TOKEN 让 CONTEXT 变长，别撞墙也别咬到自己 |
| 🐳 **Token Fall** | 接物 + 资源管理 | 接住 Token · 管理上下文：LOAD 越高 C 越稀缺、NOISE 越危险，还有高分高风险的 HEAVY TOKEN |
| 🐳 **Attention Maze** | 记忆解谜 | 记住路径 · 聚焦关键 · 找到出口（12 个手工 Layer） |

四款共用**同一套角色外观**（经典小鲸鱼 / 鲸鱼娘，随时可换）、同一套中英双语、
同一个 Sound 开关、同一套像素风格。

### Token Fall 的难度曲线

Token Fall 用 **LOAD 1 ~ 5** 五个阶段表达难度（约 0 / 30 / 60 / 100 / 150 秒）：

- **LOAD 1**：掉落稀疏、同屏 1 个，COMPRESS 常见、**没有 HEAVY TOKEN** —— 明显的新手阶段；
- **LOAD 2 ~ 3**：HEAVY TOKEN 登场，NOISE 变多，COMPRESS 开始变珍贵；
- **LOAD 4 ~ 5**：同屏多个目标，必须主动决定「接 Token / 抢 C / 躲 Noise / 要不要冒险吃 Heavy」；
- **150 秒之后**进入无限高压阶段，但**所有数值都会封顶**：很难，但理论上一直能继续玩。

难度并不只来自下落速度，更主要的是**资源管理压力、COMPRESS 稀缺度与错误成本**：

- **COMPRESS 越后期越弱**：基础压缩量 −256 → −128；短时间内连吃还会边际递减（100% → 75% → 50%），
  Context 越低收益越小 —— 所以后期不是「见到 C 就无脑接」；
- **NOISE 越后期越狠**：CONTEXT +128 → +224，后期一次误接就可能逼近溢出；
- **Overflow 抢救时间越后期越短**：2.0 秒 → 1.2 秒（不再更低，手机玩家也要有反应时间）；
- **HEAVY TOKEN**（LOAD 2 起出现）：+35 分但 CONTEXT +96，是典型的「高分 vs 风险」选择，算有效 Token、CLEAN 连击继续；
- 高 Context 时仍然保留 **COMPRESS 保底**（避免纯随机的必死局），但 LOAD 越高阈值越极端、等待越久，
  而且永远要玩家自己移动过去接 —— 保底只防止无解，不会变成系统自动救命。

### Attention Maze 的注意力与 KEY

Attention Maze 的每一关都只能靠**读权重**过关，位置和编号都不提供任何线索：

- 后期的 Layer 会出现 **5~6 个 KEY**，注意力连线和权重数字更多，但每个标签都带 KEY 编号（`K4 0.83`），最高权重那条还会额外加亮；
- **MULTI-HEAD** 关卡里 HEAD 1 与 HEAD 2 可能各自关注不同的 KEY，最终答案必须**综合两个头** ——
  只记住某一次的最高值经常会猜错；
- 正确答案、权重、地图全部写死在 `games/attention-maze/levels.js`，**每局、每次重开都完全一样**，绝不随机；
- 答案在 KEY 编号和地图位置上都刻意打散：没有哪个 KEY 能靠「总是选它」蒙对，
  也不会总是「最靠右」或者「离出口最近」的那个。

## 技术特点

- **零依赖 / 零构建**：没有 `package.json`、没有打包器、没有框架、没有 CDN、没有外部音频文件；
  经典形态的全部美术都是代码画的，两套可选皮肤用的是**仓库自带的本地图片**（运行时零外部请求）；
- **一份美术**：小鲸鱼像素素材只在 `shared/whale.js` 里存一份，Whale Runner / Token Fall / 大厅预览共用；
- **一个角色开关**：`arcade.characterSkin` 全站共享 —— 在大厅三态循环切换，
  四款游戏和大厅预览立刻一起换（加载失败自动退回经典形态）；
- **按皮肤懒加载**：只下载当前皮肤需要的图，经典用户一张第三方素材都不会加载；
- **一份文案**：全站词典在 `shared/i18n.js`，Canvas 里的文字也跟着语言实时切换；
- **一个 Sound 开关**：`arcade.sound` 全站共享 —— 在任何一款游戏里静音，另外三款一起静音（自动兼容旧设置）；
- **Retina 清晰**：Canvas 按 DPR（上限 3）设置背板分辨率，判定仍在固定逻辑坐标里做；
- **先测后发**：GitHub Actions 先跑完整套测试，通过之后才部署 Pages。

## 角色外观：Classic Whale / Whale Girl

全站有两套角色外观，**默认是 Classic Whale**（老玩家升级后不会被突然换角色）：

| 皮肤 | 外观 | 说明 |
| --- | --- | --- |
| `classic` | 代码绘制的像素 DeepSeek 小鲸鱼 | 默认；四款游戏的手感、判定盒完全按原样 |
| `yunyue` | **鲸鱼娘**（高清 Q 版插画，8 帧走路循环） | 可选皮肤，**只换外观**，不改变任何玩法数值 |

- 在大厅顶部点角色按钮即可来回切换：🐳 经典鲸鱼 → 🐳 鲸鱼娘 → 🐳 经典鲸鱼；
  四张卡片预览会**立刻**跟着换，不需要刷新页面；
- 选择存在 `localStorage: arcade.characterSkin`，四款游戏共用。旧版本存过的 `whalechan`
  会自动迁移成 `yunyue`（用户当初主动选过「鲸鱼娘」，不该被退回经典），非法值一律回退 `classic`；
- 角色皮肤**只影响画面**：不碰最高分、Attention Maze 进度、音效开关、语言和难度；
- 素材**按皮肤懒加载**：用经典鲸鱼时一张第三方图都不下载；鼠标移到角色按钮上会顺手预热下一套；
- 图片没加载完或加载失败时先继续画经典小鲸鱼，素材到位后自动重绘 —— 不白屏、不消失、不报错；
- 动画帧由时间决定（`frame = floor(time / frameMs) % 帧数`），暂停 / 切标签页时和游戏世界一起冻结；
- 皮肤自己声明插值方式（鲸鱼娘是插画，绘制时打开 `imageSmoothing`），并且每次画完都会把 Canvas 状态还原。

角色的具体形态：

- **Whale Runner**：地面状态播走路 / 跑动循环，跳跃用腾空姿态，下潜用低姿态，结束时用失败表情；
  脚底始终贴海床，判定盒（`BOX` / `MID_BOTTOM` / `LOW_BOTTOM`）完全不变；
- **Context Snake**：只换**蛇头**那一格（小头像），身体仍然是 Context 像素块；
  DEEP THINK 时换成埋头工作的头像；格子尺寸与碰撞不变，朝左时水平镜像；
- **Token Fall**：底部玩家换成鲸鱼娘 —— 左右移动播走路循环、停下回到待机，
  DEEP THINK 是埋头工作，溢出抢救是慌张表情，结束时是失败表情；
- **Attention Maze**：格子制，用的是裁好的小头像（视觉 34px，逻辑仍然只占 1 格），朝左时水平镜像。

鲸鱼娘素材来自开源仓库 [`YunYueSama/codex-deepseek-pet`](https://github.com/YunYueSama/codex-deepseek-pet)，
授权是**大肥鱼项目署名许可 1.0**（自定义许可，**不是 MIT**）。

来源文件、上游 commit、做过的改动与授权全文见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、
[`assets/whale-yunyue/ATTRIBUTION.md`](assets/whale-yunyue/ATTRIBUTION.md) 和 `LICENSES/`。

## 本地运行

任选一种：

1. **直接双击** `index.html`（无需服务器）
2. 本地静态服务器（行为与线上一致）：
   ```bash
   python3 -m http.server 8080
   # 打开 http://localhost:8080/
   ```

> 所有资源都走**相对路径**，所以放在 `/` 根目录或 `/DeepSeek-Arcade/` 之类的子路径下都能正常工作
> （`test/paths.test.mjs` 会静态校验这一点）。

## 测试

```bash
bash test/run.sh          # 等价于 node test/run.mjs（会自动回退到 DSH 自带的 node）
```

四款游戏共用一个无头测试环境（桩 DOM + 桩 Canvas，不需要浏览器），目前 **1000+ 项**，覆盖玩法规则、
Attention Maze 12 关的 **BFS 可解性验证**、多语言词表一致性、相对路径与 localStorage key 冲突、
以及 v1.0 的结构约定（统一 Sound / 共享素材 / 关卡拆分 / CI 配置 / LICENSE）。
细节见 [docs/testing.md](docs/testing.md)。

CI 里跑的就是这一条命令：测试不过，Pages 不会部署（见 `.github/workflows/pages.yml`）。

## 目录结构

```text
.
├── index.html / arcade.css / arcade.js   游戏大厅（GitHub Pages 首页）
├── shared/                               全站共用
│   ├── i18n.js                           中英词典 + 语言切换
│   ├── audio.js                          Web Audio 音色 + 全站统一 Sound 开关
│   ├── character.js                      角色皮肤注册表（三套皮肤）+ 懒加载、动画时钟与回退
│   └── whale.js                          DeepSeek 小鲸鱼像素素材（唯一一份）
├── games/
│   ├── runner/                           Whale Runner
│   ├── snake/                            Context Snake
│   ├── token-fall/                       Token Fall
│   └── attention-maze/                   Attention Maze（levels.js 关卡数据 + game.js 引擎）
├── assets/whale-yunyue/                  鲸鱼娘运行时素材（19 张派生 WebP）+ ATTRIBUTION.md
├── tools/derive-character-assets.py      角色素材派生脚本（dev-only，运行时不用）
├── test/                                 无头测试（桩 DOM + 桩 Canvas）
├── docs/                                 architecture.md · testing.md（各有 .en.md 英文版）
├── LICENSES/YUNYUE-WHALE-PET-LICENSE.txt 鲸鱼娘的授权全文（自定义许可，不是 MIT）
├── THIRD_PARTY_NOTICES.md                第三方素材声明（代码 MIT / 素材各自的授权）
├── LICENSE                               MIT（**只覆盖代码**）
├── README.md / README.en.md              项目说明（中文 / English）
└── .github/workflows/pages.yml           先测试、再部署 GitHub Pages
```

## 文档

中文 · English：`README.md` / `README.en.md`，`docs/architecture.md` / `docs/architecture.en.md`，
`docs/testing.md` / `docs/testing.en.md`（每篇顶部都有语言切换链接）。

- [docs/architecture.md](docs/architecture.md) — shared 设计、加载顺序、Canvas 与 DPR、localStorage 约定、
  手机适配、调参入口，以及四款游戏各自的实现细节（小鲸鱼的来历、判定盒、Q/K/V、MULTI-HEAD、关卡数据结构）。
- [docs/testing.md](docs/testing.md) — 测试怎么跑、每个 suite 覆盖什么、BFS 关卡验证、怎么加测试。

## 声明与 License

- **代码**以 **MIT License** 发布，见 [LICENSE](LICENSE)。
- **鲸鱼娘素材**来自 <https://github.com/YunYueSama/codex-deepseek-pet>
  （大肥鱼项目署名许可 1.0，**不是 MIT**），不属于本项目的 MIT 授权。
- **DeepSeek 名称、Logo、相关图形与品牌资产不包含在 MIT 授权内**，其权利归各自权利人所有；
  小鲸鱼像素造型来自 DeepSeek 官方 logo，本项目只做同人致敬。
- 这是一个**非官方同人项目**，与 DeepSeek 官方无关联；Whale Runner 玩法致敬 Chrome 断网小恐龙。
- 代码零依赖、无构建，可以随便拿去改成别的角色或加新游戏。