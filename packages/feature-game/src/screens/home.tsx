import { Link } from "@tanstack/react-router";
import { Download, Heart, Settings2 } from "lucide-react";
import { buttonVariants, cn } from "@zbeul/ui";
import { Glow, SAFE_AREA, Wordmark } from "../components/screen";
import { cardCount } from "../engine/game";
import { PATHS } from "../paths";
import { resumable, useGame } from "../store";
import { enterGameMode } from "../use-game-screen";

/**
 * The home: play, and almost nothing else. No menu, no navigation bar.
 * "Installer l'appli" hides itself once the app runs from the home screen
 * (`installed:` is a display-mode media query, apps/web/src/styles.css).
 */
export function HomePage() {
  const game = useGame((state) => resumable(state.game));

  return (
    <div
      className={cn(
        "isolate mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between gap-8",
        SAFE_AREA,
      )}
    >
      <Glow />
      <main className="flex flex-1 flex-col justify-center gap-10">
        <div className="text-center">
          <h1 className="leading-none">
            <Wordmark className="text-[5.5rem] leading-none" />
          </h1>
          <p className="font-display mt-2 text-xl font-semibold tracking-tight">
            the game for afterparties
          </p>
          <p className="text-muted-foreground mt-3 text-balance">
            Un seul téléphone, on se le passe, et la soirée part en vrille.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {game ? (
            <>
              <Link
                to={PATHS.play}
                onClick={enterGameMode}
                className={buttonVariants({ size: "xl" })}
              >
                Reprendre la partie
              </Link>
              <p className="text-muted-foreground text-center text-sm">
                Carte {cardCount(game)}
                {game.settings.duration ? ` sur ${game.settings.duration}` : ""}
                , {game.players.length} joueurs. Elle vous attend.
              </p>
              <Link
                to={PATHS.setup}
                className={buttonVariants({ size: "xl", variant: "secondary" })}
              >
                Nouvelle partie
              </Link>
            </>
          ) : (
            <Link to={PATHS.setup} className={buttonVariants({ size: "xl" })}>
              Jouer
            </Link>
          )}
          <Link
            to={PATHS.install}
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "installed:hidden",
            )}
          >
            <Download aria-hidden="true" className="size-5" />
            Installer l'appli
          </Link>
        </div>
      </main>

      <footer className="flex justify-center gap-2">
        <Link
          to={PATHS.favorites}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-muted-foreground",
          )}
        >
          <Heart aria-hidden="true" className="size-4" />
          Favoris
        </Link>
        <Link
          to={PATHS.settings}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-muted-foreground",
          )}
        >
          <Settings2 aria-hidden="true" className="size-4" />
          Réglages
        </Link>
      </footer>
    </div>
  );
}
