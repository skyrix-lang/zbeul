import { describe, expect, it } from "vitest";
import { voteWeight } from "./vote-weight";

describe("voteWeight", () => {
  it("leaves a card without votes, or with as many up as down, alone", () => {
    expect(voteWeight(0, 0)).toBe(1);
    expect(voteWeight(2, 2)).toBe(1);
  });

  it("lowers a card after two or three thumbs down, never to zero", () => {
    expect(voteWeight(0, 1)).toBe(0.5);
    expect(voteWeight(0, 2)).toBe(0.4);
    expect(voteWeight(0, 3)).toBe(0.35);
    expect(voteWeight(0, 1000)).toBeGreaterThanOrEqual(0.25);
  });

  it("raises a liked card, at most twice", () => {
    expect(voteWeight(1, 0)).toBe(1.41);
    expect(voteWeight(3, 0)).toBe(1.68);
    expect(voteWeight(1000, 0)).toBeLessThanOrEqual(2);
    expect(voteWeight(3, 1)).toBeGreaterThan(1);
  });
});
