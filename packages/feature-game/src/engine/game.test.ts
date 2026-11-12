import { describe, expect, it } from "vitest";
import type { Card, Level, MiniGame } from "@zbeul/core";
import { deck } from "../cards";
import {
  cardCount,
  choose,
  DEFAULT_SETTINGS,
  levelCap,
  nextTurn,
  missedAnswer,
  play,
  randomTeams,
  ranking,
  stakeAt,
  startGame,
  startProblems,
  type Context,
  type GameState,
  type Gender,
  type Player,
  type Settings,
} from "./game";
import { seeded } from "./random";
import { GAMES, SELECTABLE_GAMES } from "./rules";
import { cardSegments, segmentsText, stakeLine } from "./text";

const NAMES = ["Ada", "Bob", "Cléo", "Dan", "Eve", "Fay", "Gus", "Hugo"];
const GENDERS: Gender[] = ["fille", "gars", "autre"];

function somePlayers(count: number, overrides: Partial<Player> = {}): Player[] {
  return NAMES.slice(0, count).map((name, index) => ({
    id: name,
    name,
    gender: GENDERS[index % 3]!,
    ceiling: null,
    excluded: [],
    team: null,
    ...overrides,
  }));
}

const settingsWith = (overrides: Partial<Settings>): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

const contextFor = (seed: number): Context => ({
  deck,
  rng: seeded(seed),
  now: 0,
});

/** Plays a whole game with "Carte suivante", or up to `limit` cards. */
function playThrough(
  settings: Settings,
  players: Player[],
  seed = 1,
  limit = 500,
): GameState {
  const context = contextFor(seed);
  let state = startGame({ id: "game", settings, players }, context);
  while (!state.finished && state.turns.length < limit) {
    state = play(state, "next", context);
  }
  return state;
}

const cardsOf = (state: GameState): Card[] =>
  state.turns.map((turn) => deck.byId.get(turn.cardId)!);

const count = <T>(items: T[]) => {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
};

