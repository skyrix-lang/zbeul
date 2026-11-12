import type {
  Audience,
  Card,
  ContentTheme,
  Level,
  MiniGame,
} from "@zbeul/core";
import { pick, randomInt, shuffle, weightedPick, type Rng } from "./random";
import {
  GAMES,
  INTENSITIES,
  MAX_ACTIVE_RULES,
  MAX_PLAYERS,
  MAX_STAKE,
  MAX_TEAMS,
  MIN_PLAYERS,
  SELECTABLE_GAMES,
  SIPS_ONLY,
  UNLIMITED_HORIZON,
  type Intensity,
} from "./rules";

// A game, as plain data, and the functions that move it forward. Nothing here
// touches React, storage or the clock: the store (../store.ts) passes those
// in, so every rule can be tested with a seeded random source.

export type Gender = "gars" | "fille" | "autre";

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  /** Their own ceiling; null follows the game's level. */
  ceiling: Level | null;
  excluded: ContentTheme[];
  /** Index in `settings.teams`, when playing in teams. */
  team: number | null;
}

export interface Settings {
  format: "solo" | "teams";
  /** Team names; the length is the number of teams. */
  teams: string[];
  level: Level;
  /** Start at level 1 and climb to `level` during the game. */
  pressure: boolean;
  games: MiniGame[];
  sips: boolean;
  intensity: Intensity;
  /** Small stakes first, big ones at the end. */
  progressive: boolean;
  /** Number of cards; null is unlimited. */
  duration: number | null;
  /** Themes nobody wants tonight. */
  excluded: ContentTheme[];
  /** The packs to play with; empty plays them all. */
  packs: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  format: "solo",
  teams: ["Équipe 1", "Équipe 2"],
  level: 2,
  pressure: false,
  games: [...SELECTABLE_GAMES],
  sips: false,
  intensity: "normale",
  progressive: true,
  duration: 50,
  excluded: [],
  packs: [],
};

export type Outcome = "won" | "lost" | "joker";

export interface Turn {
  cardId: string;
  /** The players the card names, in order: [J1], [J2]… */
  players: string[];
  /** Sips or points; 0 when the card has none. */
  stake: number;
  outcome?: Outcome;
  /**
   * Points mode: what each player won (above zero) or lost (below) on a card
   * the group judged, by player id.
   */
  deltas?: Record<string, number>;
  /** Drawn after a joker, in place of the card before: not counted, no joker. */
  replacement?: true;
  /** Culture G: the answer is on screen. */
  revealed?: true;
  /** Action ou vérité: the half the player chose. */
  choice?: Choice;
  /** The players whose rule ended as this card came. */
  endedRules?: string[];
}

export type Choice = "action" | "verite";

/** The part of a turn that says which card it was, for whom. */
export type Draw = Pick<Turn, "cardId" | "players" | "stake">;

export interface Score {
  /** Stakes won: sips handed out, or points gained. */
  won: number;
  /** Stakes lost: sips drunk, or points lost. */
  lost: number;
}

export interface ActiveRule {
  playerId: string;
  /** Cards left, counting the current one. */
  remaining: number;
}

export interface GameState {
  id: string;
  startedAt: number;
  updatedAt: number;
  settings: Settings;
  players: Player[];
  /** Every card played; the last one is on screen. */
  turns: Turn[];
  finished: boolean;
  /** The deck ran dry before the planned end. */
  outOfCards: boolean;
  scores: Record<string, Score>;
  rules: ActiveRule[];
  /** Players who drew a drinking-partner card. */
  partners: string[];
  /** When each gender card falls (sips only). */
  genderSlots: { audience: Audience; at: number }[];
  /** The turn at which the next water break falls (sips only). */
  nextPauseAt: number;
}

export interface Deck {
  cards: readonly Card[];
  byId: ReadonlyMap<string, Card>;
}

export function createDeck(cards: readonly Card[]): Deck {
  return { cards, byId: new Map(cards.map((card) => [card.id, card])) };
}

// ── Setup ────────────────────────────────────────────────────────────────────

export const ceilingOf = (player: Player, settings: Settings): Level =>
  player.ceiling ?? settings.level;

