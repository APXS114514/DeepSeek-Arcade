# DeepSeek Arcade

**五款 DeepSeek-inspired 像素小游戏合集**（非官方同人）：Whale Runner · Context Snake · Token Fall · Attention Maze · Context Breaker。
纯 HTML + CSS + 原生 JavaScript（Canvas 2D）——**零依赖、零构建、零后端、零运行时外部请求**。
经典形态的美术（小鲸鱼、迷宫、掉落物、粒子、UI）全部由 Canvas 代码绘制；
另有一套可选的鲸鱼娘外观，用的是仓库自带的第三方素材（来源与授权见文末）。

**中文** · [English](README.en.md)

> **在线试玩：<https://apxs114514.github.io/DeepSeek-Arcade/>**
> 首页是游戏大厅，选一款开始；每个游戏页左上角都有 **← 返回游戏厅**。

## 五款游戏

| 游戏 | 类型 | 一句话 |
| --- | --- | --- |
| 🐳 **Whale Runner** | 跑酷 | 上浮 / 下潜躲开海洋生物，游得越远越快 |
| 🐳 **Context Snake** | 贪吃蛇 | 吃 TOKEN 让 CONTEXT 变长，别撞墙也别咬到自己 |
| 🐳 **Token Fall** | 接物 + 资源管理 | 接住 Token · 管理上下文：LOAD 越高 C 越稀缺、NOISE 越危险，还有高分高风险的 HEAVY TOKEN |
| 🐳 **Attention Maze** | 记忆解谜 | 记住路径 · 聚焦关键 · 找到出口（12 个手工 Layer） |
| 🐳 **Context Breaker** | 打砖块 | 用 TOKEN 弹球打碎 CONTEXT 方块，闯过越来越复杂的层级 |

五款共用**同一套角色外观**（`arcade.characterSkin`：默认经典小鲸鱼，可切换鲸鱼娘）、同一套中英双语、
同一个 Sound 开关、同一套像素风格 —— **只换画面，不改任何玩法数值**。

难度曲线、关卡机制与实现细节都在文档里，README 不重复：

- **[docs/architecture.md](docs/architecture.md)** —— Token Fall 的 LOAD 1~5 完整数值表、
  Attention Maze 的 KEY / MULTI-HEAD 机制与 12 关设计、Canvas 与 DPR、localStorage 约定、
  手机适配、调参入口，以及五款游戏各自的实现细节；
- **[docs/testing.md](docs/testing.md)** —— 测试怎么跑、每个 suite 覆盖什么、怎么加测试。

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

五款游戏共用一个无头测试环境（桩 DOM + 桩 Canvas，不需要浏览器），覆盖玩法规则、
Attention Maze 12 关的 **BFS 可解性验证**、多语言词表一致性、相对路径与 localStorage key 冲突。
CI 里跑的就是这一条命令：测试不过，Pages 不会部署。

## 声明与 License

- **代码**以 **MIT License** 发布，见 [LICENSE](LICENSE)。
- **鲸鱼娘素材**来自 [`YunYueSama/codex-deepseek-pet`](https://github.com/YunYueSama/codex-deepseek-pet)，
  授权是**大肥鱼项目署名许可 1.0**（自定义许可，**不是 MIT**），**不包含在 MIT 授权内**；
  全文见 [`LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`](LICENSES/YUNYUE-WHALE-PET-LICENSE.txt)，
  来源文件、上游 commit 与做过的改动见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- **DeepSeek 名称、Logo、相关图形与品牌资产不包含在 MIT 授权内**，其权利归各自权利人所有；
  小鲸鱼像素造型来自 DeepSeek 官方 logo，本项目只做同人致敬。
- 这是一个**非官方同人项目**，与 DeepSeek 官方无关联；Whale Runner 玩法致敬 Chrome 断网小恐龙。
- 代码零依赖、无构建，可以随便拿去改成别的角色或加新游戏。
