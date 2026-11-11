// What the site calls itself. The public address is configuration, read by the
// BFF from PUBLIC_URL when the container starts, not baked into the build.
export const site = {
  name: "Zbeul",
  description:
    "Zbeul, the game for afterparties : le jeu de soirée entre potes sur un seul téléphone, de l'apéro tranquille au très limite. Gratuit, sans compte, jouable sans connexion. Réservé aux adultes.",
};

/** Pages that should rank: listed in the sitemap. App pages aren't. */
export const PUBLIC_PATHS = [
  "/",
  "/mentions-legales",
  "/conditions",
  "/confidentialite",
  "/charte",
] as const;
