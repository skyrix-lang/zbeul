import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { LEVELS, type Level, type MiniGame } from "@zbeul/core";
import {
  Button,
  cn,
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@zbeul/ui";
import { useDeck, usePacks } from "../cards";
import { Choice, ToggleRow } from "../components/choice";
import { levelClass } from "../components/game-card";
import { Screen, Section } from "../components/screen";
import { startProblems } from "../engine/game";
import {
  DURATIONS,
  FAMILY_LABELS,
  GAMES,
  INTENSITIES,
  LEVEL_NAMES,
  LEVEL_TONES,
  SELECTABLE_GAMES,
  type Family,
  type Intensity,
} from "../engine/rules";
import { PATHS } from "../paths";
import { useGame, usePrefs } from "../store";
import { enterGameMode } from "../use-game-screen";
import { PlayersSection, TeamsSection, ThemeChecks } from "./setup-players";

const FAMILIES = Object.keys(FAMILY_LABELS) as Family[];

/** The game's settings. Each change is kept for the next game as it is made. */
export function SetupPage() {
  const navigate = useNavigate();
  const settings = usePrefs((prefs) => prefs.settings);
  const players = usePrefs((prefs) => prefs.players);
  const alcoholWarned = usePrefs((prefs) => prefs.alcoholWarned);
  const setSettings = usePrefs((prefs) => prefs.setSettings);
  const update = usePrefs((prefs) => prefs.update);
  const start = useGame((game) => game.start);
  const deck = useDeck();
  const packs = usePacks();
  // No pack chosen plays them all; a pack that no longer exists is forgotten.
  const chosenPacks = packs.filter(
    (pack) => settings.packs.length === 0 || settings.packs.includes(pack.id),
  );
  const playingPacks = chosenPacks.length > 0 ? chosenPacks : packs;
  const togglePack = (id: string) => {
    const next = playingPacks.some((pack) => pack.id === id)
      ? playingPacks.filter((pack) => pack.id !== id)
      : [...playingPacks, packs.find((pack) => pack.id === id)!];
    // At least one pack: a game needs cards.
    if (next.length === 0) return;
    setSettings({
      packs: next.length === packs.length ? [] : next.map((pack) => pack.id),
    });
  };
  const [confirming, setConfirming] = useState<"border" | "alcohol" | null>(
    null,
  );

  const problems = startProblems(settings, players);
  const chosenGames = SELECTABLE_GAMES.filter((game) =>
    settings.games.includes(game),
  );

  const launch = () => {
    if (problems.length > 0) return;
    // Asked here, on the tap: browsers refuse full screen at any other time.
    enterGameMode();
    start(settings, players);
    void navigate({ to: PATHS.play });
  };
  const chooseLevel = (level: Level) => {
    // Border asks once, as it is turned on.
    if (level === 5 && settings.level !== 5) setConfirming("border");
    else setSettings({ level });
  };
  const toggleSips = (sips: boolean) => {
    if (sips && !alcoholWarned) setConfirming("alcohol");
    else setSettings({ sips });
  };
  const toggleGame = (game: MiniGame) =>
    setSettings({
      games: settings.games.includes(game)
        ? settings.games.filter((other) => other !== game)
        : [...settings.games, game],
    });

  return (
    <Screen
      title="Nouvelle partie"
      intro="Ajoute les joueurs et lance. Le reste est déjà réglé."
      footer={
        <div className="flex flex-col gap-2">
          <p
            role="status"
            className={cn(
              "text-center text-sm",
              problems.length > 0
                ? "text-destructive-soft-foreground"
                : "text-muted-foreground",
            )}
          >
            {problems[0] ??
              `${players.length} joueurs, ${settings.duration ?? "∞"} cartes, niveau ${LEVEL_NAMES[settings.level]}.`}
          </p>
          <Button size="xl" disabled={problems.length > 0} onClick={launch}>
            C'est parti
          </Button>
        </div>
      }
    >
      <PlayersSection />
      <TeamsSection />

      <Section
        title="Niveau"
        hint="Le plafond de la partie. Plus un niveau en est proche, plus il sort."
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Niveau de la partie</legend>
          {LEVELS.map((level) => (
            <label
              key={level}
              className="bg-card has-checked:border-primary has-checked:ring-primary has-focus-visible:ring-ring flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-2 pr-4 has-checked:ring-2 has-focus-visible:ring-2"
            >
              <input
                type="radio"
                name="level"
                className="sr-only"
                checked={settings.level === level}
                onChange={() => chooseLevel(level)}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "font-display flex size-10 shrink-0 items-center justify-center rounded-md text-xl font-extrabold",
                  levelClass(level),
                )}
              >
                {level}
              </span>
              <span>
                <span className="block font-semibold">
                  {LEVEL_NAMES[level]}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {LEVEL_TONES[level]}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <ToggleRow
          title="Montée en pression"
          hint="On démarre au niveau 1 et ça grimpe jusqu'au plafond."
          checked={settings.pressure}
          onCheckedChange={(pressure) => setSettings({ pressure })}
        />
      </Section>

      <Section title="Enjeux">
        <ToggleRow
          title="Mode gorgées"
          hint={
            settings.sips
              ? "Activé. L'abus d'alcool est dangereux pour la santé."
              : "Désactivé : on joue aux points."
          }
          checked={settings.sips}
          onCheckedChange={toggleSips}
        />
        <Choice
          label="Intensité des enjeux"
          name="intensity"
          value={settings.intensity}
          onChange={(intensity) => setSettings({ intensity })}
          options={(Object.keys(INTENSITIES) as Intensity[]).map(
            (intensity) => ({
              value: intensity,
              label: INTENSITIES[intensity].label,
            }),
          )}
        />
        <ToggleRow
          title="Montée progressive"
          hint="Petits enjeux au début, gros à la fin."
          checked={settings.progressive}
          onCheckedChange={(progressive) => setSettings({ progressive })}
        />
      </Section>

      <Section title="Durée">
        <Choice
          label="Nombre de cartes"
          name="duration"
          value={settings.duration ?? 0}
          onChange={(duration) => setSettings({ duration: duration || null })}
          options={DURATIONS.map((duration) => ({
            value: duration ?? 0,
            label: duration ?? "Illimité",
            hint: duration ? "cartes" : "jusqu'au bout",
          }))}
        />
      </Section>

      <Section title="Options">
        <details className="group bg-card rounded-lg border">
          <OptionSummary
            title="Mini-jeux"
            value={`${chosenGames.length} sur ${SELECTABLE_GAMES.length}`}
          />
          <div className="flex flex-col gap-4 px-4 pb-4">
            {FAMILIES.map((family) => (
              <fieldset key={family}>
                <legend className="text-muted-foreground text-sm font-semibold">
                  {FAMILY_LABELS[family]}
                </legend>
                {SELECTABLE_GAMES.filter(
                  (game) => GAMES[game].family === family,
                ).map((game) => {
                  const tooFew = players.length < GAMES[game].minPlayers;
                  return (
                    <div
                      key={game}
                      className="flex min-h-12 items-center gap-3"
                    >
                      <input
                        id={`game-${game}`}
                        type="checkbox"
                        aria-describedby={`game-${game}-how`}
                        checked={settings.games.includes(game)}
                        onChange={() => toggleGame(game)}
                        className="accent-primary size-5 shrink-0"
                      />
                      <div>
                        <label
                          htmlFor={`game-${game}`}
                          className="block cursor-pointer font-semibold"
                        >
                          {GAMES[game].label}
                        </label>
                        <p
                          id={`game-${game}-how`}
                          className="text-muted-foreground text-sm"
                        >
                          {game === "partenaire" && !settings.sips
                            ? "En mode gorgées seulement."
                            : tooFew
                              ? `À partir de ${GAMES[game].minPlayers} joueurs.`
                              : GAMES[game].how}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </details>

        <details className="group bg-card rounded-lg border">
          <OptionSummary
            title="Thèmes à éviter"
            value={
              settings.excluded.length === 0
                ? "Aucun"
                : `${settings.excluded.length} en moins`
            }
          />
          <div className="px-4 pb-4">
            <ThemeChecks
              legend="Pour toute la partie"
              excluded={settings.excluded}
              onToggle={(theme) =>
                setSettings({
                  excluded: settings.excluded.includes(theme)
                    ? settings.excluded.filter((other) => other !== theme)
                    : [...settings.excluded, theme],
                })
              }
            />
          </div>
        </details>

        {packs.length > 1 ? (
          <fieldset className="bg-card rounded-lg border p-4">
            <legend className="sr-only">Packs de cartes</legend>
            <p aria-hidden="true" className="font-semibold">
              Packs
            </p>
            {packs.map((pack) => (
              <div key={pack.id} className="flex min-h-12 items-center gap-3">
                <input
                  id={`pack-${pack.id}`}
                  type="checkbox"
                  aria-describedby={`pack-${pack.id}-about`}
                  checked={playingPacks.some((other) => other.id === pack.id)}
                  onChange={() => togglePack(pack.id)}
                  className="accent-primary size-5 shrink-0"
                />
                <div>
                  <label
                    htmlFor={`pack-${pack.id}`}
                    className="block cursor-pointer font-semibold"
                  >
                    {pack.name}
                  </label>
                  <p
                    id={`pack-${pack.id}-about`}
                    className="text-muted-foreground text-sm"
                  >
                    {pack.description ||
                      "Des cartes en plus, toujours gratuites."}
                  </p>
                </div>
              </div>
            ))}
          </fieldset>
        ) : (
          <p className="text-muted-foreground text-sm">
            {packs[0]?.name ?? "Pack officiel"} : {deck.cards.length} cartes,
            toutes gratuites.
          </p>
        )}
      </Section>

      <Dialog
        open={confirming === "border"}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogTitle>Border, vraiment ?</DialogTitle>
        <DialogDescription>
          Argent, intimité, secrets, avis cash sur le groupe : ça pique. En
          confirmant, tu assures que tous les joueurs sont majeurs et d'accord.
          Qui préfère rester tranquille baisse son profil dans ses options.
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button variant="secondary" size="lg" />}>
            On reste sages
          </DialogClose>
          <Button
            size="lg"
            onClick={() => {
              setSettings({ level: 5 });
              setConfirming(null);
            }}
          >
            Tout le monde est d'accord
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirming === "alcohol"}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogTitle>Mode gorgées</DialogTitle>
        <DialogDescription>
          L'abus d'alcool est dangereux pour la santé. Bois avec modération, ou
          pas du tout : le jeu marche aussi très bien aux points. Des pauses
          verre d'eau tomberont pendant la partie, et personne ne conduit en
          rentrant.
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button variant="secondary" size="lg" />}>
            On reste aux points
          </DialogClose>
          <Button
            size="lg"
            onClick={() => {
              update({
                alcoholWarned: true,
                settings: { ...settings, sips: true },
              });
              setConfirming(null);
            }}
          >
            Compris, on active
          </Button>
        </DialogActions>
      </Dialog>
    </Screen>
  );
}

/**
 * The line that opens an option. It says what is chosen, and shows that it
 * opens: "Modifier" and a chevron, which turn into "Fermer" once open.
 */
function OptionSummary({ title, value }: { title: string; value: string }) {
  return (
    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{value}</span>
      </span>
      <span className="text-primary-soft-foreground flex shrink-0 items-center gap-1 text-sm font-semibold">
        <span className="group-open:hidden">Modifier</span>
        <span className="hidden group-open:inline">Fermer</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </span>
    </summary>
  );
}
