import { Link } from "@tanstack/react-router";
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
  intro,
  children,
  footer,
}: {
  title: string;
  back?: Path;
  intro?: ReactNode;
  children: ReactNode;
  /** Stays at the bottom of the screen; the content scrolls above it. */
  footer?: ReactNode;
}) {
  const content = (
    <>
      <header>
        <Link
          to={back}
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
        <div className="mt-6 flex flex-1 flex-col gap-6">{children}</div>
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
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-6 pl-[max(1.25rem,env(safe-area-inset-left))]">
        {content}
      </div>
      <div className="border-t pt-3 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
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
 * parent needs `relative isolate`, so the lights stay behind its content.
 */
export function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="bg-primary/25 animate-drift absolute -top-24 -left-24 size-80 rounded-full blur-3xl motion-reduce:animate-none" />
      <div className="bg-level-5-glow/20 animate-drift absolute top-1/3 -right-32 size-96 rounded-full blur-3xl [animation-delay:-6s] motion-reduce:animate-none" />
      <div className="bg-level-3/15 animate-drift absolute -bottom-32 left-1/4 size-80 rounded-full blur-3xl [animation-delay:-11s] motion-reduce:animate-none" />
    </div>
  );
}
