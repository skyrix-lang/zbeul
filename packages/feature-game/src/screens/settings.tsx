import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { LEVELS } from "@zbeul/core";
import {
  Button,
  cn,
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@zbeul/ui";
import { useDeck } from "../cards";
import { GameCard, levelClass } from "../components/game-card";
import { Screen, Section } from "../components/screen";
import { LEVEL_NAMES } from "../engine/rules";
import { previewSegments } from "../engine/text";
import { LEGAL_LINKS, PATHS, type Path } from "../paths";
import { eraseEverything, THEMES, usePrefs } from "../store";

/** Applies the chosen theme to the page, now and at each change. */
export function useTheme() {
  const theme = usePrefs((prefs) => prefs.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "nuit") delete root.dataset.theme;
    else root.dataset.theme = theme;
    // The browser's own bars take the theme's background.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", getComputedStyle(root).backgroundColor);
  }, [theme]);
}

const SAMPLE_CARD = "MOB-001";

/** Everything secondary lives here: theme, data, reports, legal pages. */
export function SettingsPage({
  version,
  cookieSettings,
}: {
  version: string;
  /**
   * Reopens the cookie banner, when the app measures its audience: the
   * visitor can change their answer here. Its id receives focus back.
   */
  cookieSettings?: { id: string; open: () => void };
}) {
  const navigate = useNavigate();
  const theme = usePrefs((prefs) => prefs.theme);
  const setTheme = usePrefs((prefs) => prefs.setTheme);
  const [erasing, setErasing] = useState(false);
  const deck = useDeck();
  const sample = deck.byId.get(SAMPLE_CARD) ?? deck.cards[0]!;

  const links: { to: Path; label: string }[] = [
    { to: PATHS.report, label: "Signaler un problème" },
    { to: PATHS.install, label: "Installer l'appli" },
    ...LEGAL_LINKS,
  ];

  return (
    <Screen title="Réglages">
      <Section
        title="Thème"
        hint="Touche un thème : il s'applique tout de suite."
      >
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Thème de l'appli</legend>
          {THEMES.map((option) => (
            <label
              key={option.id}
              className="bg-card has-checked:border-primary has-checked:ring-primary has-focus-visible:ring-ring flex min-h-16 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 has-checked:ring-2 has-focus-visible:ring-2"
            >
              <input
                type="radio"
                name="theme"
                className="sr-only"
                checked={theme === option.id}
                onChange={() => setTheme(option.id)}
              />
              <span className="font-semibold">{option.label}</span>
              <span className="text-muted-foreground text-xs">
                {option.mood}
              </span>
            </label>
          ))}
        </fieldset>
        <figure aria-label="Aperçu du thème" className="flex flex-col gap-2">
          <figcaption className="text-muted-foreground text-sm">
            Un exemple de carte et les cinq niveaux, dans ce thème. Rien à
            toucher ici.
          </figcaption>
          <div className="pointer-events-none relative select-none">
            <GameCard
              card={sample}
              segments={previewSegments(sample)}
              className="h-52"
              footer={
                <p className="font-display text-lg font-extrabold">
                  2 gorgées à distribuer ou à boire
                </p>
              }
            />
            {/* A stamp across the card: it is a sample, not a game. */}
            <p
              aria-hidden="true"
              className="border-foreground/80 bg-background/85 text-foreground font-display absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-2 border-dashed px-4 py-1 text-2xl font-extrabold tracking-widest uppercase"
            >
              Aperçu
            </p>
          </div>
          <ul className="grid grid-cols-5 gap-1.5">
            {LEVELS.map((level) => (
              <li
                key={level}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-md px-1 text-center text-[0.6875rem] leading-tight font-bold",
                  levelClass(level),
                  level === 5 && "shadow-none",
                )}
              >
                {LEVEL_NAMES[level]}
              </li>
            ))}
          </ul>
        </figure>
      </Section>

      <Section title="Le reste">
        <ul className="bg-card divide-y rounded-lg border">
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="focus-visible:ring-ring flex min-h-13 items-center justify-between gap-3 px-4 font-semibold focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                {link.label}
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-5"
                />
              </Link>
            </li>
          ))}
          {cookieSettings && (
            <li>
              <button
                type="button"
                id={cookieSettings.id}
                onClick={cookieSettings.open}
                className="focus-visible:ring-ring flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left font-semibold focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                Gérer les cookies
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-5"
                />
              </button>
            </li>
          )}
        </ul>
      </Section>

      <Section
        title="Tes données"
        hint="Joueurs, parties, favoris : tout reste sur ce téléphone, rien n'est envoyé en ligne."
      >
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setErasing(true)}
          className="text-destructive-soft-foreground"
        >
          Effacer toutes les données
        </Button>
      </Section>

      <p className="text-muted-foreground text-center text-sm">
        Zbeul, the game for afterparties. Version {version}.
      </p>

      <Dialog open={erasing} onOpenChange={setErasing}>
        <DialogTitle>Tout effacer ?</DialogTitle>
        <DialogDescription>
          La partie en cours, les joueurs, les favoris et les réglages
          disparaissent de ce téléphone. Impossible de revenir en arrière.
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button variant="secondary" size="lg" />}>
            Non, je garde tout
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              eraseEverything();
              void navigate({ to: PATHS.home });
            }}
          >
            Tout effacer
          </Button>
        </DialogActions>
      </Dialog>
    </Screen>
  );
}
