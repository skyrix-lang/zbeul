import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@zbeul/api/test-server";
import { DEFAULT_SETTINGS, type Player } from "./engine/game";
import { flushFeedback } from "./reports";
import { GAME_KEY, useGame, usePrefs } from "./store";

const players: Player[] = ["Ada", "Bob", "Cléo", "Dan"].map((name) => ({
  id: name,
  name,
  gender: "autre",
  ceiling: null,
  excluded: [],
  team: null,
}));

const game = () => useGame.getState().game!;
const last = () => game().turns.at(-1)!;

beforeEach(() => {
  useGame.getState().clear();
  usePrefs.setState({
    favorites: [],
    pendingLikes: [],
    pendingReports: [],
    sentLikes: [],
    sentDislikes: [],
    recent: [],
  });
});

describe("stepping back", () => {
  const start = () =>
    useGame
      .getState()
      .start(
        { ...DEFAULT_SETTINGS, games: ["montre-ou-bois"], duration: 30 },
        players,
      );

  it("has nothing to step back to on the first card", () => {
    start();
    const first = last();
    useGame.getState().back();
    expect(last()).toEqual(first);
  });

  it("gives the score back, and shows the same cards again", () => {
    start();
    const first = last();
    useGame.getState().play("lost");
    const second = last();
    useGame.getState().play("won");
    const third = last();

    // A misclick on the first card: two steps back.
    useGame.getState().back();
    useGame.getState().back();
    expect(game().turns).toHaveLength(1);
    expect(game().scores[first.players[0]!]).toEqual({ won: 0, lost: 0 });

    // Settled the other way, the cards that followed come back in order.
    useGame.getState().play("won");
    expect(game().scores[first.players[0]!]!.won).toBe(first.stake);
    expect(last()).toMatchObject({
      cardId: second.cardId,
      players: second.players,
      stake: second.stake,
    });
    useGame.getState().play("won");
    expect(last()).toMatchObject({ cardId: third.cardId });
    expect(useGame.getState().redo).toEqual([]);
  });

  it("steps back from a joker's replacement to the card refused", () => {
    start();
    const refused = last();
    useGame.getState().play("joker");
    const replacement = last();
    expect(replacement.replacement).toBe(true);

    useGame.getState().back();
    expect(last()).toEqual(refused);
    // Played this time: the replacement is forgotten, a new card comes.
    useGame.getState().play("won");
    expect(last().replacement).toBeUndefined();
    expect(game().scores[refused.players[0]!]!.lost).toBe(0);
  });

  it("brings the same replacement back after a step back and the same joker", () => {
    start();
    useGame.getState().play("joker");
    const replacement = last();

    useGame.getState().back();
    useGame.getState().play("joker");

    expect(last()).toEqual(replacement);
    expect(useGame.getState().redo).toEqual([]);
  });

  it("remembers twenty taps, and only what a tap changes", () => {
    // Every level: enough cards of the mini-game for 25 taps.
    useGame
      .getState()
      .start(
        { ...DEFAULT_SETTINGS, games: ["montre-ou-bois"], level: 5 },
        players,
      );
    for (let tap = 0; tap < 25; tap++) useGame.getState().play("won");
    const { past } = useGame.getState();
    expect(past).toHaveLength(20);
    // Not the whole game each time: it would weigh megabytes in a long one.
    expect(past[0]).not.toHaveProperty("turns");
    expect(past[0]).not.toHaveProperty("players");
    for (let tap = 0; tap < 20; tap++) useGame.getState().back();
    expect(game().turns).toHaveLength(6);
    expect(useGame.getState().past).toEqual([]);
  });

  it("keeps a game saved by the previous version playable", async () => {
    start();
    useGame.getState().play("won");
    const saved = structuredClone(game());
    saved.turns[0] = { cardId: "CG-001", players: ["Ada"], stake: 1 };
    localStorage.setItem(
      GAME_KEY,
      JSON.stringify({ state: { game: saved }, version: 2 }),
    );

    await useGame.persist.rehydrate();

    // Its quiz answers were shown on the next card: they count as seen.
    expect(game().turns[0]!.revealed).toBe(true);
    expect(game().turns[1]!.revealed).toBeUndefined();
    expect(useGame.getState().past).toEqual([]);
    expect(useGame.getState().redo).toEqual([]);
    useGame.getState().play("won");
    expect(game().turns).toHaveLength(3);
    useGame.getState().back();
    expect(game().turns).toHaveLength(2);
  });

  it("steps back from the half chosen to the question", () => {
    useGame
      .getState()
      .start({ ...DEFAULT_SETTINGS, games: ["action-verite"] }, players);
    useGame.getState().choose("action");
    expect(last().choice).toBe("action");
    useGame.getState().back();
    expect(last().choice).toBeUndefined();
  });
});

