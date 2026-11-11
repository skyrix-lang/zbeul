import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { bffDevPort, devPort } from "../../scripts/checkout.ts";

// In development, Vite serves the app and forwards the BFF's paths to it, so
// the browser sees one origin, as in production (where the BFF serves the
// build). WEB_PORT and PORT come from the repository's .env (`yarn setup`).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const port = Number(env.WEB_PORT ?? devPort());
  const bff = `http://localhost:${env.PORT ?? bffDevPort()}`;
  const publicUrl = env.PUBLIC_URL ?? `http://localhost:${port}`;

  return {
    plugins: [
      // Generates src/routeTree.gen.ts from src/routes. Before react().
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      devPublicUrl(publicUrl),
      pwa(),
    ],
    server: {
      port,
      strictPort: true,
      proxy: Object.fromEntries(
        ["/api", "/auth", "/robots.txt", "/sitemap.xml"].map((path) => [
          path,
          { target: bff },
        ]),
      ),
    },
    build: { sourcemap: true },
  };
});

/** The BFF fills %PUBLIC_URL% in index.html when it serves it; in development, Vite does. */
function devPublicUrl(url: string): Plugin {
  return {
    name: "dev-public-url",
    apply: "serve",
    transformIndexHtml: (html) => html.replaceAll("%PUBLIC_URL%", url),
  };
}

/**
 * Makes the app installable and playable offline: a web manifest, and a
 * service worker (Workbox) that keeps the whole build on the phone.
 */
function pwa() {
  return VitePWA({
    // A new version waits until the app applies it, on the home screen
    // (src/pwa.ts): never in the middle of a game.
    registerType: "prompt",
    // Registered from src/pwa.ts: no inline script, which the CSP refuses.
    injectRegister: null,
    manifest: {
      name: "Zbeul",
      short_name: "Zbeul",
      description:
        "Zbeul, the game for afterparties : le jeu de soirée entre potes sur un seul téléphone.",
      lang: "fr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      // The game screen is made for landscape, the others for portrait.
      orientation: "any",
      background_color: "#0b0b12",
      theme_color: "#0b0b12",
      categories: ["games", "entertainment"],
      icons: [
        { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/pwa-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      // Everything the game needs, cards and font included. Not index.html:
      // the BFF serves the page at "/", with the site's address filled in.
      globPatterns: ["**/*.{js,css,svg,png,woff2,webmanifest}"],
      // French needs the Latin subsets of the font only.
      globIgnores: ["**/*vietnamese*"],
      additionalManifestEntries: [{ url: "/", revision: String(Date.now()) }],
      navigateFallback: "/",
      // Never from the cache: the API, sign-in, and the pages behind it. The
      // admin must not be available offline.
      navigateFallbackDenylist: [
        /^\/api\//,
        /^\/auth\//,
        /^\/admin/,
        /^\/bookings/,
        /^\/sign-in/,
        /\.[a-z0-9]+$/,
      ],
      cleanupOutdatedCaches: true,
    },
  });
}
