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
| Token Fall · gameplay | All four drop kinds, CONTEXT never below 0, the 2-second overflow rescue (including the "rescued but still killed" regression), DEEP THINK timing and the physics slowdown, CLEAN combo up to x5, difficulty caps, the COMPRESS guarantee, NOISE never forming a wall, all timers frozen while paused, keyboard / touch / multi-touch / drag, restart cleanup, high-score key, DPR does not affect collision |
| Attention Maze · gameplay | 12-layer data self-check plus **BFS solvability**, map parsing, grid movement and wall bumping, early EXIT is locked, QUERY display timing, a wrong KEY costs exactly one MISTAKE, correct KEY unlocks VALUE, VALUE unlocks EXIT, weights never re-randomise, MULTI-HEAD phase order and the combined-weight answer, RESCAN limits, pause freezing every timer, tab switching, restart cleanup, progress and stars, corrupted saves, RESET confirmation, touch / multi-touch / blur, DPR independence |
| v1.0 engineering | CI structure (`setup-node`, run tests, `needs: test`), the global sound switch and its legacy-key migration, the shared whale asset (no duplicated pixels), the Attention Maze level split plus layer fingerprints, README / docs / LICENSE contracts, back-to-arcade links, no site-absolute paths |
| i18n | Chinese/English switching and persistence on all five pages, the legacy `whaleRunner.lang` key, **full dictionary key parity**, and the required key lists for Token Fall and Attention Maze |
| Static checks | Every `src` / `href` resolves to a real file, no site-absolute paths, no localStorage key collisions across the four games, and the engineering contracts above |

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
