# Cards, packs and history in the admin

Status: built

## Goal

The admin can add, change, archive and publish cards and packs from `/admin`,
without a release, and see who changed what. Players get the published deck
the next time they open the app with a connection, and keep playing offline
with the last deck they received.

## Users and access

The admin only (`apps/bff/src/admin.ts`): every route below answers 404 to
anyone else. Players read one public route, the published deck.

## Behaviour

- **The database becomes the deck's source of truth.** A migration seeds it
  once from the deck bundled with the app (`specs/cartes-mvp.md`), in one
  pack, "Pack officiel", everything published.
- **Cards.** The admin lists them, filtered by mini-game, level, status, pack
  and text (the filters are in the URL). A card is `draft`, `published` or
  `archived`; only published cards of published packs reach players. A card is
  never deleted: archiving keeps its reference, its history and old reports.
- **The form adapts to the mini-game**: answer, unit and source for a quiz
  (all required), how long the rule lasts for "Invente une règle", the audience
  for a gender card. The text is checked: `[J1]`…`[J4]` in order, and as many
  players as the mini-game takes (two for a duel, four for a quiz…).
- **A new card's reference** is the mini-game's prefix and the next free
  number (`TP-052`), chosen by the server.
- **Preview**: the card as players see it, with made-up names, in sips or
  points, at a low, middle and high stake.
- **Several cards at once**: level, status and pack, for the cards ticked in
  the list.
- **Packs**: name, description, published or not. A pack with no published
  card isn't offered. With more than one pack, the game's setup lets the
  group choose; with one, it shows a single line, as before.
- **History**: every creation and change records the admin's email, the time,
  and the card before and after. Shown per card and as a recent list.
- **Reports**: a report about a card links to that card's form, where it can
  be corrected or archived.
- **Players.** The home screen fetches the published deck when there is a
  connection, checks it, and keeps it on the phone. The game uses the last
  deck received, or the bundled one before any. A new deck is never swapped in
  during a game: it is read at the home screen only. A saved game whose card
  was archived moves on to the next card.

Failures: an invalid card is 400 with the field at fault; an unknown card or
pack is 404; the deck route failing (offline, server down) changes nothing for
the player, who keeps their last deck.

## Data

New tables, no change to existing rows:

- `packs` (`id` text, name, description, published, position);
- `cards` (`id` text such as `TP-001`, pack, mini-game, level, text, themes,
  audience, double tier, witness, rule duration, answer, unit, source, status);
- `card_changes` (card, admin's email, action, before, after, when).

A second migration inserts the pack and the 870 bundled cards.

## Pages and API

Pages, all under the hidden `/admin`, never indexed, never offline:
`/admin` (reports), `/admin/cartes`, `/admin/cartes/nouvelle`,
`/admin/cartes/$cardId`, `/admin/packs`, `/admin/historique`.

API:

| Route                         | Who    | Errors   |
| ----------------------------- | ------ | -------- |
| `GET /api/deck`               | anyone |          |
| `GET /api/admin/cards`        | admin  | 404      |
| `POST /api/admin/cards`       | admin  | 400, 404 |
| `PATCH /api/admin/cards/{id}` | admin  | 400, 404 |
| `POST /api/admin/cards/bulk`  | admin  | 400, 404 |
| `GET /api/admin/changes`      | admin  | 404      |
| `GET /api/admin/packs`        | admin  | 404      |
| `POST /api/admin/packs`       | admin  | 400, 404 |
| `PATCH /api/admin/packs/{id}` | admin  | 400, 404 |

## Out of scope

- Translations and English (V1 in `specs/specs.md`): cards have one text.
- Deleting a card or a pack.
- Card statistics (V1).
- Writing the admin's changes back to `specs/cartes-mvp.md` and the bundled
  deck: they stay the first-install fallback, and can be refreshed from the
  live deck by hand later.

## Tests

- Schema: a card's text and fields are checked against its mini-game.
- API: the deck holds published cards of published packs only; admin routes
  are 404 to others; create, update, bulk update and archive record history.
- Game: uses the deck it received, falls back to the bundled one, never
  stores an invalid deck, and filters by the packs chosen.
- Admin: creates a quiz card with its fields, previews it, publishes it, and
  the game's deck then holds it; archives a card from a report.

## Open questions

Decided while building, to be confirmed:

- Players receive a new deck at the home screen, not in the middle of a game.
- The bundled deck is not regenerated from the database automatically.
