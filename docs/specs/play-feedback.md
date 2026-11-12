# Play feedback (first players' remarks)

Status: built

## Goal

Fix what the first players stumbled on: a game that can be paused and stepped
back, a score that counts group cards in points mode, a lighter sips mode, more
cards at the chosen level, and a thumbs up or down on every card.

## Users and access

Players, without an account. Thumbs and reports are anonymous. The admin sees
the counts per card.

## Behaviour

**Everywhere.** Text can't be selected, except card texts, legal pages and
fields. "Retour" goes back to the previous screen; the home when there is none.

**Setup.** The two collapsed options show a chevron and "Modifier". The fixed
footer no longer drags the page.

**Settings.** The theme preview is stamped "Aperçu".

**Game.**

- The cross offers three choices: carry on, pause (back to the home, where the
  game waits 12 hours as before), or end and see the ranking.
- A back button returns to the previous card, scores included, up to 20 taps.
  "Next" after going back shows the same cards again, not new ones.
- Sips mode: "Carte suivante" only. No "Gagné", "Perdu" or "Joker", no score,
  and the end screen has no ranking.
- Points mode:
  - a card for one player keeps "Gagné" / "Perdu" / "Joker";
  - "Joker" costs the stake and replaces the card with another of the same
    mini-game for the same player. The replacement has no joker;
  - a group card shows the players: tap who loses the stake (tap twice for the
    double on a two-tier card). A duel: tap the loser of the two. Culture G: on
    the answer card, tap the closest (wins the stake) and the farthest (loses
    it). Tapping nobody is allowed.
- Action ou vérité: the card asks "action ou vérité ?"; the chosen half shows
  after a tap. A card's text holds both, split on "Vérité :".
- Culture G: the answer has its own card after the question, with the question,
  the stake and the source. It isn't counted as a card.
- A rule that ends is announced on the next card.
- Names are highlighted at once, without animation.
- Levels: a level's weight doubles at each step (1, 2, 4, 8, 16), so the
  game's level is about half of the cards. With "montée en pression", the
  ceiling is reached at half of the game.
- Personal limits (unchanged, confirmed): a card that names players never names
  one whose profile or excluded themes rule it out; a group card that any
  player rules out is not drawn at all.

**Thumbs.** Each card has a thumb up and a thumb down, in place of the flag.

- Up: the card joins the favourites on the phone, and an anonymous like is
  sent. Favourites and likes are now one thing.
- Down: a sheet with reasons to tick (nulle ou ennuyeuse, trop longue, trop
  dure, à modifier) and an optional message; sent as a report.
- Tapping a thumb again cancels it. Votes leave the phone when the game ends
  or is paused, or at the next home screen with a network: until then they can
  be cancelled.

**Failures.** No network: votes wait on the phone (as reports do). Too many
from one address: 429, dropped. Unknown card: counted nowhere.

## Data

- `reports.reasons`: an array of reasons, empty for existing rows.
- `card_likes`: one row per card with a count.
- A migration rewrites the Chaîne and Valise cards that still end with
  "[J1], tu commences." so the name comes first, and records each change in
  `card_changes`. Agreed by the owner.

## Pages and API

- `POST /api/reports` accepts `reasons`. Public, rate limited (unchanged).
- `POST /api/likes` `{ cardIds }`: public, rate limited per address.
- `GET /api/admin/cards` returns `likes` and `reports` per card.

## Out of scope

Un-liking a card after its like has left the phone; statistics per game.

## Decisions (answered 2026-11-12)

All of the above were confirmed by the owner, including the reversal of "no
player picker on the game screen" in points mode.
