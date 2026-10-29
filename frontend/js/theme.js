/**
 * TrueShift Enterprise Theme Manager
 * Supports 'light' (default Bright Minimalist), 'dark' (Deep Navy/Charcoal), and 'system'.
 * Persists user preference in localStorage and prevents FOUC.
 */

(function () {
  const THEME_KEY = "trueshift_theme";
  const THEME_KEY_ALT = "trueshift_theme_pref";

  function getSystemPreference() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY_ALT) || "light";
  }

  function applyTheme(theme) {
    const resolved = theme === "system" ? getSystemPreference() : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-setting", theme);
    document.documentElement.style.colorScheme = resolved;

    // Update switcher buttons UI if present
    updateSwitcherUI(theme);
  }

  function updateSwitcherUI(theme) {
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const iconLight = btn.querySelector(".theme-icon-light");
      const iconDark = btn.querySelector(".theme-icon-dark");
      if (iconLight && iconDark) {
        if (current === "dark") {
          iconLight.style.display = "none";
          iconDark.style.display = "block";
        } else {
          iconLight.style.display = "block";
          iconDark.style.display = "none";
        }
      }
      btn.setAttribute("title", `Theme: ${theme.toUpperCase()} (Click to toggle)`);
    });

    document.querySelectorAll(".theme-select-input").forEach((sel) => {
      sel.value = theme;
    });
  }

  // Immediate execution on load to prevent flash
  const initialTheme = getStoredTheme();
  applyTheme(initialTheme);

  // Watch for OS preference changes
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    });
  }

  window.ThemeManager = {
    get: getStoredTheme,
    getResolved() {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
    set(theme) {
      if (!["light", "dark", "system"].includes(theme)) theme = "light";
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(THEME_KEY_ALT, theme);
      applyTheme(theme);
      window.dispatchEvent(new CustomEvent("themechanged", { detail: { theme, resolved: this.getResolved() } }));
    },
    toggle() {
      const current = this.getResolved();
      const next = current === "dark" ? "light" : "dark";
      this.set(next);
      return next;
    },
    renderToggle() {
      const resolved = this.getResolved();
      return `
        <button type="button" class="icon-btn theme-toggle-btn" aria-label="Toggle light and dark mode" onclick="ThemeManager.toggle()">
          <svg class="theme-icon-light" style="display:${resolved === 'dark' ? 'none' : 'block'};" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="theme-icon-dark" style="display:${resolved === 'dark' ? 'block' : 'none'};" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      `;
    },
    init() {
      applyTheme(getStoredTheme());
      // Auto-mount toggle in any container with data-theme-switcher
      document.querySelectorAll("[data-theme-switcher]").forEach((el) => {
        el.innerHTML = this.renderToggle();
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.ThemeManager.init();
  });
})();
