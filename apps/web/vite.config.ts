import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
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
      devPlaceholders({
        PUBLIC_URL: publicUrl,
        GA_MEASUREMENT_ID: env.GA_MEASUREMENT_ID ?? "",
      }),
      pwa(),
      precompress(),
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

/**
 * The BFF fills %PUBLIC_URL% and %GA_MEASUREMENT_ID% in index.html when it
 * serves it; in development, Vite does, from the repository's .env.
 */
function devPlaceholders(values: Record<string, string>): Plugin {
  return {
    name: "dev-placeholders",
    apply: "serve",
    transformIndexHtml: (html) =>
      Object.entries(values).reduce(
        (page, [name, value]) => page.replaceAll(`%${name}%`, value),
        html,
      ),
  };
}

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * Writes a brotli (`.br`) and a gzip (`.gz`) copy next to each text file of the
 * build, at the strongest settings, so the BFF serves them without
 * compressing on every request (apps/bff/src/app.ts). Not index.html, which
 * the BFF fills in and compresses when it starts, nor source maps, which only
 * developer tools load. Files under 1 kB aren't worth it.
 */
export function precompress(): Plugin {
  let outDir = "";
  return {
    name: "precompress",
    apply: "build",
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: "post",
      sequential: true,
      handler: async () => {
        const files = await readdir(outDir, { recursive: true });
        await Promise.all(
          files
            .filter(
              (file) =>
                /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/.test(
                  file,
                ) && file !== "index.html",
            )
            .map(async (file) => {
              const path = join(outDir, file);
              if ((await stat(path)).size < 1024) return;
              const source = await readFile(path);
              const [br, gz] = await Promise.all([
                brotli(source, {
                  params: {
                    [constants.BROTLI_PARAM_QUALITY]:
                      constants.BROTLI_MAX_QUALITY,
                    [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
                  },
                }),
                gzipAsync(source, { level: constants.Z_BEST_COMPRESSION }),
              ]);
              await Promise.all([
                writeFile(`${path}.br`, br),
                writeFile(`${path}.gz`, gz),
              ]);
            }),
        );
      },
    },
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
