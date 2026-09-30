# DeepSeek Arcade

**四款 DeepSeek-inspired 像素小游戏合集**（非官方同人）：Whale Runner · Context Snake · Token Fall · Attention Maze。
纯 HTML + CSS + 原生 JavaScript（Canvas 2D）——**零依赖、零构建、零图片、零后端**。

**中文** · [English](README.en.md)

> **在线试玩：<https://apxs114514.github.io/DeepSeek-Arcade/>**
> 首页是游戏大厅，选一款开始；每个游戏页左上角都有 **← 返回游戏厅**。

## 四款游戏

| 游戏 | 类型 | 一句话 |
| --- | --- | --- |
| 🐳 **Whale Runner** | 跑酷 | 上浮 / 下潜躲开海洋生物，游得越远越快 |
| 🐳 **Context Snake** | 贪吃蛇 | 吃 TOKEN 让 CONTEXT 变长，别撞墙也别咬到自己 |
| 🐳 **Token Fall** | 接物 + 资源管理 | 接住 Token · 管理上下文：接 COMPRESS 压缩 Context，躲开 NOISE |
| 🐳 **Attention Maze** | 记忆解谜 | 记住路径 · 聚焦关键 · 找到出口（12 个手工 Layer） |

四款是**同一只 DeepSeek 小鲸鱼**、同一套中英双语、同一个 Sound 开关、同一套像素风格。

## 技术特点

- **零依赖 / 零构建**：没有 `package.json`、没有打包器、没有框架、没有外部图片或音频文件；
- **一份美术**：小鲸鱼像素素材只在 `shared/whale.js` 里存一份，Whale Runner / Token Fall / 大厅预览共用；
- **一份文案**：全站词典在 `shared/i18n.js`，Canvas 里的文字也跟着语言实时切换；
- **一个 Sound 开关**：`arcade.sound` 全站共享 —— 在任何一款游戏里静音，另外三款一起静音（自动兼容旧设置）；
- **Retina 清晰**：Canvas 按 DPR（上限 3）设置背板分辨率，判定仍在固定逻辑坐标里做；
- **先测后发**：GitHub Actions 先跑完整套测试，通过之后才部署 Pages。

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

四款游戏共用一个无头测试环境（桩 DOM + 桩 Canvas，不需要浏览器），目前 **600+ 项**，覆盖玩法规则、
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
│   └── whale.js                          DeepSeek 小鲸鱼像素素材（唯一一份）
├── games/
│   ├── runner/                           Whale Runner
│   ├── snake/                            Context Snake
│   ├── token-fall/                       Token Fall
│   └── attention-maze/                   Attention Maze（levels.js 关卡数据 + game.js 引擎）
├── test/                                 无头测试（桩 DOM + 桩 Canvas）
├── docs/                                 architecture.md · testing.md（各有 .en.md 英文版）
├── LICENSE                               MIT（代码）
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
- **DeepSeek 名称、Logo、相关图形与品牌资产不包含在 MIT 授权内**，其权利归各自权利人所有；
  小鲸鱼像素造型来自 DeepSeek 官方 logo，本项目只做同人致敬。
- 这是一个**非官方同人项目**，与 DeepSeek 官方无关联；Whale Runner 玩法致敬 Chrome 断网小恐龙。
- 代码零依赖、无构建，可以随便拿去改成别的角色或加新游戏。
