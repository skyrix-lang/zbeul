import type { Card } from "@zbeul/core";
import type { GameState, Gender, Player, Turn } from "./game";
import { GAMES } from "./rules";

// What a card says once it is drawn: the players' names in place, the wording
// agreed with the first player's gender, and drinks turned into points when
// sips are off.

export type Segment =
  | { type: "text"; text: string }
  | { type: "player"; name: string };

const GENDER_INDEX: Record<Gender, number> = { gars: 0, fille: 1, autre: 2 };

/** "bois", "boit", "boivent" become points when sips are off. */
export function toPoints(text: string): string {
  return text
    .replace(/\bboivent double\b/g, "perdent le double")
    .replace(/\bboit double\b/g, "perd le double")
    .replace(/\bboit 1 gorgée/g, "perd 1 point")
    .replace(
      /\bbuvez tous les (deux|trois)\b/g,
      "perdez tous les $1 des points",
    )
    .replace(/\bboit avec toi\b/g, "perd des points avec toi")
    .replace(/\bte fera boire\b/g, "te fera perdre des points")
    .replace(/\bboivent\b/g, "perdent des points")
    .replace(/\bboit\b/g, "perd des points")
    .replace(/\b([Tt])u bois\b/g, "$1u perds des points");
}

/**
 * An "action ou vérité" card holds both halves in one text:
 * "[J1], action : … Vérité : …". Null when a card isn't written that way.
 */
export function actionAndTruth(text: string) {
  const parts =
    /^(.*?)\baction\s*:\s*([\s\S]*?)\s*Vérité\s*:\s*([\s\S]*)$/.exec(text);
  if (!parts) return null;
  return { lead: parts[1]!, action: parts[2]!, verite: parts[3]! };
}

/** What an "action ou vérité" card shows: the question, then the chosen half. */
function chosenHalf(text: string, choice: Turn["choice"]) {
  const halves = actionAndTruth(text);
  if (!halves) return text;
  if (choice === "action") return `${halves.lead}action : ${halves.action}`;
  if (choice === "verite") return `${halves.lead}vérité : ${halves.verite}`;
  return `${halves.lead}action ou vérité ?`;
}

export function cardSegments(
  card: Card,
  turn: Turn,
  players: readonly Player[],
  sips: boolean,
  /** Both halves of an "action ou vérité" card: outside a game. */
  whole = false,
): Segment[] {
  const named = turn.players.map((id) =>
    players.find((player) => player.id === id),
  );
  const gender = named[0]?.gender ?? "autre";
  const shown =
    card.game === "action-verite" && !whole
      ? chosenHalf(card.text, turn.choice)
      : card.text;
  let text = shown
    // [accusé/accusée/accusé·e], [il/elle/iel]: agreed with the first player.
    .replace(
      /\[([^\]/]+)\/([^\]/]+)\/([^\]/]+)\]/g,
      (_, ...forms: string[]) => forms[GENDER_INDEX[gender]]!,
    )
    .replaceAll("[durée]", String(card.ruleDuration ?? 10));
  if (!sips) text = toPoints(text);

  return text
    .split(/(\[J[1-4]\])/)
    .filter((part) => part !== "")
    .map((part): Segment => {
      const index = /^\[J([1-4])\]$/.exec(part)?.[1];
      if (!index) return { type: "text", text: part };
      return { type: "player", name: named[Number(index) - 1]?.name ?? "?" };
    });
}

/** The card as one string, for screen readers and the favourites. */
export const segmentsText = (segments: readonly Segment[]) =>
  segments
    .map((segment) => (segment.type === "text" ? segment.text : segment.name))
    .join("");

/** A card outside a game: made-up players, named as the card needs. */
function preview(card: Card, stake = 0) {
  const names = ["Romain", "Inès", "Sacha", "Léa"];
  const players: Player[] = names.map((name, index) => ({
    id: String(index),
    name,
    gender: index % 2 === 0 ? "gars" : "fille",
    ceiling: null,
    excluded: [],
    team: null,
  }));
  const turn: Turn = {
    cardId: card.id,
    players: players.slice(0, card.targets).map((player) => player.id),
    stake,
  };
  return { players, turn };
}

/** A card outside a game, with made-up names: for favourites and previews. */
export function previewSegments(card: Card, sips = true): Segment[] {
  const { players, turn } = preview(card);
  return cardSegments(card, turn, players, sips, true);
}

/** The stake line of a card outside a game, for a preview. */
export function previewStakeLine(card: Card, stake: number, sips: boolean) {
  const { players, turn } = preview(card, stake);
  return stakeLine(card, turn, { settings: { sips }, players });
}

export const sipsLabel = (count: number) =>
  `${count} ${count > 1 ? "gorgées" : "gorgée"}`;
export const pointsLabel = (count: number) =>
  `${count} ${count > 1 ? "points" : "point"}`;

/** The stake, in the card's own terms: "Le perdant boit 3 gorgées". */
export function stakeLine(
  card: Card,
  turn: Turn,
  state: {
    settings: Pick<GameState["settings"], "sips">;
    players: readonly Player[];
  },
): string {
  const { sips } = state.settings;
  const { kind } = GAMES[card.game];
  const x = turn.stake;
  const amount = sips ? sipsLabel(x) : pointsLabel(x);
  const name =
    state.players.find((player) => player.id === turn.players[0])?.name ?? "";

  switch (kind) {
    case "pause":
      return "Aucun enjeu. Juste de l'eau.";
    case "partner":
      return "Jusqu'à la fin de la partie.";
    case "rule":
      return sips
        ? `Qui oublie la règle boit ${amount}`
        : `Qui oublie la règle perd ${amount}`;
    case "sentence":
      return sips ? `${name} boit ${amount}` : `${name} perd ${amount}`;
    case "duel":
      return sips ? `Le perdant boit ${amount}` : `Le perdant perd ${amount}`;
    case "closest":
      return sips
        ? `Le plus proche distribue ${amount}, le plus éloigné les boit`
        : `Le plus proche gagne ${amount}, le plus éloigné les perd`;
    case "solo":
      // With sips nobody presses "Gagné" or "Perdu": the card says it all.
      return sips
        ? `Réussi : distribue ${amount}. Raté : bois-les`
        : `${amount} à gagner ou à perdre`;
    case "group":
      if (card.doubleTier) {
        return sips
          ? `${sipsLabel(x)}, ${x * 2} pour le second groupe`
          : `${pointsLabel(x)}, ${x * 2} pour le second groupe`;
      }
      return sips
        ? `Les perdants boivent ${amount}`
        : `Les perdants perdent ${amount}`;
  }
}