/** The most teams these players can form: at least two players in each. */
export const maxTeams = (playerCount: number) =>
  Math.min(MAX_TEAMS, Math.floor(playerCount / 2));

/** Deals the players into `count` teams of equal size, give or take one. */
export function randomTeams(
  players: readonly Player[],
  count: number,
  rng: Rng,
): Player[] {
  const order = new Map(
    shuffle(rng, players).map((player, index) => [player.id, index % count]),
  );
  return players.map((player) => ({ ...player, team: order.get(player.id)! }));
}

/** Why the game can't start yet; empty when it can. In the app's own words. */
export function startProblems(
  settings: Settings,
  players: readonly Player[],
): string[] {
  const problems: string[] = [];
  const names = players.map((player) => player.name.trim().toLowerCase());
  if (players.length < MIN_PLAYERS) {
    problems.push("Il faut au moins 2 joueurs. Seul, c'est juste boire.");
  }
  if (players.length > MAX_PLAYERS) {
    problems.push(`${MAX_PLAYERS} joueurs maximum.`);
  }
  if (names.some((name) => name === "")) {
    problems.push("Un joueur n'a pas de prénom.");
  } else if (new Set(names).size !== names.length) {
    problems.push("Deux joueurs ont le même prénom : ajoute une initiale.");
  }
  if (settings.format === "teams") {
    const sizes = settings.teams.map(
      (_, team) => players.filter((player) => player.team === team).length,
    );
    if (
      sizes.some((size) => size < 2) ||
      players.some((player) => player.team === null)
    ) {
      problems.push("Chaque équipe doit avoir au moins 2 joueurs.");
    }
  }
  if (
    players.length >= MIN_PLAYERS &&
    !settings.games.some((game) => GAMES[game].minPlayers <= players.length)
  ) {
    problems.push("Coche au moins un mini-jeu jouable à ce nombre.");
  }
  return problems;
}

// ── Level and stake ──────────────────────────────────────────────────────────

const horizonOf = (settings: Settings) =>
  settings.duration ?? UNLIMITED_HORIZON;

/**
 * The highest level a card may have at this turn. With "montée en pression"
 * the game climbs one level at a time and reaches its own at half-time, so
 * the second half is played at the level that was chosen.
 */
export function levelCap(settings: Settings, turn: number): Level {
  if (!settings.pressure || settings.level === 1) return settings.level;
  const step = horizonOf(settings) / 2 / (settings.level - 1);
  return Math.min(settings.level, 1 + Math.floor(turn / step)) as Level;
}

/** How much more often a level comes up than the one below: twice. */
export const levelWeight = (level: Level) => 2 ** (level - 1);

/** The cards played so far: a joker's replacement isn't one more. */
export const cardCount = (state: Pick<GameState, "turns">) =>
  state.turns.filter((turn) => !turn.replacement).length;

/**
 * The stake of the card at `turn`. Flat: any value of the intensity's range.
 * Progressive: a two-value window that stays low for the first third of the
 * game, climbs, and stays at the top for the last third.
 */
