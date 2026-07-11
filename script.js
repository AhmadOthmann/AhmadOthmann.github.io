"use strict";

(() => {
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const allowedThemes = new Set(["system", "light", "dark", "contrast"]);

  function readPreference(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writePreference(key, value, defaultValue) {
    try {
      if (value === defaultValue) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      // The selected preference still applies for the current page view.
    }
  }

  function resolvedTheme(theme) {
    if (theme === "system") {
      return systemDark.matches ? "dark" : "light";
    }
    return theme;
  }

  function updateThemeColor() {
    if (!themeColor) return;
    const theme = resolvedTheme(root.dataset.theme || "system");
    const colors = {
      light: "#f3f0e8",
      dark: "#0c121b",
      contrast: "#000000"
    };
    themeColor.content = colors[theme] || colors.light;
  }

  const themeSelect = document.querySelector("#theme-select");
  if (themeSelect) {
    const initialTheme = allowedThemes.has(root.dataset.theme) ? root.dataset.theme : "system";
    themeSelect.value = initialTheme;
    themeSelect.addEventListener("change", () => {
      const theme = allowedThemes.has(themeSelect.value) ? themeSelect.value : "system";
      root.dataset.theme = theme;
      writePreference("portfolio-theme", theme, "system");
      updateThemeColor();
    });
  }

  const textSizeToggle = document.querySelector("#text-size-toggle");
  const motionToggle = document.querySelector("#motion-toggle");

  function updateToggle(button, enabled) {
    if (!button) return;
    button.setAttribute("aria-pressed", String(enabled));
    const state = button.querySelector(".toggle-state");
    if (state) {
      state.textContent = enabled ? state.dataset.enabled : state.dataset.disabled;
    }
  }

  function setTextSize(large, persist = true) {
    root.dataset.textSize = large ? "large" : "normal";
    updateToggle(textSizeToggle, large);
    if (persist) writePreference("portfolio-text-size", large ? "large" : "normal", "normal");
  }

  function setMotion(reduce, persist = true) {
    root.dataset.motion = reduce ? "reduce" : "auto";
    updateToggle(motionToggle, reduce);
    if (persist) writePreference("portfolio-motion", reduce ? "reduce" : "auto", "auto");
  }

  setTextSize(root.dataset.textSize === "large", false);
  setMotion(root.dataset.motion === "reduce", false);

  textSizeToggle?.addEventListener("click", () => {
    setTextSize(root.dataset.textSize !== "large");
  });

  motionToggle?.addEventListener("click", () => {
    setMotion(root.dataset.motion !== "reduce");
  });

  document.querySelector("#reset-preferences")?.addEventListener("click", () => {
    root.dataset.theme = "system";
    if (themeSelect) themeSelect.value = "system";
    writePreference("portfolio-theme", "system", "system");
    setTextSize(false);
    setMotion(false);
    updateThemeColor();
  });

  systemDark.addEventListener("change", updateThemeColor);
  updateThemeColor();

  const projectCards = [...document.querySelectorAll(".project-card")];
  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  const filterStatus = document.querySelector("#filter-status");

  function announceProjectCount(count) {
    if (!filterStatus) return;
    const template = count === 1 ? filterStatus.dataset.countOne : filterStatus.dataset.countMany;
    filterStatus.textContent = (template || "{count}").replace("{count}", String(count));
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "all";
      let visibleCount = 0;

      filterButtons.forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });

      projectCards.forEach((card) => {
        const visible = filter === "all" || card.dataset.category === filter;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      announceProjectCount(visibleCount);
    });
  });

  const toolMenus = [...document.querySelectorAll(".tool-menu")];

  toolMenus.forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      toolMenus.forEach((otherMenu) => {
        if (otherMenu !== menu) otherMenu.open = false;
      });
    });
  });

  document.addEventListener("pointerdown", (event) => {
    toolMenus.forEach((menu) => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openMenu = toolMenus.find((menu) => menu.open);
    if (!openMenu) return;
    openMenu.open = false;
    openMenu.querySelector("summary")?.focus();
  });

  const storedTheme = readPreference("portfolio-theme");
  if (themeSelect && allowedThemes.has(storedTheme) && storedTheme !== root.dataset.theme) {
    root.dataset.theme = storedTheme;
    themeSelect.value = storedTheme;
    updateThemeColor();
  }
})();
