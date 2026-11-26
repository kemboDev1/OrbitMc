/* Sets theme and language before first paint. Kept as a separate file so the CSP can forbid inline scripts. */
(function () {
  try {
    var mode = JSON.parse(localStorage.getItem('sado:theme') || '"system"');
    var dark = mode === 'dark' || (mode !== 'light' && !matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var lang = JSON.parse(localStorage.getItem('sado:lang') || 'null');
    if (lang === 'ru' || lang === 'en' || lang === 'uz') document.documentElement.lang = lang;
  } catch (e) {}
})();
