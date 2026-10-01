# Architecture & implementation notes

This document holds the internals of DeepSeek Arcade. For a quick start see [README](../README.en.md),
for the test story see [docs/testing.en.md](testing.en.md).

**English** · [中文](architecture.md)

## Design principles

- **No dependencies, no build, no runtime external requests**: all four games are plain HTML + CSS + JavaScript
  (Canvas 2D). In classic mode every piece of art (whale, mazes, falling tokens, particles, UI) is drawn with
  `fillRect` / `fillText` — no external files at all. The optional **Whale-chan** skin loads third-party WebP files
  **shipped inside this repo** (`assets/whale-chan/`, CC BY 4.0) — no CDN, no third-party domain at runtime.
- **No bundler, no framework, no ES modules**: each page loads plain `<script src>` tags in order, so "open the HTML
  file directly", "any static server" and "a GitHub Pages sub-path" all behave identically.
- **Gameplay is not shared across games**: `shared/` only holds things that are genuinely common (copy, the sound
  switch, the whale pixel data). No abstractions created just to look uniform.

## The four shared modules (`shared/`)

| File | Role |
| --- | --- |
| `shared/i18n.js` | The single dictionary (zh / en) plus language detection and switching (`arcade.lang`, with legacy `whaleRunner.lang` support). Pages use `data-i18n` attributes or `I18N.t('key')`; canvas text goes through `I18N.t` too, so switching language never needs a reload. |
| `shared/audio.js` | Web Audio helpers **and the global Sound switch**. `ArcadeAudio.tone({...})` synthesises tones on the fly (no audio files); `isEnabled(legacyKey)` / `setEnabled(on)` / `toggle()` read and write `arcade.sound`, and `tone()` stays silent while muted. |
| `shared/whale.js` | The **single copy** of the DeepSeek whale pixel art: `NORMAL_A` / `NORMAL_B` (24×18 swim frames), `DIVE_A` / `DIVE_B` (24×13 dive frames) plus `width / height / mirror / rotate` helpers. Whale Runner, Token Fall and the lobby previews all read it. |
| `shared/character.js` | The global character skin **Classic Whale / Whale-chan**: reads and writes `arcade.characterSkin`, preloads the nine Whale-chan WebP files once, broadcasts `onChange`, and exposes `draw()`, which returns `false` when it cannot draw so the caller can fall back to the classic whale. |

**Sound precedence (decided on first read)**: `arcade.sound` > the current game's own legacy key (`whaleRunner.sound` /
`arcade.snake.sound` / `arcade.tokenFall.sound` / `arcade.attentionMaze.sound`) > default `on`.
A legacy value is copied into `arcade.sound` as a migration but the old key is **never deleted**; migration only looks at
the current game's own key, so one game's mute state cannot leak into another. Whale Runner keeps its own three-stage
`beep()` envelope — only the switch is unified.

## Load order (important)

```html
<script src="../../shared/i18n.js"></script>
<script src="../../shared/audio.js"></script>
<script src="../../shared/whale.js"></script>     <!-- pages that draw the whale -->
<script src="../../shared/character.js"></script> <!-- character skin -->
<script src="levels.js"></script>                 <!-- Attention Maze: level data -->
<script src="game.js"></script>
```

`shared/whale.js` and `shared/character.js` must come before the game script, and Attention Maze's `levels.js` must
come before `game.js`. A missing file never crashes the game; it logs a clear warning to the console instead.

> `shared/character.js` derives the asset directory from **its own script URL** (`shared/character.js` →
> `../assets/whale-chan/`), so the site root, a `/DeepSeek-Arcade/` sub-path and `file://` all work without any
> configuration, and a root-absolute `/assets/...` path can never appear.

## Canvas & DPR

All four games follow the same pattern: **logical coordinates are fixed** (Whale Runner scales everything with `PX`,
Token Fall is 380×560, Attention Maze is 420×354). DPR is only used to set `canvas.width/height` and to call
`ctx.scale(dpr, dpr)`, capped at 3 to avoid overdrawing on high-density screens. All collision happens in logical
coordinates, so changing screens or DPR never changes the hitboxes. Every canvas uses `image-rendering: pixelated`
so scaled-up pixel art keeps hard edges.