describe("thumbs", () => {
  const { toggleFavorite, setDislike } = usePrefs.getState();
  const prefs = () => usePrefs.getState();

  it("keeps a liked card as a favourite, and takes the like back", () => {
    toggleFavorite("TP-001");
    expect(prefs().favorites).toEqual(["TP-001"]);
    expect(prefs().pendingLikes).toEqual(["TP-001"]);
    toggleFavorite("TP-001");
    expect(prefs().favorites).toEqual([]);
    expect(prefs().pendingLikes).toEqual([]);
  });

  it("holds one thumb at a time for a card", () => {
    toggleFavorite("TP-001");
    setDislike("TP-001", { message: "", reasons: ["boring"] });
    expect(prefs().favorites).toEqual([]);
    expect(prefs().pendingLikes).toEqual([]);
    expect(prefs().pendingReports).toEqual([
      { cardId: "TP-001", message: "", reasons: ["boring"], thumb: true },
    ]);
    toggleFavorite("TP-001");
    expect(prefs().pendingReports).toEqual([]);
    expect(prefs().favorites).toEqual(["TP-001"]);
  });

  it("takes a thumb down back, and leaves other reports alone", () => {
    usePrefs.setState({
      pendingReports: [{ cardId: "TP-001", message: "Écrit à la main" }],
    });
    setDislike("TP-001", { message: "", reasons: [] });
    setDislike("TP-001", null);
    expect(prefs().pendingReports).toEqual([
      { cardId: "TP-001", message: "Écrit à la main" },
    ]);
  });

  it("sends the thumbs when the game is left, and nothing twice", async () => {
    const likes: unknown[] = [];
    const reports: unknown[] = [];
    server.use(
      http.post("*/api/likes", async ({ request }) => {
        likes.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/reports", async ({ request }) => {
        reports.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    toggleFavorite("TP-001");
    toggleFavorite("JAM-002");
    setDislike("DUE-001", { message: "Bof", reasons: ["too-long"] });

    await Promise.all([flushFeedback(), flushFeedback()]);

    expect(likes).toEqual([{ cardIds: ["TP-001", "JAM-002"] }]);
    // How the report was made stays on the phone.
    expect(reports).toEqual([
      { cardId: "DUE-001", message: "Bof", reasons: ["too-long"] },
    ]);
    expect(prefs().pendingLikes).toEqual([]);
    expect(prefs().pendingReports).toEqual([]);
    // The card stays a favourite once its like has left.
    expect(prefs().favorites).toEqual(["TP-001", "JAM-002"]);
  });

  it("keeps the rest for later when the server says too many", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/reports", () => {
        calls++;
        return calls === 1
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ error: "Too many" }, { status: 429 });
      }),
    );
    setDislike("TP-001", { message: "", reasons: [] });
    setDislike("TP-002", { message: "", reasons: [] });
    toggleFavorite("JAM-002");

    await flushFeedback();

    // The first left; the second and the like wait, nothing is lost.
    expect(prefs().pendingReports.map((report) => report.cardId)).toEqual([
      "TP-002",
    ]);
    expect(prefs().pendingLikes).toEqual(["JAM-002"]);
    expect(prefs().sentDislikes).toEqual(["TP-001"]);
  });

  it("counts a like once, even when the thumb goes down and up again", async () => {
    const likes: unknown[] = [];
    server.use(
      http.post("*/api/likes", async ({ request }) => {
        likes.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    toggleFavorite("TP-001");
    await flushFeedback();
    toggleFavorite("TP-001");
    toggleFavorite("TP-001");
    await flushFeedback();

    expect(likes).toEqual([{ cardIds: ["TP-001"] }]);
    expect(prefs().favorites).toEqual(["TP-001"]);
  });

  it("keeps the likes on the phone when the server is down", async () => {
    server.use(http.post("*/api/likes", () => HttpResponse.error()));
    toggleFavorite("TP-001");
    await flushFeedback();
    expect(prefs().pendingLikes).toEqual(["TP-001"]);
  });
});
