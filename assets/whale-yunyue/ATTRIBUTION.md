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
| `jump.webp` | `dense-jump.png` (cell 512) | 9 | `clips.jump` 腾空段的一帧（举臂屈膝） |
| `dive.webp` | `dense-jump.png` (cell 512) | 21 | `clips.land` 的落地压缩帧，用作低姿态 / 下潜 |
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
3. **Fixed crop window per pose group** — all frames of one state (e.g. the whole
   walk cycle) share a single crop rectangle and a single transform, so the
   character cannot jitter or drift between frames.
4. **Uniform rescale** — the whole set is scaled by one factor (0.4638) into a
   shared **192×208** RGBA canvas; the original aspect ratio is preserved.
5. **Bottom alignment** — each pose group's alpha bounding box is aligned to the
   same ground baseline, so the character's feet always land on the same line.
6. **Alpha edge cleanup** — alpha values below 8/255 are zeroed to remove faint
   edge halos. RGB values are untouched.
7. **Format change** — re-encoded from PNG to **WebP (quality 88)** to keep the
   runtime payload small (≈215 KB for all 19 files).

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
- 本项目做过的处理：**挑帧 → 按 512 基准统一缩放 → 每个姿势组一个固定裁剪窗口 →
  等比缩放到底部对齐的 192×208 画布 → 清理极低 alpha 毛边 → 重新编码为 WebP**。
  没有重画、没有改色。
- **没有使用** `design/references/` 里的社区参考图；只用了上游自己运行时播放的
  动画图集。
- 本项目为非官方同人作品，与 DeepSeek 官方无关联。

[YunYueSama/codex-deepseek-pet]: https://github.com/YunYueSama/codex-deepseek-pet
