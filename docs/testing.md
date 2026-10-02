# 测试

六款游戏共用一个无头测试环境：**桩 DOM + 桩 Canvas**，直接在 Node 里把真实的 `game.js` 跑起来，
不需要浏览器、不需要任何 npm 依赖。

**中文** · [English](testing.en.md)

```bash
bash test/run.sh          # 等价于 node test/run.mjs（会自动回退到 DSH 自带的 node）
```

CI 里同样是这一条命令（`.github/workflows/pages.yml` 的 `Run tests` 步骤），**测试不过就不会部署 Pages**。

目前 **1300+ 项**，十一个套件：

| 套件 | 覆盖 |
| --- | --- |
| Whale Runner · 碰撞 | 跳/潜 vs 四类海洋生物，且在 **PX=2/3/4** 三档缩放下都成立 |
| Context Snake · 玩法 | 移动、禁止反向（含快速连按）、吃 TOKEN 增长、撞墙、撞自身、最高分、速度上限、THINK 触发与结束、触屏输入、离开页面停循环 |
| Token Fall · 玩法 | 五类掉落物结算、CONTEXT 不低于 0、Overflow 抢救随 LOAD 收紧与取消（含「救回来不再判死」回归）、DEEP THINK 触发/到期/物理减速、Combo 增长与 x5 封顶、难度上限、高 Context 的 COMPRESS 保底、NOISE 不成墙、暂停时所有计时冻结、键盘 / 触屏 / 多指 / 拖动、切走标签页与失焦会松开输入、bfcache 返回后循环能接回来、重开清理、最高分 key、DPR 不影响判定 |
| Token Fall · LOAD 难度曲线 | 阶段按 0/30/60/100/150 秒正确切换且永不出现 LOAD 6、每个 LOAD 的 COMPRESS 基础值与 NOISE 惩罚、自然概率随 LOAD 下降、HEAVY TOKEN 不在 LOAD 1 出现且权重始终少于 TOKEN、COMPRESSION FATIGUE（递减 / 7 秒重置 / 封顶）、Context Efficiency、压缩量按 16 取整 + 下限 64 + 永不为负、保底阈值逐级严格而 LOAD 5 仍保留极端保底、Overflow 抢救时间逐级收紧且不低于 1.2 秒、HEAVY TOKEN 继续 CLEAN、暂停 / 切页 / 重开对 LOAD、Fatigue、Overflow 的影响。**只验证 `window.TokenFallRules` 暴露的纯函数与真实行为，不做随机采样** |
| Context Breaker · 玩法 | 初始 serve、发球、左/右/顶墙反弹、挡板按落点给角度且永不接近水平、CONTEXT 一击碎（10 分）、DENSE 两击且首击进受损状态（20 分）、NOISE 缩窄挡板并到期恢复、THINK 减速并到期恢复、COMPRESS 全局 HP−1 且不连锁触发、掉球扣命、3 条命归零进 gameOver、清空关卡自动进下一层且球速封顶、暂停冻结球/效果计时/角色时钟、切标签页与失焦自动暂停、高分写入 `arcade.breakerHighScore` 且不覆盖历史更高分、与另外四款 key 不冲突、换皮肤不改变碰撞盒与反弹结果、素材全 404 不崩溃 |
| Hallucination Hunt · 生成器 / 校验器 / 难度 | **property-style**：对 1500 个 seed 断言同一组不变量（不抛异常、claim 数量符合 LOAD、文本非空、无 NaN/未替换占位符、mutation ≠ 原文、index 合法、同 seed 完全一致）。另有：知识库质量（id 唯一 / category 白名单 / 来源元数据 / 中英 claims 一一对应 / 占位符都有值 / 每条 fact 至少一条可变异 claim / 各分类条数）、PRNG（同 seed 同序列、int 含两端、shuffle 是排列、fork 一致、核心文件无 `Math.random`）、**11 种 mutation 的逐类型性质测试**（swap 的 replacement ≠ original、数字真的变了、DATE_SHIFT 落在 1000~2099、UNIT_ERROR 只换单位不动数字、NEGATION 真的否定、FABRICATED_DETAIL 真的更长）、Validator 的九条拒绝规则（含 null / 越界不抛异常）、难度（LOAD 恒 1~5、单轮最多变一档、优秀表现不回落、连续失误不上顶、极端 reactionTime 无 NaN）、Streaming（同一 elapsed 同一字数、单调不减、标点停顿）、计分上限、Daily seed 与分享文本、状态机与暂停冻结、aria-live 与 reduced-motion 声明 |
| 多语言 | 七个页面的中英切换与持久化、旧的 `whaleRunner.lang` 兼容、**全站词典 key 一一对应且无遗漏**、Token Fall 要求的 39 个 key（含 LOAD / HEAVY TOKEN / 压力提示）、Attention Maze 要求的 40 个 key 中英齐全、Context Breaker 要求的 32 个 key 中英齐全、Hallucination Hunt 要求的 37 个 key 中英齐全 |
| Whale Runner · 冒烟 | 生命周期、暂停/静音/隐藏、判定盒几何自检、AI 连跑 20000 帧零死亡 |
| Attention Maze · 玩法 | 12 关地图数据自检（15×11、四周封闭、节点都在可走格、不重叠、answer 就是注意力最高的 KEY）与 **BFS 可解性验证**、par 合理性、地图解析、走格子与撞墙不加 MOVES、提前到 EXIT 无效、
QUERY 触发与展示时长、错误 KEY 只记一次 MISTAKE、正确 KEY 解锁 VALUE、VALUE 解锁 EXIT、权重不随机、MULTI-HEAD 阶段顺序与「两头之和」判定、RESCAN 次数与上限、暂停冻结全部计时、切页自动暂停、
重开清理、进度解锁与星级（含「更差成绩不覆盖最佳」）、存档损坏容错、RESET 二次确认、触屏/多指/失焦松手、DPR 不影响判定 |
| 角色皮肤 | `arcade.characterSkin` 默认 classic、非法值回退、`setSkin` / `cycleSkin` 来回切换、`onChange`、重新进页面读回同一个值、**旧值 `whalechan` 自动迁移成 `yunyue` 并写回**；**换皮肤不改任何游戏数据**（成绩 / 进度 / 音效 / 语言 key 逐个比对，循环一整圈后再比一次）；四款游戏换皮肤后**判定盒完全不变**（Runner 用固定随机种子跑同一段剧本对比死亡帧、Token Fall 对比接物结算、Snake 对比蛇头格子与长度、Maze 对比所在格与 MOVES）；**动画帧只由时间决定**（同一时间画 50 次仍是同一帧、8 帧 walk 真的在换帧）；暂停后角色动画时钟冻结且不再换帧；`yunyue` 绘制期间 `imageSmoothingEnabled = true`，且画完一定还原（smoothing 与 globalAlpha）；左右朝向镜像正确（Runner 不镜像、Token Fall / Snake / Maze 朝左镜像），`jump` 与步态同向；素材**懒加载**（classic 启动不下载任何图片、切换只请求当前皮肤那一套、切回来不重复 `new Image()`、hover 预热下一套）；全套 404 / 单张 404 / 加载中都回退经典小鲸鱼且不报错 |
| 静态检查 | 所有 `src`/`href` 都能解析到真实文件、没有站点绝对路径、六款游戏的 localStorage key 互不冲突、角色注册表里的每张素材都真实存在（且目录里没有漏登记 / 多余的 WebP）、旧的第三方素材目录与 CC BY 4.0 全文已删除 |

