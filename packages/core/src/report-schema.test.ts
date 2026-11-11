import { describe, expect, it } from "vitest";
import { createReportSchema } from "./report-schema";

describe("createReportSchema", () => {
  it("accepts a card on its own, or a message on its own", () => {
    expect(createReportSchema.parse({ cardId: "TP-001" })).toEqual({
      cardId: "TP-001",
      message: "",
    });
    expect(
      createReportSchema.parse({ message: "  Le bouton est cassé " }),
    ).toEqual({ message: "Le bouton est cassé" });
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
});
