# DeepSeek Arcade

**A collection of four DeepSeek-inspired pixel mini-games** (unofficial fan project):
Whale Runner · Context Snake · Token Fall · Attention Maze.
Pure HTML + CSS + vanilla JavaScript (Canvas 2D) — **no dependencies, no build step, no backend, no runtime external requests**.
In classic mode every graphic (whale, mazes, drops, particles, UI) is drawn by Canvas code;
two optional character skins (Animated Whale Girl / Pixel Whale Girl) use third-party artwork
shipped in this repo (sources and licences below).

**English** · [中文](README.md)

> **Play online: <https://apxs114514.github.io/DeepSeek-Arcade/>**
> The homepage is the arcade lobby — pick a game. Every game page has **← Back to Arcade** in the top-left corner.

## The four games

| Game | Genre | One-liner |
| --- | --- | --- |
| 🐳 **Whale Runner** | Endless runner | Jump / dive past sea creatures — the further you swim, the faster it gets |
| 🐳 **Context Snake** | Snake | Eat TOKENs to grow your CONTEXT; don't hit the walls or yourself |
| 🐳 **Token Fall** | Catcher + resource management | Catch Token · Manage context: the higher the LOAD, the rarer COMPRESS gets and the deadlier NOISE becomes — plus the high-score, high-risk HEAVY TOKEN |
| 🐳 **Attention Maze** | Memory puzzle | Remember · Attend · Escape (12 hand-made layers) |

All four share the same set of character skins (Classic Whale / Animated Whale Girl / Pixel Whale Girl, swappable at
any time), the same zh/en bilingual UI, the same sound switch and the same pixel style.

### Token Fall's difficulty curve

Token Fall expresses difficulty through five **LOAD 1 ~ 5** stages (roughly 0 / 30 / 60 / 100 / 150 seconds):

- **LOAD 1**: sparse drops, one object on screen, COMPRESS is common and **HEAVY TOKEN does not exist yet** — a clear beginner phase;
- **LOAD 2 ~ 3**: HEAVY TOKEN appears, NOISE gets more frequent, COMPRESS starts to feel precious;
- **LOAD 4 ~ 5**: several targets on screen at once, so you must actively choose what to catch;
- **after 150 seconds** you enter an endless high-pressure stage, but **every value is capped**: brutally hard, yet never mathematically unwinnable.

Difficulty does not come from fall speed alone — it comes from **resource pressure, COMPRESS scarcity and the cost of mistakes**:

- **COMPRESS gets weaker every LOAD**: base compression −256 → −128; chaining them in quick succession decays (100% → 75% → 50%) and low Context pays even less — so late game you do *not* grab every COMPRESS you see;
- **NOISE hits harder every LOAD**: CONTEXT +128 → +224, so one bad catch late in a run can push you to the brink of overflow;
- **the overflow rescue window shrinks**: 2.0s → 1.2s (never shorter — mobile players still need time to react);
- **HEAVY TOKEN** (from LOAD 2): +35 points but CONTEXT +96 — the classic high-score-vs-risk choice. It counts as a real token, so your CLEAN combo continues;
- **COMPRESS guarantees stay** so pure RNG can never make a run unwinnable, but the higher the LOAD the more extreme the threshold and the longer the wait — and you always have to move over and catch it yourself.

### Attention Maze: attention and KEYs

Every Attention Maze layer can only be solved by **reading the weights** — neither the KEY number nor its position gives
anything away:

- later layers show **5–6 KEYs** at once; the attention lines and weight labels get busier, but every label carries its
  KEY number (`K4 0.83`) and the strongest weight is highlighted on top of that;
- in **MULTI-HEAD** layers, HEAD 1 and HEAD 2 may favour different KEYs, and the answer only exists in the
  **combination of both heads** — remembering a single round's maximum regularly leads you to the wrong KEY;
- the correct KEY, the weights and the maps all live in `games/attention-maze/levels.js` and are **completely identical
  every run and every restart** — the answer is never randomised;
- the answers are deliberately spread across KEY numbers and map positions: no KEY can be guessed by "always pick it",
  and the answer is never always the right-most KEY or the one closest to the exit.

## Technical highlights

- **No dependencies / no build**: no `package.json`, no bundler, no framework, no CDN, no external audio files;
  classic mode draws all of its art in code, and the two optional skins use images **shipped in this repo** (zero runtime external requests);
- **One copy of the art**: the whale sprite lives only in `shared/whale.js` — Whale Runner, Token Fall and the lobby previews all read it;
- **One character switch**: `arcade.characterSkin` is global — cycle it in the lobby and all four games
  plus the lobby previews switch at once (a failed image load falls back to the classic whale);
- **Lazy, per-skin loading**: only the current skin's images are downloaded — a Classic Whale player never fetches a
  single third-party asset;
- **One dictionary**: all copy lives in `shared/i18n.js`, and canvas text follows the language instantly;
- **One sound switch**: `arcade.sound` is global — mute in any game and the other three go quiet too (old per-game settings are migrated automatically);
- **Crisp on Retina**: canvases size their backing store by DPR (capped at 3) while all collision stays in fixed logical coordinates;
- **Test before deploy**: GitHub Actions runs the full test suite first and only deploys Pages when it passes.

## Character skin: Classic Whale / Animated Whale Girl / Pixel Whale Girl

The arcade ships three character appearances, and **Classic Whale is the default** (existing players are never
silently re-skinned):