## localStorage keys (cross-game conventions)

| Key | Notes |
| --- | --- |
| Language | `arcade.lang` (`zh`/`en`); **reads the legacy `whaleRunner.lang`** so existing players keep their choice |
| Whale Runner high score | `whaleRunner.high` (original key kept, history preserved) |
| Context Snake high score | `arcade.snake.high` |
| Token Fall high score | `arcade.tokenFall.high` |
| Attention Maze progress | `arcade.attentionMaze.progress` (highest unlocked layer + per-layer stars / best time / best moves — not a score) |
| Sound switch | global `arcade.sound`; legacy keys `whaleRunner.sound`, `arcade.snake.sound`, `arcade.tokenFall.sound`, `arcade.attentionMaze.sound` |
| Copy | Maintained in **one place**: `shared/i18n.js`. Pages use `data-i18n` attributes or `I18N.t('key')` |
| Audio | Whale Runner keeps its own `beep()` (tuned envelope, untouched); the other games use `shared/audio.js` |
| Navigation | Plain HTML page loads (no SPA router), so the browser back button works normally |

## Navigation & GitHub Pages

Pages are plain HTML documents with no SPA router, so the browser back button just works.
Every asset uses a **relative path**, so the site works both at the domain root and under a Project Site sub-path such
as `/DeepSeek-Arcade/` (`test/paths.test.mjs` statically enforces that there is no `src="/..."` or `href="/..."`).

## Deployment

Pushing to `main` publishes automatically. `.github/workflows/pages.yml` has two jobs: **Run tests**
(`actions/setup-node` with Node 20, then `node test/run.mjs`) and **Deploy Pages** (`needs: test`, so a failing test
suite blocks the deploy), which uses `actions/configure-pages` + `upload-pages-artifact` + `deploy-pages` to publish the
repository root to <https://apxs114514.github.io/DeepSeek-Arcade/>. The repository's root `index.html` is the lobby.

## Mobile support

- **Narrow screens (≤720px)**: the card loses its padding, canvases fill the width, buttons are at least 48px tall,
  pull-to-refresh is disabled (`overscroll-behavior: none`) and canvases use `touch-action: none`, so playing never
  scrolls the page.
- **Landscape (height ≤560px)**: the title and tips are hidden to give the stage more room. Whale Runner shows a
  "↻ rotate your phone" hint and a `⛶` fullscreen button (which also tries to lock the orientation); Context Snake and
  Attention Maze scale the canvas by height and flatten their controls into one row, so canvas + controls fit on one screen.
- **Measured (simulated device sizes)**: on one phone the runner canvas goes from 368×82 in portrait to 784×174 in
  landscape (2.2× wider); the snake canvas is 339×240 in landscape with the D-pad and buttons above the fold.
- **Touch input**: the runner uses jump / dive buttons; the snake uses a D-pad **plus** canvas swipes (22px threshold,
  small drags count as taps); Token Fall uses **two large arrow buttons (hold to keep moving)** plus horizontal canvas
  dragging, and releases on `pointerup` / `pointercancel` / `pointerleave` / `lostpointercapture` as well as a document-level
  fallback — sliding off a button, an interrupted gesture or switching apps can never leave the whale running, and
  multi-touch is merged correctly. Attention Maze uses a **four-way D-pad (hold to keep stepping, at most one cell per
  frame)** plus canvas swipes (one cell per swipe, never a sustained walk); internally it tracks a press-ordered direction
  stack keyed by input source, so releasing any source recomputes immediately, and a document fallback covers fingers
  lifted outside the buttons.
- Every canvas sets `image-rendering: pixelated` to keep hard pixel edges when CSS scales it up; DPR is capped at 3.

## What to tweak (tuning knobs)

- **Whale Runner difficulty**: `START_SPEED` / `MAX_SPEED` / `ACCEL`; **feel**: `GRAVITY` / `JUMP_V` / `FAST_FALL`.
- **Whale Runner art**: `URCHIN` / `CORAL` / `JELLY_*` / `FISH_*` are character art (`X` main colour, `o` belly,
  `.` transparent) — just edit the characters. The whale itself lives in `shared/whale.js`.