export function stakeAt(settings: Settings, turn: number, rng: Rng): number {
  const { flat, from, to } = INTENSITIES[settings.intensity];
  if (!settings.progressive) return randomInt(rng, flat[0], flat[1]);
  const progress = Math.min(1, turn / Math.max(1, horizonOf(settings) - 1));
  const eased = Math.min(1, Math.max(0, (progress - 0.32) / 0.36));
  const low = Math.round(from + (to - from) * eased);
  return Math.min(MAX_STAKE, low + randomInt(rng, 0, 1));
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const overlaps = (a: readonly ContentTheme[], b: readonly ContentTheme[]) =>
  a.some((theme) => b.includes(theme));

const genderOf: Record<Audience, Gender> = {
  gars: "gars",
  filles: "fille",
  autres: "autre",
};

/** How often each player has been named so far. */
function timesNamed(state: GameState) {
  const counts = new Map(state.players.map((player) => [player.id, 0]));
  for (const turn of state.turns) {
    for (const id of turn.players) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The players a card may name: it suits their ceiling and their exclusions. */
function suitedPlayers(card: Card, state: GameState): Player[] {
  const group = GAMES[card.game].kind === "group";
  return state.players.filter((player) => {
    // A group card suits everyone or nobody (checked in `playable`): the
    // player it names only starts the round.
    if (group) return true;
    if (card.game === "partenaire" && state.partners.includes(player.id)) {
      return false;
    }
    return (
      card.level <= ceilingOf(player, state.settings) &&
      !overlaps(card.themes, player.excluded)
    );
  });
}

/**
 * Picks who the card names, least-named players first so everyone is named
 * about as often. Null when there aren't enough players for it.
 */
function chooseTargets(
  card: Card,
  state: GameState,
  rng: Rng,
  /** The player the card must name first: a joker's replacement. */
  firstId?: string,
): string[] | null {
  if (card.targets === 0) return [];
  const counts = timesNamed(state);
  const order = shuffle(rng, suitedPlayers(card, state)).sort(
    (a, b) =>
      Number(b.id === firstId) - Number(a.id === firstId) ||
      counts.get(a.id)! - counts.get(b.id)!,
  );
  if (firstId && order[0]?.id !== firstId) return null;
  if (card.game === "duel" && state.settings.format === "teams") {
    // Two teams face each other.
    const first = order[0];
    const second = order.find((player) => player.team !== first?.team);
    return first && second ? [first.id, second.id] : null;
  }
  if (order.length < card.targets) return null;
  return order.slice(0, card.targets).map((player) => player.id);
}

/** Whether this card can be drawn now, whoever it ends up naming. */
function playable(card: Card, state: GameState, cap: Level): boolean {
  const { settings, players } = state;
  const info = GAMES[card.game];
  if (card.audience || card.game === "pause") return false; // Placed, not drawn.
  if (!settings.games.includes(card.game)) return false;
  if (!settings.sips && SIPS_ONLY.includes(card.game)) return false;
  if (card.level > cap || players.length < info.minPlayers) return false;
  if (overlaps(card.themes, settings.excluded)) return false;
  // A card without a pack (the bundled deck) is in every game.
  const packs = settings.packs ?? [];
  if (packs.length > 0 && card.pack && !packs.includes(card.pack)) return false;
  if (state.turns.some((turn) => turn.cardId === card.id)) return false;

  if (info.kind === "group") {
    // A card for the whole group never goes past the most careful player.
    return players.every(
      (player) =>
        card.level <= ceilingOf(player, settings) &&
        !overlaps(card.themes, player.excluded),
    );
  }
  if (info.kind === "rule" && state.rules.length >= MAX_ACTIVE_RULES) {
    return false;
  }
  if (info.kind === "partner") {
    // Once per game at levels 1 and 2, twice above.
    const quota = settings.level <= 2 ? 1 : 2;
    if (state.partners.length >= quota) return false;
  }
  const suited = suitedPlayers(card, state);
  if (card.game === "duel" && settings.format === "teams") {
    return new Set(suited.map((player) => player.team)).size >= 2;
  }
  return suited.length >= card.targets;
}

const gameOf = (turn: Turn | undefined, deck: Deck) =>
  turn && deck.byId.get(turn.cardId)?.game;

/** A water break or a gender card that is due at this turn, if any. */
function placedCard(
  state: GameState,
  deck: Deck,
  rng: Rng,
): { card: Card; patch: Partial<GameState> } | null {
  const turn = cardCount(state);
  if (!state.settings.sips) return null;

  if (turn >= state.nextPauseAt) {
    const pauses = deck.cards.filter((card) => card.game === "pause");
    const fresh = pauses.filter(
      (card) => !state.turns.some((played) => played.cardId === card.id),
    );
    if (pauses.length > 0) {
      return {
        card: pick(rng, fresh.length > 0 ? fresh : pauses),
        patch: { nextPauseAt: turn + randomInt(rng, 45, 55) },
      };
    }
  }

  // Not right after another card of the same mini-game.
  if (gameOf(state.turns.at(-1), deck) === "tout-le-monde") return null;
  const due = state.genderSlots.find((slot) => slot.at <= turn);
  if (!due) return null;
  const genderSlots = state.genderSlots.filter((slot) => slot !== due);
  const card = deck.cards.find((card) => card.audience === due.audience);
  const concerned = state.players.some(
    (player) => player.gender === genderOf[due.audience],
  );
  if (!card || !concerned) {
    // Nobody is concerned: the card is skipped, and the next one may fall.
    return placedCard({ ...state, genderSlots }, deck, rng) ?? null;
  }
  return { card, patch: { genderSlots } };
}

/** Draws from the mixed deck: a mini-game first, then a level, then a card. */
function drawnCard(
  state: GameState,
  deck: Deck,
  rng: Rng,
  recent: ReadonlySet<string>,
  /** A joker's replacement: the same mini-game, for the same player. */
  only?: { game: MiniGame; playerId: string },
): Card | null {
  const cap = levelCap(state.settings, cardCount(state));
  const pool = deck.cards.filter(
    (card) =>
      playable(card, state, cap) &&
      (!only ||
        (card.game === only.game &&
          suitedPlayers(card, state).some(
            (player) => player.id === only.playerId,
          ))),
  );
  if (pool.length === 0) return null;

  const all = [...new Set(pool.map((card) => card.game))];
  const previous = gameOf(state.turns.at(-1), deck);
  const quizTooRecent = state.turns
    .slice(-4)
    .some((turn) => gameOf(turn, deck) === "culture-g");
  // Each mini-game is as likely as the others, however many cards it has;
  // never the same twice in a row, and at most one quiz in five cards.
  let games = all.filter(
    (game) => game !== previous && !(game === "culture-g" && quizTooRecent),
  );
  if (games.length === 0) games = all.filter((game) => game !== previous);
  if (games.length === 0) games = all;
  const game = pick(rng, games);

  // The game's level dominates: each level comes up twice as often as the
  // one below it.
  const ofGame = pool.filter((card) => card.game === game);
  const levels = [...new Set(ofGame.map((card) => card.level))];
  const level = weightedPick(rng, levels, levelWeight);
  const candidates = ofGame.filter((card) => card.level === level);
  // Cards seen in the last games on this phone wait their turn.
  const fresh = candidates.filter((card) => !recent.has(card.id));
  return pick(rng, fresh.length > 0 ? fresh : candidates);
}

// ── Playing ──────────────────────────────────────────────────────────────────

const emptyScore = (): Score => ({ won: 0, lost: 0 });

/** Adds `points` to a player's score: won when above zero, lost when below. */
function addScore(
  scores: GameState["scores"],
  playerId: string | undefined,
  points: number,
): GameState["scores"] {
  if (!playerId || points === 0) return scores;
  const score = scores[playerId] ?? emptyScore();
  return {
    ...scores,
    [playerId]:
      points > 0
        ? { ...score, won: score.won + points }
        : { ...score, lost: score.lost - points },
  };
}

export interface Context {
  deck: Deck;
  rng: Rng;
  now: number;
  /** Cards seen in the last games on this phone. */
  recent?: ReadonlySet<string>;
  /**
   * The card to show next instead of drawing one: after stepping back, the
   * game shows the same cards again.
   */
  redo?: Draw;
}

/** Moves to the next card, or ends the game when there is none. */
export function nextTurn(state: GameState, context: Context): GameState {
  const { deck, rng, now, recent = new Set<string>() } = context;
  const { settings } = state;
  const turn = cardCount(state);
  const base = { ...state, updatedAt: now };
  if (state.finished) return state;
  if (settings.duration !== null && turn >= settings.duration) {
    return { ...base, finished: true };
  }

  const again = context.redo && deck.byId.get(context.redo.cardId);
  const placed = again ? null : placedCard(state, deck, rng);
  const card = again ?? placed?.card ?? drawnCard(state, deck, rng, recent);
  const players =
    card && (again ? context.redo!.players : chooseTargets(card, state, rng));
  if (!card || !players) return { ...base, finished: true, outOfCards: true };

  const kind = GAMES[card.game].kind;
  const noStake = kind === "pause" || kind === "partner";
  const stake = again
    ? context.redo!.stake
    : noStake
      ? 0
      : stakeAt(settings, turn, rng);
  // A rule made on an earlier card has one card fewer to live.
  const rules = state.rules.map((rule) => ({
    ...rule,
    remaining: rule.remaining - 1,
  }));
  const ended = rules.filter((rule) => rule.remaining <= 0);
  const drawn: Turn = {
    cardId: card.id,
    players,
    stake,
    ...(ended.length > 0 && {
      endedRules: ended.map((rule) => rule.playerId),
    }),
  };
  const next: GameState = {
    ...base,
    ...placed?.patch,
    turns: [...state.turns, drawn],
    rules: rules.filter((rule) => rule.remaining > 0),
  };
  if (again) {
    // The moments of the placed cards were settled the first time round.
    if (card.game === "pause") {
      next.nextPauseAt = turn + randomInt(rng, 45, 55);
    }
    if (card.audience) {
      const slot = state.genderSlots.find(
        (slot) => slot.audience === card.audience,
      );
      next.genderSlots = state.genderSlots.filter((other) => other !== slot);
    }
  }

  const [first] = players;
  if (kind === "sentence" && !settings.sips) {
    // No button: the player loses the stake as the card appears.
    drawn.outcome = "lost";
    next.scores = addScore(state.scores, first, -stake);
  }
  if (kind === "rule" && first) {
    // Shown on its own card, then for `ruleDuration` more.
    next.rules.push({
      playerId: first,
      remaining: (card.ruleDuration ?? 10) + 1,
    });
  }
  if (kind === "partner" && first) {
    next.partners = [...state.partners, first];
  }
  return next;
}

/**
 * After a joker: another card of the same mini-game for the same player, in
 * place of the one refused. Null when there is none left for them.
 */
function replacementTurn(
  state: GameState,
  refused: Turn,
  card: Card,
  context: Context,
): GameState | null {
  const { deck, rng, now, recent = new Set<string>() } = context;
  const playerId = refused.players[0];
  if (!playerId) return null;
  const again = context.redo && deck.byId.get(context.redo.cardId);
  const next =
    again ?? drawnCard(state, deck, rng, recent, { game: card.game, playerId });
  const players =
    next &&
    (again ? context.redo!.players : chooseTargets(next, state, rng, playerId));
  if (!next || !players) return null;
  return {
    ...state,
    updatedAt: now,
    turns: [
      ...state.turns,
      { cardId: next.id, players, stake: refused.stake, replacement: true },
    ],
  };
}

/** Starts a game and draws its first card. */
export function startGame(
  input: { id: string; settings: Settings; players: Player[] },
  context: Context,
): GameState {
  const { rng, now } = context;
  const { settings } = input;
  const players = input.players.map((player) => ({
    ...player,
    name: player.name.trim(),
    team: settings.format === "teams" ? player.team : null,
  }));
  // The three gender cards fall once each, at random moments.
  const last = Math.max(4, (settings.duration ?? 60) - 2);
  const moments = shuffle(
    rng,
    Array.from({ length: last - 1 }, (_, index) => index + 2),
  );
  const withGenderCards =
    settings.sips && settings.games.includes("tout-le-monde");
  const state: GameState = {
    id: input.id,
    startedAt: now,
    updatedAt: now,
    settings,
    players,
    turns: [],
    finished: false,
    outOfCards: false,
    scores: Object.fromEntries(
      players.map((player) => [player.id, emptyScore()]),
    ),
    rules: [],
    partners: [],
    genderSlots: withGenderCards
      ? (["gars", "filles", "autres"] as const).map((audience, index) => ({
          audience,
          at: moments[index] ?? index + 2,
        }))
      : [],
    nextPauseAt: randomInt(rng, 45, 55),
  };
  return nextTurn(state, context);
}

/**
 * Whether the card on screen is settled with "Gagné" / "Perdu": it names one
 * player to judge, and the game counts points. With sips there is no score,
 * so every card only has "Carte suivante".
 */
export function isSettled(card: Card, settings: Pick<Settings, "sips">) {
  return !settings.sips && GAMES[card.game].kind === "solo";
}

/** Whether the group says who lost this card: points mode, several players. */
export function isJudged(card: Card, settings: Pick<Settings, "sips">) {
  const { kind } = GAMES[card.game];
  return (
    !settings.sips &&
    (kind === "group" || kind === "duel" || kind === "closest")
  );
}

/** Whether the card has an answer to show before the next card. */
export const hasAnswer = (card: Card) => GAMES[card.game].kind === "closest";

const replaceLast = (state: GameState, turn: Turn): GameState => ({
  ...state,
  turns: [...state.turns.slice(0, -1), turn],
});

/** Action ou vérité: the player says which, and the card shows that half. */
export function choose(state: GameState, choice: Choice, now: number) {
  const turn = state.turns.at(-1);
  if (!turn || state.finished || turn.choice) return state;
  return { ...replaceLast(state, { ...turn, choice }), updatedAt: now };
}

/**
 * Settles the card on screen, then moves on.
 * - "Gagné" and "Perdu" count for a card that names one player to judge.
 * - "Joker" costs them the stake and brings another card of the same
 *   mini-game for them; that one has no joker.
 * - `deltas` are the points the group gave on a card it judged.
 * - A quiz shows its answer first: the next call moves on.
 */
export function play(
  state: GameState,
  outcome: Outcome | "next",
  context: Context,
  deltas: Record<string, number> = {},
): GameState {
  const turn = state.turns.at(-1);
  if (!turn || state.finished) return state;
  const card = context.deck.byId.get(turn.cardId);
  // A card that an update removed from the deck can't be settled: the game
  // moves on, so a saved game stays playable.
  if (!card) return nextTurn(state, context);
  const { settings } = state;

  if (hasAnswer(card) && !turn.revealed) {
    return {
      ...replaceLast(state, { ...turn, revealed: true }),
      updatedAt: context.now,
    };
  }
  if (isJudged(card, settings) && !turn.deltas) {
    const given = Object.entries(deltas).filter(([, points]) => points !== 0);
    if (given.length > 0) {
      const judged: GameState = {
        ...replaceLast(state, { ...turn, deltas: Object.fromEntries(given) }),
        scores: given.reduce(
          (scores, [id, points]) => addScore(scores, id, points),
          state.scores,
        ),
      };
      return nextTurn(judged, context);
    }
  }
  if (outcome === "next" || !isSettled(card, settings) || turn.outcome) {
    return nextTurn(state, context);
  }
  // A replacement can't be refused in turn: its joker counts as lost.
  const settled: GameState = {
    ...replaceLast(state, { ...turn, outcome }),
    scores: addScore(
      state.scores,
      turn.players[0],
      outcome === "won" ? turn.stake : -turn.stake,
    ),
  };
  if (outcome === "joker" && !turn.replacement) {
    const replaced = replacementTurn(settled, turn, card, context);
    if (replaced) return replaced;
  }
  return nextTurn(settled, context);
}

/** Ends the game now: the ranking comes next. */
export function endGame(state: GameState, now: number): GameState {
  return { ...state, finished: true, updatedAt: now };
}

// ── Reading a game ───────────────────────────────────────────────────────────

export interface RankingRow {
  id: string;
  name: string;
  /** Team members, when playing in teams. */
  members: string[];
  won: number;
  lost: number;
  /** What the ranking is sorted by: won minus lost. */
  total: number;
  rank: number;
}

/** Players, or teams, from first to last; equal totals share a rank. */
export function ranking(state: GameState): RankingRow[] {
  const { settings, players, scores } = state;
  const sum = (group: Player[]) =>
    group.reduce(
      (total, player) => ({
        won: total.won + (scores[player.id]?.won ?? 0),
        lost: total.lost + (scores[player.id]?.lost ?? 0),
      }),
      emptyScore(),
    );
  const groups =
    settings.format === "teams"
      ? settings.teams.map((name, team) => ({
          id: `team-${team}`,
          name,
          group: players.filter((player) => player.team === team),
        }))
      : players.map((player) => ({
          id: player.id,
          name: player.name,
          group: [player],
        }));
  const rows = groups
    .map(({ id, name, group }) => {
      const { won, lost } = sum(group);
      return {
        id,
        name,
        members:
          settings.format === "teams" ? group.map((player) => player.name) : [],
        won,
        lost,
        total: won - lost,
      };
    })
    .sort((a, b) => b.total - a.total);
  return rows.map((row) => ({
    ...row,
    rank: 1 + rows.findIndex((other) => other.total === row.total),
  }));
}

/** The answer nobody saw: the game ended on a quiz before it was shown. */
export function missedAnswer(state: GameState, deck: Deck): Card | null {
  const last = state.turns.at(-1);
  const card = last && deck.byId.get(last.cardId);
  return card && hasAnswer(card) && !last.revealed ? card : null;
}
