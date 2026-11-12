import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getDeck } from "./cards";
import {
  choose,
  DEFAULT_SETTINGS,
  endGame,
  play,
  startGame,
  type Choice,
  type Context,
  type Draw,
  type GameState,
  type Outcome,
  type Player,
  type Settings,
  type Turn,
} from "./engine/game";
import type { ReportReason } from "@zbeul/core";
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
  reasons?: ReportReason[];
  /**
   * Made with the thumb down during a game: it can still be taken back until
   * it leaves the phone.
   */
  thumb?: true;
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
  /** Reports waiting to leave: made offline, or with the thumb down. */
  pendingReports: PendingReport[];
  /** Thumbs up that haven't left the phone yet. */
  pendingLikes: string[];
  /** Cards whose like has left: liked again, it isn't counted twice. */
  sentLikes: string[];
  /** Cards whose thumb down has left: it still shows as given. */
  sentDislikes: string[];
}

interface PrefsActions {
  confirmAge: () => void;
  setTheme: (theme: ThemeId) => void;
  /** Thumb up: keeps the card as a favourite, and likes it once online. */
  toggleFavorite: (cardId: string) => void;
  /** Thumb down: reports the card, or takes the report back. */
  setDislike: (cardId: string, report: PendingReport | null) => void;
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
  pendingLikes: [],
  sentLikes: [],
  sentDislikes: [],
};

/** How many sent thumbs the phone remembers. */
export const SENT_LIMIT = 1000;

/** How many reports and likes may wait on the phone. */
export const MAX_PENDING = 50;

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
        set(({ favorites, pendingLikes, pendingReports, sentLikes }) => {
          const without = pendingLikes.filter((id) => id !== cardId);
          if (favorites.includes(cardId)) {
            return {
              favorites: favorites.filter((id) => id !== cardId),
              pendingLikes: without,
            };
          }
          return {
            favorites: [...favorites, cardId],
            pendingLikes: sentLikes.includes(cardId)
              ? without
              : [...without, cardId].slice(-MAX_PENDING),
            // One thumb at a time: liking a card takes its report back.
            pendingReports: pendingReports.filter(
              (report) => !(report.thumb && report.cardId === cardId),
            ),
          };
        }),
      // A thumb down that has left can't be taken back online; here it
      // stops showing as given.
      setDislike: (cardId, report) =>
        set(({ favorites, pendingLikes, pendingReports, sentDislikes }) => {
          const others = pendingReports.filter(
            (other) => !(other.thumb && other.cardId === cardId),
          );
          if (!report) {
            return {
              pendingReports: others,
              sentDislikes: sentDislikes.filter((id) => id !== cardId),
            };
          }
          return {
            pendingReports: [
              ...others,
              { ...report, cardId, thumb: true as const },
            ].slice(-MAX_PENDING),
            favorites: favorites.filter((id) => id !== cardId),
            pendingLikes: pendingLikes.filter((id) => id !== cardId),
          };
        }),
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

/** How many steps back the game remembers. */
const HISTORY_LIMIT = 20;

/**
 * The game before a tap, without what a tap never changes (players,
 * settings) and with one turn instead of all: a tap only changes the last
 * turn, or adds one. Twenty whole games would weigh megabytes in a long one.
 */
export interface Step extends Pick<
  GameState,
  | "scores"
  | "rules"
  | "partners"
  | "genderSlots"
  | "nextPauseAt"
  | "finished"
  | "outOfCards"
> {
  turnCount: number;
  lastTurn: Turn | undefined;
}

const stepOf = (game: GameState): Step => ({
  scores: game.scores,
  rules: game.rules,
  partners: game.partners,
  genderSlots: game.genderSlots,
  nextPauseAt: game.nextPauseAt,
  finished: game.finished,
  outOfCards: game.outOfCards,
  turnCount: game.turns.length,
  lastTurn: game.turns.at(-1),
});