- **Whale Runner palette**: `PAL` maps each element to `[shallow RGB, deep RGB]`; note that `PAL.belly`'s deep value
  deliberately sits close to `PAL.whale` (too bright and it becomes a white blob in the dark sea).
- **Context Snake feel**: `BASE_STEP_MS` (start speed) / `STEP_DEC` (speed-up per TOKEN) / `MIN_STEP_MS` (speed cap) /
  `THINK_MS` / `THINK_SLOW` / `THINK_CHANCE` / `THINK_COOLDOWN` / `CTX_PER_TOKEN`.
- **Token Fall balance**: difficulty *is* one `LOADS` table — per LOAD the `tokenCtx` / `heavyCtx` / `compressCtx` /
  `noiseCtx` / `overflowMs` (rescue window) / `urgeRatio`+`urgeMs` and `rescueRatio`+`rescueMs` (the two guarantees) /
  `thinkChance` / `w` (natural drop weights) / `pace` (speed, spawn interval, on-screen cap); `LOAD_STARTS` holds the
  stage boundaries (0/30/60/100/150 seconds). Tuning means editing that one table: `getDropWeights()` /
  `compressAmount()` / `paceAt()` are pure readers of it and are exposed to the tests via `window.TokenFallRules`.
  Also `FATIGUE_WINDOW_MS`, `FATIGUE_MUL` (chain decay), `COMPRESS_MIN_AMOUNT`, `COMPRESS_STEP`, `EFF_*`
  (Context Efficiency), `COMBO_STEP`, `COMBO_MAX` (CLEAN multiplier).
- **Token Fall feel**: `PLAYER_SPEED` / `PLAYER_ACCEL` (smooth movement), `PLAYER_HIT` and `HIT` (hitbox insets — smaller
  means more forgiving).
- **Attention Maze levels**: the `LAYERS` array in `games/attention-maze/levels.js` is the whole game — per layer a `map`
  (15×11 of `#` / `.`), explicit `nodes` (start / exit / query / keys / value coordinates), `keys[].w` (single-head weights)
  or `heads` (two attention heads), `answer` (the id of the correct KEY), plus `scanMs` / `focus` / `rescan` /
  `parTime` / `parMoves` / `tip`. Adding a layer is one more entry: the tests then verify that nodes sit on floor tiles,
  that `answer` really is the highest-attention KEY, that start→QUERY→correct KEY→VALUE→EXIT is connected and that the par values are sane.
- **Attention Maze pacing**: `ATT_MS` (single-head display) / `HEAD_MS` (per head) / `COMBINE_MS` (combine hint) /
  `RESCAN_MS` / `MOVE_REPEAT_DELAY`, `MOVE_REPEAT_EVERY` (hold-to-repeat interval) / `TWEEN_MS` (visual interpolation only,
  never collision) / the star thresholds inside `starsFor()`.
- **Copy**: add keys to `DICT.zh` / `DICT.en` in `shared/i18n.js` (both sides are required and tested) and use `data-i18n` in HTML.
- After any change, run `bash test/run.sh`.

## Character skins (Classic Whale / Whale-chan)

Two character appearances, managed centrally by `shared/character.js`, and **both are purely cosmetic**:

| Skin | Assets | Notes |
| --- | --- | --- |
| `classic` (default) | the character sprite in `shared/whale.js` plus each game's own pixel sprites | every hitbox, difficulty and feel value stays exactly as before |
| `whalechan` | `assets/whale-chan/*.webp` (derived WebP of third-party CC BY 4.0 artwork) | a texture swap — still no gameplay value changes |

- **State**: `localStorage: arcade.characterSkin`; only `classic` / `whalechan` are accepted and anything else falls
  back to `classic`. When the key is missing the default is **classic**, so existing players are never re-skinned silently.
- **Preload**: the module creates the nine `Image` objects exactly once (~180KB total, all relative paths) and only ever
  draws from that cache — never `new Image()` inside a render loop.
- **Fallback**: `ArcadeCharacter.draw()` returns `false` when the skin is off, the asset is still loading, or the file
  404s / fails to decode. The caller then draws the classic whale, so a broken image can never make the character
  disappear, throw, or stall the Canvas.
