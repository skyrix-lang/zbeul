import { describe, expect, it } from "vitest";
import { cardSchema } from "./card-schema";

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
