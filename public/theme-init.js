// Apply stored theme synchronously so the splash matches the user's theme
// before React mounts. Mirrors the readStoredTheme() logic in uiStore.ts.
// Lives in an external file (not an inline <script>) so the CSP can drop
// 'unsafe-inline' from script-src.
try {
  var t = localStorage.getItem('plot3d-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'light');
}
