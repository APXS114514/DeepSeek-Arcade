# YunYue Whale Girl — asset attribution / 素材署名

Every image in `assets/whale-yunyue/` is **derived artwork** made from the
open-source project **[YunYueSama/codex-deepseek-pet]** and is licensed under that
project's **大肥鱼项目署名许可 1.0** — a custom attribution licence, **not MIT**.
The full upstream licence text is kept verbatim at
[`../../LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`](../../LICENSES/YUNYUE-WHALE-PET-LICENSE.txt).

Required attribution / 必须保留的署名：

```text
作者：YunYueSama
仓库：https://github.com/YunYueSama/codex-deepseek-pet
```

## Source snapshot

| | |
| --- | --- |
| **Upstream repository** | <https://github.com/YunYueSama/codex-deepseek-pet> |
| **Commit used** | `7661c8b304c5400701f91da01b1a643a207331de` |
| **Upstream licence** | 大肥鱼项目署名许可 1.0 (see `LICENSE`) + `ASSET_LICENSE.md` |
| **Licence text kept at** | [`../../LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`](../../LICENSES/YUNYUE-WHALE-PET-LICENSE.txt) |
| **Upstream files used** | `assets/whale/inbetween-walk.png`, `motion-idle.png`, `dense-jump.png`, `story-token.png`, `actions.png`, `expressions.png`, `portrait.png` |
| **Frame definitions taken from** | `src/renderer/motion.js` (clip tables) and `src/renderer/app.js` (atlas slicing) |
| **Local files** | 19 WebP files in this directory |
| **Derivation script** | [`../../tools/derive-character-assets.py`](../../tools/derive-character-assets.py) |

## Which upstream frame each local file comes from

Upstream atlases are 4-column grids of square cells; the cell size differs per
atlas (512 / 384 / 1024), so every frame is normalised onto the same 512 reference
scale before it is placed on the shared canvas. Frame numbers are 0-based,
row-major, exactly as `src/renderer/app.js` slices them.

| Local file | Upstream atlas | Upstream frame(s) | Animation |
| --- | --- | --- | --- |
| `idle-0..3.webp` | `motion-idle.png` (cell 512) | 0, 1, 2, 3 | 待机轻微换重心（上游 `clips.shift` / `clips.settle` 用的就是这几张） |
| `walk-0..7.webp` | `inbetween-walk.png` (cell 512) | 0, 3, 4, 6, 8, 11, 12, 14 | 上游 `clips.right` 真正播放的整身步态；按上游 16 帧播放顺序等间隔取 8 帧，帧时长 ×2 后总时长仍是上游的 960ms |
| `jump.webp` | `dense-jump.png` (cell 512) | 7 | `clips.jump` 的腾空帧，**水平镜像**后使用（见下方第 3 条）。整个 `dense-jump` 图集都是镜像的，见「Direction」一节 |
| `dive.webp` | `dense-jump.png` (cell 512) | 21 | `clips.land` 的落地压缩帧，用作低姿态 / 下潜，**同样水平镜像** |
| `think.webp` | `story-token.png` (cell 384) | 0 | `clips.think` 第一帧（低头看 token 的工作姿势） |
| `startle.webp` | `actions.png` (cell 512) | 14 | `clips.surprise` 用到的惊慌帧（带惊叹号） |
| `blocked.webp` | `expressions.png` (cell 512) | 14 | `clips.shock` 用到的崩溃 / 委屈帧 |
| `head.webp` | `portrait.png` (1024×1024 单帧) | 0 | 正面全身立绘派生的方形头像 |
| `head-think.webp` | `story-token.png` | 0 | 由 `think.webp` 派生的方形头像（Deep Think 用） |

## Modifications (this project's changes)

For 大肥鱼项目署名许可 1.0 §3, these files are **modified** versions of the
upstream material. Nothing was redrawn and no colour was changed. The pipeline was:

1. **Frame selection** — only the frames listed above were taken out of the
   upstream atlases; the full atlases are *not* redistributed here.
2. **Scale normalisation** — every atlas was normalised to a common 512-pixel
   reference cell (`×512/cell`) so the character keeps the same size across
   states. Integer factor, no distortion.
3. **Direction fix (horizontal mirroring)** — the upstream `dense-jump` atlas is
   mirrored relative to the `inbetween-walk` gait, so `jump.webp` and `dive.webp`
   are flipped left↔right. Mirroring only changes the facing direction: the
   palette, linework and proportions are untouched. See "Direction" below.
