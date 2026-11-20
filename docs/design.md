# Design

How Zbeul looks and why: read it before building or changing a screen. The
`design` skill (`.claude/skills/design/SKILL.md`) updates it with the person;
keep it in step with the theme and the screens. Rules, not history.

## Brief

- **For:** groups of adults at a party, playing on one phone passed from hand
  to hand (`specs/specs.md`), and the one administrator who manages the cards.
- **Visitors should:** confirm they are adults, start a game in a few taps,
  then read one card at a time aloud and pass the phone.
- **Tone:** festive, a little cheeky, never a menu to learn: big text, big
  buttons, the next action obvious. The legal pages stay clear and in the
  app's voice, without jokes about what they say.

## Direction

A night out on a phone: dark by default, vivid accents, soft moving lights
behind the home and the age gate, and cards whose colour rises with the
level, from mint ("Apéro entre potes") to deep violet with a glow ("Border").
One rounded, slightly condensed display font for everything that is read from
a distance. Five themes the players pick in the settings; every screen works
in all of them.

## Tokens

All in `packages/theme-default/src/theme.css`; what each one does is in
`packages/theme-default/AGENTS.md`. The values below are the default theme,
"Nuit".

| Role     | Value                                                                                                               | Why                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Themes   | Nuit (default), Tokyo Night, Rétro (dark); Clair, Crème (light): `:root` and `:root[data-theme="…"]`                | the players choose the mood; `theme.js` applies it pre-paint |
| Brand    | `--primary` pink `#ff3d8b`                                                                                          | one colour for every action                                  |
| Surfaces | `--background` `#0b0b12`, `--card` `#16161f`, `--muted` `#1f1f2b`                                                   | almost black, so the cards and the glow carry the colour     |
| Levels   | `--level-1` to `--level-5` (mint, yellow, orange, magenta, violet with `--level-5-glow`), each with a `-foreground` | a card's colour shows how far the game has gone              |
| Families | `--family-vote`, `-revelations`, `-defis`, `-culture`, `-collectif`                                                 | a mini-game family's dot, always next to its label           |
| Fonts    | body: system UI; headings: `--font-display`, Bricolage Grotesque Variable (self-hosted, width axis)                 | readable at arm's length, with character; no font for body   |
| Headings | `--font-heading: var(--font-display)`, weight 800, tracking -0.025em                                                | heavy, tight titles, the same in every theme                 |
| Radius   | `0.875rem`                                                                                                          | round and friendly                                           |
| Layout   | content 80rem, text 65ch, sections 4rem                                                                             | used by the admin and sign-in pages; the game is a column    |

## Type

- The wordmark (`Wordmark`, `packages/feature-game/src/components/screen.tsx`):
  "Zbeul" in the display font, extra bold, `tracking-tighter`, 90 % width,
  with a gradient from `primary` to `level-3`. `text-[5.5rem]` on the home,
  `text-6xl` on the age gate. It is the home's `h1`.
- `heading-screen`: a game screen's `h1` (`Screen`, the end screen, the error
  and 404 messages). `heading-screen-sm`: the age gate's longer title. Both
  keep one size at every width (`docs/decisions.md`, "Game screen titles keep
  one size at every width").
- A screen's section titles (`Section`, the legal pages' blocks): `h2` in
  `font-display text-xl font-extrabold`.
- `text-h2`: the admin's page titles and sign-in, and the starter's sign-in.
- The paragraph under a title is `text-muted-foreground`; secondary text is
  `text-sm text-muted-foreground`.
- A card's text sizes itself to fill the card (`FitText`, 10 to 72 px) and
  never scrolls; a named player is highlighted as the card inverted.
- Big buttons (`size="xl"`) use the display font, extra bold.

## Sections and components

- **Game column:** every player screen is `mx-auto max-w-md` (28rem), full
  height (`min-h-dvh`), with `SAFE_AREA` padding that keeps clear of the notch
  and the home bar. There is no header, menu or navigation bar: every screen
  leads back to the home.
- **Home:** the wordmark, the tagline in the display font, one sentence, then
  "Jouer" (or "Reprendre la partie" and "Nouvelle partie") as `xl` buttons,
  and "Favoris" and "Réglages" as ghost links at the bottom. `Glow` behind.
- **Screen** (`components/screen.tsx`): a ghost "Retour" link, the title, an
  optional intro, the content in `gap-6`. With a `footer`, the content
  scrolls above it and the footer (the main action) stays at the bottom.
- **Section:** a titled block of a screen, `h2` and an optional hint.
- **Game card** (`components/game-card.tsx`): background in its level's
  colour, the family as a dot and a label, the text filling the card; level 5
  adds a ring and a glow.
- **Choice:** one choice among a few as big touch targets (native radios).
- **Admin** (`packages/feature-admin`): a desk tool, not a party screen: a
  `max-w-4xl` column with a header ("Zbeul, admin", the email, sign-out), tabs,
  then each page's `AdminSection` (`page-section py-0`: the column gives the
  spacing). Its text can be selected.
- **Pages with the starter's layout** (`_starter`): header and footer, each
  page `page-section` > `page-container`.
- Buttons: one primary `xl` action per screen; the rest `secondary` or
  `ghost`.

## Imagery and icons

- Icons: Lucide, `aria-hidden` next to a text: `size-5` in a big link or
  button ("Retour", "Installer l'appli"), `size-4` in a small one.
- No photos or illustrations. Decoration is the `Glow` (blurred `primary`,
  `level-5-glow` and `level-3` blobs drifting slowly, still with reduced
  motion) and the level colours.
- The app icon and favicons come from `apps/web/public/icon.svg`.

## Do and don't

- Do use the tokens for every colour, including the level and family
  colours, so all five themes work; check a new screen in Clair and Crème as
  well as Nuit.
- Do keep touch targets big and the next action obvious: the phone is passed
  around, often in the dark.
- Do keep players' data on the phone; nothing on screen implies an account.
- Don't add a menu or a navigation bar to the game.
- Don't use a raw heading size; a new fixed size is a utility next to
  `heading-screen`.
- Don't animate without `motion-reduce:` falling back to still.

## Pages

| Page                                                              | Kind   | Sections                                                                 |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `/`                                                               | public | age gate on a first visit (wordmark, title, confirm); then the home      |
| `/jouer`                                                          | app    | Screen: players, level, stakes, length, options; start in the footer     |
| `/partie`                                                         | app    | one card at a time, full screen; its `h1` is visually hidden             |
| `/fin`                                                            | app    | the ranking (points mode), replay, the game's cards to add to favourites |
| `/favoris`                                                        | app    | Screen: the saved cards                                                  |
| `/reglages`                                                       | app    | Screen: theme picker with a card preview, links, erase the data          |
| `/installer`                                                      | app    | Screen: how to add the app to the home screen                            |
| `/signaler`                                                       | app    | Screen: report a problem with a card                                     |
| `/mentions-legales`, `/conditions`, `/confidentialite`, `/charte` | public | Screen with titled blocks; readable before the age gate                  |
| `/admin` (signalements) and its tabs cartes, packs, historique    | app    | admin column: header, tabs, `AdminSection`                               |
| `/sign-in`                                                        | app    | the starter's: one narrow card, title, text, sign-in button              |