/** The game as it was at `step`, rebuilt from the game it led to. */
function restore(game: GameState, step: Step, now: number): GameState {
  const { turnCount, lastTurn, ...rest } = step;
  return {
    ...game,
    ...rest,
    turns: lastTurn
      ? [...game.turns.slice(0, turnCount - 1), lastTurn]
      : game.turns.slice(0, turnCount),
    updatedAt: now,
  };
}

interface GameStore {
  game: GameState | null;
  /** The game before each of the last taps, the oldest first. */
  past: Step[];
  /** The cards stepped back from, the next first: shown again, not redrawn. */
  redo: (Draw & { replacement?: true })[];
  start: (settings: Settings, players: Player[]) => void;
  play: (outcome: Outcome | "next", deltas?: Record<string, number>) => void;
  choose: (choice: Choice) => void;
  /** Back to the game as it was before the last tap. */
  back: () => void;
  end: () => void;
  clear: () => void;
}

function context(): Context {
  return {
    // Read at each card: the deck only changes at the home screen.
    deck: getDeck(),
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
      past: [],
      redo: [],
      start: (settings, players) => {
        const game = startGame({ id: newId(), settings, players }, context());
        rememberCurrent(game);
        set({ game, past: [], redo: [] });
      },
      play: (outcome, deltas) => {
        const { game, past, redo } = get();
        if (!game) return;
        // After a step back, the same card comes again: a joker's
        // replacement after a joker, the next card otherwise.
        const again =
          redo[0] && !!redo[0].replacement === (outcome === "joker")
            ? redo[0]
            : undefined;
        const next = play(game, outcome, { ...context(), redo: again }, deltas);
        if (next === game) return;
        const drew = next.turns.length > game.turns.length;
        if (drew) rememberCurrent(next);
        const reused = drew && next.turns.at(-1)?.cardId === again?.cardId;
        set({
          game: next,
          past: [...past, stepOf(game)].slice(-HISTORY_LIMIT),
          // A different card came: what followed it no longer holds.
          redo: !drew ? redo : reused ? redo.slice(1) : [],
        });
      },
      choose: (choice) => {
        const { game, past } = get();
        if (!game) return;
        const next = choose(game, choice, Date.now());
        if (next !== game) {
          set({
            game: next,
            past: [...past, stepOf(game)].slice(-HISTORY_LIMIT),
          });
        }
      },
      back: () => {
        const { game, past, redo } = get();
        const previous = past.at(-1);
        if (!game || !previous) return;
        const undone = game.turns.at(-1);
        const left = game.turns.length > previous.turnCount && undone;
        set({
          game: restore(game, previous, Date.now()),
          past: past.slice(0, -1),
          redo: left
            ? [
                {
                  cardId: undone.cardId,
                  players: undone.players,
                  stake: undone.stake,
                  ...(undone.replacement && { replacement: true as const }),
                },
                ...redo,
              ]
            : redo,
        });
      },
      end: () => {
        const { game } = get();
        if (game) set({ game: endGame(game, Date.now()), past: [], redo: [] });
      },
      clear: () => set({ game: null, past: [], redo: [] }),
    }),
    {
      name: GAME_KEY,
      version: 3,
      storage: safeStorage,
      partialize: ({ game, past, redo }) => ({ game, past, redo }),
      // A saved game stays playable after an update: an older one is
      // converted here rather than dropped.
      migrate: (saved, version) => {
        const { game, past, redo } = saved as Partial<GameStore>;
        // Version 1 had no packs: it played every card there was.
        if (game && version < 2) game.settings.packs ??= [];
        // Version 3 added the steps back. An older game showed a quiz's
        // answer on the next card: its answers count as seen.
        if (game && version < 3) {
          game.turns = game.turns.map((turn, index) =>
            index < game.turns.length - 1 ? { ...turn, revealed: true } : turn,
          );
        }
        return { game: game ?? null, past: past ?? [], redo: redo ?? [] };
      },
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
  useGame.setState({ game: null, past: [], redo: [] });
  usePrefs.setState(initialPrefs);
  useGame.persist.clearStorage();
  usePrefs.persist.clearStorage();
}
