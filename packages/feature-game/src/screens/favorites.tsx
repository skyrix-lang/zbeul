import { Link } from "@tanstack/react-router";
import { HeartOff } from "lucide-react";
import { buttonVariants, cn } from "@zbeul/ui";
import { useDeck } from "../cards";
import { CardText, FamilyBadge, levelClass } from "../components/game-card";
import { Screen } from "../components/screen";
import { previewSegments } from "../engine/text";
import { PATHS } from "../paths";
import { usePrefs } from "../store";

/** The cards put aside at the end of a game. They stay on this phone. */
export function FavoritesPage() {
  const favorites = usePrefs((prefs) => prefs.favorites);
  const toggleFavorite = usePrefs((prefs) => prefs.toggleFavorite);
  const deck = useDeck();
  // A card removed by an update simply disappears from the list.
  const cards = favorites.flatMap((id) => deck.byId.get(id) ?? []).reverse();

  return (
    <Screen
      title="Favoris"
      intro={
        cards.length > 0
          ? "Vos cartes cultes. Les prénoms sont là pour l'exemple."
          : undefined
      }
    >
      {cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-2xl font-extrabold text-balance">
            Aucun favori. Soit vous êtes difficiles, soit vous n'avez pas encore
            joué.
          </p>
          <p className="text-muted-foreground text-balance">
            À la fin d'une partie, touche le cœur des cartes à garder.
          </p>
          <Link to={PATHS.setup} className={buttonVariants({ size: "xl" })}>
            Jouer
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li
              key={card.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4",
                levelClass(card.level),
              )}
            >
              <div className="min-w-0 flex-1">
                <FamilyBadge card={card} />
                <p className="font-display mt-2 text-lg leading-snug font-bold">
                  <CardText
                    segments={previewSegments(card)}
                    level={card.level}
                  />
                </p>
              </div>
              <button
                type="button"
                aria-label={`Retirer la carte ${card.id} des favoris`}
                onClick={() => toggleFavorite(card.id)}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none active:scale-90"
              >
                <HeartOff aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
