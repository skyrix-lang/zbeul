// What the site calls itself. The public address is configuration, read by the
// BFF from PUBLIC_URL when the container starts, not baked into the build.
export const site = {
  name: "Zbeul",
  description:
    "Zbeul, the game for afterparties : le jeu de soirée entre potes sur un seul téléphone, de l'apéro tranquille au très limite. Gratuit, sans compte, jouable sans connexion. Réservé aux adultes.",
};

/**
 * The languages the interface is translated into, the default first. A
 * visitor gets the first one their browser asks for, or the default, and can
 * switch in the header when there is more than one. Each language needs its
 * messages in every package's `locales/` folder; drop one here to stop
 * offering it. Keep `lang` in apps/web/index.html on the default.
 */
export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Pages that should rank: listed in the sitemap. App pages aren't. */
export const PUBLIC_PATHS = [
  "/",
  "/mentions-legales",
  "/conditions",
  "/confidentialite",
  "/charte",
] as const;
