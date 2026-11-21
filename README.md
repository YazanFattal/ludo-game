# Ludo Rush

A responsive, local Ludo game for one person and 1–3 AI rivals.

[Play Ludo Rush](https://yazanfattal.github.io/ludo-game/)

## Run locally

Use Node.js 24 and npm. `npm ci` installs the locked dependencies; `npm run dev` starts Vite. Open the `/ludo-game/` URL printed in the terminal.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome locally. In CI, Playwright uses its bundled Chromium (`npx playwright install --with-deps chromium`). Tests cover small phones, tablets, landscape phones, laptops, large monitors, token stacks up to 16 pieces, deterministic gameplay, AI turns, theme persistence, dialogs, expansion, and WCAG A/AA checks in both themes.

The original rule assertions are retained in `src/game.test.js`. Its capture fixture was corrected to put the attacker and enemy on the same unsafe square. Additional tests cover captures, the +20 bonus, exact finishes, extra rolls, three sixes, turn transitions, victory, and ten seeded AI matches.

## Publishing to GitHub Pages

The existing publishing method is preserved:

- Source code lives on `main`.
- Pages serves the **`gh-pages` branch, `/ (root)`**. In Settings → Pages, keep **Deploy from a branch** with those values.
- `vite.config.js` retains `base: '/ludo-game/'`.
- `npm run deploy` runs the production build first, then publishes **only `dist/`** to `gh-pages` through the existing `gh-pages` package.
- Commit and push source changes to `main` separately. Publishing the site does not back up source changes.

The GitHub Actions workflow runs lint, rule tests, build, and browser checks. It does not publish the source tree or change Pages settings. This replaces a conflicting workflow that uploaded the unbuilt repository, which could overwrite a working Vite deployment.

## Game and layout

The original custom rules are preserved: 40 outer squares, four home-lane steps before the center, four tokens per player, six to leave base, exact roll to finish, protected star squares, three consecutive sixes canceling a turn, and a capture awarding +20 steps and an extra roll. AI scoring is unchanged.

Pure game helpers live in `src/game.js`; `src/engine.js` handles immutable turn transitions. Timers are cleaned up when the match ends and pause during help and restart dialogs. The board renders once in normal and expanded modes. Tokens scale to their cells, keep their identifiers, and group into a grid on shared squares. Larger token-selection buttons provide a keyboard and touch alternative to tapping a crowded square.

The match fits a single viewport, using both available width and height to keep the whole board square. Light/dark preferences persist locally. Expanded mode supports native fullscreen where available and falls back to an in-page layout. Help and restart dialogs support Escape, focus containment and focus restoration. Reduced-motion preferences are respected.
