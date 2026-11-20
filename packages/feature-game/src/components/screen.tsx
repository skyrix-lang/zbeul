import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants, cn } from "@zbeul/ui";
import { PATHS, type Path } from "../paths";

/** Keeps content clear of the notch and the home bar, in any orientation. */
export const SAFE_AREA =
  "pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]";

/**
 * A secondary screen, in portrait: a "Retour" link, a title, the content.
 * There is no menu anywhere: every screen leads back to the home.
 */
export function Screen({
  title,
  back = PATHS.home,
  previous = false,
  selectable = false,
  intro,
  children,
  footer,
}: {
  title: string;
  back?: Path;
  /**
   * "Retour" returns to the screen the visitor came from, for a screen that
   * several others lead to; `back` is then where a direct visit goes.
   */
  previous?: boolean;
  /** The text can be selected: for pages meant to be read and quoted. */
  selectable?: boolean;
  intro?: ReactNode;
  children: ReactNode;
  /** Stays at the bottom of the screen; the content scrolls above it. */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const content = (
    <>
      <header>
        <Link
          to={back}
          onClick={(event) => {
            if (!previous || !canGoBack) return;
            event.preventDefault();
            router.history.back();
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "md" }),
            "-ml-3",
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
          Retour
        </Link>
      </header>
      <main className="flex flex-1 flex-col pt-2">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {title}
        </h1>
        {intro && <p className="text-muted-foreground mt-2">{intro}</p>}
        <div
          className={cn(
            "mt-6 flex flex-1 flex-col gap-6",
            selectable && "select-text",
          )}
        >
          {children}
        </div>
      </main>
    </>
  );

  if (!footer) {
    return (
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-md flex-col",
          SAFE_AREA,
        )}
      >
        {content}
      </div>
    );
  }
  // With a footer, the content scrolls above it: the footer never covers
  // what is being read or touched.
  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-md flex-col overflow-hidden">
      {/* `relative`: the visually hidden inputs inside are positioned against
          this scrolling area. Against the page, they made it taller than the
          screen, and a drag on the footer moved everything. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-6 pl-[max(1.25rem,env(safe-area-inset-left))]">
        {content}
      </div>
      <div className="touch-none border-t pt-3 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
        {footer}
      </div>
    </div>
  );
}

/** A titled block of a screen. */
export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div>
        <h2 className="font-display text-xl font-extrabold">{title}</h2>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** The game's name, in the brand's colours. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "from-primary to-level-3 font-display bg-gradient-to-br bg-clip-text font-extrabold tracking-tighter text-transparent [font-stretch:90%]",
        className,
      )}
    >
      Zbeul
    </span>
  );
}

/**
 * Soft moving lights behind the home and the age gate. Decoration only. The
 * parent needs `isolate`, so the lights stay behind its content.
 *
 * Fixed, and 6rem taller than the screen: when iOS cold-launches the app from
 * the home screen, it sizes the viewport (and `100dvh`) about a status bar
 * short until the first touch. Sized by its parent, the lights stopped there
 * and left a bare strip at the bottom. A fixed layer adds no scrolling; when
 * the content is taller than the screen, it scrolls over the lights. No
 * ancestor may have a transform or filter: the layer would be fixed against
 * it instead of the screen, and the strip would come back.
 */
export function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -bottom-24 -z-10 mx-auto max-w-md overflow-hidden"
    >
      <div className="bg-primary/25 animate-drift absolute -top-24 -left-24 size-80 rounded-full blur-3xl motion-reduce:animate-none" />
      <div className="bg-level-5-glow/20 animate-drift absolute top-1/3 -right-32 size-96 rounded-full blur-3xl [animation-delay:-6s] motion-reduce:animate-none" />
      {/* 2rem past the layer, which reaches 6rem past the screen: 8rem below
          its edge, as before. */}
      <div className="bg-level-3/15 animate-drift absolute -bottom-8 left-1/4 size-80 rounded-full blur-3xl [animation-delay:-11s] motion-reduce:animate-none" />
    </div>
  );
}