- **Smoothing**: Whale-chan is an illustration, not pixel art. `draw()` turns `imageSmoothingEnabled` on for the
  duration of the call and restores the previous value, so pixel objects on the same Canvas stay crisp.
- **Visual vs collision**: image size never participates in collision. Whale Runner's `BOX`, Token Fall's `PLAYER_HIT`,
  Snake's grid and Attention Maze's `CELL` all keep their original values; the asset only decides where and how large
  the texture is painted.

### Third-party artwork licence (important)

The images under `assets/whale-chan/` are **not** this project's work and are **not covered by the MIT license**:

- Author / copyright holder: **Er1c0v0**; source: the `character/` directory of
  <https://github.com/Er1c0v0/dsh-whale-pet>;
- Licence: **CC BY 4.0** (full text in `LICENSES/CC-BY-4.0.txt`);
- Only **derived WebP** files are shipped (edge-connected background removal → alpha feathering → cropping → uniform
  rescaling → WebP q90); the original upstream PNGs are not redistributed. Every source file, its upstream SHA-256
  and the modifications are recorded in `assets/whale-chan/ATTRIBUTION.md`;
- The root `LICENSE` is MIT and covers the **code only**; see `THIRD_PARTY_NOTICES.md`.

## How each game is implemented

## 🐳 Whale Runner — `games/runner/`

It is Chrome's offline dino, moved from the desert to the seabed:

| Chrome offline dino | This version |
| --- | --- |
| The dino | **DeepSeek whale** (shape taken from the official logo) |
| Cacti | **urchins / corals / low jellyfish** on the seabed |
| Pterodactyls (low / mid) | **fish** (jump over) / **mid-height jellyfish** (dive under) |
| Jump / duck | Rise-and-jump / dive |
| Day-night inversion | Shallow ⇄ deep sea (gradient + glowing plankton) |
| Score + high score | Same, plus sound, zh/en, mobile support |

**Controls**: `Space` / `↑` / `W` to jump (tapping the canvas works too) · `↓` / `S` to dive (in mid-air = fast fall) ·
`P` pause · `M` mute · touch: jump / dive buttons, `🌐` language, `⛶` fullscreen (touch only).

**Rules**: hitting any sea creature ends the run; the further you swim the faster it gets; a beep every 100 points and a
shallow ⇄ deep transition every 700. The high score lives in `localStorage: whaleRunner.high`.

### Where the whale comes from

It is not hand-drawn pixel art: it is a rasterisation of **the cubic path of the official DeepSeek logo**:

- **Body**: the path is rendered onto a 24×18 pixel grid (mirrored to face right), so the in-game whale is the same shape
  as the browser tab icon.
- **Two tail frames** `NORMAL_A` / `NORMAL_B`: in the logo the tail fluke shares one sub-path with the body outline and
  cannot be rotated on its own, so the whole path gets a **smooth shear along x** (zero displacement at the body, growing
  towards the fluke) and is rasterised again — the two frames line up cell for cell.
- **Two dive frames** `DIVE_A` / `DIVE_B`: the whole path is squashed vertically to 0.72 (a 24×13 gliding pose) and gets
  the same tail shear.

### Technical details worth knowing

- `PX` is the **master switch for the whole world**: canvas, gravity / initial velocity / speed, hitboxes and font sizes all
  follow `S = PX/3`, so changing `PX` from 3 to 2 or 4 scales everything proportionally without changing gameplay
  (the tests regress 2/3/4).
- Hitboxes are expressed in "sprite cells × PX" (`BOX` / `MID_BOTTOM` / `LOW_BOTTOM`) and their interlock is
  `dive box top 11 cells < mid obstacle box bottom 13 cells < stand box top 16 cells`; a **self-check runs at start-up**
  and warns in the console if it breaks.

---

## 🐳 Context Snake — `games/snake/`

Classic snake in a blue pixel sea. You are a whale head, and eating **TOKEN**s makes your **CONTEXT** grow longer.

