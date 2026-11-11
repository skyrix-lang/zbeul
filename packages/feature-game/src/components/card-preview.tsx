import { cn } from "@zbeul/ui";
import { deck } from "../cards";
import { previewSegments } from "../engine/text";
import { CardText, FamilyBadge, levelClass } from "./game-card";

/**
 * A card from its reference, with made-up names: what the admin sees next to
 * a report. Nothing when the reference isn't in the deck.
 */
export function CardPreview({ cardId }: { cardId: string }) {
  const card = deck.byId.get(cardId);
  if (!card) return null;
  return (
    <div className={cn("rounded-2xl p-4", levelClass(card.level))}>
      <FamilyBadge card={card} />
      <p className="font-display mt-2 leading-snug font-bold">
        <CardText segments={previewSegments(card)} level={card.level} />
      </p>
    </div>
  );
}
