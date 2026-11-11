import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { AgeGate } from "@zbeul/feature-game";
import { useNoindex } from "../page-meta";

// The game's screens: for adults only, and without any header, menu or
// navigation bar. The legal pages sit outside, readable before the age gate.
export const Route = createFileRoute("/_game")({
  component: function GameLayout() {
    // Only the home should rank. The others say so themselves, but not while
    // the age gate stands in for them.
    useNoindex(
      useLocation({ select: (location) => location.pathname }) !== "/",
    );
    return (
      <AgeGate>
        <Outlet />
      </AgeGate>
    );
  },
});