describe("the mix of mini-games", () => {
  it("never plays the same mini-game twice in a row", () => {
    for (const seed of [1, 2, 3]) {
      const games = cardsOf(
        playThrough(settingsWith({ duration: 80 }), somePlayers(6), seed),
      ).map((card) => card.game);
      expect(new Set(games).size).toBeGreaterThan(8);
      games.forEach((game, index) => {
        expect(game).not.toBe(games[index - 1]);
      });
    }
  });

  it("never plays a mini-game that is unchecked", () => {
    const games: MiniGame[] = ["tu-preferes", "duel", "sentence"];
    const state = playThrough(settingsWith({ games }), somePlayers(5));
    expect(state.turns).toHaveLength(50);
    for (const card of cardsOf(state)) expect(games).toContain(card.game);
  });

  it("plays each checked mini-game about as often, whatever its size", () => {
    const played: MiniGame[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const state = playThrough(
        settingsWith({ duration: 80, level: 3 }),
        somePlayers(6),
        seed,
      );
      played.push(...cardsOf(state).map((card) => card.game));
    }
    const counts = count(played);
    // Sips are off: no drinking partner, no water break.
    const expected = SELECTABLE_GAMES.filter((game) => game !== "partenaire");
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect([...counts.keys()].sort(byName)).toEqual([...expected].sort(byName));
    const share = played.length / expected.length;
    const uneven = expected.filter((game) => {
      const times = counts.get(game)!;
      return times < share * 0.7 || times > share * 1.3;
    });
    expect(uneven).toEqual([]);
  });

  it("plays at most one quiz in five cards", () => {
    const games = cardsOf(
      playThrough(
        settingsWith({
          duration: 80,
          level: 5,
          games: ["culture-g", "duel", "sentence"],
        }),
        somePlayers(5),
      ),
    ).map((card) => card.game);
    expect(games).toContain("culture-g");
    games.forEach((_, index) => {
      const window = games.slice(index, index + 5);
      expect(
        window.filter((game) => game === "culture-g").length,
      ).toBeLessThanOrEqual(1);
    });
  });

  it("names every player about as often", () => {
    const state = playThrough(settingsWith({ duration: 80 }), somePlayers(6));
    const named = count(state.turns.flatMap((turn) => turn.players));
    const counts = [...named.values()];
    expect(named.size).toBe(6);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("holds back the cards seen in the last games", () => {
    const settings = settingsWith({ games: ["duel"], level: 1, duration: 5 });
    const duels = deck.cards.filter(
      (card) => card.game === "duel" && card.level === 1,
    );
    const recent = new Set(duels.slice(0, -5).map((card) => card.id));
    const context = { ...contextFor(4), recent };
    let state = startGame(
      { id: "game", settings, players: somePlayers(4) },
      context,
    );
    while (!state.finished) state = play(state, "next", context);
    for (const turn of state.turns) expect(recent.has(turn.cardId)).toBe(false);
  });

  it("ends early, and says so, when the deck runs dry", () => {
    const state = playThrough(
      settingsWith({ games: ["duel"], level: 1, duration: null }),
      somePlayers(4),
    );
    expect(state.finished).toBe(true);
    expect(state.outOfCards).toBe(true);
    expect(state.turns.length).toBeGreaterThanOrEqual(10);
  });
});

describe("the stake", () => {
  const stakes = (settings: Settings, turns: number[], seed = 7) => {
    const rng = seeded(seed);
    return turns.flatMap((turn) =>
      Array.from({ length: 50 }, () => stakeAt(settings, turn, rng)),
    );
  };
  const range = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, index) => from + index);

  it("starts low and ends high when progressive", () => {
    const settings = settingsWith({ intensity: "normale", duration: 30 });
    expect(new Set(stakes(settings, range(0, 10)))).toEqual(new Set([1, 2]));
    expect(new Set(stakes(settings, range(20, 30)))).toEqual(new Set([4, 5]));
  });

  it("rises over 80 cards in an unlimited game, then stays at the top", () => {
    const settings = settingsWith({ intensity: "forte", duration: null });
    expect(new Set(stakes(settings, [0, 10, 20]))).toEqual(new Set([2, 3]));
    expect(new Set(stakes(settings, [79, 200]))).toEqual(new Set([4, 5]));
  });

  it("stays within each intensity's range", () => {
    const ends = {
      douce: [1, 3],
      normale: [1, 5],
      forte: [2, 5],
      hardcore: [3, 5],
    };
    for (const [intensity, [low, high]] of Object.entries(ends)) {
      const all = stakes(
        settingsWith({ intensity: intensity as Settings["intensity"] }),
        range(0, 50),
      );
      expect([intensity, Math.min(...all), Math.max(...all)]).toEqual([
        intensity,
        low,
        high,
      ]);
    }
  });

  it("is any value of the range, about as often, when flat", () => {
    const settings = settingsWith({ intensity: "normale", progressive: false });
    const counts = count(stakes(settings, range(0, 30)));
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    for (const times of counts.values()) {
      expect(times).toBeGreaterThan(400);
      expect(times).toBeLessThan(600);
    }
  });

  it("never goes above 5", () => {
    for (const progressive of [true, false]) {
      const settings = settingsWith({ intensity: "hardcore", progressive });
      expect(Math.max(...stakes(settings, range(0, 100)))).toBe(5);
    }
  });
});

