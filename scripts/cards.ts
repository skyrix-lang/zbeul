import { readFileSync, writeFileSync } from "node:fs";
import { cardSchema, type Card, type MiniGame } from "@zbeul/core";

// yarn cards:generate  writes the bundled deck from specs/cartes-mvp.md, the
//                      cards' source of truth until the admin exists.
// yarn cards:check     fails when the deck is out of date (part of `yarn verify`).

const SOURCE = "specs/cartes-mvp.md";
const OUTPUT = "packages/feature-game/src/cards/fr.json";

const GAME_BY_HEADING: Record<string, MiniGame> = {
  "Tu préfères": "tu-preferes",
  "J'ai déjà ou je n'ai jamais": "jamais",
  "Action ou vérité": "action-verite",
  "Qui pourrait… ?": "qui-pourrait",
  Tribunal: "tribunal",
  Duel: "duel",
  "Culture G : le plus proche": "culture-g",
  "Chaîne de thème": "chaine",
  "Dans ma valise": "valise",
  "Montre ou bois": "montre-ou-bois",
  "Tout le monde concerné": "tout-le-monde",
  "Sentence gratuite": "sentence",
  "Invente une règle": "regle",
  "Partenaire de boisson": "partenaire",
  Pause: "pause",
};

const AUDIENCE_BY_ID: Record<string, Card["audience"]> = {
  "TMC-GARS": "gars",
  "TMC-FILLES": "filles",
  "TMC-AUTRES": "autres",
};

const THEME_BY_LABEL: Record<string, Card["themes"][number]> = {
  contact: "contact",
  sexe: "sexe",
  ex: "ex",
  couple: "couple",
  argent: "argent",
  avis: "avis",
  secrets: "secrets",
  transgressions: "transgressions",
};

export function parseCards(markdown: string): Card[] {
  const cards: Card[] = [];
  let game: MiniGame | undefined;

  for (const line of markdown.split("\n")) {
    const heading = /^### (.+)$/.exec(line)?.[1];
    if (heading) {
      game = GAME_BY_HEADING[heading.trim()];
      if (!game) throw new Error(`Unknown mini-game heading: ${heading}`);
      continue;
    }
    if (line.startsWith("## ")) game = undefined;
    if (!game || !/^\| [A-Z]+-[A-Z0-9]+ +\|/.test(line)) continue;

    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const [id = "", level = "", text = "", themes = "", ...rest] = cells;
    const remark = game === "culture-g" ? "" : (rest[0] ?? "");
    const players = new Set(text.match(/\[J[1-4]\]/g));
    const ruleDuration = /Règle valable (\d+) cartes/.exec(remark)?.[1];

    const card = cardSchema.parse({
      id,
      game,
      level: Number(level),
      text,
      themes: themes
        .split(",")
        .map((theme) => theme.trim())
        .filter(Boolean)
        .map((theme) => {
          const known = THEME_BY_LABEL[theme];
          if (!known) throw new Error(`${id}: unknown theme "${theme}"`);
          return known;
        }),
      targets: players.size,
      audience: AUDIENCE_BY_ID[id],
      doubleTier: remark.includes("Enjeu doublé") || undefined,
      witness: remark.includes("témoin") || undefined,
      ruleDuration: game === "regle" ? Number(ruleDuration ?? 10) : undefined,
      ...(game === "culture-g" && {
        answer: rest[0],
        unit: rest[1],
        source: rest[2],
      }),
    });
    cards.push(card);
  }

  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) throw new Error("Two cards share a reference");
  return cards;
}

function main() {
  // One card per line, so a change to a card is a one-line diff.
  const cards = parseCards(readFileSync(SOURCE, "utf8"));
  const json = `[\n${cards.map((card) => JSON.stringify(card)).join(",\n")}\n]\n`;
  if (process.argv[2] === "check") {
    if (readFileSync(OUTPUT, "utf8") !== json) {
      console.error(
        `${OUTPUT} is out of date with ${SOURCE}: run \`yarn cards:generate\`.`,
      );
      process.exit(1);
    }
    console.log("The bundled deck matches the cards file.");
    return;
  }
  writeFileSync(OUTPUT, json);
  console.log(`Wrote ${OUTPUT}.`);
}

if (process.argv[1]?.endsWith("cards.ts")) main();
