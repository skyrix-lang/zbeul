import { Link } from "@tanstack/react-router";
import { throwUnexpected, useListCardChanges } from "@zbeul/api";
import { dateFormat, describeChange } from "./labels";
import { AdminSection, Loading } from "./layout";

/** Who changed which card, and when: the 200 latest changes. */
export function HistoryPage() {
  const changes = useListCardChanges(undefined, {
    query: { throwOnError: throwUnexpected(404) },
  });
  return (
    <AdminSection
      className="page-section py-0"
      title="Historique"
      intro="Les 200 dernières modifications de cartes."
    >
      {!changes.data ? (
        <Loading />
      ) : changes.data.length === 0 ? (
        <p className="text-muted-foreground">
          Rien pour l'instant : le jeu est comme au premier jour.
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {changes.data.map((change) => (
            <li key={change.id} data-testid="change" className="p-3 text-sm">
              <p className="text-muted-foreground">
                {dateFormat.format(new Date(change.createdAt))} ·{" "}
                {change.adminEmail}
              </p>
              <p>
                <Link
                  to="/admin/cartes/$cardId"
                  params={{ cardId: change.cardId }}
                  className="font-semibold underline underline-offset-4"
                >
                  {change.cardId}
                </Link>{" "}
                : {describeChange(change).join(" ; ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