| Skin | Appearance | Notes |
| --- | --- | --- |
| `classic` | the code-drawn pixel DeepSeek whale | default; every hitbox and feel value stays exactly as before |
| `yunyue` | **Animated Whale Girl** — high-res chibi illustration with an 8-frame walk cycle | optional, **visual only** — no gameplay values change |
| `pixel` | **Pixel Whale Girl** — native 72×88 pixel grid, lossless WebP | optional, **visual only** — no gameplay values change |

- The lobby button **cycles through three states**:
  🐳 Classic Whale → 🐳 Animated Whale Girl → 🐳 Pixel Whale Girl → back to Classic. The four card previews update
  instantly, with no page reload;
- The choice is stored in `localStorage: arcade.characterSkin` and shared by all four games. A legacy `whalechan`
  value is migrated to `yunyue` (those players had actively picked a whale girl and must not silently fall back to
  the classic whale); anything invalid falls back to `classic`;
- The skin is **cosmetic only**: high scores, Attention Maze progress, the sound switch, the language and the
  difficulty are untouched;
- Assets are **lazily loaded per skin**: a Classic Whale player downloads no third-party image at all. Hovering the
  skin button warms up the next skin in the background;
- While assets are missing or fail to load the game keeps drawing the classic whale and switches over automatically
  once they arrive — no blank screen, no vanished character, no errors;
- Animation frames are a pure function of time (`frame = floor(time / frameMs) % frameCount`), so they freeze together
  with the game world when you pause or switch tabs;
- Illustrated skins turn `imageSmoothingEnabled` on, the pixel skin turns it off, and the Canvas state is always
  restored after each draw.

Per game:

- **Whale Runner**: the ground state plays the walk/run cycle, jumping uses an airborne pose and diving a low pose,
  and game over uses the failure pose; the feet always sit on the seabed and the hitboxes
  (`BOX` / `MID_BOTTOM` / `LOW_BOTTOM`) are untouched;
- **Context Snake**: only the **head** cell is re-skinned with a small avatar — the body stays Context pixels.
  DEEP THINK shows the working avatar; the grid size and collision are unchanged, and it is mirrored when moving left;
- **Token Fall**: the bottom player becomes the whale girl — left/right movement plays the walk cycle and stopping
  returns to idle, DEEP THINK shows her working, the overflow rescue shows her startled and game over shows her defeated;
- **Attention Maze**: a cropped head icon (34px visually, still exactly 1 logical cell), mirrored when moving left.

Both artworks come from open-source repositories, but under **different licences** — do not conflate them:

- **Animated Whale Girl** — [`YunYueSama/codex-deepseek-pet`](https://github.com/YunYueSama/codex-deepseek-pet),
  licensed under **大肥鱼项目署名许可 1.0** (a custom attribution licence, **not MIT**);
- **Pixel Whale Girl** — [`chenthreegold/deepseek-whale-pet`](https://github.com/chenthreegold/deepseek-whale-pet),
  licensed under the **MIT License**.

Source files, upstream commits, the modifications made and the full licence texts live in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
[`assets/whale-yunyue/ATTRIBUTION.md`](assets/whale-yunyue/ATTRIBUTION.md),
[`assets/whale-pixel/ATTRIBUTION.md`](assets/whale-pixel/ATTRIBUTION.md) and `LICENSES/`.

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

All four games share one headless test harness (stub DOM + stub Canvas, no browser needed). 1050+ assertions cover
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
│   ├── character.js                      Character-skin registry (three skins) + lazy loading, frame clock, fallback
│   ├── whale.js                          The DeepSeek whale pixel data (single copy)
│   └── arcade.css                        Design tokens + page shell
├── games/
│   ├── runner/                           Whale Runner
│   ├── snake/                            Context Snake
│   ├── token-fall/                       Token Fall
│   └── attention-maze/                   Attention Maze (levels.js data + game.js engine)
├── assets/whale-yunyue/                  Animated Whale Girl runtime assets (19 derived WebP) + ATTRIBUTION.md
├── assets/whale-pixel/                   Pixel Whale Girl runtime assets (20 lossless WebP) + ATTRIBUTION.md
├── tools/derive-character-assets.py      Asset derivation script (dev-only, not used at runtime)
├── test/                                 Headless tests (stub DOM + stub Canvas)
├── docs/                                 architecture.md · testing.md (+ .en.md)
├── LICENSES/YUNYUE-WHALE-PET-LICENSE.txt Full licence text for the Animated Whale Girl (custom, not MIT)
├── LICENSES/CHENTHREEGOLD-WHALE-PET-MIT.txt Full MIT text for the Pixel Whale Girl
├── THIRD_PARTY_NOTICES.md                Third-party notices (MIT code / each artwork under its own licence)
├── LICENSE                               MIT (**code only**)
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
- **The Animated Whale Girl artwork** comes from <https://github.com/YunYueSama/codex-deepseek-pet>
  (大肥鱼项目署名许可 1.0 — **not MIT**); **the Pixel Whale Girl artwork** comes from
  <https://github.com/chenthreegold/deepseek-whale-pet> (MIT). Neither is covered by this project's MIT grant.
- **The DeepSeek name, logo, related graphics and brand assets are NOT covered by the MIT license**; all rights remain
  with their respective owners. The whale pixel art is derived from the official DeepSeek logo, as a fan tribute.
- This is an **unofficial fan project**, not affiliated with DeepSeek. Whale Runner's gameplay pays homage to
  Chrome's offline dino game.
- Zero dependencies, no build step — feel free to swap the character or add another game.