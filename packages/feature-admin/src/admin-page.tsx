import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import {
  getListReportsQueryKey,
  throwUnexpected,
  useGetAdminStatus,
  useGetMe,
  useListReports,
  useUpdateReport,
} from "@zbeul/api";
import { REPORT_STATUSES, type Report, type ReportStatus } from "@zbeul/core";
import { Button, buttonVariants, Card } from "@zbeul/ui";
import { AdminLogin, AdminSetup } from "./sign-in";

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "À lire",
  handled: "Traités",
  dismissed: "Sans suite",
};

const EMPTY: Record<ReportStatus, string> = {
  open: "Rien à lire. Soit tout va bien, soit personne n'ose.",
  handled: "Aucun signalement traité pour l'instant.",
  dismissed: "Rien de classé sans suite.",
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface AdminPageProps {
  /** Which reports to list: URL state, owned by the route. */
  status: ReportStatus;
  /** What a signed-in visitor who isn't the admin sees: the app's 404. */
  notFound: ReactNode;
  /** Shows a card from its reference; the deck lives in the game package. */
  renderCard: (cardId: string) => ReactNode;
}

/**
 * The hidden admin. Signed out: the sign-in form (or, the first time, the
 * password setup). Signed in as someone else: "page not found", as if there
 * were no admin. The BFF enforces the same on every admin route.
 */
export function AdminPage(props: AdminPageProps) {
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
  if (!user.isAdmin) return props.notFound;
  return <Dashboard email={user.email} {...props} />;
}

function Dashboard({
  email,
  status,
  renderCard,
}: AdminPageProps & { email: string | null }) {
  const reports = useListReports(
    { status },
    { query: { throwOnError: throwUnexpected(404) } },
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Zbeul, admin</h1>
          <p className="text-muted-foreground text-sm">{email}</p>
        </div>
        {/* A form post: the BFF ends the session and redirects home. */}
        <form method="post" action="/auth/logout">
          <Button type="submit" variant="secondary">
            <LogOut aria-hidden="true" className="size-4" />
            Se déconnecter
          </Button>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">Signalements</h2>
        <nav aria-label="Filtrer les signalements" className="flex gap-2">
          {REPORT_STATUSES.map((option) => (
            <Link
              key={option}
              to="/admin"
              search={option === "open" ? {} : { status: option }}
              aria-current={option === status ? "page" : undefined}
              className={buttonVariants({
                variant: option === status ? "primary" : "ghost",
                size: "sm",
              })}
            >
              {STATUS_LABELS[option]}
            </Link>
          ))}
        </nav>

        {!reports.data ? (
          <p role="status" className="text-muted-foreground">
            Chargement…
          </p>
        ) : reports.data.length === 0 ? (
          <p className="text-muted-foreground">{EMPTY[status]}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.data.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                renderCard={renderCard}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReportRow({
  report,
  renderCard,
}: {
  report: Report;
  renderCard: AdminPageProps["renderCard"];
}) {
  const queryClient = useQueryClient();
  const update = useUpdateReport();
  const file = async (status: ReportStatus) => {
    await update.mutateAsync({ id: report.id, data: { status } });
    // The report leaves this list and joins another.
    await queryClient.invalidateQueries({
      queryKey: getListReportsQueryKey().slice(0, 1),
    });
  };
  const actions: { status: ReportStatus; label: string }[] = [
    { status: "handled", label: "Traité" },
    { status: "dismissed", label: "Sans suite" },
    { status: "open", label: "Rouvrir" },
  ];

  return (
    <li data-testid="report">
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-sm">
          <time dateTime={report.createdAt}>
            {dateFormat.format(new Date(report.createdAt))}
          </time>
          {report.cardId && ` · carte ${report.cardId}`}
        </p>
        {report.cardId && renderCard(report.cardId)}
        {report.message ? (
          <p className="whitespace-pre-wrap">{report.message}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Sans commentaire.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {actions
            .filter((action) => action.status !== report.status)
            .map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.status === "handled" ? "primary" : "secondary"}
                disabled={update.isPending}
                onClick={() => void file(action.status)}
              >
                {action.label}
              </Button>
            ))}
        </div>
      </Card>
    </li>
  );
}
