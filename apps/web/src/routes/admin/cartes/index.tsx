import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CARD_STATUSES, LEVELS, MINI_GAMES } from "@zbeul/core";
import { CARD_SORTS, CardsPage } from "@zbeul/feature-admin";
import { usePageMeta } from "../../../page-meta";

// The list's filters live in the URL. An unknown value is no filter.
const searchSchema = z.object({
  game: z.enum(MINI_GAMES).optional().catch(undefined),
  level: z
    .union(LEVELS.map((level) => z.literal(level)))
    .optional()
    .catch(undefined),
  status: z.enum(CARD_STATUSES).optional().catch(undefined),
  pack: z.string().max(60).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  sort: z.enum(CARD_SORTS).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/cartes/")({
  validateSearch: searchSchema,
  component: function CardsRoute() {
    usePageMeta({ title: "Cartes | Admin", noindex: true });
    return <CardsPage filters={Route.useSearch()} />;
  },
});
