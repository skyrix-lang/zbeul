import { describe, expect, it } from "vitest";
import { cardSchema, LEVELS, type MiniGame } from "@zbeul/core";
import { toPoints } from "../engine/text";
import { deck } from "./index";
import raw from "./fr.json";

// Lists of offending cards, compared with an empty list: a failure names them.

describe("the bundled deck", () => {
  it("only holds valid cards", () => {
    const invalid = raw.filter((card) => !cardSchema.safeParse(card).success);
    expect(invalid.map((card) => card.id)).toEqual([]);
    expect(raw.length).toBeGreaterThan(800);
  });

  it("has at least 10 cards per level for every mixed mini-game", () => {
    const outside: MiniGame[] = ["partenaire", "pause"];
    const games = [...new Set(deck.cards.map((card) => card.game))].filter(
      (game) => !outside.includes(game),
    );
    const thin = games.flatMap((game) =>
      LEVELS.filter(
        (level) =>
          deck.cards.filter(
            (card) =>
              card.game === game && card.level === level && !card.audience,
          ).length < 10,
      ).map((level) => `${game} level ${level}`),
    );
    expect(games).toHaveLength(13);
    expect(thin).toEqual([]);
  });

  it("gives every quiz question four players and a sourced answer", () => {
    const quiz = deck.cards.filter((card) => card.game === "culture-g");
    expect(quiz.length).toBeGreaterThan(100);
    const incomplete = quiz.filter(
      (card) => card.targets !== 4 || !card.answer || !card.source,
    );
    expect(incomplete.map((card) => card.id)).toEqual([]);
  });

  it("has the three gender cards, a water break and a drinking partner", () => {
    const audiences = deck.cards.flatMap((card) => card.audience ?? []);
    expect(audiences.sort((a, b) => a.localeCompare(b))).toEqual([
      "autres",
      "filles",
      "gars",
    ]);
    expect(deck.cards.some((card) => card.game === "pause")).toBe(true);
    expect(deck.cards.some((card) => card.game === "partenaire")).toBe(true);
  });

  it("leaves no drink in a card played for points", () => {
    const sipsOnly: MiniGame[] = ["partenaire", "pause"];
    const stillDrinking = deck.cards.filter(
      (card) =>
        !sipsOnly.includes(card.game) &&
        !card.audience &&
        /\b(boit|boivent|buvez|tu bois)\b/i.test(toPoints(card.text)),
    );
    expect(stillDrinking.map((card) => card.id)).toEqual([]);
    expect(toPoints("Ceux qui avaient la gueule de bois boivent double.")).toBe(
      "Ceux qui avaient la gueule de bois perdent le double.",
    );
  });
});