4. **Fixed crop window per pose group** — all frames of one state (e.g. the whole
   walk cycle) share a single crop rectangle and a single transform, so the
   character cannot jitter or drift between frames.
5. **Uniform rescale** — the whole set is scaled by one factor (0.4595) into a
   shared **192×208** RGBA canvas; the original aspect ratio is preserved.
6. **Bottom alignment** — each pose group's alpha bounding box is aligned to the
   same ground baseline, so the character's feet always land on the same line.
7. **Alpha edge cleanup** — alpha values below 8/255 are zeroed to remove faint
   edge halos. RGB values are untouched.
8. **Format change** — re-encoded from PNG to **WebP (quality 88)** to keep the
   runtime payload small (≈214 KB for all 19 files).

## Direction

Whale Runner always swims to the right, so every pose that is not front-facing has
to look to the right. Judging that by eye is unreliable — the hair plume and the
tail fin swing to whichever side the pose happens to swing them, which is *not* the
same as the direction the character is facing.

So the facing is measured: take the skin-tone (face) pixels in the head band and
compare their horizontal centre of mass with the head bounding box centre.
**Positive = the face sits right of the head centre = facing right.** As a sanity
check, mirroring a known right-facing walk frame flips its value from +58 to −59.

Measured on the upstream atlases:

| Upstream atlas | Face offset | Facing |
| --- | --- | --- |
| `inbetween-walk` (the gait we use) | **+70** | right |
| `dense-jump` (every frame) | **−15 … −52** | **left — the whole atlas is mirrored** |
| `motion-idle`, `story-token`, `actions`, `expressions` | ≈ 0 | front-facing |

That is why `jump.webp` and `dive.webp` are mirrored: no frame of `dense-jump`
faces right, so flipping the group is the only way to make the jump match the gait.
`tools/derive-character-assets.py` marks them with `flip=True` and **re-measures
every state after rendering**, refusing to finish if a state that must follow the
gait ends up facing the other way.

## Third-party rights boundary

Upstream's `ASSET_LICENSE.md` states that `design/` and parts of
`assets/whale/` contain **community reference art** whose original authors and
licences have not been verified, and that upstream's licence only covers the
contributions the upstream author has the right to license. Accordingly:

- **No file from `design/references/` or `design/sources/` is used here.**
- Only runtime `assets/whale/` atlases that upstream itself plays in
  `src/renderer/app.js` were used.
- This project claims no rights over the underlying character design, and does not
  imply that upstream or DeepSeek endorses DeepSeek Arcade.

## DeepSeek disclaimer

DeepSeek Arcade is an unofficial fan project. "DeepSeek", the DeepSeek logo and
related brand assets remain the property of their owners and are not covered by
this licence.

---

## 中文摘要

- 本目录 19 张 WebP 全部派生自 <https://github.com/YunYueSama/codex-deepseek-pet>
  的运行时图集（commit `7661c8b304c5400701f91da01b1a643a207331de`）。
- 上游授权是 **大肥鱼项目署名许可 1.0**（自定义许可，**不是 MIT**），全文见
  `LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`；使用时必须署名
  「作者：YunYueSama / 仓库：https://github.com/YunYueSama/codex-deepseek-pet」。
- 本项目做过的处理：**挑帧 → 方向修正（跳跃 / 下潜水平镜像，见下）→ 按 512 基准统一缩放
  → 每个姿势组一个固定裁剪窗口 → 等比缩放到底部对齐的 192×208 画布 → 清理极低 alpha 毛边
  → 重新编码为 WebP**。没有重画、没有改色。
- **方向修正**：上游 `inbetween-walk`（走路用的那套）朝右，但整个 `dense-jump` 图集是镜像的
  （实测「脸的横向偏移」走路是 +70，dense-jump 每帧都是 −15 ~ −52）。Whale Runner 一直往右游，
  所以跳跃 / 下潜必须翻回来，否则会「倒着飞」。派生脚本对这两组标 `flip=True`，
  并且**渲染完会重新量一遍朝向**，方向不对就直接报错退出。
- **没有使用** `design/references/` 里的社区参考图；只用了上游自己运行时播放的
  动画图集。
- 本项目为非官方同人作品，与 DeepSeek 官方无关联。

[YunYueSama/codex-deepseek-pet]: https://github.com/YunYueSama/codex-deepseek-pet
