import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { deckSchema, type Card, type PublishedDeck } from "@zbeul/core";
import { createDeck, type Deck } from "../engine/game";
import cards from "./fr.json";

// The deck the game plays with. The app bundles one (generated from
// specs/cartes-mvp.md by `yarn cards:generate`), so a first game plays without
// a connection. The admin's published deck replaces it once received: it is
// kept on the phone (localStorage) and used from then on, offline too.

/** The deck bundled with the app. */
export const deck = createDeck(cards as Card[]);

export const DECK_KEY = "zbeul:deck";

interface DeckStore {
  /** The last deck received from the server, or null before any. */
  received: PublishedDeck | null;
  receive: (deck: unknown) => boolean;
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      received: null,
      /**
       * Keeps a deck from the server, if it is one and it has cards: a broken
       * answer never replaces a deck that works. Returns whether it was kept.
       */
      receive: (candidate) => {
        const parsed = deckSchema.safeParse(candidate);
        if (!parsed.success || parsed.data.cards.length === 0) return false;
        if (parsed.data.version !== get().received?.version) {
          set({ received: parsed.data });
        }
        return true;
      },
    }),
    {
      name: DECK_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ received }) => ({ received }),
    },
  ),
);

// Indexing 900 cards is cheap but not free: once per deck received.
let indexed: { from: PublishedDeck; deck: Deck } | undefined;

const deckOf = (received: PublishedDeck | null): Deck => {
  if (!received) return deck;
  if (indexed?.from !== received) {
    indexed = { from: received, deck: createDeck(received.cards) };
  }
  return indexed.deck;
};

/** The deck in use: the last one received, or the bundled one. */
export const getDeck = (): Deck => deckOf(useDeckStore.getState().received);

/** The deck in use, for a component: it follows a new deck. */
export const useDeck = (): Deck =>
  deckOf(useDeckStore((store) => store.received));

/** The packs players can choose from. None before a deck is received. */
export const usePacks = () =>
  useDeckStore((store) => store.received?.packs) ?? NO_PACKS;
const NO_PACKS: PublishedDeck["packs"] = [];