## 关卡可解性验证（Attention Maze）

`test/attentionmaze.test.mjs` 里有一个**独立的 BFS 验证器**，它不依赖游戏运行时，直接读 `games/attention-maze/levels.js`
的关卡数据，对 12 个 Layer 逐个确认：

- 地图是 15×11、四周封闭、所有节点都落在可走格上、没有两个节点共用一格；
- `answer` 确实是注意力最高的 KEY 且没有并列（单头看权重，多头按两个头之和取整比较，且要求余量 ≥ 0.08，避免浮点平局）；
- **起点 → QUERY → 正确 KEY → VALUE → EXIT 全程连通**（忽略关卡锁，只看地图几何）；
- `parMoves` ≥ 最短通路（三星可达），且不会宽松到失去意义（≤ 1.6 倍），`parTime` 也在合理区间。

加一个新 Layer 只要往 `levels.js` 追一条数据，这个验证器会自动替你验一遍。

同一个 suite 里还有一组**关卡设计质量**检查（防止正确答案又挤到某一个 KEY 上）：
每关唯一最高、任何 KEY 占比 ≤ 40%、不连续 3 关同一答案、K1/K2/K3 都当过答案、K4 首次登场后必须当过答案、
K5/K6 不能只是干扰项、KEY 数量单调递增、答案不会总是最右 / 离 QUERY 最近 / 离 EXIT 最近、每关与第二名差距 ≥ 0.08。

