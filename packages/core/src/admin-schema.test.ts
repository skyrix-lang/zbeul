import { describe, expect, it } from "vitest";
import {
  adminLoginSchema,
  adminSetupSchema,
  passwordSchema,
} from "./admin-schema";

describe("passwordSchema", () => {
  it("accepts a long password with every kind of character", () => {
    expect(passwordSchema.safeParse("Cactus-Volant-42").success).toBe(true);
    expect(passwordSchema.safeParse("été-Brûlant_2026!").success).toBe(true);
  });

  it.each([
    ["Court-1a", "Au moins 12 caractères"],
    ["CACTUS-VOLANT-42", "Une minuscule"],
    ["cactus-volant-42", "Une majuscule"],
    ["Cactus-Volant-xx", "Un chiffre"],
    ["CactusVolant4242", "Un caractère spécial"],
  ])("refuses %s: %s", (password, message) => {
    const result = passwordSchema.safeParse(password);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      message,
    ]);
  });

  it("lists everything a weak password is missing", () => {
    expect(passwordSchema.safeParse("abc").error?.issues).toHaveLength(4);
  });
});

describe("adminSetupSchema", () => {
  const setup = {
    email: " Ada+Zbeul@Example.Test ",
    password: "Cactus-Volant-42",
    code: " code ",
  };

  it("normalises the email and the code", () => {
    expect(adminSetupSchema.parse(setup)).toEqual({
      email: "ada+zbeul@example.test",
      password: "Cactus-Volant-42",
      code: "code",
    });
  });

  it("refuses a password built on the email", () => {
    const result = adminSetupSchema.safeParse({
      ...setup,
      password: "Ada-Lovelace-1815",
    });
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("refuses a missing code or a bad email", () => {
    expect(adminSetupSchema.safeParse({ ...setup, code: " " }).success).toBe(
      false,
    );
    expect(adminSetupSchema.safeParse({ ...setup, email: "ada" }).success).toBe(
      false,
    );
  });
});

describe("adminLoginSchema", () => {
  it("takes any non-empty password: its strength was checked when it was set", () => {
    expect(
      adminLoginSchema.parse({ email: "ADA@example.test", password: "x" }),
    ).toEqual({ email: "ada@example.test", password: "x" });
    expect(
      adminLoginSchema.safeParse({ email: "ada@example.test", password: "" })
        .success,
    ).toBe(false);
  });
});
