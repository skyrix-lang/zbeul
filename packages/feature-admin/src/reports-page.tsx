import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getGetMeQueryKey,
  getListReportsQueryKey,
  throwUnexpected,
  useListCards,
  useListReports,
  useUpdateReport,
} from "@zbeul/api";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  type AdminCard,
  type Report,
  type ReportStatus,
} from "@zbeul/core";
import { Badge, Button, buttonVariants, Card } from "@zbeul/ui";
import { dateFormat, toCard, type RenderCard } from "./labels";
import { AdminSection, Loading } from "./layout";

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

/** What players reported. `status` is URL state, owned by the route. */
export function ReportsPage({
  status,
  renderCard,
}: {
  status: ReportStatus;
  renderCard: RenderCard;
}) {
  const queryClient = useQueryClient();
  const reports = useListReports(
    { status },
    { query: { throwOnError: throwUnexpected(404), retry: false } },
  );
  const cards = useListCards({
    query: { throwOnError: throwUnexpected(404), retry: false },
  });
  // A 404 here means the session ended (to anyone but the admin the route
  // doesn't exist): asking who is there again brings the sign-in form back.
  const signedOut = reports.isError;
  useEffect(() => {
    if (signedOut) {
      void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    }
  }, [signedOut, queryClient]);
  const byId = new Map(cards.data?.map((card) => [card.id, card]));

  return (
    <AdminSection className="page-section py-0" title="Signalements">
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
        <Loading />
      ) : reports.data.length === 0 ? (
        <p className="text-muted-foreground">{EMPTY[status]}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.data.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              card={report.cardId ? byId.get(report.cardId) : undefined}
              renderCard={renderCard}
            />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}

function ReportRow({
  report,
  card,
  renderCard,
}: {
  report: Report;
  card: AdminCard | undefined;
  renderCard: RenderCard;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateReport();
  const [failed, setFailed] = useState(false);
  const file = async (status: ReportStatus) => {
    setFailed(false);
    try {
      await update.mutateAsync({ id: report.id, data: { status } });
    } catch {
      setFailed(true);
    }
    // The report leaves this list and joins another. After a failure, the
    // list says whether the session is still there.
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
        {card && renderCard(toCard(card))}
        {report.reasons.length > 0 && (
          <ul aria-label="Raisons cochées" className="flex flex-wrap gap-1.5">
            {report.reasons.map((reason) => (
              <li key={reason}>
                <Badge tone="warning">{REPORT_REASON_LABELS[reason]}</Badge>
              </li>
            ))}
          </ul>
        )}
        {report.message ? (
          <p className="whitespace-pre-wrap">{report.message}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Sans commentaire.</p>
        )}
        {failed && (
          <p role="alert" className="text-destructive-soft-foreground text-sm">
            Ça n'a pas marché. Réessaie.
          </p>
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
          {card && (
            <Link
              to="/admin/cartes/$cardId"
              params={{ cardId: card.id }}
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              Corriger ou archiver la carte
            </Link>
          )}
        </div>
      </Card>
    </li>
  );
}
