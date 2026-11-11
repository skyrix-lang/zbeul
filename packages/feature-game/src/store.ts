import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { deck } from "./cards";
import {
  DEFAULT_SETTINGS,
  endGame,
  play,
  startGame,
  type Context,
  type GameState,
  type Outcome,
  type Player,
  type Settings,
} from "./engine/game";
import { AGE_GATE_MS, RESUME_WINDOW_MS } from "./engine/rules";

// Everything the app remembers lives on the phone, in localStorage, and is
// never sent anywhere (specs §9): the game in progress, and the preferences.
// Each store has a version: `migrate` must keep an older save playable after
// an update.

export const THEMES = [
  { id: "nuit", label: "Nuit", mood: "Presque noir, accents vifs", dark: true },
  {
    id: "tokyo",
    label: "Tokyo Night",
    mood: "Bleus nuit, violets, cyans",
    dark: true,
  },
  {
    id: "retro",
    label: "Rétro",
    mood: "Néons roses sur violet profond",
    dark: true,
  },
  {
    id: "clair",
    label: "Clair",
    mood: "Blanc cassé, accents saturés",
    dark: false,
  },
  { id: "creme", label: "Crème", mood: "Tons chauds, papier", dark: false },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

/** The storage keys; apps/web/public/theme.js reads PREFS_KEY before React loads. */
export const GAME_KEY = "zbeul:game";
export const PREFS_KEY = "zbeul:prefs";

/** How many recently seen cards are held back from the next games. */
const RECENT_LIMIT = 300;

export const newId = () =>
  // randomUUID needs https; a phone on the local network in development has none.
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export interface PendingReport {
  cardId?: string;
  message: string;
}

interface PrefsState {
  /** When the visitor confirmed they are an adult. */
  ageConfirmedAt: number | null;
  theme: ThemeId;
  favorites: string[];
  recent: string[];
  /** The last game's settings and players, offered again. */
  settings: Settings;
  players: Player[];
  teamMode: "random" | "manual";
  /** The alcohol warning has been shown once. */
  alcoholWarned: boolean;
  /** The portrait hint on the game screen was closed. */
  rotateHintClosed: boolean;
  /** Reports made offline, sent when the network is back. */
  pendingReports: PendingReport[];
}

interface PrefsActions {
  confirmAge: () => void;
  setTheme: (theme: ThemeId) => void;
  toggleFavorite: (cardId: string) => void;
  remember: (cardId: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setPlayers: (players: Player[]) => void;
  update: (patch: Partial<PrefsState>) => void;
}

const initialPrefs: PrefsState = {
  ageConfirmedAt: null,
  theme: "nuit",
  favorites: [],
  recent: [],
  settings: DEFAULT_SETTINGS,
  players: [],
  teamMode: "random",
  alcoholWarned: false,
  rotateHintClosed: false,
  pendingReports: [],
};

/** Only used when localStorage is unavailable (private mode on old browsers). */
const safeStorage = createJSONStorage(() => {
  try {
    localStorage.getItem(PREFS_KEY);
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
});

export const usePrefs = create<PrefsState & PrefsActions>()(
  persist(
    (set) => ({
      ...initialPrefs,
      confirmAge: () => set({ ageConfirmedAt: Date.now() }),
      setTheme: (theme) => set({ theme }),
      toggleFavorite: (cardId) =>
        set(({ favorites }) => ({
          favorites: favorites.includes(cardId)
            ? favorites.filter((id) => id !== cardId)
            : [...favorites, cardId],
        })),
      remember: (cardId) =>
        set(({ recent }) => ({
          recent: [...recent.filter((id) => id !== cardId), cardId].slice(
            -RECENT_LIMIT,
          ),
        })),
      setSettings: (patch) =>
        set(({ settings }) => ({ settings: { ...settings, ...patch } })),
      setPlayers: (players) => set({ players }),
      update: (patch) => set(patch),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      storage: safeStorage,
      // A save from a newer or unknown version keeps what it can.
      migrate: (saved) => saved as PrefsState,
      merge: (saved, current) => {
        const stored = (saved ?? {}) as Partial<PrefsState>;
        return {
          ...current,
          ...stored,
          // A setting added by an update takes its default.
          settings: { ...current.settings, ...stored.settings },
        };
      },
    },
  ),
);

export const isAdult = (confirmedAt: number | null, now = Date.now()) =>
  confirmedAt !== null && now - confirmedAt < AGE_GATE_MS;

interface GameStore {
  game: GameState | null;
  start: (settings: Settings, players: Player[]) => void;
  play: (outcome: Outcome | "next") => void;
  end: () => void;
  clear: () => void;
}

function context(): Context {
  return {
    deck,
    rng: Math.random,
    now: Date.now(),
    recent: new Set(usePrefs.getState().recent),
  };
}

/** Holds the card on screen back from the next games on this phone. */
function rememberCurrent(game: GameState) {
  const turn = game.turns.at(-1);
  if (turn) usePrefs.getState().remember(turn.cardId);
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      start: (settings, players) => {
        const game = startGame({ id: newId(), settings, players }, context());
        rememberCurrent(game);
        set({ game });
      },
      play: (outcome) => {
        const { game } = get();
        if (!game) return;
        const next = play(game, outcome, context());
        if (next.turns.length > game.turns.length) rememberCurrent(next);
        set({ game: next });
      },
      end: () => {
        const { game } = get();
        if (game) set({ game: endGame(game, Date.now()) });
      },
      clear: () => set({ game: null }),
    }),
    {
      name: GAME_KEY,
      version: 1,
      storage: safeStorage,
      partialize: ({ game }) => ({ game }),
      // The first version: nothing to migrate yet. A later version converts
      // the saved game here rather than dropping it.
      migrate: (saved) => saved as { game: GameState | null },
    },
  ),
);

/** A game that can be picked up: unfinished, and played in the last 12 hours. */
export function resumable(game: GameState | null, now = Date.now()) {
  return game !== null &&
    !game.finished &&
    now - game.updatedAt < RESUME_WINDOW_MS
    ? game
    : null;
}

/** "Effacer toutes les données": forgets everything kept on this phone. */
export function eraseEverything() {
  useGame.setState({ game: null });
  usePrefs.setState(initialPrefs);
  useGame.persist.clearStorage();
  usePrefs.persist.clearStorage();
}