describe("levels", () => {
  it("plays the levels nearest the ceiling most often", () => {
    const levels: Level[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      const state = playThrough(
        settingsWith({ level: 5, duration: 80 }),
        somePlayers(6),
        seed,
      );
      levels.push(...cardsOf(state).map((card) => card.level));
    }
    const counts = count(levels);
    for (const level of [5, 4, 3, 2] as const) {
      expect(counts.get(level)!, `level ${level}`).toBeGreaterThan(
        counts.get((level - 1) as Level)!,
      );
    }
    // The game's level is about half of the cards (16 in 31), and the level
    // below about a quarter.
    const share = (level: Level) => counts.get(level)! / levels.length;
    expect(share(5)).toBeGreaterThan(0.42);
    expect(share(5)).toBeLessThan(0.6);
    expect(share(4)).toBeGreaterThan(0.18);
    expect(share(1)).toBeLessThan(0.08);
  });

  it("never goes past the game's level", () => {
    const state = playThrough(settingsWith({ level: 2 }), somePlayers(6));
    expect(Math.max(...cardsOf(state).map((card) => card.level))).toBe(2);
  });

  it("climbs one level at a time under pressure, and is there at half-time", () => {
    const settings = settingsWith({ level: 5, pressure: true, duration: 50 });
    expect(
      [0, 6, 7, 13, 19, 24, 25, 49].map((turn) => levelCap(settings, turn)),
    ).toEqual([1, 1, 2, 3, 4, 4, 5, 5]);
    // 30 cards at Border: the second half is played at Border.
    const short = settingsWith({ level: 5, pressure: true, duration: 30 });
    expect(levelCap(short, 14)).toBe(4);
    expect(levelCap(short, 15)).toBe(5);
    expect(levelCap(settingsWith({ level: 1, pressure: true }), 0)).toBe(1);
    const cards = cardsOf(playThrough(settings, somePlayers(6)));
    cards.forEach((card, turn) => {
      expect(card.level).toBeLessThanOrEqual(levelCap(settings, turn));
    });
    expect(
      cards.slice(25).filter((card) => card.level === 5).length,
    ).toBeGreaterThan(6);
  });

  it("keeps group cards within the most careful player's ceiling", () => {
    const players = somePlayers(6);
    players[0] = { ...players[0]!, ceiling: 2 };
    for (const seed of [1, 2, 3]) {
      const state = playThrough(
        settingsWith({ level: 5, duration: 80 }),
        players,
        seed,
      );
      const cards = cardsOf(state);
      expect(cards.some((card) => card.level === 5)).toBe(true);
      // A card for the group, or one that names the careful player, suits
      // them; the others may go up to the game's level.
      const tooHigh = cards.filter(
        (card, index) =>
          card.level > 2 &&
          (GAMES[card.game].kind === "group" ||
            state.turns[index]!.players.includes("Ada")),
      );
      expect(tooHigh.map((card) => card.id)).toEqual([]);
    }
  });

  it("respects the themes a player or the group excludes", () => {
    const players = somePlayers(5);
    players[1] = { ...players[1]!, excluded: ["sexe", "ex"] };
    const state = playThrough(
      settingsWith({ level: 5, duration: 80, excluded: ["argent"] }),
      players,
    );
    const cards = cardsOf(state);
    expect(cards.filter((card) => card.themes.includes("argent"))).toEqual([]);
    // Bob's themes only come up on cards that name someone else.
    const personal = cards.flatMap((card, index) =>
      card.themes.some((theme) => ["sexe", "ex"].includes(theme))
        ? [{ card, players: state.turns[index]!.players }]
        : [],
    );
    expect(personal.length).toBeGreaterThan(0);
    expect(
      personal
        .filter(
          ({ card, players }) =>
            GAMES[card.game].kind === "group" || players.includes("Bob"),
        )
        .map(({ card }) => card.id),
    ).toEqual([]);
  });
});

