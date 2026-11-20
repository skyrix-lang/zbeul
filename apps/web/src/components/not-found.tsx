import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { buttonVariants } from "@zbeul/ui";
import { usePageMeta } from "../page-meta";

/** A full-screen message: an error, or a page that doesn't exist. */
export function Message({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="heading-screen text-balance">{title}</h1>
      {children}
    </main>
  );
}

// The server answers 404 for an address that matches no route (routes.json);
// a route's own "not found" still answers 200, so the page tells search
// engines not to index it too. Also what a signed-in visitor who isn't the admin
// sees at /admin: nothing says there is an admin.
export function NotFoundPage() {
  usePageMeta({ title: "Page introuvable", noindex: true });
  return (
    <Message title="Page introuvable">
      <p className="text-muted-foreground">
        Cette page n'existe pas. Ou alors elle est partie en after sans toi.
      </p>
      <Link to="/" className={buttonVariants({ size: "xl" })}>
        Retour à l'accueil
      </Link>
    </Message>
  );
}
