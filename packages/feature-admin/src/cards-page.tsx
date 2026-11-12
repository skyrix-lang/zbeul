import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  getListCardsQueryKey,
  throwUnexpected,
  useListCards,
  useListPacks,
  useUpdateCards,
} from "@zbeul/api";
import {
  CARD_STATUSES,
  LEVEL_NAMES,
  LEVELS,
  MINI_GAME_LABELS,
  MINI_GAMES,
  type AdminCard,
  type CardStatus,
  type Level,
  type MiniGame,
} from "@zbeul/core";
import { Badge, Button, buttonVariants, Input } from "@zbeul/ui";
import { STATUS_LABELS } from "./labels";
import { AdminSection, Loading, selectClass } from "./layout";

/** The list's filters: URL state, owned by the route. */
export interface CardFilters {
  game?: MiniGame;
  level?: Level;
  status?: CardStatus;
  pack?: string;
  q?: string;
}

const STATUS_TONES = {
  draft: "warning",
  published: "success",
  archived: "neutral",
} as const;

/** Accents and case don't matter when searching. */
const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterCards(cards: AdminCard[], filters: CardFilters) {
  const query = filters.q ? plain(filters.q) : "";
  return cards.filter(
    (card) =>
      (!filters.game || card.game === filters.game) &&
      (!filters.level || card.level === filters.level) &&
      (!filters.status || card.status === filters.status) &&
      (!filters.pack || card.packId === filters.pack) &&
      (!query ||
        plain(card.text).includes(query) ||
        plain(card.id).includes(query)),
  );
}

/** Every card, filtered; several can be changed at once. */
export function CardsPage({ filters }: { filters: CardFilters }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Always asked again on arrival: the list is what the admin acts on.
  const cards = useListCards({
    query: { throwOnError: throwUnexpected(404), staleTime: 0 },
  });
  const packs = useListPacks({
    query: { throwOnError: throwUnexpected(404), staleTime: 0 },
  });
  const bulk = useUpdateCards();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [change, setChange] = useState<{
    level?: Level;
    status?: CardStatus;
    packId?: string;
  }>({});
  const [result, setResult] = useState<string | null>(null);

  const setFilters = (patch: CardFilters) =>
    void navigate({
      to: "/admin/cartes",
      search: { ...filters, ...patch },
      replace: true,
    });
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    setFilters({ q: typeof q === "string" && q.trim() ? q.trim() : undefined });
  };

  const shown = filterCards(cards.data ?? [], filters);
  const ticked = shown.filter((card) => selected.has(card.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const nothingToChange = Object.values(change).every(
    (value) => value === undefined,
  );

  const apply = async () => {
    setResult(null);
    try {
      const { changed } = await bulk.mutateAsync({
        data: { ids: ticked.map((card) => card.id), ...change },
      });
      setResult(
        changed === 0
          ? "Rien n'a changé : elles étaient déjà comme ça."
          : `${changed} carte${changed > 1 ? "s" : ""} modifiée${changed > 1 ? "s" : ""}.`,
      );
      setSelected(new Set());
      setChange({});
    } catch {
      setResult("Ça n'a pas marché. Réessaie.");
    }
    await queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
  };

  return (
    <AdminSection
      title="Cartes"
      intro={
        cards.data
          ? `${shown.length} sur ${cards.data.length}. Seules les cartes publiées arrivent chez les joueurs.`
          : undefined
      }
      action={
        <Link to="/admin/cartes/nouvelle" className={buttonVariants()}>
          Nouvelle carte
        </Link>
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mini-jeu
          <select
            value={filters.game ?? ""}
            onChange={(event) =>
              setFilters({
                game: (event.target.value || undefined) as MiniGame | undefined,
              })
            }
            className={selectClass}
          >
            <option value="">Tous</option>
            {MINI_GAMES.map((game) => (
              <option key={game} value={game}>
                {MINI_GAME_LABELS[game]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Niveau
          <select
            value={filters.level ?? ""}
            onChange={(event) =>
              setFilters({
                level: event.target.value
                  ? (Number(event.target.value) as Level)
                  : undefined,
              })
            }
            className={selectClass}
          >
            <option value="">Tous</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level} · {LEVEL_NAMES[level]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Statut
          <select
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters({
                status: (event.target.value || undefined) as
                  | CardStatus
                  | undefined,
              })
            }
            className={selectClass}
          >
            <option value="">Tous</option>
            {CARD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pack
          <select
            value={filters.pack ?? ""}
            onChange={(event) =>
              setFilters({ pack: event.target.value || undefined })
            }
            className={selectClass}
          >
            <option value="">Tous</option>
            {packs.data?.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={search} role="search" className="flex items-end gap-2">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <label htmlFor="card-search">Texte ou référence</label>
            <Input
              // A new field when the filter changes elsewhere (back button).
              key={filters.q ?? ""}
              id="card-search"
              name="q"
              defaultValue={filters.q ?? ""}
              className="min-h-10 w-44"
            />
          </div>
          <Button type="submit" variant="secondary">
            Chercher
          </Button>
        </form>
      </div>

      {ticked.length > 0 && (
        <fieldset className="bg-card flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-semibold">
            Changer les {ticked.length} cartes cochées
          </legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nouveau niveau
            <select
              value={change.level ?? ""}
              onChange={(event) =>
                setChange({
                  ...change,
                  level: event.target.value
                    ? (Number(event.target.value) as Level)
                    : undefined,
                })
              }
              className={selectClass}
            >
              <option value="">Inchangé</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} · {LEVEL_NAMES[level]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nouveau statut
            <select
              value={change.status ?? ""}
              onChange={(event) =>
                setChange({
                  ...change,
                  status: (event.target.value || undefined) as
                    | CardStatus
                    | undefined,
                })
              }
              className={selectClass}
            >
              <option value="">Inchangé</option>
              {CARD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nouveau pack
            <select
              value={change.packId ?? ""}
              onChange={(event) =>
                setChange({
                  ...change,
                  packId: event.target.value || undefined,
                })
              }
              className={selectClass}
            >
              <option value="">Inchangé</option>
              {packs.data?.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={nothingToChange || bulk.isPending}
            onClick={() => void apply()}
          >
            Appliquer
          </Button>
        </fieldset>
      )}
      {result && (
        <p role="status" className="text-sm font-semibold">
          {result}
        </p>
      )}

      {!cards.data ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune carte ne correspond. Même le jeu a ses limites.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set(shown.map((card) => card.id)))}
            >
              Tout cocher
            </Button>
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Tout décocher
              </Button>
            )}
          </div>
          <ul className="bg-card divide-y rounded-lg border">
            {shown.map((card) => (
              <li
                key={card.id}
                data-testid="card-row"
                className="flex items-start gap-3 p-3"
              >
                <input
                  type="checkbox"
                  aria-label={`Cocher la carte ${card.id}`}
                  checked={selected.has(card.id)}
                  onChange={() => toggle(card.id)}
                  className="accent-primary mt-1 size-5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Link
                      to="/admin/cartes/$cardId"
                      params={{ cardId: card.id }}
                      className="font-semibold underline underline-offset-4"
                    >
                      {card.id}
                    </Link>
                    <span className="text-muted-foreground">
                      {MINI_GAME_LABELS[card.game]} · niveau {card.level}
                    </span>
                    <Badge tone={STATUS_TONES[card.status]}>
                      {STATUS_LABELS[card.status]}
                    </Badge>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm">{card.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminSection>
  );
}
