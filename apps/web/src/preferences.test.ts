import { afterEach, describe, expect, it } from "vitest";
import { PREFERENCES_KEY, usePreferences } from "./preferences";

const stored = () =>
  JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "null");

afterEach(() => {
  usePreferences.setState({ language: null });
  window.localStorage.clear();
});

describe("preferences", () => {
  it("are kept in localStorage, with a version", () => {
    usePreferences.getState().setLanguage("fr");
    expect(stored()).toEqual({ state: { language: "fr" }, version: 1 });
  });

  it("fall back to defaults for a value they don't know", async () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ state: { language: "klingon" }, version: 1 }),
    );
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().language).toBeNull();
  });

  it("survive a value that isn't JSON", async () => {
    window.localStorage.setItem(PREFERENCES_KEY, "{oops");
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().language).toBeNull();
  });
});
