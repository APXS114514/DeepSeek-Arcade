# Pixel Whale Girl — asset attribution / 素材署名

Every image in `assets/whale-pixel/` is **derived artwork** made from the
open-source project **[chenthreegold/deepseek-whale-pet]**, which is released under
the **MIT License** (`Copyright (c) 2026 DeepSeek Whale Pet Contributors`). The
full upstream licence text is kept verbatim at
[`../../LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt`](../../LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt).

## Source snapshot

| | |
| --- | --- |
| **Upstream repository** | <https://github.com/chenthreegold/deepseek-whale-pet> |
| **Commit used** | `332e0a6d2e585d521e886bd4ea0c87e8a8e06c44` |
| **Upstream licence** | MIT — `Copyright (c) 2026 DeepSeek Whale Pet Contributors` |
| **Licence text kept at** | [`../../LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt`](../../LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt) |
| **Upstream file used** | `codex-package/deepseek-whale-girl/spritesheet.webp` (1536×1872, 8 columns × 9 rows, 192×208 cells) |
| **Frame definitions taken from** | `scripts/build_atlas.py` (row order and per-row frame content) and `desktop_pet.py` / `whale_pet_preview.html` (animation sets) |
| **Local files** | 20 lossless WebP files in this directory |
| **Derivation script** | [`../../tools/derive-character-assets.py`](../../tools/derive-character-assets.py) |

## Which upstream frame each local file comes from

The upstream atlas is a 2× nearest-neighbour upscale of a native **72×88** pixel
grid (`scripts/draw_pet.py` draws on 72×88, `build_atlas.py: to_cell()` scales by 2).
This project reverses that exact upscale with nearest-neighbour resampling, so every
file below is back on the original 72×88 pixel grid — **no interpolation, no
invented pixels**. Rows are 0-based, top to bottom, in the order declared by
`build_atlas.py`.

| Local file | Upstream row | Upstream frame(s) | Animation |
| --- | --- | --- | --- |
| `idle-0..2.webp` | 0 `idle` | 0, 1, 3 (play order `0,1,0,2`) | 待机上下浮动 `dy = 0, +1, 0, −1` |
| `walk-0..2.webp` | 1 `running-right` | 0, 1, 2 (play order `0,1,2,1,0,1,2,1`) | 上游完整一步：3 个姿势 + 2/4px 位移，8 帧一循环 |
| `jump-0..3.webp` | 4 `jumping` | 0, 1, 2, 3 (play order `0,1,2,1,3`) | 蹲 → 腾空 → 落地 |
| `dive.webp` | 4 `jumping` | 0 | 同一行里最低的姿态（`draw_whale(dy=3)`），用作下潜 |
| `think-0..1.webp` | 8 `review` | 0, 1 | `arm="think"` + `eye="up"` + 星光，工作 / 思考 |
| `startle-0..1.webp` | 6 `waiting` | 0, 1 | 冒号抖动，状况外的慌张 |
| `blocked-0..2.webp` | 5 `failed` | 0, 1, 3 (play order `0,1,0,2,0,1,0,2`) | 垂手 + 汗 + 哭，失败 / 崩溃 |
| `head.webp` | 0 `idle` | 0 | 方形头像 crop |
| `head-think.webp` | 8 `review` | 0 | 方形头像 crop（Deep Think 用） |

## Modifications (this project's changes)

Performed on the upstream material:
**cropped / frame extracted / nearest-neighbour rescaled to the native 72×88 grid /
alpha edge cleaned / deduplicated / re-encoded to lossless WebP.**

Nothing was redrawn, recoloured or blurred. Details:

1. **Frame extraction** — cells of the upstream sprite atlas, cropped to the inner
   144×176 sprite box (`to_cell()` centres it at offset 24,16 inside each 192×208
   cell).
2. **Pixel-grid recovery** — nearest-neighbour downscale 144×176 → 72×88, exactly
   undoing upstream's 2× upscale. Nearest-neighbour is required here; bilinear
   resampling would destroy the pixel art.
3. **Alpha edge cleanup** — alpha values below 8/255 are zeroed.
4. **Frame deduplication** — upstream frames that are byte-identical (the 8-frame
   run is only 3 distinct poses, the 8-frame failure loop only 3) are stored **once**;
   the original playback order is preserved by a frame-index sequence in
   `shared/character.js`. This is why 20 files cover 9 upstream animation sets.
5. **Square head crops** — for the tiny Snake / Maze avatars, derived from
   `idle` / `review` with nearest-neighbour resampling to 56×56.
6. **Format change** — re-encoded PNG → **WebP (lossless)** so the pixel grid stays
   bit-exact. Total runtime payload ≈14 KB.

This project does **not** claim authorship of the character. Please credit the
upstream project and keep its MIT notice when redistributing these files.

## DeepSeek disclaimer

Upstream describes the artwork as pixel-drawn by DeepSeek and reviewed by a
third-party multimodal model; DeepSeek Arcade is an unofficial fan project and is
not affiliated with, endorsed by, or sponsored by DeepSeek or by the upstream
authors.

---

## 中文摘要

- 本目录 20 张 WebP 全部派生自
  <https://github.com/chenthreegold/deepseek-whale-pet> 的 Codex 图集
  （commit `332e0a6d2e585d521e886bd4ea0c87e8a8e06c44`），上游授权为 **MIT**
  （`Copyright (c) 2026 DeepSeek Whale Pet Contributors`），全文见
  `LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt`。
- 本项目做过的处理：**裁格 → 用最近邻还原 72×88 原生像素网格 → 清理极低 alpha
  毛边 → 相同帧去重 → 重新编码为无损 WebP**。没有重画、没有改色、没有用双线性
  插值（像素画必须保持硬边）。
- 去重后 20 个文件覆盖上游 9 组动画；播放顺序用帧索引序列还原。
- 角色形象不是本项目的作品，转载时请保留上游 MIT 声明。

[chenthreegold/deepseek-whale-pet]: https://github.com/chenthreegold/deepseek-whale-pet
