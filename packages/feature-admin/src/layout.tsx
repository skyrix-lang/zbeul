import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { throwUnexpected, useGetAdminStatus, useGetMe } from "@zbeul/api";
import { Button, cn } from "@zbeul/ui";
import { AdminLogin, AdminSetup } from "./sign-in";

const NAV = [
  { to: "/admin", label: "Signalements", exact: true },
  { to: "/admin/cartes", label: "Cartes", exact: false },
  { to: "/admin/packs", label: "Packs", exact: true },
  { to: "/admin/historique", label: "Historique", exact: true },
] as const;

const tab =
  "rounded-md px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Everything under /admin goes through here. Signed out: the sign-in form
 * (or, the first time, the password setup). Signed in as someone else: "page
 * not found", as if there were no admin. The admin: the page, under the
 * admin's own header. The BFF enforces the same on every admin route.
 */
export function AdminGate({
  notFound,
  children,
}: {
  /** What a signed-in visitor who isn't the admin sees: the app's 404. */
  notFound: ReactNode;
  children: ReactNode;
}) {
  const me = useGetMe({ query: { throwOnError: throwUnexpected() } });
  const status = useGetAdminStatus({
    query: { throwOnError: throwUnexpected() },
  });

  if (!me.data || !status.data) {
    return (
      <p role="status" className="text-muted-foreground p-8 text-center">
        Chargement…
      </p>
    );
  }
  const { user } = me.data;
  if (!user) return status.data.setupNeeded ? <AdminSetup /> : <AdminLogin />;
  if (!user.isAdmin) return notFound;

  return (
    // The admin works at a desk: its text can be selected and copied.
    <div className="page-container flex min-h-dvh flex-col gap-6 py-5 select-text">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold">Zbeul, admin</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
          {/* A form post: the BFF ends the session and redirects home. */}
          <form method="post" action="/auth/logout">
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden="true" className="size-4" />
              Se déconnecter
            </Button>
          </form>
        </div>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 border-b pb-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact, includeSearch: false }}
              className={tab}
              activeProps={{
                className: cn(
                  tab,
                  "bg-primary-soft text-primary-soft-foreground",
                ),
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  );
}

/** A page's title and what follows, under the admin's header. */
export function AdminSection({
  title,
  intro,
  action,
  className,
  children,
}: {
  title: string;
  intro?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h2">{title}</h1>
          {intro && <p className="text-muted-foreground text-sm">{intro}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** "Chargement…", said to screen readers too. */
export function Loading() {
  return (
    <p role="status" className="text-muted-foreground">
      Chargement…
    </p>
  );
}

export const selectClass =
  "bg-card border-input focus-visible:ring-ring min-h-10 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
