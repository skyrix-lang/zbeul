import type { Card } from "@zbeul/core";
import { cn } from "@zbeul/ui";
import { previewSegments, previewStakeLine } from "../engine/text";
import { CardText, FamilyBadge, levelClass } from "./game-card";

/**
 * A card as players see it, with made-up names: what the admin sees next to a
 * report, and while writing a card. With a `stake`, the stake line too.
 */
export function CardPreview({
  card,
  sips = true,
  stake,
}: {
  card: Card;
  sips?: boolean;
  stake?: number;
}) {
  return (
    <div className={cn("rounded-2xl p-4", levelClass(card.level))}>
      <FamilyBadge card={card} />
      <p className="font-display mt-2 leading-snug font-bold">
        <CardText segments={previewSegments(card, sips)} level={card.level} />
      </p>
      {stake !== undefined && (
        <p className="font-display mt-3 text-sm font-extrabold">
          {previewStakeLine(card, stake, sips)}
        </p>
      )}
    </div>
  );
}
