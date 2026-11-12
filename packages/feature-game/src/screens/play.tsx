import { Navigate, useNavigate } from "@tanstack/react-router";
import {
  Info,
  RotateCw,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type Card,
  type ReportReason,
} from "@zbeul/core";
import {
  Button,
  cn,
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogTitle,
  Textarea,
} from "@zbeul/ui";
import { useDeck } from "../cards";
import { GameCard } from "../components/game-card";
import {
  cardCount,
  hasAnswer,
  isJudged,
  isSettled,
  levelCap,
  type Choice,
  type GameState,
  type Outcome,
  type Player,
  type Turn,
} from "../engine/game";
import { GAMES, LEVEL_NAMES } from "../engine/rules";
import {
  actionAndTruth,
  cardSegments,
  pointsLabel,
  segmentsText,
  stakeLine,
  type Segment,
} from "../engine/text";
import { PATHS } from "../paths";
import { useFlushOnLeave } from "../reports";
import { useGame, usePrefs } from "../store";
import { leaveGameMode, useScreenAwake } from "../use-game-screen";

/**
 * The game screen, made for landscape: the card in the middle, the buttons on
 * each side, under the thumbs. With sips, "Carte suivante" is the only button:
 * the card says who drinks. With points, a card for one player has "Gagné",
 * "Perdu" and "Joker", and a card for several shows their names to tap.
 * In portrait the buttons go below the card.
 */
export function PlayPage() {
  const game = useGame((state) => state.game);
  const play = useGame((state) => state.play);
  const deck = useDeck();
  useScreenAwake();
  // Thumbs given during the game leave the phone when it is paused or over.
  useFlushOnLeave();
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
  return <Table game={game} card={card} turn={turn} />;
}

/** What the buttons of the card on screen do. */
type Mode = "choose" | "settle" | "next";

