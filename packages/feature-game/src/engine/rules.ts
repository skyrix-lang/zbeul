import { MINI_GAME_LABELS, type Level, type MiniGame } from "@zbeul/core";

// The names of the levels and themes are shared with the admin.
export { LEVEL_NAMES, THEME_LABELS } from "@zbeul/core";

// The fixed rules of the game (specs/specs.md §3 to §6): what each mini-game
// is, the levels, the stakes. Nothing here changes during a game.

export type Family = "vote" | "revelations" | "defis" | "culture" | "collectif";

export const FAMILY_LABELS: Record<Family, string> = {
  vote: "Vote",
  revelations: "Révélations",
  defis: "Défis",
  culture: "Culture G",
  collectif: "Collectif et règles",
};

/**
 * How a card is played, which decides the buttons and the score:
 * - solo: one player wins or loses ("Gagné" / "Perdu" / "Joker");
 * - group: everyone plays, the losers are named out loud, no score;
 * - duel, closest: named players, the group referees, no score;
 * - sentence: the player loses the stake at once;
 * - rule, partner, pause: no winner.
 */
export type Kind =
  | "solo"
  | "group"
  | "duel"
  | "closest"
  | "sentence"
  | "rule"
  | "partner"
  | "pause";

export interface MiniGameInfo {
  label: string;
  family: Family;
  kind: Kind;
  minPlayers: number;
  /** One line that reminds the group how it's played. */
  how: string;
}

export const GAMES: Record<MiniGame, MiniGameInfo> = {
  "tu-preferes": {
    label: MINI_GAME_LABELS["tu-preferes"],
    family: "vote",
    kind: "group",
    minPlayers: 3,
    how: "Tout le monde vote. La minorité trinque.",
  },
  jamais: {
    label: MINI_GAME_LABELS["jamais"],
    family: "revelations",
    kind: "group",
    minPlayers: 3,
    how: "Ceux qui l'ont fait trinquent.",
  },
  "action-verite": {
    label: MINI_GAME_LABELS["action-verite"],
    family: "revelations",
    kind: "solo",
    minPlayers: 2,
    how: "Tu choisis. Refuser, c'est perdre.",
  },
  "qui-pourrait": {
    label: MINI_GAME_LABELS["qui-pourrait"],
    family: "vote",
    kind: "group",
    minPlayers: 3,
    how: "À trois, tout le monde pointe du doigt.",
  },
  tribunal: {
    label: MINI_GAME_LABELS["tribunal"],
    family: "vote",
    kind: "solo",
    minPlayers: 4,
    how: "Le groupe vote. Coupable, c'est perdu.",
  },
  duel: {
    label: MINI_GAME_LABELS["duel"],
    family: "defis",
    kind: "duel",
    minPlayers: 3,
    how: "Le groupe arbitre et désigne le perdant.",
  },
  "culture-g": {
    label: MINI_GAME_LABELS["culture-g"],
    family: "culture",
    kind: "closest",
    minPlayers: 4,
    how: "Chacun annonce un nombre. Réponse sur la carte suivante.",
  },
  chaine: {
    label: MINI_GAME_LABELS["chaine"],
    family: "defis",
    kind: "group",
    minPlayers: 3,
    how: "Chacun son tour. Qui sèche ou répète a perdu.",
  },
  valise: {
    label: MINI_GAME_LABELS["valise"],
    family: "defis",
    kind: "group",
    minPlayers: 3,
    how: "Répète la liste, ajoute un objet. Qui se trompe a perdu.",
  },
  "montre-ou-bois": {
    label: MINI_GAME_LABELS["montre-ou-bois"],
    family: "defis",
    kind: "solo",
    minPlayers: 2,
    how: "Prouve-le tout de suite, ou c'est perdu.",
  },
  "tout-le-monde": {
    label: MINI_GAME_LABELS["tout-le-monde"],
    family: "collectif",
    kind: "group",
    minPlayers: 2,
    how: "Les concernés se dénoncent.",
  },
  sentence: {
    label: MINI_GAME_LABELS["sentence"],
    family: "collectif",
    kind: "sentence",
    minPlayers: 2,
    how: "Sans raison. C'est le jeu.",
  },
  regle: {
    label: MINI_GAME_LABELS["regle"],
    family: "collectif",
    kind: "rule",
    minPlayers: 3,
    how: "Annonce ta règle à voix haute.",
  },
  partenaire: {
    label: MINI_GAME_LABELS["partenaire"],
    family: "collectif",
    kind: "partner",
    minPlayers: 3,
    how: "Désigne ton partenaire à voix haute.",
  },
  pause: {
    label: MINI_GAME_LABELS["pause"],
    family: "collectif",
    kind: "pause",
    minPlayers: 2,
    how: "Hydratation obligatoire.",
  },
};

/** Mini-games played with drinks only: removed when sips are off. */
export const SIPS_ONLY: readonly MiniGame[] = ["partenaire", "pause"];

/** The mini-games offered in the setup: Pause can't be turned off. */
export const SELECTABLE_GAMES = (Object.keys(GAMES) as MiniGame[]).filter(
  (game) => game !== "pause",
);

export const LEVEL_TONES: Record<Level, string> = {
  1: "Facile, brise-glace",
  2: "Taquin, absurde",
  3: "Flirt, révélations",
  4: "Cash, roast assumé",
  5: "Limite limite, malaise assumé",
};

/** A player's own ceiling, when it differs from the game's level. */
export const PROFILES: { level: Level; label: string }[] = [
  { level: 2, label: "Tranquille" },
  { level: 3, label: "Partant" },
  { level: 4, label: "Chaud" },
  { level: 5, label: "Border" },
];

export type Intensity = "douce" | "normale" | "forte" | "hardcore";

/**
 * The stake's range: `flat` when it stays the same all game, and where a
 * progressive game starts and ends. Never above 5, so a doubled stake stays
 * within 10 sips.
 */
export const INTENSITIES: Record<
  Intensity,
  { label: string; flat: [number, number]; from: number; to: number }
> = {
  douce: { label: "Douce", flat: [1, 2], from: 1, to: 2 },
  normale: { label: "Normale", flat: [1, 3], from: 1, to: 4 },
  forte: { label: "Forte", flat: [2, 4], from: 2, to: 4 },
  hardcore: { label: "Hardcore", flat: [3, 5], from: 3, to: 4 },
};

export const MAX_STAKE = 5;
export const DURATIONS = [30, 50, 80, null] as const;
/** An unlimited game rises as if it had this many cards, then stays at the top. */
export const UNLIMITED_HORIZON = 80;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const MAX_TEAMS = 5;
export const MAX_ACTIVE_RULES = 3;
/** A paused game is offered again for this long. */
export const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;
/** The age gate is asked again after this long. */
export const AGE_GATE_MS = 365 * 24 * 60 * 60 * 1000;
