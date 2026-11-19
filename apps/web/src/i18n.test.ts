import { describe, expect, it } from "vitest";
import { browserLanguage, i18n } from "./i18n";
import appEn from "./locales/en.json";
import appFr from "./locales/fr.json";

/**
 * Every key of a messages file, as "a.b.c", plural forms ("x_one", "x_few")
 * counted once: languages have different plural categories.
 */
const keys = (messages: object, prefix = ""): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key.replace(/_(zero|one|two|few|many|other)$/, "")}`],
  );
const unique = (list: string[]) => [...new Set(list)].sort();

// Zbeul is French only (docs/decisions.md): LANGUAGES is ["fr"]. The English
// files stay, in step with the French ones, so the starter's changes to them
// sync without conflicts and English can come back by adding it to LANGUAGES.
const files = {
  app: { en: appEn, fr: appFr },
};

describe.each(Object.entries(files))("the %s messages", (_, { en, fr }) => {
  it("have the same keys in French and English", () => {
    expect(unique(keys(fr))).toEqual(unique(keys(en)));
  });
});

describe("the language", () => {
  it("is French, whatever the browser asks for", () => {
    expect(browserLanguage(["en-US", "de"])).toBe("fr");
    expect(browserLanguage([])).toBe("fr");
  });

  it("is French on the page", () => {
    expect(i18n.language).toBe("fr");
    expect(i18n.t("user.signIn")).toBe("Se connecter");
    expect(document.documentElement.lang).toBe("fr");
  });
});