describe("cards with their own rules", () => {
  it("names four players for a quiz, then shows its answer before the next card", () => {
    const context = contextFor(3);
    let state = startGame(
      {
        id: "game",
        settings: settingsWith({ games: ["culture-g", "duel"] }),
        players: somePlayers(5),
      },
      context,
    );
    while (deck.byId.get(state.turns.at(-1)!.cardId)!.game !== "culture-g") {
      state = play(state, "next", context);
    }
    const quiz = state.turns.at(-1)!;
    const played = state.turns.length;
    expect(new Set(quiz.players).size).toBe(4);
    expect(quiz.revealed).toBeUndefined();
    // Ended now, nobody saw the answer: the end screen shows it.
    expect(missedAnswer(state, deck)?.id).toBe(quiz.cardId);

    state = play(state, "next", context);
    // The same card, with its answer: not one more card.
    expect(state.turns).toHaveLength(played);
    expect(state.turns.at(-1)).toMatchObject({
      cardId: quiz.cardId,
      revealed: true,
    });
    expect(missedAnswer(state, deck)).toBeNull();

    // On the answer, the group says who was closest and who was farthest.
    const [closest, farthest] = quiz.players;
    state = play(state, "next", context, {
      [closest!]: quiz.stake,
      [farthest!]: -quiz.stake,
    });
    expect(state.turns).toHaveLength(played + 1);
    expect(state.scores[closest!]).toEqual({ won: quiz.stake, lost: 0 });
    expect(state.scores[farthest!]).toEqual({ won: 0, lost: quiz.stake });
  });

  it("counts Gagné and Perdu for the player the card judges", () => {
    const context = contextFor(5);
    const settings = settingsWith({ games: ["montre-ou-bois"], duration: 2 });
    let state = startGame(
      { id: "game", settings, players: somePlayers(3) },
      context,
    );
    const first = state.turns.at(-1)!;
    state = play(state, "won", context);
    const second = state.turns.at(-1)!;
    state = play(state, "lost", context);
    expect(state.finished).toBe(true);
    expect(state.scores[first.players[0]!]!.won).toBe(first.stake);
    expect(state.scores[second.players[0]!]!.lost).toBe(second.stake);
    const total = Object.values(state.scores).reduce(
      (sum, score) => sum + score.won + score.lost,
      0,
    );
    expect(total).toBe(first.stake + second.stake);
  });

  it("replaces a card refused with a joker, once, for the same player", () => {
    const context = contextFor(5);
    const settings = settingsWith({ games: ["montre-ou-bois"], duration: 2 });
    let state = startGame(
      { id: "game", settings, players: somePlayers(3) },
      context,
    );
    const refused = state.turns.at(-1)!;
    const player = refused.players[0]!;

    state = play(state, "joker", context);
    const replacement = state.turns.at(-1)!;
    // The joker costs the stake, and another card comes for the same player.
    expect(state.scores[player]).toEqual({ won: 0, lost: refused.stake });
    expect(replacement).toMatchObject({
      replacement: true,
      stake: refused.stake,
    });
    expect(replacement.players[0]).toBe(player);
    expect(replacement.cardId).not.toBe(refused.cardId);
    expect(deck.byId.get(replacement.cardId)!.game).toBe("montre-ou-bois");
    // It isn't one more card of the game.
    expect(cardCount(state)).toBe(1);

    // No joker on a replacement: it counts as lost, and the game moves on.
    state = play(state, "joker", context);
    expect(state.scores[player]!.lost).toBe(refused.stake * 2);
    expect(state.turns.at(-1)!.replacement).toBeUndefined();
    expect(cardCount(state)).toBe(2);
    state = play(state, "won", context);
    expect(state.finished).toBe(true);
  });

  it("counts what the group says of a group card or a duel, in points", () => {
    const context = contextFor(2);
    let state = startGame(
      {
        id: "game",
        settings: settingsWith({ games: ["duel", "tout-le-monde"] }),
        players: somePlayers(4),
      },
      context,
    );
    const turn = state.turns.at(-1)!;
    state = play(state, "next", context, { Ada: -turn.stake, Bob: 0 });
    expect(state.turns[0]!.deltas).toEqual({ Ada: -turn.stake });
    expect(state.scores.Ada).toEqual({ won: 0, lost: turn.stake });
    expect(state.scores.Bob).toEqual({ won: 0, lost: 0 });
    expect(state.turns).toHaveLength(2);
  });

  it("keeps no score with sips: every card only has Carte suivante", () => {
    const context = contextFor(4);
    const settings = settingsWith({
      sips: true,
      games: ["montre-ou-bois", "sentence", "duel"],
      duration: 12,
    });
    let state = startGame(
      { id: "game", settings, players: somePlayers(4) },
      context,
    );
    while (!state.finished) {
      const turn = state.turns.at(-1)!;
      expect(turn.outcome).toBeUndefined();
      // Whatever is pressed, and whoever is named, nothing is counted.
      state = play(state, "joker", context, { Ada: -3 });
      expect(turn.replacement).toBeUndefined();
    }
    expect(state.turns).toHaveLength(12);
    expect(ranking(state).every((row) => row.won + row.lost === 0)).toBe(true);
  });

  it("shows the question of an action ou vérité, then the half chosen", () => {
    const players = somePlayers(2);
    const turn = { cardId: "AV-001", players: ["Ada"], stake: 2 };
    const card = deck.byId.get("AV-001")!;
    const say = (choice?: "action" | "verite", whole = false) =>
      segmentsText(
        cardSegments(card, { ...turn, choice }, players, true, whole),
      );
    expect(say()).toBe("Ada, action ou vérité ?");
    expect(say("action")).toMatch(/^Ada, action : raconte/);
    expect(say("action")).not.toMatch(/Vérité/i);
    expect(say("verite")).toMatch(/^Ada, vérité : t'es-tu déjà/);
    // Outside a game (favourites, admin), the whole card.
    expect(say(undefined, true)).toMatch(/action : .* Vérité : /);

    const context = contextFor(1);
    const state = startGame(
      {
        id: "game",
        settings: settingsWith({ games: ["action-verite"] }),
        players,
      },
      context,
    );
    const chosen = choose(state, "verite", 5);
    expect(chosen.turns.at(-1)!.choice).toBe("verite");
    // The choice is made once.
    expect(choose(chosen, "action", 6)).toBe(chosen);
  });

  it("shows again the card stepped back from, instead of drawing one", () => {
    const settings = settingsWith({ games: ["duel", "sentence", "tribunal"] });
    const first = startGame(
      { id: "game", settings, players: somePlayers(5) },
      contextFor(8),
    );
    const { cardId, players, stake } = play(first, "next", contextFor(8))
      .turns[1]!;
    for (const seed of [20, 21, 22]) {
      // Whatever the dice say now, the same card comes for the same players.
      const again = play(first, "next", {
        ...contextFor(seed),
        redo: { cardId, players, stake },
      });
      expect(again.turns[1]).toMatchObject({ cardId, players, stake });
    }
  });

  it("leaves the score alone for a duel or a group card", () => {
    const state = (() => {
      const context = contextFor(2);
      let game = startGame(
        {
          id: "game",
          settings: settingsWith({ games: ["duel", "tout-le-monde"] }),
          players: somePlayers(4),
        },
        context,
      );
      while (!game.finished) game = play(game, "won", context);
      return game;
    })();
    expect(state.turns).toHaveLength(50);
    expect(ranking(state).every((row) => row.total === 0)).toBe(true);
  });

  it("takes the stake from the player of a Sentence gratuite at once", () => {
    const context = contextFor(1);
    const state = startGame(
      {
        id: "game",
        settings: settingsWith({ games: ["sentence"] }),
        players: somePlayers(3),
      },
      context,
    );
    const turn = state.turns[0]!;
    expect(turn.outcome).toBe("lost");
    expect(state.scores[turn.players[0]!]).toEqual({
      won: 0,
      lost: turn.stake,
    });
    // "Perdu" on it doesn't count twice.
    const after = play(state, "lost", context);
    expect(after.scores[turn.players[0]!]!.lost).toBe(
      turn.stake +
        (after.turns[1]!.players[0] === turn.players[0]
          ? after.turns[1]!.stake
          : 0),
    );
  });

  it("shows both stakes of a double-tier card", () => {
    const card = deck.byId.get("TMC-055")!;
    const state = startGame(
      {
        id: "game",
        settings: settingsWith({ sips: true }),
        players: somePlayers(3),
      },
      contextFor(1),
    );
    const turn = { cardId: card.id, players: [], stake: 2 };
    expect(stakeLine(card, turn, state)).toBe(
      "2 gorgées, 4 pour le second groupe",
    );
  });

  it("says who loses a duel, in sips or in points", () => {
    const card = deck.byId.get("DUE-001")!;
    const turn = { cardId: card.id, players: ["Ada", "Bob"], stake: 1 };
    const game = (sips: boolean) =>
      startGame(
        {
          id: "game",
          settings: settingsWith({ sips }),
          players: somePlayers(3),
        },
        contextFor(1),
      );
    expect(stakeLine(card, turn, game(true))).toBe("Le perdant boit 1 gorgée");
    expect(stakeLine(card, { ...turn, stake: 3 }, game(false))).toBe(
      "Le perdant perd 3 points",
    );
  });

  it("keeps an invented rule for its number of cards, three at most", () => {
    const context = contextFor(6);
    const settings = settingsWith({
      games: ["regle", "duel"],
      level: 1,
      duration: 80,
    });
    let state = startGame(
      { id: "game", settings, players: somePlayers(4) },
      context,
    );
    const seen: number[] = [];
    let ended = 0;
    const announced: string[][] = [];
    const expectedOver: string[][] = [];
    const newRules: unknown[] = [];
    const expected: unknown[] = [];
    while (!state.finished) {
      const turn = state.turns.at(-1)!;
      if (deck.byId.get(turn.cardId)!.game === "regle") {
        // The newest rule belongs to the player on the card: 10 more cards.
        newRules.push(state.rules.at(-1));
        expected.push({ playerId: turn.players[0], remaining: 11 });
      }
      seen.push(...state.rules.map((rule) => rule.remaining));
      expect(state.rules.length).toBeLessThanOrEqual(3);
      const before = state.rules;
      state = play(state, "next", context);
      // A rule on its last card is announced as over on the next one.
      const over = before
        .filter((rule) => rule.remaining === 1)
        .map((rule) => rule.playerId);
      announced.push(
        state.finished ? over : (state.turns.at(-1)!.endedRules ?? []),
      );
      expectedOver.push(over);
      ended += over.length;
    }
    expect(announced).toEqual(expectedOver);
    expect(ended).toBeGreaterThan(0);
    expect(newRules.length).toBeGreaterThan(3);
    expect(newRules).toEqual(expected);
    expect(Math.min(...seen)).toBe(1);
  });
});

describe("sips only", () => {
  const sips = (overrides: Partial<Settings> = {}) =>
    settingsWith({ sips: true, duration: 80, ...overrides });

  it("plays no drinking partner, gender card or water break for points", () => {
    for (const seed of [1, 2, 3]) {
      const cards = cardsOf(
        playThrough(
          settingsWith({ duration: null, level: 5 }),
          somePlayers(6),
          seed,
          150,
        ),
      );
      expect(cards).toHaveLength(150);
      for (const card of cards) {
        expect(card.game).not.toBe("partenaire");
        expect(card.game).not.toBe("pause");
        expect(card.audience).toBeUndefined();
      }
    }
  });

  it("plays the three gender cards once each", () => {
    for (const seed of [1, 2, 3, 4]) {
      const audiences = cardsOf(
        playThrough(sips({ duration: 30 }), somePlayers(6), seed),
      ).flatMap((card) => card.audience ?? []);
      expect(audiences.sort((a, b) => a.localeCompare(b))).toEqual([
        "autres",
        "filles",
        "gars",
      ]);
    }
  });

  it("skips a gender card when nobody is concerned", () => {
    const players = somePlayers(6, { gender: "fille" });
    const audiences = cardsOf(
      playThrough(sips({ duration: 30 }), players),
    ).flatMap((card) => card.audience ?? []);
    expect(audiences).toEqual(["filles"]);
  });

  it("plays a drinking partner once at level 2, and once per player", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const low = playThrough(sips({ level: 2 }), somePlayers(6), seed);
      expect(
        cardsOf(low).filter((card) => card.game === "partenaire").length,
      ).toBeLessThanOrEqual(1);
      expect(low.partners.length).toBeLessThanOrEqual(1);
    }
    const all = [1, 2, 3, 4, 5, 6].map((seed) =>
      playThrough(sips({ level: 4 }), somePlayers(6), seed),
    );
    expect(all.some((state) => state.partners.length === 2)).toBe(true);
    for (const state of all) {
      expect(state.partners.length).toBeLessThanOrEqual(2);
      expect(new Set(state.partners).size).toBe(state.partners.length);
    }
  });

  it("takes a water break about every 50 cards", () => {
    const state = playThrough(
      sips({ duration: null, level: 5 }),
      somePlayers(6),
      1,
      210,
    );
    const breaks = cardsOf(state).flatMap((card, turn) =>
      card.game === "pause" ? [turn] : [],
    );
    expect(breaks.length).toBe(4);
    breaks.forEach((turn, index) => {
      const gap = turn - (breaks[index - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(45);
      expect(gap).toBeLessThanOrEqual(56);
      expect(state.turns[turn]!.stake).toBe(0);
    });
  });
});

describe("teams", () => {
  it("deals even teams", () => {
    const teams = randomTeams(somePlayers(8), 3, seeded(1));
    const sizes = count(teams.map((player) => player.team));
    expect([...sizes.values()].sort((a, b) => a - b)).toEqual([2, 3, 3]);
  });

  it("refuses to start while a team has fewer than two players", () => {
    const settings = settingsWith({ format: "teams", teams: ["A", "B", "C"] });
    const players = randomTeams(somePlayers(6), 3, seeded(1));
    expect(startProblems(settings, players)).toEqual([]);
    players[0] = { ...players[0]!, team: players[1]!.team === 0 ? 1 : 0 };
    const moved = players.map((player, index) =>
      index < 5 ? { ...player, team: index % 2 } : { ...player, team: 2 },
    );
    expect(startProblems(settings, moved)).toEqual([
      "Chaque équipe doit avoir au moins 2 joueurs.",
    ]);
  });

  it("sets two teams against each other in a duel", () => {
    const settings = settingsWith({
      format: "teams",
      games: ["duel", "sentence"],
    });
    const players = randomTeams(somePlayers(6), 2, seeded(2));
    const state = playThrough(settings, players);
    const team = (id: string) =>
      state.players.find((player) => player.id === id)!.team;
    for (const [index, card] of cardsOf(state).entries()) {
      if (card.game !== "duel") continue;
      const [a, b] = state.turns[index]!.players;
      expect(team(a!)).not.toBe(team(b!));
    }
  });

  it("ranks teams by their players' stakes", () => {
    const context = contextFor(9);
    const settings = settingsWith({
      format: "teams",
      teams: ["Rouges", "Bleus"],
      games: ["montre-ou-bois"],
      duration: 20,
    });
    const players = randomTeams(somePlayers(4), 2, seeded(3));
    let state = startGame({ id: "game", settings, players }, context);
    const team = (id: string) => players.find((p) => p.id === id)!.team;
    // The first team always wins, the second always loses.
    while (!state.finished) {
      const player = state.turns.at(-1)!.players[0]!;
      state = play(state, team(player) === 0 ? "won" : "lost", context);
    }
    const [first, last] = ranking(state);
    expect(first).toMatchObject({ name: "Rouges", rank: 1, lost: 0 });
    expect(first!.members).toHaveLength(2);
    expect(last).toMatchObject({ name: "Bleus", rank: 2, won: 0 });
    expect(first!.total).toBeGreaterThan(0);
    expect(last!.total).toBeLessThan(0);
  });
});

describe("starting", () => {
  it("needs two to twenty players with different names", () => {
    const settings = settingsWith({});
    expect(startProblems(settings, somePlayers(1))).toHaveLength(1);
    expect(startProblems(settings, somePlayers(2))).toEqual([]);
    const twins = somePlayers(3).map((player) => ({
      ...player,
      name: " ada ",
    }));
    twins[0]!.name = "Ada";
    expect(startProblems(settings, twins)[0]).toContain("même prénom");
    const unnamed = [
      ...somePlayers(2),
      { ...somePlayers(1)[0]!, id: "x", name: " " },
    ];
    expect(startProblems(settings, unnamed)[0]).toContain("prénom");
  });

  it("needs a mini-game that can be played by that many", () => {
    const settings = settingsWith({ games: ["tribunal", "culture-g"] });
    expect(startProblems(settings, somePlayers(3))).toHaveLength(1);
    expect(startProblems(settings, somePlayers(4))).toEqual([]);
  });

  it("moves on from a saved card that an update removed from the deck", () => {
    const context = contextFor(1);
    const saved = startGame(
      { id: "game", settings: settingsWith({}), players: somePlayers(4) },
      context,
    );
    const removed = {
      ...saved,
      turns: [{ cardId: "GONE-001", players: [], stake: 2 }],
    };

    for (const outcome of ["next", "won", "joker"] as const) {
      const after = play(removed, outcome, context);
      expect(after.turns).toHaveLength(2);
      expect(deck.byId.has(after.turns[1]!.cardId)).toBe(true);
      expect(ranking(after).every((row) => row.total === 0)).toBe(true);
    }
  });

  it("is over after the chosen number of cards", () => {
    const context = contextFor(1);
    const state = playThrough(settingsWith({ duration: 30 }), somePlayers(4));
    expect(state.turns).toHaveLength(30);
    expect(state.finished).toBe(true);
    expect(state.outOfCards).toBe(false);
    expect(nextTurn(state, context)).toBe(state);
  });
});

describe("what a card says", () => {
  const players = somePlayers(3);
  const say = (id: string, named: string[], sips = true) =>
    segmentsText(
      cardSegments(
        deck.byId.get(id)!,
        { cardId: id, players: named, stake: 2 },
        players,
        sips,
      ),
    );

  it("puts the players' names in, as their own segments", () => {
    const segments = cardSegments(
      deck.byId.get("DUE-001")!,
      { cardId: "DUE-001", players: ["Ada", "Bob"], stake: 1 },
      players,
      true,
    );
    expect(segments.slice(0, 3)).toEqual([
      { type: "player", name: "Ada" },
      { type: "text", text: " contre " },
      { type: "player", name: "Bob" },
    ]);
  });

  it("agrees with the first player's gender", () => {
    expect(say("TRI-008", ["Ada"])).toContain("Ada est accusée de");
    expect(say("TRI-008", ["Ada"])).toContain("qu'elle ne l'est");
    expect(say("TRI-008", ["Bob"])).toContain("Bob est accusé de");
    expect(say("TRI-008", ["Cléo"])).toContain("accusé·e de");
    expect(say("TRI-008", ["Cléo"])).toContain("qu'iel ne l'est");
  });

  it("fills in how long a rule lasts", () => {
    expect(say("REG-001", ["Ada"])).toContain("valable 10 cartes");
    expect(say("REG-003", ["Ada"])).toContain("pendant 15 cartes");
  });

  it("turns drinks into points when sips are off", () => {
    expect(say("SEN-001", ["Ada"])).toMatch(/^Ada boit\./);
    expect(say("SEN-001", ["Ada"], false)).toMatch(/^Ada perd des points\./);
  });
});
