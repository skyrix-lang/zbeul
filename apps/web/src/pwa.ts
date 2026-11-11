import { registerSW } from "virtual:pwa-register";

// The service worker keeps the whole app, with every card, on the phone: once
// loaded, a game plays without a connection. A new version is downloaded in
// the background and waits: it is applied on the home screen only, never in
// the middle of a game (vite.config.ts sets registerType "prompt").

let waiting = false;

const update = registerSW({
  immediate: true,
  onNeedRefresh() {
    waiting = true;
    if (window.location.pathname === "/") applyUpdate();
  },
});

/** Reloads into the new version, if one is waiting. Called by the home page. */
export function applyUpdate() {
  if (!waiting) return;
  waiting = false;
  void update(true);
}