## 第三方素材与授权检查

`test/engineering.test.mjs` 里有一组**版权防回归**，静态读文件，不需要联网。它只检查**事实与结构**，
不去比对可能随时改写的整段文案：

- **旧皮肤彻底退出**：全仓库扫描（跳过 `.git`）确认运行时 / 文档 / 测试里都不再出现
  旧的第三方皮肤仓库、作者名、素材目录或旧文件名前缀（唯一允许保留的是 `shared/character.js`
  里那条旧 localStorage 值到 `yunyue` 的迁移表，以及验证迁移的测试本身）；
- `assets/whale-yunyue/ATTRIBUTION.md` 存在，写明作者 `YunYueSama`、上游仓库地址、
  上游 commit SHA、`modified`、以及所依据的许可文件名；
- `LICENSES/YUNYUE-WHALE-PET-LICENSE.txt` 是上游「大肥鱼项目署名许可 1.0」全文；
- `THIRD_PARTY_NOTICES.md` 列出这个来源，并说明「代码 MIT / 素材自己的授权」，
  且**不再出现**旧皮肤；
- 根 `LICENSE` 仍然是 MIT，并写清楚鲸鱼娘素材不在 MIT 范围内；
- 中英 README 都提到两套角色与 `arcade.characterSkin`，并给出素材来源仓库；
- 派生素材齐全、体积可控（鲸鱼娘 < 512KB）、运行时目录里没有混入上游原始 PNG；
- 已经删掉的皮肤不会复活（旧素材目录、被移除的像素皮肤目录、以及没有素材使用的许可全文都不存在）。

## 加测试怎么入手

- 页面装配在 `test/helpers.mjs` 的 `PAGES` 里：每个页面列出真实存在的 DOM id 与它要加载的脚本（顺序与 HTML 一致）。
  需要访问游戏内部状态时给页面加 `exposeGame: true`，测试里用 `b.G` 读；
  引擎里的 `var game = {` 会被替换成 `var game = window.__game = {`，所以不用改游戏代码。
- 时间推进：`b.tick(n)` 跑 n 帧；`b.jump(ms)` 只跳时钟（模拟切标签页）；`b.G.now` 是游戏内时钟，暂停时不会走。
- 输入：`b.key('keydown', 'ArrowUp', 'ArrowUp')` 走真实键盘事件，`b.els.up.fire('pointerdown', { pointerId: 1 })` 走真实指针事件。
- 静态检查：`test/paths.test.mjs` 负责死链 / 绝对路径 / localStorage key 冲突；`test/engineering.test.mjs` 负责
  v1.0 的结构约定（统一 Sound、共享素材、关卡拆分、CI 配置、LICENSE、README）。
