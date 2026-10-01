# Tests

All four games share one headless test environment: a **stub DOM + stub Canvas** that runs the real `game.js`
files inside Node — no browser and no npm dependency needed.

**English** · [中文](testing.md)

```bash
bash test/run.sh          # same as node test/run.mjs (falls back to the bundled runtime if node is not on PATH)
```

CI runs exactly this command (the `Run tests` step of `.github/workflows/pages.yml`), and **Pages is not deployed**
unless the tests pass.

## Suites

| Suite | What it covers |
| --- | --- |
| Whale Runner · collision | Jump / dive versus the four sea-creature kinds, verified at **PX = 2/3/4** zoom levels |
| Whale Runner · smoke | Lifecycle, pause / mute / tab-hidden, hitbox geometry self-check, AI runs 20000 frames without dying |
| Context Snake · gameplay | Movement, 180° reversal rejection (including rapid key mashing), eating TOKENs, wall and self collisions, high score, speed cap, DEEP THINK, touch input, leaving the page |
| Token Fall · gameplay | All five drop kinds, CONTEXT never below 0, the overflow rescue and its cancellation (including the "rescued but still killed" regression), DEEP THINK timing and the physics slowdown, CLEAN combo up to x5, difficulty caps, the COMPRESS guarantee, NOISE never forming a wall, all timers frozen while paused, keyboard / touch / multi-touch / drag, restart cleanup, high-score key, DPR does not affect collision |
| Token Fall · LOAD curve | Stage switches at 0/30/60/100/150 seconds and never reaches LOAD 6, per-LOAD COMPRESS base and NOISE penalty, natural COMPRESS chance falling with the LOAD, HEAVY TOKEN absent in LOAD 1 and always rarer than TOKEN, COMPRESSION FATIGUE (decay / 7s reset / capped), Context Efficiency, compression rounded to 16 with a floor of 64 and never going negative, guarantee thresholds tightening while LOAD 5 keeps an extreme guarantee, overflow grace shrinking but never below 1.2s, HEAVY TOKEN continuing the CLEAN combo, and the effect of pause / tab switch / restart on LOAD, Fatigue and Overflow. **Only the pure helpers exposed via `window.TokenFallRules` plus real behaviour are asserted — no random sampling** |
| Attention Maze · gameplay | 12-layer data self-check plus **BFS solvability**, map parsing, grid movement and wall bumping, early EXIT is locked, QUERY display timing, a wrong KEY costs exactly one MISTAKE, correct KEY unlocks VALUE, VALUE unlocks EXIT, weights never re-randomise, MULTI-HEAD phase order and the combined-weight answer, RESCAN limits, pause freezing every timer, tab switching, restart cleanup, progress and stars, corrupted saves, RESET confirmation, touch / multi-touch / blur, DPR independence |
| v1.0 engineering | CI structure (`setup-node`, run tests, `needs: test`), the global sound switch and its legacy-key migration, the shared whale asset (no duplicated pixels), the Attention Maze level split plus layer fingerprints, README / docs / LICENSE contracts, back-to-arcade links, no site-absolute paths |
| i18n | Chinese/English switching and persistence on all five pages, the legacy `whaleRunner.lang` key, **full dictionary key parity**, and the required key lists for Token Fall (39 keys, including LOAD / HEAVY TOKEN / the pressure banner) and Attention Maze (40 keys) |
| Character skin | `arcade.characterSkin` defaults to classic, invalid values fall back, `setSkin` / `cycleSkin` cycle all three skins, `onChange` fires, the value survives a page reload and the **legacy `whalechan` value is migrated to `yunyue` and written back**; **switching the skin changes no game data** (high scores, progress, sound and language keys compared one by one, and again after a full cycle); all four games keep their **exact hitboxes** after a skin switch (Runner replays one seeded scenario and compares the game-over frame, Token Fall compares a catch, Snake compares the head cell and length, Attention Maze compares the occupied cell and MOVES); **animation frames are a pure function of time** (drawing 50 times at the same instant stays on one frame, the multi-frame walk really changes frame, and one full Pixel cycle only uses its 3 distinct poses); pausing freezes the character clock and stops the frame changing; `imageSmoothingEnabled` is `true` while `yunyue` draws and `false` for `pixel`, always restored afterwards (both smoothing and globalAlpha); mirroring is correct (Runner never mirrors, Token Fall / Snake / Maze mirror when facing left); assets load **lazily** (a classic start downloads nothing, switching to one skin requests only that skin, switching back never re-creates an `Image`, hovering warms up the next skin); a full 404, a single 404 and a still-loading asset all fall back to the classic whale without throwing |
| Static checks | Every `src` / `href` resolves to a real file, no site-absolute paths, no localStorage key collisions across the four games, every asset in the character registry really exists (with no unregistered or leftover WebP in the directory), and the old third-party asset directory plus its CC BY 4.0 licence text are gone |

## BFS layer validation (Attention Maze)

`test/attentionmaze.test.mjs` contains an **independent BFS validator** that does not depend on the game runtime.
It reads the layer data from `games/attention-maze/levels.js` and, for each of the 12 layers, checks that:

- the map is 15×11 with a closed border, every node sits on a floor tile and no two nodes share a cell;
- `answer` really is the highest-attention KEY (single-head: the largest weight; multi-head: the largest sum of the two
  heads, compared as rounded integers with a margin of at least 0.05 so float ties cannot flip it);
- **start → QUERY → correct KEY → VALUE → EXIT are all reachable** (ignoring the progression locks, purely geometrically);
- `parMoves` is at least the shortest route (so 3 stars is achievable) but not absurdly generous (≤ 1.6×), and `parTime`
  sits in a sane band.

Adding a layer only means appending one entry to `levels.js` — the validator picks it up automatically.

## Adding tests

- Page wiring lives in the `PAGES` table of `test/helpers.mjs`: each page lists the DOM ids that really exist and the
  scripts it loads, in HTML order. Pass `exposeGame: true` to reach the game internals as `b.G`; the harness rewrites
  `var game = {` into `var game = window.__game = {`, so the game code itself stays untouched.
- Time: `b.tick(n)` runs n frames, `b.jump(ms)` only moves the clock (simulating a tab switch), and `b.G.now` is the
  in-game clock, which does not advance while paused.
- Input: `b.key('keydown', 'ArrowUp', 'ArrowUp')` dispatches real keyboard events and
  `b.els.up.fire('pointerdown', { pointerId: 1 })` dispatches real pointer events.
- Static checks: `test/paths.test.mjs` covers dead links, absolute paths and localStorage key collisions, while
  `test/engineering.test.mjs` covers the v1.0 structure (global sound, shared assets, level split, CI config, LICENSE, README).
