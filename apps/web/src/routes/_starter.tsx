import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Footer } from "../components/footer";
import { Header } from "../components/header";

// The pages behind a sign-in (today the starter's bookings, tomorrow the
// admin) keep a classic layout, with a header and a footer. The game's own
// screens have neither: see _game.tsx.
export const Route = createFileRoute("/_starter")({
  component: () => (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  ),
});
