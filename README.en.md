# DeepSeek Arcade

**A collection of six DeepSeek-inspired pixel mini-games** (unofficial fan project):
Whale Runner · Context Snake · Token Fall · Attention Maze · Context Breaker · Hallucination Hunt.
Pure HTML + CSS + vanilla JavaScript (Canvas 2D) — **no dependencies, no build step, no backend, no runtime external requests**.
In classic mode every graphic (whale, mazes, drops, particles, UI) is drawn by Canvas code;
an optional Whale Girl appearance uses third-party artwork shipped in this repo (source and licence at the end).

**English** · [中文](README.md)

> **Play online: <https://apxs114514.github.io/DeepSeek-Arcade/>**
> The homepage is the arcade lobby — pick a game. Every game page has **← Back to Arcade** in the top-left corner.

## The six games

| Game | Genre | One-liner |
| --- | --- | --- |
| 🐳 **Whale Runner** | Endless runner | Jump / dive past sea creatures — the further you swim, the faster it gets |
| 🐳 **Context Snake** | Snake | Eat TOKENs to grow your CONTEXT; don't hit the walls or yourself |
| 🐳 **Token Fall** | Catcher + resource management | Catch Token · Manage context: the higher the LOAD, the rarer COMPRESS gets and the deadlier NOISE becomes — plus the high-score, high-risk HEAVY TOKEN |
| 🐳 **Attention Maze** | Memory puzzle | Remember · Attend · Escape (12 hand-made layers) |
| 🐳 **Context Breaker** | Brick breaker | Smash CONTEXT blocks with a token ball, clear layered stages |
| 🧠 **Hallucination Hunt** | Auditing an AI answer | Read the response · Find the lie · Verify the claim |

All six share the same character skins (`arcade.characterSkin`: the code-drawn Classic Whale by default, swappable to
Whale Girl), the same zh/en bilingual UI, the same sound switch and the same pixel style — **cosmetic only, no gameplay
value changes**.

Details live in the docs — the README does not repeat them:

- **[docs/architecture.en.md](docs/architecture.en.md)** — Token Fall's full LOAD 1~5 table, Attention Maze's
  KEY / MULTI-HEAD mechanics and all 12 layer designs, Canvas & DPR, localStorage keys, mobile support, tuning knobs,
  and how each game is implemented;
- **[docs/testing.en.md](docs/testing.en.md)** — how to run the tests, what each suite covers, how to add tests.

## Run locally

Either:

1. **Open `index.html` directly** (no server needed)
2. Any static server (identical to production):
   ```bash
   python3 -m http.server 8080
   # open http://localhost:8080/
   ```

> Every asset is referenced with **relative paths**, so the site works from `/` or from a sub-path such as `/DeepSeek-Arcade/`
> (enforced by `test/paths.test.mjs`).

## Release and caching

The site is purely static with no build step, so every local CSS / JS asset is cache-busted with a query string:

```html
<link rel="stylesheet" href="shared/arcade.css?v=1.6.2">
<script src="game.js?v=1.6.2"></script>
```

**The single source of truth is `VERSION` in [`shared/version.js`](shared/version.js)**, which also renders the
version badge in the bottom-right corner. After changing any static asset:

1. bump `VERSION` in `shared/version.js` only;
2. run `node tools/bump-asset-version.mjs` — it syncs every `?v=` in the HTML files (idempotent);
3. run `bash test/run.sh` — the tests assert that **every local css/js reference carries `?v=` equal to the current
   version** and that no external / `data:` URL gained a pointless parameter.

> Do not skip this: publishing new HTML without bumping `?v=` lets browsers keep serving the old CSS / JS
> alongside the new HTML — a mixed version. Changing `?v=` makes the browser treat the asset as a new URL.
> CI can run `node tools/bump-asset-version.mjs --check` as a check-only gate.

## Tests

```bash
bash test/run.sh          # same as node test/run.mjs
```

All six games share one headless harness (stub DOM + stub Canvas, no browser needed), covering gameplay rules,
a **BFS solvability check for all 12 Attention Maze layers**, i18n dictionary parity, relative paths and
localStorage key collisions. CI runs exactly this command: if the tests fail, Pages is not deployed.

## Notice & License

- **The code** is released under the **MIT License** — see [LICENSE](LICENSE).
- **The Whale Girl artwork** comes from [`YunYueSama/codex-deepseek-pet`](https://github.com/YunYueSama/codex-deepseek-pet)
  and is licensed under **大肥鱼项目署名许可 1.0** (a custom attribution licence, **not MIT**) — it is
  **NOT covered by the MIT license** of this project. The full text is in
  [`LICENSES/YUNYUE-WHALE-PET-LICENSE.txt`](LICENSES/YUNYUE-WHALE-PET-LICENSE.txt); source files, the upstream commit
  and the modifications made are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **The DeepSeek name, logo, related graphics and brand assets are NOT covered by the MIT license**; all rights remain
  with their respective owners. The whale pixel art is derived from the official DeepSeek logo, as a fan tribute.
- This is an **unofficial fan project**, not affiliated with DeepSeek. Whale Runner's gameplay pays homage to
  Chrome's offline dino game.
- Zero dependencies, no build step — feel free to swap the character or add another game.
