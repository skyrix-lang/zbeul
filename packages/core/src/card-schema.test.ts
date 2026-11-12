import { describe, expect, it } from "vitest";
import {
  bulkCardsSchema,
  cardInputSchema,
  cardSchema,
  countTargets,
} from "./card-schema";

const card = {
  id: "TP-001",
  game: "tu-preferes",
  level: 1,
  text: "Tu préfères pouvoir voler ou être invisible ?",
  themes: [],
  targets: 0,
};

describe("cardSchema", () => {
  it("accepts a card", () => {
    expect(cardSchema.parse(card)).toEqual(card);
  });

  it("refuses an unknown mini-game, level or theme", () => {
    expect(cardSchema.safeParse({ ...card, game: "poker" }).success).toBe(
      false,
    );
    expect(cardSchema.safeParse({ ...card, level: 6 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...card, themes: ["météo"] }).success).toBe(
      false,
    );
  });

  it("refuses a quiz question without a sourced answer", () => {
    const quiz = { ...card, id: "CG-001", game: "culture-g", targets: 4 };
    expect(cardSchema.safeParse(quiz).success).toBe(false);
    expect(
      cardSchema.safeParse({ ...quiz, answer: "330", unit: "mètres" }).success,
    ).toBe(false);
    expect(
      cardSchema.safeParse({
        ...quiz,
        answer: "330",
        unit: "mètres",
        source: "Société d'exploitation de la tour Eiffel",
      }).success,
    ).toBe(true);
  });
});

describe("countTargets", () => {
  it("counts the players a text names", () => {
    expect(countTargets("Tu préfères voler ou nager ?")).toBe(0);
    expect(countTargets("[J1] contre [J2], puis [J1] encore.")).toBe(2);
    expect(countTargets("[J1], [J2], [J3] et [J4] : combien ?")).toBe(4);
  });

  it("refuses players out of order", () => {
    expect(countTargets("[J2], à toi.")).toBeNull();
    expect(countTargets("[J1] contre [J3].")).toBeNull();
  });
});

describe("cardInputSchema", () => {
  const input = {
    game: "tribunal",
    level: 2,
    text: " [J1] est [accusé/accusée/accusé·e] de tout. Coupable ? ",
    packId: "officiel",
  };
  const problems = (card: object) =>
    cardInputSchema
      .safeParse(card)
      .error?.issues.map((issue) => issue.path.join(".")) ?? [];

  it("fills in what the admin left out", () => {
    expect(cardInputSchema.parse(input)).toEqual({
      game: "tribunal",
      level: 2,
      text: "[J1] est [accusé/accusée/accusé·e] de tout. Coupable ?",
      themes: [],
      packId: "officiel",
      status: "draft",
      audience: null,
      doubleTier: false,
      witness: false,
      ruleDuration: null,
      answer: null,
      unit: null,
      source: null,
    });
  });

  it("wants as many players as the mini-game takes", () => {
    expect(
      problems({ ...input, text: "Quelqu'un est accusé de tout." }),
    ).toEqual(["text"]);
    expect(problems({ ...input, text: "[J1] et [J2] sont accusés." })).toEqual([
      "text",
    ]);
    expect(
      problems({ ...input, game: "duel", text: "[J1] contre [J2] : duel." }),
    ).toEqual([]);
    expect(
      problems({ ...input, game: "tu-preferes", text: "[J1], tu préfères ?" }),
    ).toEqual(["text"]);
  });

  it("refuses a placeholder the game doesn't know", () => {
    expect(
      problems({ ...input, text: "[J1] est [coupable] de tout." }),
    ).toEqual(["text"]);
    expect(
      problems({ ...input, text: "[J1], règle de [durée] cartes." }),
    ).toEqual(["text"]);
    expect(
      problems({
        ...input,
        game: "regle",
        text: "[J1], invente une règle valable [durée] cartes.",
      }),
    ).toEqual([]);
  });

  it("wants a sourced answer for a quiz question", () => {
    const quiz = {
      ...input,
      game: "culture-g",
      text: "[J1], [J2], [J3] et [J4] : combien mesure la tour Eiffel ?",
    };
    expect(problems(quiz)).toEqual(["answer", "unit", "source"]);
    expect(problems({ ...quiz, answer: "330", unit: " ", source: "" })).toEqual(
      ["unit", "source"],
    );
    expect(
      problems({ ...quiz, answer: "330", unit: "mètres", source: "SETE" }),
    ).toEqual([]);
  });

  it("keeps an audience for the cards meant for everyone", () => {
    expect(problems({ ...input, audience: "gars" })).toEqual(["audience"]);
    expect(
      problems({
        game: "tout-le-monde",
        level: 1,
        text: "Tous les gars boivent.",
        packId: "officiel",
        audience: "gars",
      }),
    ).toEqual([]);
  });
});

describe("bulkCardsSchema", () => {
  it("needs cards, and something to change", () => {
    expect(bulkCardsSchema.safeParse({ ids: ["TP-001"] }).success).toBe(false);
    expect(bulkCardsSchema.safeParse({ ids: [], level: 2 }).success).toBe(
      false,
    );
    expect(
      bulkCardsSchema.parse({ ids: ["TP-001"], status: "archived" }),
    ).toEqual({ ids: ["TP-001"], status: "archived" });
  });
});
