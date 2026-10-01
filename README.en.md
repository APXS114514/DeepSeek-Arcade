# DeepSeek Arcade

**A collection of four DeepSeek-inspired pixel mini-games** (unofficial fan project):
Whale Runner · Context Snake · Token Fall · Attention Maze.
Pure HTML + CSS + vanilla JavaScript (Canvas 2D) — **no dependencies, no build step, no backend, no runtime external requests**.
In classic mode every graphic (whale, mazes, drops, particles, UI) is drawn by Canvas code;
the optional **Whale-chan** skin uses local third-party artwork (CC BY 4.0 — see below).

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

All four share the same DeepSeek whale, the same zh/en bilingual UI, the same sound switch and the same pixel style.

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
  classic mode draws all of its art in code, and the optional Whale-chan skin uses images **shipped in this repo**;
- **One copy of the art**: the whale sprite lives only in `shared/whale.js` — Whale Runner, Token Fall and the lobby previews all read it;
- **One character switch**: `arcade.characterSkin` is global — pick Classic Whale or Whale-chan in the lobby and all four games
  plus the lobby previews switch at once (a failed image load falls back to the classic whale);
- **One dictionary**: all copy lives in `shared/i18n.js`, and canvas text follows the language instantly;
- **One sound switch**: `arcade.sound` is global — mute in any game and the other three go quiet too (old per-game settings are migrated automatically);
- **Crisp on Retina**: canvases size their backing store by DPR (capped at 3) while all collision stays in fixed logical coordinates;
- **Test before deploy**: GitHub Actions runs the full test suite first and only deploys Pages when it passes.

## Character skin: Classic Whale / Whale-chan

The arcade ships two character appearances, and **Classic Whale is the default** (existing players are never
silently re-skinned):

| Skin | Appearance | Notes |
| --- | --- | --- |
| `classic` | the code-drawn pixel DeepSeek whale | default; every hitbox and feel value stays exactly as before |
| `whalechan` | third-party illustrated character "Whale-chan" | optional, **visual only** — no gameplay values change |

- Toggle it with the **🐳 Classic / 🐳 Whale-chan** button at the top of the lobby; the four card previews update instantly;
- The choice is stored in `localStorage: arcade.characterSkin` and shared by all four games — no page reload needed;
- The skin is **cosmetic only**: high scores, Attention Maze progress, the sound switch and the language are untouched;
- If an image fails to load or is blocked, the game draws the classic whale instead and keeps running.

Per game:

- **Whale Runner**: stand / run / jump / dive poses, feet always on the seabed, hitbox untouched;
- **Context Snake**: only the **head** cell is re-skinned — the body stays Context pixels; DEEP THINK shows the working pose;
- **Token Fall**: the bottom player becomes Whale-chan; DEEP THINK shows her working, and the overflow rescue shows her startled;
- **Attention Maze**: a cropped head icon (34px visually, still exactly 1 logical cell), mirrored when moving left.

### Whale-chan artwork licence (important)

Whale-chan is **not** drawn by DeepSeek Arcade and is **not covered by the MIT license**:

- **Author / copyright holder**: **Er1c0v0**
- **Source**: GitHub repository [`Er1c0v0/dsh-whale-pet`](https://github.com/Er1c0v0/dsh-whale-pet) (the `character/` directory)
- **Licence**: **CC BY 4.0** (Creative Commons Attribution 4.0 International) — full text in [`LICENSES/CC-BY-4.0.txt`](LICENSES/CC-BY-4.0.txt)
- **Full attribution and list of modifications**: [`assets/whale-chan/ATTRIBUTION.md`](assets/whale-chan/ATTRIBUTION.md)
- **Third-party notices**: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

> The root [`LICENSE`](LICENSE) is **MIT** and covers this project's **code** only.
> Do not assume `assets/whale-chan/*` is MIT — it is **CC BY 4.0**, and attribution to `Er1c0v0` must be kept
> if you redistribute or adapt it.

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

All four games share one headless test harness (stub DOM + stub Canvas, no browser needed). 900+ assertions cover
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
├── assets/whale-chan/                    Whale-chan runtime assets (derived WebP) + ATTRIBUTION.md
├── test/                                 Headless tests (stub DOM + stub Canvas)
├── docs/                                 architecture.md · testing.md (+ .en.md)
├── LICENSES/CC-BY-4.0.txt                Full licence text for the Whale-chan artwork (not MIT)
├── THIRD_PARTY_NOTICES.md                Third-party notices (MIT code / CC BY 4.0 artwork)
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
- **The Whale-chan character artwork** is third-party material by **Er1c0v0** (<https://github.com/Er1c0v0/dsh-whale-pet>),
  licensed under **CC BY 4.0** and **NOT covered by the MIT license** — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
  and [assets/whale-chan/ATTRIBUTION.md](assets/whale-chan/ATTRIBUTION.md).
- **The DeepSeek name, logo, related graphics and brand assets are NOT covered by the MIT license**; all rights remain
  with their respective owners. The whale pixel art is derived from the official DeepSeek logo, as a fan tribute.
- This is an **unofficial fan project**, not affiliated with DeepSeek. Whale Runner's gameplay pays homage to
  Chrome's offline dino game.
- Zero dependencies, no build step — feel free to swap the character or add another game.