- **TOKEN**: a glowing blue pixel block. Each one grows the body by one segment and adds `CONTEXT +8`.
- **THINK** (a rare special item): eating it starts **4 seconds of DEEP THINK** — 1.7× slower per cell (noticeable but
  restrained), a blue wash over the field and a countdown bar in the HUD. It can only appear after 3 TOKENs and at least
  26 cells apart, so it never floods the screen.
- **Speed**: 150ms per cell at the start, 4ms faster per TOKEN, **capped at 72ms** (reached at the 20th TOKEN) — tighter
  over time but never out of control.
- **No 180° reversals**: input goes through a length-2 queue and is validated against the *last queued* direction, so even
  rapid mashing (right→up→left) cannot produce an illegal U-turn.
- **End condition**: hitting a wall or biting yourself.
- **Controls**: `arrows` / `WASD` · touch supports both the **D-pad** and **canvas swipes** · tapping the canvas = start /
  pause / restart · `P` pause · `M` mute.
- **High score**: `arcade.snake.high` (completely separate from Whale Runner's `whaleRunner.high`).

> Everything is code-drawn: the whale head is an 8×8 character sprite (rotated in 90° steps), the body is made of glowing
> pixel blocks that get darker and thinner towards the tail, and TOKEN / THINK / grid / particles are all `fillRect`.

---

## 🐳 Token Fall — `games/token-fall/`

A vertical catching game. Different Token kinds fall from the top and you steer the whale along the seabed.
**It is not a "catch everything" game — it is about scoring while managing a limited context window.**

| Drop | Colour | When caught | Catch it? |
| --- | --- | --- | --- |
| **TOKEN** | DeepSeek blue | `SCORE +10`, `CONTEXT +32~40` | Your main score source (most common) |
| **HEAVY TOKEN** | mint green (shows `H`) | `SCORE +35`, `CONTEXT +96` | From LOAD 2: big score, big Context gamble |
| **COMPRESS** | bright cyan | `SCORE +20`, shrinks context (see below) | Ever rarer late — don't chain them blindly |
| **NOISE** | purple-red | `SCORE +0`, `CONTEXT +128~224` | Must be dodged |
| **THINK** | gold (`<think>`) | `SCORE +30`, `CONTEXT +16`, 4s DEEP THINK | Rare — grab it |

> The numbers are not constants: **the same drop is worth different amounts in different LOADs** (table below).

#### Difficulty stages LOAD 1 ~ 5

`LOAD_STARTS = [0, 30000, 60000, 100000, 150000]` — roughly **0 / 30 / 60 / 100 / 150 seconds**.
After 150 seconds the run stays in LOAD 5 and **every value is capped** (speed 230px/s, spawn 520ms, 4 concurrent drops,
NOISE weight 0.32), so late game is brutal but never a guaranteed numeric blow-up.

| | LOAD 1 | LOAD 2 | LOAD 3 | LOAD 4 | LOAD 5 |
| --- | --- | --- | --- | --- | --- |
| Time | 0~30s | 30~60s | 60~100s | 100~150s | 150s+ |
| TOKEN context | +32 | +32 | +36 | +40 | +40 |
| COMPRESS base | 256 | 224 | 192 | 160 | 128 |
| NOISE penalty | +128 | +144 | +160 | +192 | +224 |
| COMPRESS natural chance | 0.18 | 0.14 | 0.10 | 0.07 | 0.05 |
| HEAVY TOKEN chance | 0 | 0.08 | 0.15 | 0.20 | 0.22 |
| NOISE chance | 0.06 | 0.13 | 0.20 | 0.27 | 0.32 |
| Overflow grace | 2.0s | 1.8s | 1.6s | 1.4s | 1.2s |
| urge guarantee (ratio / wait) | 85% / 3.2s | 88% / 3.8s | 90% / 4.5s | 92% / 5.2s | 97% / 6.5s |
| rescue guarantee (ratio / wait) | 95% / 1.4s | 96% / 1.8s | 97% / 2.2s | 98% / 2.6s | 99% / 3.0s |

- **Pace (`pace`)**: speed 95 → 230 px/s, spawn interval 1150 → 520ms, concurrent drops 1 → 4. These interpolate
  **linearly between adjacent LOADs** (`paceAt()`) so there is no teleport-style acceleration, and the concurrent count is
  floored (LOAD 1 is 1 the whole way, LOAD 5 is 4). Difficulty comes from the rules below, not from raw speed.
- **COMPRESS is a three-factor composite** (`compressAmount()`):
  `final = LOAD base × Compression Fatigue × Context Efficiency`, then rounded to a multiple of **16**, floored at **64**,
  and always limited to the current Context (context can never go negative).
  - **Compression Fatigue**: chaining COMPRESS within 7 seconds decays — the 1st / 2nd / 3rd+ give **100% / 75% / 50%**.
    Go `FATIGUE_WINDOW_MS = 7000` without another catch and it resets to 100%; it never accumulates permanently
    (and the recovery timer is frozen while paused).
  - **Context Efficiency**: context above 75% gives 100%, 40–75% gives 80%, below 40% gives 50% — so a COMPRESS caught at
    low context is largely wasted, which makes "save it for an emergency" a real decision.
  - The floating number drawn on Canvas is the **effective** value (e.g. `COMPRESS -160`), never the base value.
- **HUD**: `CONTEXT 384 / 1024` plus the current stage **`LOAD n`** (CONTEXT left, LOAD right, DEEP THINK in the middle).
  On a stage change the centre of the screen shows `LOAD n` + `PRESSURE INCREASED` for about **1 second** with a short
  Web Audio cue — never a long obstruction. The cap stays fixed at **1024**.
- **DEEP THINK**: every drop falls at ×0.6, with a restrained blue pixel glow and a remaining-time bar along the top edge.
  It is rare (5% per spawn, dropping to 1.8% by LOAD 5; at least 9 seconds apart, not in the first 5 seconds) — rarer later
  but **never removed**: it stays the "always happy to see it" special item.
- **CONTEXT OVERFLOW**: reaching 1024 does **not** kill you instantly — you get a rescue window that shrinks with the LOAD
  (2.0s → 1.2s, floored by `OVERFLOW_FLOOR_MS = 1200` because mobile players still need reaction time) with a flashing
  `OVERFLOW` label and an amber countdown bar. Catching a **COMPRESS** inside that window pushes context back under 1024
  and **cancels the overflow immediately** (the state is re-checked every frame, so a rescued run can never be killed by a
  stale timer); only if the timer runs out while still over does the run end, and the reason reads
  **`CONTEXT OVERFLOW`** rather than a generic GAME OVER. The timer is fully frozen while paused.
- **CLEAN combo**: catching **TOKEN / HEAVY TOKEN / COMPRESS / THINK** in a row builds a combo, +1 multiplier every 3
  catches, **capped at x5**; catching NOISE resets it. Missing a TOKEN or COMPRESS neither ends the run nor breaks the combo
  — the point is **choosing**, not catching everything. HEAVY TOKEN counts as a real token, so it does **not** break the
  combo (that is what makes the high-score-vs-Context gamble work).
- **Spawn guarantees** (to avoid unwinnable states) — both get stricter with the LOAD (table above):
  - **urge**: context ≥ this LOAD's ratio and no COMPRESS has spawned for `urgeMs` → the next spawn is a COMPRESS;
  - **rescue**: context ≥ this LOAD's ratio and there is no COMPRESS on screen → one is guaranteed within `rescueMs`.
  - A guaranteed COMPRESS is **never dropped directly on top of the player** (`COMPRESS_MIN_OFFSET`) and never
    auto-compresses — you still have to go and catch it. NOISE **never spawns three times in a row**
    (`NOISE_STREAK_MAX = 2`; after that its weight is handed to TOKEN), so it cannot form an unavoidable wall.
- **Pressure feedback**: from 60% the context bar brightens, from 85% it pulses gently, and from 95% a restrained amber
  border appears at the screen edges (no harsh red flashing, no impact on playability); a very light "Context Buffer"
  strip sits on the whale's back.
- **Controls**: hold `←` `→` / `A` `D` for smooth movement with acceleration (never a one-cell teleport) · two large arrow
  buttons on phones (**hold to keep moving**) · or drag the whale horizontally on the canvas · tap the canvas / `P` / `⏸` to
  pause · `M` to mute.
- **Pause and tab switching**: while paused, drops, DEEP THINK, the overflow countdown, scoring and the difficulty clock are
  all frozen; switching tabs pauses automatically and returning does not resume; a huge frame gap (coming back from another
  tab) is clamped so drops cannot teleport.
- **High score**: `arcade.tokenFall.high` (sound state now comes from the global `arcade.sound`).

> Classic mode is also zero images: the whale is the same one as Whale Runner — the 24×18 character sprite rasterised from the **official
> DeepSeek logo path** (two tail frames, mirrored when swimming left; the hitbox is inset by sprite cells, so transparent
> areas never collide). The four drop kinds, background particles, grid, HUD and glows are all `fillRect` / `fillText`.
> Sounds are synthesised through `shared/audio.js` (short TOKEN blip, COMPRESS drop, NOISE error, THINK rise, overflow
> warning, game over).

---

## 🐳 Attention Maze — `games/attention-maze/`

A pixel maze puzzle inspired by **Transformer attention** (no machine-learning knowledge required — the in-game visuals teach
the rules). Each stage is a **LAYER**, there are 12 hand-designed ones, and the core loop is:

**ATTENTION SCAN (see the whole map) → FOCUS MODE (only your surroundings) → remember → walk to EXIT**

- **ATTENTION SCAN**: at the start of a layer the whole maze is lit for 2–3 seconds with the exit, QUERY, KEYs and VALUE in
  plain sight; you cannot move during the scan — it exists purely to memorise. Then **FOCUS MODE** begins: only a
  **Manhattan distance of 2–3 cells** stays lit (the window edge is outlined), everything further away is covered by a dark
  navy mask (never pure black), and visited cells keep a very faint memory trail. Later layers narrow the view to 2 cells and
  shorten the scan to 1.7 seconds.
- **QUERY / KEY / VALUE**: stepping on `Q` lights up **attention lines and weight numbers** from it to every `K` (they fade
  after about 1.8 seconds). Low weights are thin and dim, high weights are thicker and brighter, and the **highest one also
  gets extra bright dots** and the brightest number — never colour alone. The weights are **hard-coded in the level data**, so
  they are identical for the whole run and across restarts, never randomised. Walking to the highest-weight KEY gives
  **ATTENTION MATCHED**; a wrong KEY only costs one **MISTAKE** with a **LOW ATTENTION** hint (one mistake per wrong KEY) and
  never a game over — this is a puzzle, not a punishment. Only the correct KEY unlocks `V`, and only the VALUE unlocks **EXIT**.
- **MULTI-HEAD ATTENTION** (LAYERS 09–12): stepping on the QUERY lights **HEAD 1**, then **HEAD 2**, and the two heads favour
  different KEYs. After both rounds you only get a short **"Combine the heads"** prompt (never the answer): the KEY with the
  **highest combined weight across both heads** is the right one. The two heads use different line styles (HEAD 1 solid,
  HEAD 2 dotted pixel line), not just different colours.
- **How the 12 LAYERs introduce mechanics**: 01 scan-and-find-the-exit → 02 a longer serpentine corridor → 03 branches and
  comb passages → 04 the first QUERY with two KEYs → 05 three KEYs plus weights → 06 the full QUERY→KEY→VALUE→EXIT chain →
  07 a twistier maze with four KEYs and the view narrowed to 2 cells → 08 the scan cut to 1.7 seconds and still four KEYs →
  09 the first MULTI-HEAD → 10 MULTI-HEAD where **HEAD 1 alone misleads you** → 11 **five KEYs** where neither head's own
  favourite is the answer → 12 **FINAL ATTENTION**: **six KEYs** and every mechanic at once.
  Every layer is **guaranteed solvable**: the tests verify start→QUERY→correct KEY→VALUE→EXIT connectivity with BFS.
- **The KEY count ramps from 2 up to 6, and the answer distribution is deliberately spread out**: K1–K5 all get to be the
  correct answer at some point, no single KEY accounts for more than 25% of the answers, and no layer's answer can be
  guessed from "right-most / farthest from QUERY / closest to EXIT". Those are not just intentions — the
  "level design quality" group in `test/attentionmaze.test.mjs` asserts the answer share, the no-long-streaks rule,
  that K4 really wins once after it first appears, that a newly added K5/K6 is never a pure distractor, and that every
  answer beats the runner-up by ≥ 0.08. Adding layers or re-tuning weights will fail the suite if the answers cluster
  on one KEY or one corner again.
- **No death**: a wrong KEY, a detour or a forgotten route only affects TIME / MOVES / MISTAKES; only pressing **RESTART**
  restarts the layer.
- **RESCAN**: each layer lets you re-view the whole map on demand (twice in the teaching layers, once later; the HUD shows
  `RESCAN 1`). Using it is not a MISTAKE, but it **caps the layer at 2 stars** — being stuck never forces a restart, while
  3 stars require real memorisation.
- **Stars and progress**: reaching the EXIT always clears the layer, and 1 star is not a failure. Perfect time and moves with
  0 MISTAKEs and no RESCAN = **3 stars**; close enough = 2 stars; otherwise 1 star. Each layer's best stars / time / moves are
  stored locally, clearing a layer unlocks the next one, and the main screen is a 12-cell **Layer Select** (locked cells show
  a lock) where any unlocked layer can be replayed.
- **Controls**: `arrows` / `WASD` to step (holding keeps stepping, at most one cell per frame) · a touch **D-pad** (hold to
  keep moving; releasing, sliding off or an interrupted gesture stops immediately) · canvas swipes move one cell as a
  secondary option · `P` pause · `R` RESCAN · `M` mute.
- **Pause**: the scan countdown, the attention display, the MULTI-HEAD display, the layer clock and the animation clock are
  all frozen; switching tabs pauses automatically and returning never auto-resumes.
- **Progress**: `arcade.attentionMaze.progress` (JSON: highest unlocked layer plus per-layer best stars / time / moves; a
  corrupted save silently falls back to defaults).

> Zero images: the maze, the top-down whale (the character art rotated in integer 90° steps for four facings), the Q/K/V
> nodes, the attention lines (hand-drawn pixel lines whose thickness is the weight), the mask and the HUD are all `fillRect`;
> sounds are synthesised through `shared/audio.js` at restrained volumes.

---

## Directory structure (full)

```text
.
├── index.html / arcade.css / arcade.js   游戏大厅 / Arcade lobby (GitHub Pages homepage)
├── shared/                               真正共用的部分 / shared by every page
│   ├── i18n.js                           zh/en dictionary + language switching
│   ├── audio.js                          Web Audio tones + global Sound switch
│   ├── whale.js                          DeepSeek whale pixel data (single copy)
│   └── arcade.css                        design tokens + page shell (body / card / buttons / back link)
├── games/
│   ├── runner/                           Whale Runner: index.html / style.css / game.js
│   ├── snake/                            Context Snake: index.html / style.css / game.js
│   ├── token-fall/                       Token Fall: index.html / style.css / game.js
│   └── attention-maze/                   Attention Maze: index.html / style.css / levels.js + game.js
├── test/                                 headless tests (stub DOM + stub Canvas, no browser)
│   ├── run.mjs / run.sh                  run everything: bash test/run.sh
│   ├── helpers.mjs                       harness (assembles the DOM per page)
│   ├── collision.test.mjs                Whale Runner collision model + zoom invariance
│   ├── smoke.test.mjs                    Whale Runner smoke test + AI long run
│   ├── snake.test.mjs                    Context Snake rules
│   ├── tokenfall.test.mjs                Token Fall rules, overflow rescue, pause and touch
│   ├── attentionmaze.test.mjs            12-layer solvability, Q/K/V, MULTI-HEAD, progress and stars
│   ├── engineering.test.mjs              v1.0 contracts: CI, global sound, shared assets, level split
│   ├── i18n.test.mjs                     zh/en switching on five pages + dictionary parity
│   └── paths.test.mjs                    dead links / absolute paths / localStorage key collisions
├── docs/                                 architecture.md · testing.md (+ .en.md)
├── LICENSE                               MIT (code only)
├── README.md / README.en.md              project overview (zh / en)
└── .github/workflows/pages.yml           test first, then deploy GitHub Pages
```

> Note: `docs/` and `test/` are not part of the live site logic but are published along with it by Pages (they are tiny).
