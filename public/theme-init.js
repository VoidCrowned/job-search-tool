/* global localStorage, document */
// Apply the saved theme before the page draws, so there is no flash of the wrong one.
// A separate file (not inline) so the online version's Content-Security-Policy can forbid inline scripts.
try {
  var theme = localStorage.getItem('jobsuche:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Storage blocked (e.g. strict privacy settings): keep the system theme.
}
