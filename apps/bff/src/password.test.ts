import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("passwords", () => {
  it("verifies the password that was hashed, and no other", async () => {
    const hash = await hashPassword("Cactus-Volant-42");
    expect(await verifyPassword("Cactus-Volant-42", hash)).toBe(true);
    expect(await verifyPassword("Cactus-Volant-43", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("never stores the password, and salts each hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword("Cactus-Volant-42"),
      hashPassword("Cactus-Volant-42"),
    ]);
    expect(first).toMatch(/^scrypt\$32768\$8\$3\$[\w+/=]+\$[\w+/=]+$/);
    expect(first).not.toContain("Cactus");
    expect(first).not.toBe(second);
  });

  it("treats the same characters typed differently as the same password", async () => {
    // "é" as one character, then as "e" followed by a combining accent.
    const hash = await hashPassword("été-Chaud_2026!");
    expect(await verifyPassword("été-Chaud_2026!", hash)).toBe(true);
  });

  it("refuses when there is no account or the hash is damaged", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "plain-text")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$1$1$1$$")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$3$8$1$AAAA$AAAA")).toBe(
      false,
    );
  });
});
