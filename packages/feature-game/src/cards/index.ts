import type { Card } from "@zbeul/core";
import { createDeck } from "../engine/game";
import cards from "./fr.json";

// The French deck, bundled with the app so a game plays offline. Generated
// from specs/cartes-mvp.md by `yarn cards:generate`; cards.test.ts checks
// every card against the schema.
export const deck = createDeck(cards as Card[]);
