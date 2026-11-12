import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Card, Level } from "@zbeul/core";
import { cn } from "@zbeul/ui";
import {
  FAMILY_LABELS,
  GAMES,
  LEVEL_NAMES,
  type Family,
} from "../engine/rules";
import type { Segment } from "../engine/text";

// A card, as it looks everywhere: in a game, in the favourites, and in the
// theme preview. Its background is its level's colour; a named player is the
// card inverted, so the highlight is readable on every level and theme.

const LEVEL_STYLE: Record<Level, { card: string; mark: string }> = {
  1: {
    card: "bg-level-1 text-level-1-foreground",
    mark: "bg-level-1-foreground text-level-1",
  },
  2: {
    card: "bg-level-2 text-level-2-foreground",
    mark: "bg-level-2-foreground text-level-2",
  },
  3: {
    card: "bg-level-3 text-level-3-foreground",
    mark: "bg-level-3-foreground text-level-3",
  },
  4: {
    card: "bg-level-4 text-level-4-foreground",
    mark: "bg-level-4-foreground text-level-4",
  },
  5: {
    card: "bg-level-5 text-level-5-foreground ring-level-5-glow ring-2 shadow-[0_0_2.5rem_-0.25rem_var(--level-5-glow)]",
    mark: "bg-level-5-foreground text-level-5",
  },
};

const FAMILY_DOT: Record<Family, string> = {
  vote: "bg-family-vote",
  revelations: "bg-family-revelations",
  defis: "bg-family-defis",
  culture: "bg-family-culture",
  collectif: "bg-family-collectif",
};

/** A level's colour as a small swatch or chip. */
export const levelClass = (level: Level) => LEVEL_STYLE[level].card;

/**
 * Sizes its text to fill the box without ever scrolling: the longest card
 * stays readable on the smallest phone, in portrait or landscape.
 */
export function FitText({
  fitKey,
  min = 10,
  max = 72,
  className,
  children,
}: {
  /** Refit when this changes: the text itself. */
  fitKey: string;
  min?: number;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const boxElement = box.current;
    const textElement = text.current;
    if (!boxElement || !textElement) return;
    const fit = () => {
      let low = min;
      let high = max;
      // Seven halvings land within half a pixel of the best size.
      for (let step = 0; step < 7; step++) {
        const size = (low + high) / 2;
        textElement.style.fontSize = `${size}px`;
        const fits =
          textElement.offsetHeight <= boxElement.clientHeight &&
          textElement.scrollWidth <= boxElement.clientWidth;
        if (fits) low = size;
        else high = size;
      }
      textElement.style.fontSize = `${low}px`;
    };
    fit();
    // The display font changes the text's size when it arrives.
    void document.fonts?.ready.then(fit);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(boxElement);
    return () => observer.disconnect();
  }, [fitKey, min, max]);

  return (
    <div
      ref={box}
      className={cn(
        "flex min-h-0 flex-1 items-center overflow-hidden",
        className,
      )}
    >
      <div ref={text} className="w-full">
        {children}
      </div>
    </div>
  );
}

export function CardText({
  segments,
  level,
}: {
  segments: readonly Segment[];
  level: Level;
}) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <mark
            key={index}
            className={cn(
              "rounded-[0.3em] box-decoration-clone px-[0.22em] font-extrabold",
              LEVEL_STYLE[level].mark,
            )}
          >
            {segment.name}
          </mark>
        ),
      )}
    </>
  );
}

export function FamilyBadge({ card }: { card: Card }) {
  const { family, label } = GAMES[card.game];
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
      <span
        aria-hidden="true"
        className={cn(
          "size-3 shrink-0 rounded-full ring-2 ring-current",
          FAMILY_DOT[family],
        )}
      />
      <span className="truncate">
        {FAMILY_LABELS[family] === label
          ? label
          : `${FAMILY_LABELS[family]} · ${label}`}
      </span>
    </p>
  );
}

export function GameCard({
  card,
  segments,
  top,
  footer,
  animated = false,
  className,
}: {
  card: Card;
  segments: readonly Segment[];
  /** Above the text: the previous quiz's answer. */
  top?: ReactNode;
  /** Below the text: the stake. */
  footer?: ReactNode;
  /** Slides in. */
  animated?: boolean;
  className?: string;
}) {
  const length = segments.reduce(
    (total, segment) =>
      total + (segment.type === "text" ? segment.text : segment.name).length,
    0,
  );
  return (
    <article
      className={cn(
        "flex min-h-0 flex-col gap-3 rounded-[1.75rem] p-5 landscape:gap-2 landscape:px-4 landscape:py-3",
        LEVEL_STYLE[card.level].card,
        animated && "animate-card-in motion-reduce:animate-fade-in",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <FamilyBadge card={card} />
        <p className="shrink-0 text-xs font-bold tracking-wide uppercase">
          {LEVEL_NAMES[card.level]}
        </p>
      </header>
      {top}
      <FitText fitKey={`${card.id}:${length}`}>
        <p
          data-testid="card-text"
          className={cn(
            "font-display leading-[1.12] font-extrabold text-balance select-text",
            // A long card narrows its letters, and may break its words, before it
            // shrinks them.
            length > 180 &&
              "leading-[1.16] font-bold hyphens-auto [font-stretch:82%]",
          )}
        >
          <CardText segments={segments} level={card.level} />
        </p>
      </FitText>
      {footer}
    </article>
  );
}
