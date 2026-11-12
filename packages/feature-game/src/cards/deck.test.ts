import { beforeEach, describe, expect, it } from "vitest";
import { cardInputSchema } from "@zbeul/core";
import {
  DEFAULT_SETTINGS,
  play,
  startGame,
  type Context,
  type Player,
} from "../engine/game";
import { seeded } from "../engine/random";
import { deck, getDeck, useDeckStore } from "./index";
import raw from "./fr.json";

const received = {
  version: "v2",
  packs: [
    { id: "officiel", name: "Pack officiel", description: "" },
    { id: "couple", name: "Soirée couple", description: "À deux, ou presque." },
  ],
  cards: [
    {
      id: "DUE-900",
      game: "duel",
      level: 1,
      text: "[J1] contre [J2] : bras de fer.",
      themes: [],
      targets: 2,
      pack: "officiel",
    },
    {
      id: "DUE-901",
      game: "duel",
      level: 1,
      text: "[J1] contre [J2] : qui connaît le mieux l'autre ?",
      themes: ["couple"],
      targets: 2,
      pack: "couple",
    },
  ],
};

beforeEach(() => useDeckStore.setState({ received: null }));

describe("the deck in use", () => {
  it("is the bundled one until the server sends another", () => {
    expect(getDeck()).toBe(deck);

    expect(useDeckStore.getState().receive(received)).toBe(true);

    expect(getDeck().cards.map((card) => card.id)).toEqual([
      "DUE-900",
      "DUE-901",
    ]);
    expect(getDeck().byId.get("DUE-901")?.pack).toBe("couple");
    // The same deck object while nothing changes: no work at each card.
    expect(getDeck()).toBe(getDeck());
  });

  it("is kept on the phone, for the next visit without a connection", () => {
    useDeckStore.getState().receive(received);

    const saved = JSON.parse(localStorage.getItem("zbeul:deck")!);
    expect(saved.state.received.version).toBe("v2");
    expect(saved.state.received.cards).toHaveLength(2);
  });

  it.each([
    ["an error page", "<html>502 Bad Gateway</html>"],
    ["nothing", null],
    ["an empty deck", { ...received, cards: [] }],
    [
      "a card the game can't play",
      { ...received, cards: [{ ...received.cards[0], game: "poker" }] },
    ],
    [
      "a quiz question without its answer",
      {
        ...received,
        cards: [{ ...received.cards[0], game: "culture-g", targets: 4 }],
      },
    ],
  ])("never replaces a deck that works with %s", (_, answer) => {
    useDeckStore.getState().receive(received);

    expect(useDeckStore.getState().receive(answer)).toBe(false);

    expect(useDeckStore.getState().received?.version).toBe("v2");
    expect(getDeck().cards).toHaveLength(2);
  });
});

describe("packs", () => {
  const players: Player[] = ["Ada", "Bob", "Cléo"].map((name) => ({
    id: name,
    name,
    gender: "autre",
    ceiling: null,
    excluded: [],
    team: null,
  }));
  const cardsPlayed = (packs: string[]) => {
    useDeckStore.getState().receive(received);
    const context: Context = { deck: getDeck(), rng: seeded(1), now: 0 };
    let game = startGame(
      {
        id: "game",
        settings: { ...DEFAULT_SETTINGS, games: ["duel"], level: 1, packs },
        players,
      },
      context,
    );
    while (!game.finished) game = play(game, "next", context);
    return game.turns
      .map((turn) => turn.cardId)
      .sort((a, b) => a.localeCompare(b));
  };

  it("plays every pack when none is chosen", () => {
    expect(cardsPlayed([])).toEqual(["DUE-900", "DUE-901"]);
  });

  it("only plays the packs chosen", () => {
    expect(cardsPlayed(["couple"])).toEqual(["DUE-901"]);
    expect(cardsPlayed(["officiel"])).toEqual(["DUE-900"]);
  });
});

describe("the bundled deck", () => {
  it("only holds cards the admin's form would accept", () => {
    // The database is seeded from it: every card must stay editable.
    const refused = raw.filter(
      (card) =>
        !cardInputSchema.safeParse({ ...card, packId: "officiel" }).success,
    );
    expect(refused.map((card) => card.id)).toEqual([]);
  });
});
