import { describe, expect, it } from "vitest";
import { createReportSchema, likeCardsSchema } from "./report-schema";

describe("createReportSchema", () => {
  it("accepts a card on its own, or a message on its own", () => {
    expect(createReportSchema.parse({ cardId: "TP-001" })).toEqual({
      cardId: "TP-001",
      message: "",
      reasons: [],
    });
    expect(
      createReportSchema.parse({ message: "  Le bouton est cassé " }),
    ).toEqual({ message: "Le bouton est cassé", reasons: [] });
  });

  it("takes the reasons ticked under the thumb down, each once", () => {
    expect(
      createReportSchema.parse({
        cardId: "TP-001",
        reasons: ["boring", "too-long", "boring"],
      }).reasons,
    ).toEqual(["boring", "too-long"]);
    expect(
      createReportSchema.safeParse({ cardId: "TP-001", reasons: ["rude"] })
        .success,
    ).toBe(false);
  });

  it("refuses an empty report", () => {
    expect(createReportSchema.safeParse({}).success).toBe(false);
    expect(createReportSchema.safeParse({ message: "  a " }).success).toBe(
      false,
    );
  });

  it("refuses a card reference that isn't one, and an endless message", () => {
    expect(createReportSchema.safeParse({ cardId: "tp-001" }).success).toBe(
      false,
    );
    expect(
      createReportSchema.safeParse({ cardId: "TP-001; DROP TABLE" }).success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({ message: "a".repeat(1001) }).success,
    ).toBe(false);
  });

  it("takes likes for up to 50 cards, and only card references", () => {
    expect(likeCardsSchema.safeParse({ cardIds: ["TP-001"] }).success).toBe(
      true,
    );
    expect(likeCardsSchema.safeParse({ cardIds: [] }).success).toBe(false);
    expect(likeCardsSchema.safeParse({ cardIds: ["nope"] }).success).toBe(
      false,
    );
    expect(
      likeCardsSchema.safeParse({ cardIds: Array(51).fill("TP-001") }).success,
    ).toBe(false);
  });
});
