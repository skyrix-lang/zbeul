// How players' thumbs change the chance of drawing a card (docs/decisions.md).
// Tuned for a small group: a few votes are enough to move a card. With more
// players, raise NEUTRAL_VOTES so a card needs more votes to move.

/** Each card counts as if it already had this many votes in the middle. */
export const NEUTRAL_VOTES = 1;
/** A card voted down by everyone comes up this much less often (×0.25). */
export const LOWEST_WEIGHT = 0.25;
/** A card voted up by everyone comes up this much more often (×2). */
export const HIGHEST_WEIGHT = 2;

/**
 * How likely a card is drawn, against an unvoted one (1), from its thumbs up
 * and down. Never zero: a disliked card still comes up, less often.
 */
export function voteWeight(likes: number, dislikes: number): number {
  // From -1 (all down) to 1 (all up), pulled to 0 while votes are few.
  const balance = (likes - dislikes) / (likes + dislikes + NEUTRAL_VOTES);
  const weight =
    balance >= 0 ? HIGHEST_WEIGHT ** balance : LOWEST_WEIGHT ** -balance;
  // Two decimals: enough to draw with, and the deck stays stable.
  return Math.round(weight * 100) / 100;
}
