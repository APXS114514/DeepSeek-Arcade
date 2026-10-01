# Third-party notices / 第三方声明

DeepSeek Arcade is a static, dependency-free fan project. Almost everything in it
is written for this repository, but two optional character skins ship third-party
artwork. **The two are licensed differently** — read the matching section before
reusing anything.

## 1. DeepSeek Arcade code — MIT

All source code, the pixel-art drawn in code (including the classic DeepSeek whale
sprites in [`shared/whale.js`](shared/whale.js)), the maze layout data, the i18n
dictionary and the tests are released under the **MIT License** — see
[`LICENSE`](LICENSE).

## 2. YunYue Whale Girl skin — 大肥鱼项目署名许可 1.0

| | |
| --- | --- |
| **Assets** | everything under [`assets/whale-yunyue/`](assets/whale-yunyue/) |
| **Author / copyright holder** | **YunYueSama** |
| **Source** | <https://github.com/YunYueSama/codex-deepseek-pet> |
| **Licence** | **大肥鱼项目署名许可 1.0** (a custom attribution licence — *not* MIT) |
| **Licence text** | [`LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`](LICENSES/YUNYUE-WHALE-PET-LICENSE.txt) |
| **Full attribution** | [`assets/whale-yunyue/ATTRIBUTION.md`](assets/whale-yunyue/ATTRIBUTION.md) |

**These images are NOT MIT-licensed.** Redistributing or adapting them requires
keeping the upstream attribution in a place a recipient can easily find:

```text
作者：YunYueSama
仓库：https://github.com/YunYueSama/codex-deepseek-pet
```

DeepSeek Arcade ships only **derived** WebP files (frame extraction, alpha-edge
cleanup, uniform rescaling, bottom-alignment onto a shared canvas and re-encoding);
the upstream atlases are not redistributed here. Upstream explicitly does **not**
license the community reference art under `design/` — none of it is used here. See
[`assets/whale-yunyue/ATTRIBUTION.md`](assets/whale-yunyue/ATTRIBUTION.md) for the
exact source files, the upstream commit and the list of modifications.

## 3. Pixel Whale Girl skin — MIT

| | |
| --- | --- |
| **Assets** | everything under [`assets/whale-pixel/`](assets/whale-pixel/) |
| **Author / copyright holder** | **DeepSeek Whale Pet Contributors** |
| **Source** | <https://github.com/chenthreegold/deepseek-whale-pet> |
| **Licence** | **MIT** |
| **Licence text** | [`LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt`](LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt) |
| **Full attribution** | [`assets/whale-pixel/ATTRIBUTION.md`](assets/whale-pixel/ATTRIBUTION.md) |

This one is MIT as well, but it is a **separate MIT grant from a different
copyright holder**. Keep the upstream notice
(`Copyright (c) 2026 DeepSeek Whale Pet Contributors`) when redistributing it, and
do not present the derivative frames as the original authors' work. DeepSeek Arcade
only crops frames out of the upstream sprite atlas, restores the 72×88 native pixel
grid with nearest-neighbour resampling and re-encodes to lossless WebP.

## 4. DeepSeek name, logo and brand assets

"DeepSeek", the DeepSeek logo and any related names, graphics and brand assets are
**not** part of any license here and remain the property of their respective
owners. This is an unofficial fan project — not affiliated with, endorsed by, or
sponsored by DeepSeek. The presence of these skins does not imply that any upstream
author endorses DeepSeek Arcade.

---

## 中文摘要

- **代码**：MIT（见根目录 `LICENSE`）。
- **动画鲸鱼娘皮肤**（`assets/whale-yunyue/`）：来自 **YunYueSama**，
  仓库 <https://github.com/YunYueSama/codex-deepseek-pet>，授权是
  **大肥鱼项目署名许可 1.0**（自定义许可，**不是 MIT**），全文见
  `LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`。转载或改编时必须保留
  「作者：YunYueSama / 仓库：https://github.com/YunYueSama/codex-deepseek-pet」
  的署名，并说明经过修改。
- **像素鲸鱼娘皮肤**（`assets/whale-pixel/`）：来自
  <https://github.com/chenthreegold/deepseek-whale-pet>，授权 **MIT**
  （另一份独立的 MIT 授权，权利人：DeepSeek Whale Pet Contributors），全文见
  `LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt`。
- **两套素材都不是本项目原创**：根目录 `LICENSE` 只覆盖 DeepSeek Arcade
  自己的代码与原创内容。看到根目录的 MIT，不要以为 `assets/whale-yunyue/*`
  也是 MIT。
- 仓库里只保存**派生过的 WebP**（挑帧 / 裁切 / 去毛边 / 等比缩放 / 底部对齐 /
  重新编码），不重新分发上游原始图集；每个素材的来源、上游 commit 与改动都记在
  各自的 `ATTRIBUTION.md` 里。
- **DeepSeek 名称与 Logo** 不属于上述任何授权，权利归各自权利人所有；
  本项目为非官方同人作品。
