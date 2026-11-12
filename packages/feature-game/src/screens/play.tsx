import { Navigate } from "@tanstack/react-router";
import { Flag, Info, RotateCw, ScrollText, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@zbeul/core";
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
import { GameCard } from "../components/game-card";
import {
  isSettled,
  levelCap,
  pendingAnswer,
  type GameState,
  type Outcome,
} from "../engine/game";
import { GAMES, LEVEL_NAMES } from "../engine/rules";
import { cardSegments, segmentsText, stakeLine } from "../engine/text";
import { PATHS } from "../paths";
import { useSendReport } from "../reports";
import { useGame, usePrefs } from "../store";
import { leaveGameMode, useScreenAwake } from "../use-game-screen";

/**
 * The game screen, made for landscape: the card in the middle, the buttons on
 * each side, under the thumbs. Nothing to type and nobody to pick: at most
 * "Gagné", "Perdu", "Joker" and "Carte suivante". In portrait the buttons go
 * below the card.
 */
export function PlayPage() {
  const game = useGame((state) => state.game);
  const play = useGame((state) => state.play);
  const deck = useDeck();
  useScreenAwake();
  useEffect(() => leaveGameMode, []);
  const current = game?.turns.at(-1);
  const missing =
    !!current && !game?.finished && !deck.byId.has(current.cardId);
  // The card on screen was removed by an update: on to the next one.
  useEffect(() => {
    if (missing) play("next");
  }, [missing, play]);

  if (!game) return <Navigate to={PATHS.home} replace />;
  if (game.finished) return <Navigate to={PATHS.end} replace />;
  const turn = game.turns.at(-1);
  const card = turn && deck.byId.get(turn.cardId);
  if (!turn) return <Navigate to={PATHS.home} replace />;
  if (!card) return null; // Skipped by the effect above.
  return <Table game={game} card={card} />;
}

function Table({ game, card }: { game: GameState; card: Card }) {
  const play = useGame((state) => state.play);
  const end = useGame((state) => state.end);
  const deck = useDeck();
  const rotateHintClosed = usePrefs((prefs) => prefs.rotateHintClosed);
  const update = usePrefs((prefs) => prefs.update);
  const [dialog, setDialog] = useState<"quit" | "report" | null>(null);
  const report = useSendReport();
  const [reported, setReported] = useState<string | null>(null);

  const { settings, players } = game;
  const turn = game.turns.at(-1)!;
  const number = game.turns.length;
  const segments = cardSegments(card, turn, players, settings.sips);
  const answer = pendingAnswer(game, deck);
  const settled = isSettled(card) && !turn.outcome;
  const cap = levelCap(settings, number - 1);
  const levelRose =
    settings.pressure && number > 1 && cap > levelCap(settings, number - 2);
  const nameOf = (id: string) =>
    players.find((player) => player.id === id)?.name ?? "?";

  return (
    <div
      className={cn(
        "bg-background fixed inset-0 grid gap-3 [grid-template-areas:'top_top'_'card_card'_'lose_win'] [grid-template-columns:minmax(0,3fr)_minmax(0,2fr)] [grid-template-rows:auto_minmax(0,1fr)_auto]",
        "landscape:gap-x-4 landscape:gap-y-2 landscape:[grid-template-rows:auto_minmax(0,1fr)]",
        // Landscape: "Perdu" and "Joker" under the left thumb, "Gagné" or
        // "Carte suivante" under the right one.
        settled
          ? "landscape:[grid-template-areas:'lose_top_win'_'lose_card_win'] landscape:[grid-template-columns:minmax(6.5rem,17vw)_minmax(0,1fr)_minmax(6.5rem,17vw)]"
          : "landscape:[grid-template-areas:'top_win'_'card_win'] landscape:[grid-template-columns:minmax(0,1fr)_minmax(7rem,19vw)]",
        "pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]",
      )}
    >
      <h1 className="sr-only">Partie en cours</h1>

      {/* The counter and the reminders share the row, and wrap when short. */}
      <header className="flex min-w-0 items-start gap-1 [grid-area:top] landscape:items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Terminer la partie"
          onClick={() => setDialog("quit")}
          className="text-muted-foreground size-11 shrink-0"
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
        <div className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <p className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
            Carte {number}
            {settings.duration ? ` / ${settings.duration}` : ""}
          </p>
          {(game.rules.length > 0 || game.partners.length > 0) && (
            <ul
              aria-label="Règles en cours"
              className="flex flex-wrap justify-center gap-1.5 text-xs font-semibold"
            >
              {game.rules.map((rule, index) => (
                <li
                  key={`${rule.playerId}-${index}`}
                  className="bg-warning-soft text-warning-soft-foreground flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap"
                >
                  <ScrollText aria-hidden="true" className="size-3.5" />
                  Règle de {nameOf(rule.playerId)}
                  <span className="tabular-nums">
                    · encore {rule.remaining}
                  </span>
                </li>
              ))}
              {game.partners.map((id) => (
                <li
                  key={id}
                  className="bg-primary-soft text-primary-soft-foreground flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap"
                >
                  <Users aria-hidden="true" className="size-3.5" />
                  {nameOf(id)} a un partenaire de boisson
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Signaler cette carte"
          onClick={() => setDialog("report")}
          className="text-muted-foreground size-11 shrink-0"
        >
          <Flag aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <main className="relative flex min-h-0 min-w-0 flex-col [grid-area:card]">
        <GameCard
          // A new element for each card, so it slides in again.
          key={number}
          card={card}
          segments={segments}
          animated
          className="flex-1"
          top={answer && <Answer card={answer} />}
          footer={
            <footer className="flex flex-col gap-x-4 gap-y-0.5 landscape:flex-row landscape:items-end landscape:justify-between">
              <p className="text-sm font-semibold">{GAMES[card.game].how}</p>
              <p
                data-testid="stake"
                className="font-display text-lg leading-tight font-extrabold landscape:text-right"
              >
                {stakeLine(card, turn, game)}
              </p>
            </footer>
          }
        />
        {levelRose && (
          <p
            key={`level-${number}`}
            role="status"
            className="bg-foreground text-background font-display animate-pop pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-extrabold whitespace-nowrap shadow-lg motion-reduce:animate-fade-in"
          >
            Niveau {cap} · {LEVEL_NAMES[cap]}
          </p>
        )}
        {/* Screen readers hear each new card. */}
        <p aria-live="polite" className="sr-only">
          {GAMES[card.game].label}. {segmentsText(segments)}{" "}
          {stakeLine(card, turn, game)}
        </p>
      </main>

      {/* New buttons for each card: see Actions. */}
      <Actions key={number} settled={settled} onPlay={play} />

      {!rotateHintClosed && (
        <div className="bg-background/95 fixed inset-0 z-40 hidden flex-col items-center justify-center gap-5 p-8 text-center portrait:pointer-coarse:flex">
          <RotateCw
            aria-hidden="true"
            className="text-primary size-14 motion-safe:animate-pulse"
          />
          <p className="font-display text-3xl font-extrabold">
            Tourne ton téléphone
          </p>
          <p className="text-muted-foreground text-balance">
            La partie se joue à l'horizontale : la carte au milieu, les boutons
            sous les pouces.
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => update({ rotateHintClosed: true })}
          >
            Rester à la verticale
          </Button>
        </div>
      )}

      <Dialog
        open={dialog === "quit"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogTitle>On arrête là ?</DialogTitle>
        <DialogDescription>
          {number} cartes jouées. Le classement vous attend, et les rancunes
          aussi.
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button variant="secondary" size="lg" />}>
            Encore une carte
          </DialogClose>
          <Button size="lg" onClick={end}>
            Voir le classement
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog === "report"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogTitle>Signaler cette carte ?</DialogTitle>
        <DialogDescription>
          {reported === card.id
            ? "C'est noté, merci. Sans réseau, ça partira à la prochaine connexion."
            : `Carte ${card.id}. Fausse, nulle ou déplacée : dis-le, c'est anonyme. Aucune info sur vous ne part avec.`}
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button variant="secondary" size="lg" />}>
            {reported === card.id ? "Fermer" : "Finalement non"}
          </DialogClose>
          {reported !== card.id && (
            <Button
              size="lg"
              onClick={() => {
                void report({ cardId: card.id, message: "" });
                setReported(card.id);
              }}
            >
              Signaler
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}

/**
 * The card's buttons. They take a third of a second to accept a tap: a double
 * tap on the previous card must not settle this one before anyone has read
 * it. Meanwhile they look the same, and say "disabled" to assistive tools.
 */
function Actions({
  settled,
  onPlay,
}: {
  settled: boolean;
  onPlay: (outcome: Outcome | "next") => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
      // The previous card's buttons are gone, and the focus with them: a
      // keyboard carries on from this card's first button.
      if (document.activeElement === document.body) {
        group.current?.querySelector("button")?.focus({ preventScroll: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  const tap = (outcome: Outcome | "next") => () => {
    if (ready) onPlay(outcome);
  };

  if (!settled) {
    return (
      <div
        ref={group}
        className="flex [grid-area:lose/lose/win/win] landscape:[grid-area:win]"
      >
        <Button
          size="xl"
          aria-disabled={!ready}
          onClick={tap("next")}
          className="flex-1"
        >
          Carte suivante
        </Button>
      </div>
    );
  }
  return (
    <>
      <div
        ref={group}
        className="flex gap-3 [grid-area:lose] landscape:flex-col"
      >
        <Button
          size="xl"
          variant="secondary"
          aria-disabled={!ready}
          onClick={tap("lost")}
          className="min-w-0 flex-[2] px-2 landscape:flex-[3]"
        >
          Perdu
        </Button>
        <Button
          size="xl"
          variant="ghost"
          aria-disabled={!ready}
          onClick={tap("joker")}
          className="border-input min-w-0 flex-1 border border-dashed px-2"
        >
          Joker
        </Button>
      </div>
      <div className="flex [grid-area:win]">
        <Button
          size="xl"
          aria-disabled={!ready}
          onClick={tap("won")}
          className="min-w-0 flex-1 px-2"
        >
          Gagné
        </Button>
      </div>
    </>
  );
}

/** The previous quiz's answer, with its source one tap away. */
function Answer({ card }: { card: Card }) {
  return (
    <details
      data-testid="answer"
      className="rounded-xl bg-current/10 px-3 py-2 text-sm landscape:py-1"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden">
        <span>
          Réponse : {card.answer} {card.unit}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Info aria-hidden="true" className="size-4" />
          Source
        </span>
      </summary>
      <p className="mt-1 text-xs font-medium">{card.source}</p>
    </details>
  );
}
