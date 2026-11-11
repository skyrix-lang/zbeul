import { Dices, SlidersHorizontal, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CONTENT_THEMES, type ContentTheme, type Level } from "@zbeul/core";
import { Button, Input } from "@zbeul/ui";
import { Choice } from "../components/choice";
import { Section } from "../components/screen";
import {
  maxTeams,
  randomTeams,
  type Gender,
  type Player,
  type Settings,
} from "../engine/game";
import {
  LEVEL_NAMES,
  MAX_PLAYERS,
  PROFILES,
  THEME_LABELS,
} from "../engine/rules";
import { newId, usePrefs } from "../store";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "gars", label: "Gars" },
  { value: "fille", label: "Fille" },
  { value: "autre", label: "Autre" },
];

const selectClass =
  "bg-card border-input focus-visible:ring-ring min-h-11 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * Keeps the teams possible after a change: no more teams than the players
 * allow, and every player in a team that exists. Dealt at random, the teams
 * are dealt again when someone has no team (or when `deal` asks); by hand,
 * newcomers join the smallest team.
 */
export function settle(
  players: Player[],
  settings: Settings,
  mode: "random" | "manual",
  deal = false,
): { players: Player[]; settings: Settings } {
  if (settings.format !== "teams") return { players, settings };
  const count = Math.max(
    2,
    Math.min(settings.teams.length, maxTeams(players.length)),
  );
  const next = { ...settings, teams: settings.teams.slice(0, count) };
  const placed = (player: Player) =>
    !deal && player.team !== null && player.team < count;
  if (players.every(placed)) return { players, settings: next };
  if (mode === "random") {
    return {
      players: randomTeams(players, count, Math.random),
      settings: next,
    };
  }
  const result = players.map((player) =>
    placed(player) ? player : { ...player, team: null },
  );
  for (const [index, player] of result.entries()) {
    if (player.team !== null) continue;
    const sizes = next.teams.map(
      (_, team) => result.filter((other) => other.team === team).length,
    );
    result[index] = { ...player, team: sizes.indexOf(Math.min(...sizes)) };
  }
  return { players: result, settings: next };
}

