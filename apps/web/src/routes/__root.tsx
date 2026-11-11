import type { QueryClient } from "@tanstack/react-query";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTheme } from "@zbeul/feature-game";
import { Button } from "@zbeul/ui";
import { Message, NotFoundPage } from "../components/not-found";
import { usePageMeta } from "../page-meta";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootLayout,
    errorComponent: ErrorPage,
    notFoundComponent: NotFoundPage,
  },
);

// No header, menu or navigation bar: the game's screens fill the phone. The
// signed-in pages add their own layout (_starter.tsx).
function RootLayout() {
  useTheme();
  return <Outlet />;
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrors = useQueryErrorResetBoundary();
  usePageMeta({ title: "Oups", noindex: true });
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Message title="Ça a planté">
      <p className="text-muted-foreground">
        Rien de grave : ta partie est gardée sur ton téléphone.
      </p>
      <Button
        size="xl"
        onClick={() => {
          queryErrors.reset();
          reset();
          void router.invalidate();
        }}
      >
        Réessayer
      </Button>
    </Message>
  );
}
