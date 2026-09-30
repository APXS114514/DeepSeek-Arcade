# DeepSeek Arcade

**A collection of four DeepSeek-inspired pixel mini-games** (unofficial fan project):
Whale Runner · Context Snake · Token Fall · Attention Maze.
Pure HTML + CSS + vanilla JavaScript (Canvas 2D) — **no dependencies, no build step, no image files, no backend**.

**English** · [中文](README.md)

> **Play online: <https://apxs114514.github.io/DeepSeek-Arcade/>**
> The homepage is the arcade lobby — pick a game. Every game page has **← Back to Arcade** in the top-left corner.

## The four games

| Game | Genre | One-liner |
| --- | --- | --- |
| 🐳 **Whale Runner** | Endless runner | Jump / dive past sea creatures — the further you swim, the faster it gets |
| 🐳 **Context Snake** | Snake | Eat TOKENs to grow your CONTEXT; don't hit the walls or yourself |
| 🐳 **Token Fall** | Catcher + resource management | Catch Token · Manage context: grab COMPRESS to shrink your context, dodge NOISE |
| 🐳 **Attention Maze** | Memory puzzle | Remember · Attend · Escape (12 hand-made layers) |

All four share the same DeepSeek whale, the same zh/en bilingual UI, the same sound switch and the same pixel style.

## Technical highlights

- **No dependencies / no build**: no `package.json`, no bundler, no framework, no external image or audio files;
- **One copy of the art**: the whale sprite lives only in `shared/whale.js` — Whale Runner, Token Fall and the lobby previews all read it;
- **One dictionary**: all copy lives in `shared/i18n.js`, and canvas text follows the language instantly;
- **One sound switch**: `arcade.sound` is global — mute in any game and the other three go quiet too (old per-game settings are migrated automatically);
- **Crisp on Retina**: canvases size their backing store by DPR (capped at 3) while all collision stays in fixed logical coordinates;
- **Test before deploy**: GitHub Actions runs the full test suite first and only deploys Pages when it passes.

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

## Tests

```bash
bash test/run.sh          # same as node test/run.mjs
```

All four games share one headless test harness (stub DOM + stub Canvas, no browser needed). 700+ assertions cover
gameplay rules, a **BFS solvability check for all 12 Attention Maze layers**, i18n dictionary parity, relative paths
and localStorage key collisions, plus the v1.0 structural contracts (global sound, shared assets, level data split,
CI config, LICENSE). Details in [docs/testing.en.md](docs/testing.en.md).

CI runs exactly this command: if the tests fail, Pages is not deployed (see `.github/workflows/pages.yml`).

## Directory structure

```text
.
├── index.html / arcade.css / arcade.js   Arcade lobby (GitHub Pages homepage)
├── shared/                               Shared by every page
│   ├── i18n.js                           zh/en dictionary + language switching
│   ├── audio.js                          Web Audio tones + the global Sound switch
│   ├── whale.js                          The DeepSeek whale pixel data (single copy)
│   └── arcade.css                        Design tokens + page shell
├── games/
│   ├── runner/                           Whale Runner
│   ├── snake/                            Context Snake
│   ├── token-fall/                       Token Fall
│   └── attention-maze/                   Attention Maze (levels.js data + game.js engine)
├── test/                                 Headless tests (stub DOM + stub Canvas)
├── docs/                                 architecture.md · testing.md (+ .en.md)
├── LICENSE                               MIT (code only)
├── README.md / README.en.md              Project overview (zh / en)
└── .github/workflows/pages.yml           Test first, then deploy to GitHub Pages
```

## Docs

- [docs/architecture.en.md](docs/architecture.en.md) — shared modules, script load order, Canvas & DPR, localStorage keys,
  mobile support, tuning knobs, and how each of the four games is implemented.
- [docs/testing.en.md](docs/testing.en.md) — how to run the tests, what each suite covers, the BFS layer validator,
  and how to add tests.

## Notice & License

- **The code** is released under the **MIT License** — see [LICENSE](LICENSE).
- **The DeepSeek name, logo, related graphics and brand assets are NOT covered by the MIT license**; all rights remain
  with their respective owners. The whale pixel art is derived from the official DeepSeek logo, as a fan tribute.
- This is an **unofficial fan project**, not affiliated with DeepSeek. Whale Runner's gameplay pays homage to
  Chrome's offline dino game.
- Zero dependencies, no build step — feel free to swap the character or add another game.
