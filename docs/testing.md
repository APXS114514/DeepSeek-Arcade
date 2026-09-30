# 测试

四款游戏共用一个无头测试环境：**桩 DOM + 桩 Canvas**，直接在 Node 里把真实的 `game.js` 跑起来，
不需要浏览器、不需要任何 npm 依赖。

```bash
bash test/run.sh          # 等价于 node test/run.mjs（会自动回退到 DSH 自带的 node）
```

CI 里同样是这一条命令（`.github/workflows/pages.yml` 的 `Run tests` 步骤），**测试不过就不会部署 Pages**。

## 测试

```bash
bash test/run.sh          # 等价于 node test/run.mjs（会自动回退到 DSH 自带的 node）
```

目前 **573 项**，七个套件：

| 套件 | 覆盖 |
| --- | --- |
| Whale Runner · 碰撞 | 跳/潜 vs 四类海洋生物，且在 **PX=2/3/4** 三档缩放下都成立 |
| Context Snake · 玩法 | 移动、禁止反向（含快速连按）、吃 TOKEN 增长、撞墙、撞自身、最高分、速度上限、THINK 触发与结束、触屏输入、离开页面停循环 |
| Token Fall · 玩法 | 四类掉落物结算、CONTEXT 不低于 0、Overflow 2 秒抢救与取消（含「救回来不再判死」回归）、DEEP THINK 触发/到期/物理减速、Combo 增长与 x5 封顶、难度上限、高 Context 的 COMPRESS 保底、NOISE 不成墙、暂停时所有计时冻结、键盘 / 触屏 / 多指 / 拖动、切走标签页与失焦会松开输入、bfcache 返回后循环能接回来、重开清理、最高分 key、DPR 不影响判定 |
| 多语言 | 五个页面的中英切换与持久化、旧的 `whaleRunner.lang` 兼容、**全站词典 key 一一对应且无遗漏**、Token Fall 要求的 31 个 key、Attention Maze 要求的 40 个 key 中英齐全 |
| Whale Runner · 冒烟 | 生命周期、暂停/静音/隐藏、判定盒几何自检、AI 连跑 20000 帧零死亡 |
| Attention Maze · 玩法 | 12 关地图数据自检（15×11、四周封闭、节点都在可走格、不重叠、answer 就是注意力最高的 KEY）与 **BFS 可解性验证**、par 合理性、地图解析、走格子与撞墙不加 MOVES、提前到 EXIT 无效、
QUERY 触发与展示时长、错误 KEY 只记一次 MISTAKE、正确 KEY 解锁 VALUE、VALUE 解锁 EXIT、权重不随机、MULTI-HEAD 阶段顺序与「两头之和」判定、RESCAN 次数与上限、暂停冻结全部计时、切页自动暂停、
重开清理、进度解锁与星级（含「更差成绩不覆盖最佳」）、存档损坏容错、RESET 二次确认、触屏/多指/失焦松手、DPR 不影响判定 |
| 静态检查 | 所有 `src`/`href` 都能解析到真实文件、没有站点绝对路径、四款游戏的 localStorage key 互不冲突 |

## 关卡可解性验证（Attention Maze）

`test/attentionmaze.test.mjs` 里有一个**独立的 BFS 验证器**，它不依赖游戏运行时，直接读 `games/attention-maze/levels.js`
的关卡数据，对 12 个 Layer 逐个确认：

- 地图是 15×11、四周封闭、所有节点都落在可走格上、没有两个节点共用一格；
- `answer` 确实是注意力最高的 KEY（单头看权重，多头按两个头之和取整比较，且要求余量 ≥ 0.05，避免浮点平局）；
- **起点 → QUERY → 正确 KEY → VALUE → EXIT 全程连通**（忽略关卡锁，只看地图几何）；
- `parMoves` ≥ 最短通路（三星可达），且不会宽松到失去意义（≤ 1.6 倍），`parTime` 也在合理区间。

加一个新 Layer 只要往 `levels.js` 追一条数据，这个验证器会自动替你验一遍。

## 加测试怎么入手

- 页面装配在 `test/helpers.mjs` 的 `PAGES` 里：每个页面列出真实存在的 DOM id 与它要加载的脚本（顺序与 HTML 一致）。
  需要访问游戏内部状态时给页面加 `exposeGame: true`，测试里用 `b.G` 读；
  引擎里的 `var game = {` 会被替换成 `var game = window.__game = {`，所以不用改游戏代码。
- 时间推进：`b.tick(n)` 跑 n 帧；`b.jump(ms)` 只跳时钟（模拟切标签页）；`b.G.now` 是游戏内时钟，暂停时不会走。
- 输入：`b.key('keydown', 'ArrowUp', 'ArrowUp')` 走真实键盘事件，`b.els.up.fire('pointerdown', { pointerId: 1 })` 走真实指针事件。
- 静态检查：`test/paths.test.mjs` 负责死链 / 绝对路径 / localStorage key 冲突；`test/engineering.test.mjs` 负责
  v1.0 的结构约定（统一 Sound、共享素材、关卡拆分、CI 配置、LICENSE、README）。
