import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Heart, Trophy } from "lucide-react";
import { Button, buttonVariants, cn } from "@zbeul/ui";
import { useDeck } from "../cards";
import { CardText, FamilyBadge, levelClass } from "../components/game-card";
import { SAFE_AREA, Section } from "../components/screen";
import { pendingAnswer, ranking, type RankingRow } from "../engine/game";
import { cardSegments, pointsLabel, sipsLabel } from "../engine/text";
import { PATHS } from "../paths";
import { useGame, usePrefs } from "../store";
import { enterGameMode } from "../use-game-screen";

/** The end of a game: the ranking, the cards worth keeping, and another round. */
export function EndPage() {
  const navigate = useNavigate();
  const game = useGame((state) => state.game);
  const start = useGame((state) => state.start);
  const favorites = usePrefs((prefs) => prefs.favorites);
  const toggleFavorite = usePrefs((prefs) => prefs.toggleFavorite);
  const deck = useDeck();

  if (!game) return <Navigate to={PATHS.home} replace />;
  if (!game.finished) return <Navigate to={PATHS.play} replace />;

  const { settings, players } = game;
  const rows = ranking(game);
  const answer = pendingAnswer(game, deck);
  const everyoneLevel = rows.every((row) => row.total === 0);
  const played = game.turns.flatMap((turn) => {
    const card = deck.byId.get(turn.cardId);
    return card && card.game !== "pause" ? [{ turn, card }] : [];
  });

  const replay = () => {
    enterGameMode();
    start(settings, players);
    void navigate({ to: PATHS.play });
  };

  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-md flex-col",
        SAFE_AREA,
      )}
    >
      <main className="flex flex-1 flex-col gap-6 pt-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {settings.format === "teams"
              ? "Le classement des équipes"
              : "Le classement"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {game.outOfCards
              ? "Plus de cartes ? Vous êtes des machines."
              : `${game.turns.length} cartes plus tard, voilà où vous en êtes.`}
          </p>
        </div>

        {answer && (
          <p className="bg-card rounded-lg border p-4 text-sm">
            <span className="font-semibold">
              La réponse de la dernière carte : {answer.answer} {answer.unit}
            </span>
            <span className="text-muted-foreground block">{answer.source}</span>
          </p>
        )}

        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <RankingLine
              key={row.id}
              row={row}
              sips={settings.sips}
              winner={row.rank === 1 && !everyoneLevel}
              // Line by line, the winner last to be believed.
              delay={index * 110}
            />
          ))}
        </ol>
        {everyoneLevel && (
          <p className="text-muted-foreground text-center text-sm">
            Égalité parfaite. Personne n'a rien risqué, bravo la prise de
            risque.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button size="xl" onClick={replay}>
            Rejouer
          </Button>
          <Link
            to={PATHS.setup}
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            Changer les réglages
          </Link>
          <Link
            to={PATHS.home}
            className={buttonVariants({ size: "lg", variant: "ghost" })}
          >
            Retour à l'accueil
          </Link>
        </div>

        <Section
          title="Les cartes de la partie"
          hint="Touche le cœur pour garder les meilleures en favoris."
        >
          <ul className="flex flex-col gap-2">
            {played.map(({ turn, card }, index) => {
              const kept = favorites.includes(card.id);
              return (
                <li
                  key={`${card.id}-${index}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3",
                    levelClass(card.level),
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <FamilyBadge card={card} />
                    <p className="font-display mt-1 leading-snug font-bold">
                      <CardText
                        segments={cardSegments(
                          card,
                          turn,
                          players,
                          settings.sips,
                        )}
                        level={card.level}
                      />
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={kept}
                    aria-label={`Garder la carte ${card.id} en favori`}
                    onClick={() => toggleFavorite(card.id)}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none active:scale-90"
                  >
                    <Heart
                      aria-hidden="true"
                      className={cn("size-6", kept && "fill-current")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      </main>
    </div>
  );
}

function RankingLine({
  row,
  sips,
  winner,
  delay,
}: {
  row: RankingRow;
  sips: boolean;
  winner: boolean;
  delay: number;
}) {
  return (
    <li
      data-testid="ranking-row"
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "bg-card animate-rise flex items-center gap-3 rounded-lg border p-3 motion-reduce:animate-fade-in",
        winner && "border-primary ring-primary ring-2",
      )}
    >
      <span
        className={cn(
          "font-display flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold",
          winner
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {winner ? (
          <Trophy
            aria-label="Vainqueur"
            className="size-5 motion-safe:animate-bounce"
          />
        ) : (
          row.rank
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block truncate text-lg font-extrabold">
          {row.name}
        </span>
        <span className="text-muted-foreground block truncate text-sm">
          {row.members.length > 0 && `${row.members.join(", ")} · `}
          {sips
            ? `a distribué ${sipsLabel(row.won)}, en a bu ${row.lost}`
            : `+${row.won} / −${row.lost}`}
        </span>
      </span>
      {!sips && (
        <span className="font-display text-xl font-extrabold tabular-nums">
          {pointsLabel(row.total)}
        </span>
      )}
    </li>
  );
}
