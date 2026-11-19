import { LANGUAGES } from "@zbeul/core";
import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// What a visitor chose in this browser, kept in localStorage: the pattern for
// any client-only state that should survive a reload. Persisted stores have a
// `version`: bump it and add a `migrate` when the shape changes, so an older
// save still loads. What's read back is checked with Zod, field by field, so
// a value from an older version or edited by hand falls back to its default
// instead of breaking the app. Never keep personal data or secrets here:
// anything on the page can read it.

const storedSchema = z.object({
  /** null: follow the browser's languages. */
  language: z.enum(LANGUAGES).nullable().catch(null),
});
type Stored = z.infer<typeof storedSchema>;

interface Preferences extends Stored {
  setLanguage: (language: Stored["language"]) => void;
}

/** The game's own settings (theme, players) live in its store, not here. */
export const PREFERENCES_KEY = "preferences";

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      language: null,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: PREFERENCES_KEY,
      version: 1,
      partialize: ({ language }) => ({ language }),
      merge: (stored, current) => ({
        ...current,
        ...storedSchema.parse({ ...(stored as object | undefined) }),
      }),
    },
  ),
);
