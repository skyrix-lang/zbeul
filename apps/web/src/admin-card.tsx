import type { RenderCard } from "@zbeul/feature-admin";
import { CardPreview } from "@zbeul/feature-game";

/**
 * How the admin shows a card: with the game's own components. Wired here
 * because the admin's package doesn't depend on the game's.
 */
export const renderCard: RenderCard = (card, options) => (
  <CardPreview card={card} {...options} />
);