function Table({
  game,
  card,
  turn,
}: {
  game: GameState;
  card: Card;
  turn: Turn;
}) {
  const navigate = useNavigate();
  const play = useGame((state) => state.play);
  const choose = useGame((state) => state.choose);
  const back = useGame((state) => state.back);
  const canGoBack = useGame((state) => state.past.length > 0);
  const end = useGame((state) => state.end);
  const rotateHintClosed = usePrefs((prefs) => prefs.rotateHintClosed);
  const update = usePrefs((prefs) => prefs.update);
  const liked = usePrefs((prefs) => prefs.favorites.includes(card.id));
  // Given and still on the phone, or already sent in this game or another.
  const disliked = usePrefs(
    (prefs) =>
      prefs.sentDislikes.includes(card.id) ||
      prefs.pendingReports.some(
        (report) => report.thumb && report.cardId === card.id,
      ),
  );
  const toggleFavorite = usePrefs((prefs) => prefs.toggleFavorite);
  const setDislike = usePrefs((prefs) => prefs.setDislike);
  const [dialog, setDialog] = useState<"quit" | "dislike" | null>(null);

  const { settings, players } = game;
  const number = cardCount(game);
  // One face per step of a card: the question, then the answer or the half
  // that was chosen. Each slides in, and gets its own buttons.
  const face = `${game.turns.length}-${turn.revealed ? "answer" : (turn.choice ?? "card")}`;
  const answering = hasAnswer(card) && !!turn.revealed;
  const question = cardSegments(card, turn, players, settings.sips);
  const segments: Segment[] = answering
    ? [
        {
          type: "text",
          text: `${card.answer ?? "?"} ${card.unit ?? ""}`.trim(),
        },
      ]
    : question;
  const stake = stakeLine(card, turn, game);
  const choosing =
    card.game === "action-verite" &&
    !turn.choice &&
    actionAndTruth(card.text) !== null;
  const mode: Mode = choosing
    ? "choose"
    : isSettled(card, settings) && !turn.outcome
      ? "settle"
      : "next";
  // The group says who lost: on the card itself, or on a quiz's answer.
  const judging =
    isJudged(card, settings) && !turn.deltas && (!hasAnswer(card) || answering);
  const [deltas, setDeltas] = useState<{
    face: string;
    points: Record<string, number>;
  }>({ face, points: {} });
  const points = deltas.face === face ? deltas.points : {};

  const cap = levelCap(settings, number - 1);
  const levelRose =
    settings.pressure &&
    number > 1 &&
    !turn.replacement &&
    !answering &&
    !turn.choice &&
    cap > levelCap(settings, number - 2);
  const nameOf = (id: string) =>
    players.find((player) => player.id === id)?.name ?? "?";
  const endedRules = answering || turn.choice ? [] : (turn.endedRules ?? []);

  const leave = () => void navigate({ to: PATHS.home });

  return (
    <div
      className={cn(
        "bg-background fixed inset-0 grid gap-3 [grid-template-areas:'top_top'_'card_card'_'lose_win'] [grid-template-columns:minmax(0,3fr)_minmax(0,2fr)] [grid-template-rows:auto_minmax(0,1fr)_auto]",
        "landscape:gap-x-4 landscape:gap-y-2 landscape:[grid-template-rows:auto_minmax(0,1fr)]",
        // "Action" and "Vérité" weigh the same: half of the row each.
        mode === "choose" &&
          "[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]",
        // Landscape: the left thumb has "Perdu" and "Joker" (or "Vérité"),
        // the right one "Gagné", "Action" or "Carte suivante".
        mode === "next"
          ? "landscape:[grid-template-areas:'top_win'_'card_win'] landscape:[grid-template-columns:minmax(0,1fr)_minmax(7rem,19vw)]"
          : "landscape:[grid-template-areas:'lose_top_win'_'lose_card_win'] landscape:[grid-template-columns:minmax(6.5rem,17vw)_minmax(0,1fr)_minmax(6.5rem,17vw)]",
        "pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]",
      )}
    >
      <h1 className="sr-only">Partie en cours</h1>

      {/* The counter and the reminders share the row, and wrap when short. */}
      <header className="flex min-w-0 items-start gap-0.5 [grid-area:top] landscape:items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Quitter la partie"
          onClick={() => setDialog("quit")}
          className="text-muted-foreground size-11 shrink-0"
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Revenir en arrière"
          disabled={!canGoBack}
          onClick={back}
          className="text-muted-foreground size-11 shrink-0"
        >
          <Undo2 aria-hidden="true" className="size-5" />
        </Button>
        <div className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <p className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
            Carte {number}
            {settings.duration ? ` / ${settings.duration}` : ""}
          </p>
          {(game.rules.length > 0 || game.partners.length > 0) && (
            <ul
              aria-label="Règles en cours"
              className="flex max-w-full min-w-0 flex-wrap justify-center gap-1.5 text-xs font-semibold"
            >
              {game.rules.map((rule, index) => (
                <li
                  key={`${rule.playerId}-${index}`}
                  className="bg-warning-soft text-warning-soft-foreground flex max-w-full min-w-0 items-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap"
                >
                  <ScrollText
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  {/* A long name is cut short before it pushes the row wider
                      than the smallest screens. */}
                  <span className="truncate">
                    Règle de {nameOf(rule.playerId)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    · encore {rule.remaining}
                  </span>
                </li>
              ))}
              {game.partners.map((id) => (
                <li
                  key={id}
                  className="bg-primary-soft text-primary-soft-foreground flex max-w-full min-w-0 items-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap"
                >
                  <Users aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {nameOf(id)} a un partenaire de boisson
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="J'aime cette carte"
          aria-pressed={liked}
          onClick={() => toggleFavorite(card.id)}
          className={cn(
            "size-11 shrink-0",
            liked ? "text-success-soft-foreground" : "text-muted-foreground",
          )}
        >
          <ThumbsUp
            aria-hidden="true"
            className={cn("size-5", liked && "fill-current")}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Je n'aime pas cette carte"
          aria-pressed={disliked}
          onClick={() =>
            disliked ? setDislike(card.id, null) : setDialog("dislike")
          }
          className={cn(
            "size-11 shrink-0",
            disliked
              ? "text-destructive-soft-foreground"
              : "text-muted-foreground",
          )}
        >
          <ThumbsDown
            aria-hidden="true"
            className={cn("size-5", disliked && "fill-current")}
          />
        </Button>
      </header>

      <main className="relative flex min-h-0 min-w-0 flex-col gap-2 [grid-area:card]">
        <GameCard
          // A new element for each face, so it slides in again.
          key={face}
          card={card}
          segments={segments}
          animated
          className="flex-1"
          top={
            answering && (
              <p
                data-testid="question"
                className="line-clamp-2 text-sm font-semibold"
              >
                {segmentsText(question)}
              </p>
            )
          }
          footer={
            <footer className="flex flex-col gap-x-4 gap-y-0.5 landscape:flex-row landscape:items-end landscape:justify-between">
              {answering ? (
                <Source card={card} />
              ) : (
                <p className="text-sm font-semibold">
                  {choosing
                    ? "Choisis d'abord. La carte s'affiche ensuite."
                    : turn.replacement
                      ? "Carte de remplacement : plus de joker."
                      : GAMES[card.game].how}
                </p>
              )}
              <p
                data-testid="stake"
                className="font-display text-lg leading-tight font-extrabold landscape:text-right"
              >
                {stake}
              </p>
            </footer>
          }
        />
        {judging && (
          <Judges
            key={`judges-${face}`}
            card={card}
            turn={turn}
            players={players}
            points={points}
            onChange={(next) => setDeltas({ face, points: next })}
          />
        )}
        {(levelRose || endedRules.length > 0) && (
          <div
            key={`notes-${face}`}
            className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5"
          >
            {levelRose && (
              <p
                role="status"
                className="bg-foreground text-background font-display animate-pop rounded-full px-4 py-2 text-sm font-extrabold whitespace-nowrap shadow-lg motion-reduce:animate-fade-in"
              >
                Niveau {cap} · {LEVEL_NAMES[cap]}
              </p>
            )}
            {endedRules.map((id, index) => (
              <p
                key={`${id}-${index}`}
                role="alert"
                data-testid="rule-ended"
                className="bg-foreground text-background font-display animate-pop flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold whitespace-nowrap shadow-lg motion-reduce:animate-fade-in"
              >
                <ScrollText aria-hidden="true" className="size-4" />
                La règle de {nameOf(id)} est terminée
              </p>
            ))}
          </div>
        )}
        {/* Screen readers hear each new card. */}
        <p aria-live="polite" className="sr-only">
          {GAMES[card.game].label}. {answering && "Réponse : "}
          {segmentsText(segments)} {stake}
        </p>
      </main>

      {/* New buttons for each face: see Actions. */}
      <Actions
        key={face}
        mode={mode}
        joker={!turn.replacement}
        next={
          hasAnswer(card) && !answering ? "Voir la réponse" : "Carte suivante"
        }
        onChoose={choose}
        onPlay={(outcome) => play(outcome, judging ? points : undefined)}
      />

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
        <DialogTitle>On fait quoi ?</DialogTitle>
        <DialogDescription>
          {number} {number > 1 ? "cartes jouées" : "carte jouée"}. En pause, la
          partie t'attend sur l'accueil pendant 12 heures.
        </DialogDescription>
        <DialogActions>
          <DialogClose render={<Button size="lg" />}>
            Encore une carte
          </DialogClose>
          <Button variant="secondary" size="lg" onClick={leave}>
            Mettre en pause
          </Button>
          <Button variant="secondary" size="lg" onClick={end}>
            {settings.sips
              ? "Terminer la partie"
              : "Terminer et voir le classement"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dislike
        // A fresh form for each card.
        key={card.id}
        card={card}
        open={dialog === "dislike"}
        onClose={() => setDialog(null)}
        onSend={(report) => {
          setDislike(card.id, report);
          setDialog(null);
        }}
      />
    </div>
  );
}

/**
 * The card's buttons. They take a third of a second to accept a tap: a double
 * tap on the previous card must not settle this one before anyone has read
 * it. Meanwhile they look the same, and say "disabled" to assistive tools.
 */
function Actions({
  mode,
  joker,
  next,
  onChoose,
  onPlay,
}: {
  mode: Mode;
  /** Whether "Joker" is offered: not on a joker's replacement. */
  joker: boolean;
  /** What the only button says, when there is one. */
  next: string;
  onChoose: (choice: Choice) => void;
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
  const tap = (action: () => void) => () => {
    if (ready) action();
  };

  if (mode === "next") {
    return (
      <div
        ref={group}
        className="flex [grid-area:lose/lose/win/win] landscape:[grid-area:win]"
      >
        <Button
          size="xl"
          aria-disabled={!ready}
          onClick={tap(() => onPlay("next"))}
          // Narrow padding beside the card: the label fits the thinnest column.
          className="min-w-0 flex-1 landscape:px-2"
        >
          {next}
        </Button>
      </div>
    );
  }
  if (mode === "choose") {
    return (
      <>
        <div ref={group} className="flex [grid-area:lose]">
          <Button
            size="xl"
            variant="secondary"
            aria-disabled={!ready}
            onClick={tap(() => onChoose("verite"))}
            className="min-w-0 flex-1 px-2"
          >
            Vérité
          </Button>
        </div>
        <div className="flex [grid-area:win]">
          <Button
            size="xl"
            variant="secondary"
            aria-disabled={!ready}
            onClick={tap(() => onChoose("action"))}
            className="min-w-0 flex-1 px-2"
          >
            Action
          </Button>
        </div>
      </>
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
          onClick={tap(() => onPlay("lost"))}
          className="min-w-0 flex-[2] px-2 landscape:flex-[3]"
        >
          Perdu
        </Button>
        {joker && (
          <Button
            size="xl"
            variant="ghost"
            aria-disabled={!ready}
            onClick={tap(() => onPlay("joker"))}
            className="border-input min-w-0 flex-1 border border-dashed px-2"
          >
            Joker
          </Button>
        )}
      </div>
      <div className="flex [grid-area:win]">
        <Button
          size="xl"
          aria-disabled={!ready}
          onClick={tap(() => onPlay("won"))}
          className="min-w-0 flex-1 px-2"
        >
          Gagné
        </Button>
      </div>
    </>
  );
}

/**
 * Points mode, on a card for several players: their names, to tap. Each tap
 * moves a name to its next state; tapping nobody is fine.
 * - a group card: loses the stake (then the double, on a two-tier card);
 * - a duel: the loser of the two;
 * - a quiz: the closest wins the stake, the farthest loses it.
 */
function Judges({
  card,
  turn,
  players,
  points,
  onChange,
}: {
  card: Card;
  turn: Turn;
  players: readonly Player[];
  points: Record<string, number>;
  onChange: (points: Record<string, number>) => void;
}) {
  const { kind } = GAMES[card.game];
  const x = turn.stake;
  const steps =
    kind === "closest"
      ? [0, x, -x]
      : card.doubleTier
        ? [0, -x, -2 * x]
        : [0, -x];
  const judged =
    kind === "group"
      ? players
      : players.filter((player) => turn.players.includes(player.id));
  const legend =
    kind === "closest"
      ? "Un appui : le plus proche. Deux : le plus éloigné."
      : kind === "duel"
        ? "Qui a perdu ?"
        : card.doubleTier
          ? "Qui perd ? Deux appuis : le double."
          : "Qui perd ?";

  return (
    // `min-w-0`: a fieldset is as wide as its content by default, and the
    // names would push past a narrow screen instead of scrolling.
    <fieldset className="flex min-w-0 shrink-0 flex-col gap-1 landscape:flex-row landscape:items-center landscape:gap-2">
      <legend className="sr-only">{legend}</legend>
      <p
        aria-hidden="true"
        className="text-muted-foreground shrink-0 text-xs font-semibold landscape:max-w-28"
      >
        {legend}
      </p>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5">
        {judged.map((player) => {
          const given = points[player.id] ?? 0;
          const next = steps[(steps.indexOf(given) + 1) % steps.length]!;
          return (
            <button
              key={player.id}
              type="button"
              data-testid="judge"
              aria-label={`${player.name} : ${
                given === 0
                  ? "rien"
                  : `${given > 0 ? "gagne" : "perd"} ${pointsLabel(Math.abs(given))}`
              }`}
              onClick={() => onChange({ ...points, [player.id]: next })}
              className={cn(
                "focus-visible:ring-ring flex min-h-10 shrink-0 cursor-pointer touch-manipulation items-center gap-1.5 rounded-full border px-3 text-sm font-semibold select-none focus-visible:ring-2 focus-visible:outline-none",
                given === 0 && "bg-card",
                given > 0 &&
                  "bg-success-soft text-success-soft-foreground border-transparent",
                given < 0 &&
                  "bg-destructive-soft text-destructive-soft-foreground border-transparent",
              )}
            >
              {player.name}
              {given !== 0 && (
                <span className="tabular-nums">
                  {given > 0 ? "+" : "−"}
                  {Math.abs(given)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Where a quiz's answer comes from, one tap away. */
function Source({ card }: { card: Card }) {
  return (
    <details data-testid="answer" className="min-w-0 text-sm">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
        <Info aria-hidden="true" className="size-4" />
        Source
      </summary>
      <p className="text-xs font-medium select-text">{card.source}</p>
    </details>
  );
}

/** The thumb down: what's wrong with the card, and a few words if needed. */
function Dislike({
  card,
  open,
  onClose,
  onSend,
}: {
  card: Card;
  open: boolean;
  onClose: () => void;
  onSend: (report: { reasons: ReportReason[]; message: string }) => void;
}) {
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [message, setMessage] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogTitle>Elle a quoi, cette carte ?</DialogTitle>
      <DialogDescription>
        Carte {card.id}. C'est anonyme : rien sur vous ne part avec. Retouche le
        pouce pour annuler.
      </DialogDescription>
      <fieldset className="mt-4 grid grid-cols-2 gap-2">
        <legend className="sr-only">Ce qui ne va pas</legend>
        {REPORT_REASONS.map((reason) => (
          <label
            key={reason}
            className="has-checked:border-primary has-checked:ring-primary has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold has-checked:ring-2 has-focus-visible:ring-2"
          >
            <input
              type="checkbox"
              className="accent-primary size-4 shrink-0"
              checked={reasons.includes(reason)}
              onChange={() =>
                setReasons(
                  reasons.includes(reason)
                    ? reasons.filter((other) => other !== reason)
                    : [...reasons, reason],
                )
              }
            />
            {REPORT_REASON_LABELS[reason]}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex flex-col gap-1 text-sm font-medium">
        <label htmlFor="dislike-message">Un mot de plus (facultatif)</label>
        <Textarea
          id="dislike-message"
          rows={2}
          maxLength={1000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="text-base"
        />
      </div>
      <DialogActions>
        <DialogClose render={<Button variant="secondary" size="lg" />}>
          Finalement non
        </DialogClose>
        <Button
          size="lg"
          onClick={() => {
            onSend({ reasons, message: message.trim() });
            // Taken back and given again, the thumb starts from nothing.
            setReasons([]);
            setMessage("");
          }}
        >
          Envoyer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
