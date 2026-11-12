import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminGate } from "@zbeul/feature-admin";
import { NotFoundPage } from "../components/not-found";
import { useNoindex } from "../page-meta";

// The hidden admin: no link leads here, it is never indexed, and the service
// worker never serves it offline (vite.config.ts). There is no redirect to a
// sign-in page: the gate itself asks for the password, and shows "page not
// found" to a signed-in visitor who isn't the admin. The BFF checks every
// admin request again.
export const Route = createFileRoute("/admin")({
  component: function AdminLayout() {
    useNoindex();
    return (
      <AdminGate notFound={<NotFoundPage />}>
        <Outlet />
      </AdminGate>
    );
  },
});