export function PlayersSection() {
  const players = usePrefs((prefs) => prefs.players);
  const settings = usePrefs((prefs) => prefs.settings);
  const teamMode = usePrefs((prefs) => prefs.teamMode);
  const update = usePrefs((prefs) => prefs.update);
  const [name, setName] = useState("");
  const full = players.length >= MAX_PLAYERS;

  const save = (next: Player[]) => update(settle(next, settings, teamMode));
  const change = (id: string, patch: Partial<Player>) =>
    save(
      players.map((player) =>
        player.id === id ? { ...player, ...patch } : player,
      ),
    );
  const add = (gender: Gender) => {
    const trimmed = name.trim();
    if (!trimmed || full) return;
    save([
      ...players,
      {
        id: newId(),
        name: trimmed,
        gender,
        ceiling: null,
        excluded: [],
        team: null,
      },
    ]);
    setName("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    add("autre");
  };

  return (
    <Section
      title="Qui joue ?"
      hint="De 2 à 20. Le genre sert à accorder les cartes : il, elle ou iel."
    >
      {players.length > 0 && (
        <ul className="flex flex-col gap-2">
          {players.map((player, index) => (
            <li key={player.id} className="bg-card rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Prénom du joueur ${index + 1}`}
                  value={player.name}
                  maxLength={20}
                  autoComplete="off"
                  onChange={(event) =>
                    change(player.id, { name: event.target.value })
                  }
                  className="min-h-11 flex-1 text-base font-semibold"
                />
                <select
                  aria-label={`Genre de ${player.name || `joueur ${index + 1}`}`}
                  value={player.gender}
                  onChange={(event) =>
                    change(player.id, { gender: event.target.value as Gender })
                  }
                  className={selectClass}
                >
                  {GENDERS.map((gender) => (
                    <option key={gender.value} value={gender.value}>
                      {gender.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer ${player.name || `le joueur ${index + 1}`}`}
                  onClick={() =>
                    save(players.filter((other) => other.id !== player.id))
                  }
                  className="size-11"
                >
                  <X aria-hidden="true" className="size-5" />
                </Button>
              </div>
              <PlayerOptions
                player={player}
                gameLevel={settings.level}
                onChange={(patch) => change(player.id, patch)}
              />
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-muted-foreground text-sm">
          20 joueurs : c'est complet. Au-delà, c'est un festival.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Input
            aria-label="Prénom du nouveau joueur"
            placeholder="Un prénom"
            value={name}
            maxLength={20}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 text-base"
          />
          <div
            role="group"
            aria-label="Ajouter ce joueur"
            className="grid grid-cols-3 gap-2"
          >
            {GENDERS.map((gender) => (
              <Button
                key={gender.value}
                type="button"
                variant="secondary"
                size="lg"
                disabled={!name.trim()}
                onClick={() => add(gender.value)}
              >
                + {gender.label}
              </Button>
            ))}
          </div>
        </form>
      )}
    </Section>
  );
}

function PlayerOptions({
  player,
  gameLevel,
  onChange,
}: {
  player: Player;
  gameLevel: Level;
  onChange: (patch: Partial<Player>) => void;
}) {
  const custom = player.ceiling !== null || player.excluded.length > 0;
  const toggle = (theme: ContentTheme) =>
    onChange({
      excluded: player.excluded.includes(theme)
        ? player.excluded.filter((other) => other !== theme)
        : [...player.excluded, theme],
    });

  return (
    <details className="group mt-1">
      <summary className="text-muted-foreground flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-sm [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Options de {player.name || "ce joueur"}
        {custom && (
          <span className="bg-primary-soft text-primary-soft-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            perso
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 px-1 pt-2 pb-1">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-semibold">Profil</span>
            <span className="text-muted-foreground block">
              Jamais de carte au-dessus pour {player.name || "ce joueur"}.
            </span>
          </span>
          <select
            value={player.ceiling ?? ""}
            onChange={(event) =>
              onChange({
                ceiling: event.target.value
                  ? (Number(event.target.value) as Level)
                  : null,
              })
            }
            className={selectClass}
          >
            <option value="">Comme la partie ({LEVEL_NAMES[gameLevel]})</option>
            {PROFILES.map((profile) => (
              <option key={profile.level} value={profile.level}>
                {profile.label} (niveau {profile.level} max)
              </option>
            ))}
          </select>
        </label>
        <ThemeChecks
          legend={`Thèmes sans ${player.name || "ce joueur"}`}
          excluded={player.excluded}
          onToggle={toggle}
        />
      </div>
    </details>
  );
}

export function ThemeChecks({
  legend,
  excluded,
  onToggle,
}: {
  legend: string;
  excluded: readonly ContentTheme[];
  onToggle: (theme: ContentTheme) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-1 grid grid-cols-2 gap-x-3">
        {CONTENT_THEMES.map((theme) => (
          <label
            key={theme}
            className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={excluded.includes(theme)}
              onChange={() => onToggle(theme)}
              className="accent-primary size-5 shrink-0"
            />
            {THEME_LABELS[theme]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TeamsSection() {
  const players = usePrefs((prefs) => prefs.players);
  const settings = usePrefs((prefs) => prefs.settings);
  const teamMode = usePrefs((prefs) => prefs.teamMode);
  const update = usePrefs((prefs) => prefs.update);
  const most = maxTeams(players.length);
  const teams = settings.format === "teams";

  /** Applies a change to the format or the teams, then places everyone. */
  const apply = (patch: Partial<Settings>, mode = teamMode, deal = false) =>
    update({
      teamMode: mode,
      ...settle(players, { ...settings, ...patch }, mode, deal),
    });
  const setCount = (count: number) =>
    apply(
      {
        teams: Array.from(
          { length: count },
          (_, team) => settings.teams[team] ?? `Équipe ${team + 1}`,
        ),
      },
      teamMode,
      teamMode === "random",
    );

  return (
    <Section title="Format">
      <Choice
        label="Format de la partie"
        name="format"
        value={settings.format}
        onChange={(format) => apply({ format }, teamMode, true)}
        options={[
          { value: "solo", label: "Chacun pour soi" },
          { value: "teams", label: "Équipes" },
        ]}
      />
      {teams && most < 2 && (
        <p className="text-muted-foreground text-sm">
          Il faut au moins 4 joueurs pour faire des équipes. À 3, c'est un
          trouple.
        </p>
      )}
      {teams && most >= 2 && (
        <>
          <Choice
            label="Nombre d'équipes"
            name="team-count"
            value={Math.min(settings.teams.length, most)}
            onChange={setCount}
            options={Array.from({ length: most - 1 }, (_, index) => ({
              value: index + 2,
              label: `${index + 2} équipes`,
            }))}
          />
          <Choice
            label="Composition des équipes"
            name="team-mode"
            value={teamMode}
            onChange={(mode) => apply({}, mode, mode === "random")}
            options={[
              { value: "random", label: "Aléatoire" },
              { value: "manual", label: "À la main" },
            ]}
          />
          <ul className="flex flex-col gap-2">
            {settings.teams.map((teamName, team) => {
              const members = players.filter((player) => player.team === team);
              return (
                <li key={team} className="bg-card rounded-lg border p-3">
                  <Input
                    aria-label={`Nom de l'équipe ${team + 1}`}
                    value={teamName}
                    maxLength={20}
                    onChange={(event) =>
                      apply({
                        teams: settings.teams.map((other, index) =>
                          index === team ? event.target.value : other,
                        ),
                      })
                    }
                    className="min-h-11 text-base font-semibold"
                  />
                  <p
                    data-testid="team-members"
                    className={
                      members.length < 2
                        ? "text-destructive-soft-foreground mt-2 text-sm"
                        : "text-muted-foreground mt-2 text-sm"
                    }
                  >
                    {members.length === 0
                      ? "Personne. Ça va être calme."
                      : members.map((player) => player.name).join(", ")}
                    {members.length === 1 && " (il en faut 2)"}
                  </p>
                </li>
              );
            })}
          </ul>
          {teamMode === "random" ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => apply({}, "random", true)}
            >
              <Dices aria-hidden="true" className="size-5" />
              Relancer les équipes
            </Button>
          ) : (
            <ul className="flex flex-col gap-1">
              {players.map((player) => (
                <li key={player.id}>
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{player.name}</span>
                    <select
                      aria-label={`Équipe de ${player.name}`}
                      value={player.team ?? 0}
                      onChange={(event) =>
                        update({
                          players: players.map((other) =>
                            other.id === player.id
                              ? { ...other, team: Number(event.target.value) }
                              : other,
                          ),
                        })
                      }
                      className={selectClass}
                    >
                      {settings.teams.map((teamName, team) => (
                        <option key={team} value={team}>
                          {teamName || `Équipe ${team + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}
