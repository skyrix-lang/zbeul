# packages/feature-game

The game itself: every screen a player sees, and the rules behind them.
Depends only on `@zbeul/core`, `@zbeul/api` and `@zbeul/ui`.

- `src/engine/` is the game as plain functions on plain data: no React, no
  storage, no clock, no `Math.random` (the caller passes them in). Every rule of
  `specs/specs.md` that can be checked is a test in `engine/game.test.ts`, run
  with a seeded random source.
- `src/cards/fr.json` is generated from `specs/cartes-mvp.md` by
  `yarn cards:generate`: never edit it by hand. It is the fallback: the game
  plays the deck last received from the server (`src/cards/index.ts`, read
  with `getDeck()` or `useDeck()`), fetched at the home screen only.
- `src/store.ts` holds what the phone remembers (Zustand, in `localStorage`).
  Nothing about the players is ever sent online: the only request the game
  makes is an anonymous report (`src/reports.ts`). Bump a store's `version` and
  write its `migrate` when its shape changes: an old save must stay playable.
- The game screen (`src/screens/play.tsx`) has no input and no player picker:
  at most "Gagné", "Perdu", "Joker" and "Carte suivante".
- Texts are in French, informal ("tu"), short, with humour, except the legal
  messages (age, alcohol), which stay plain.
