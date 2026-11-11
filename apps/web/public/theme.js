// Applies the saved theme before the page first paints, so another theme
// never flashes. A file, not an inline script: the CSP only allows scripts
// from this origin. Keep the key and names in step with
// packages/feature-game/src/store.ts.
try {
  var theme = JSON.parse(localStorage.getItem("zbeul:prefs")).state.theme;
  if (/^(tokyo|retro|clair|creme)$/.test(theme)) {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // No saved theme: the default one, "Nuit", is already there.
}
