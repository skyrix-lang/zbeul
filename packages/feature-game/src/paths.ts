/** The app's addresses. apps/web has a route file for each. */
export const PATHS = {
  home: "/",
  setup: "/jouer",
  play: "/partie",
  end: "/fin",
  favorites: "/favoris",
  settings: "/reglages",
  install: "/installer",
  report: "/signaler",
  legal: "/mentions-legales",
  terms: "/conditions",
  privacy: "/confidentialite",
  charter: "/charte",
} as const;

export type Path = (typeof PATHS)[keyof typeof PATHS];

export const LEGAL_LINKS: { to: Path; label: string }[] = [
  { to: PATHS.legal, label: "Mentions légales" },
  { to: PATHS.terms, label: "Conditions d'utilisation" },
  { to: PATHS.privacy, label: "Confidentialité" },
  { to: PATHS.charter, label: "Charte de contenu" },
];
