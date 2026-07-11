"use strict";

(() => {
  const allowedThemes = new Set(["system", "light", "dark", "contrast"]);

  function readPreference(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const storedTheme = readPreference("portfolio-theme");
  const storedTextSize = readPreference("portfolio-text-size");
  const storedMotion = readPreference("portfolio-motion");

  document.documentElement.dataset.theme = allowedThemes.has(storedTheme) ? storedTheme : "system";
  document.documentElement.dataset.textSize = storedTextSize === "large" ? "large" : "normal";
  document.documentElement.dataset.motion = storedMotion === "reduce" ? "reduce" : "auto";
})();
