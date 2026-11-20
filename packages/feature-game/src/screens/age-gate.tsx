import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button, cn } from "@zbeul/ui";
import { Glow, SAFE_AREA, Wordmark } from "../components/screen";
import { LEGAL_LINKS } from "../paths";
import { isAdult, usePrefs } from "../store";

/**
 * Shows the app to adults only: asked on the first visit, then remembered on
 * this phone for 12 months. The legal pages stay readable without it.
 */
export function AgeGate({ children }: { children: ReactNode }) {
  const confirmedAt = usePrefs((prefs) => prefs.ageConfirmedAt);
  const confirmAge = usePrefs((prefs) => prefs.confirmAge);
  if (isAdult(confirmedAt)) return children;

  return (
    <div
      className={cn(
        "isolate mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between gap-8",
        SAFE_AREA,
      )}
    >
      <Glow />
      <main className="flex flex-1 flex-col justify-center gap-6 text-center">
        <p>
          <Wordmark className="text-6xl" />
        </p>
        <h1 className="font-display text-3xl font-extrabold text-balance">
          Ce site est réservé aux personnes majeures
        </h1>
        <p className="text-muted-foreground text-balance">
          Zbeul est un jeu de soirée entre adultes. Ça chambre, ça balance, et
          certaines cartes piquent.
        </p>
        <div className="flex flex-col gap-3">
          <Button size="xl" onClick={confirmAge}>
            J'ai 18 ans ou plus
          </Button>
          <a
            href="https://www.service-public.fr/"
            rel="noreferrer"
            className="text-muted-foreground rounded-md py-3 underline underline-offset-4"
          >
            J'ai moins de 18 ans, je sors
          </a>
        </div>
      </main>
      <nav
        aria-label="Informations légales"
        className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted-foreground py-2 underline underline-offset-4"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
