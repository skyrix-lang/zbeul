import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every theme must keep its text readable (WCAG 2.2 AA): the e2e axe checks
// only see the default theme, so the others are checked here.

const css = readFileSync("packages/theme-default/src/theme.css", "utf8");

function themes() {
  const blocks = [
    ...css.matchAll(/:root(?:\[data-theme="(\w+)"\])?\s*\{([^}]*)\}/g),
  ];
  const read = (body: string) =>
    Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((match) => [
        match[1]!,
        match[2]!,
      ]),
    );
  const base = read(blocks.find((block) => !block[1])![2]!);
  return blocks.map((block) => ({
    name: block[1] ?? "nuit",
    tokens: { ...base, ...read(block[2]!) },
  }));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Text colour, then each background it is used on. */
const TEXT_PAIRS: [string, string[]][] = [
  ["foreground", ["background", "card", "muted"]],
  ["card-foreground", ["card"]],
  ["muted-foreground", ["background", "card", "muted"]],
  ["primary-foreground", ["primary", "primary-hover", "destructive"]],
  ["primary-soft-foreground", ["primary-soft", "background", "card"]],
  ["secondary-foreground", ["secondary", "muted"]],
  ["success-soft-foreground", ["success-soft"]],
  ["warning-soft-foreground", ["warning-soft"]],
  ["destructive-soft-foreground", ["destructive-soft", "background", "card"]],
  ...[1, 2, 3, 4, 5].flatMap((level): [string, string[]][] => [
    [`level-${level}-foreground`, [`level-${level}`]],
    // A highlighted name is the card inverted.
    [`level-${level}`, [`level-${level}-foreground`]],
  ]),
];

/** Shapes that must stand out from what surrounds them (3:1). */
const SHAPE_PAIRS: [string, string[]][] = [
  ["input", ["background", "card"]],
  ["ring", ["background", "card"]],
  ["primary", ["background", "card"]],
];

describe.each(themes())("the $name theme", ({ tokens }) => {
  it("defines every token", () => {
    expect(Object.keys(tokens).sort()).toEqual(
      Object.keys(themes()[0]!.tokens).sort(),
    );
  });

  /** The pairs below `minimum`, as "text on background": empty when all pass. */
  const failing = (pairs: [string, string[]][], minimum: number) =>
    pairs.flatMap(([color, backgrounds]) =>
      backgrounds
        .filter(
          (background) =>
            contrast(tokens[color]!, tokens[background]!) < minimum,
        )
        .map((background) => `${color} on ${background}`),
    );

  it("keeps every text readable (4.5:1)", () => {
    expect(failing(TEXT_PAIRS, 4.5)).toEqual([]);
  });

  it("keeps inputs, focus rings and accents visible (3:1)", () => {
    expect(failing(SHAPE_PAIRS, 3)).toEqual([]);
  });
});

it("has the five themes", () => {
  expect(themes().map((theme) => theme.name)).toEqual([
    "nuit",
    "tokyo",
    "retro",
    "clair",
    "creme",
  ]);
});
