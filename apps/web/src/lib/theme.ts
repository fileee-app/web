import { useSyncExternalStore } from "react";

export const MODES = ["light", "dark", "system"] as const;

/** Swatch colours for the picker; the themes themselves are in packages/ui/src/styles/globals.css. */
export const ACCENTS = {
  blue: "oklch(0.52 0.2 266)",
  violet: "oklch(0.52 0.22 296)",
  green: "oklch(0.52 0.14 158)",
  rose: "oklch(0.52 0.2 12)",
  orange: "oklch(0.52 0.17 45)",
  neutral: "oklch(0.45 0.012 60)",
} as const;

export type Mode = (typeof MODES)[number];
export type Accent = keyof typeof ACCENTS;
export type Theme = { mode: Mode; accent: Accent };

const DEFAULT: Theme = { mode: "system", accent: "blue" };

/**
 * Reads the saved theme and applies it to <html>. It's also inlined as a <head> script (see
 * themeScript), so it can't use anything outside its own body.
 */
function applyTheme() {
  let saved: Partial<Theme> = {};

  try {
    saved = JSON.parse(localStorage.getItem("fileee-theme") ?? "{}") ?? {};
  } catch {}

  const root = document.documentElement;

  const dark =
    saved.mode === "dark" ||
    (saved.mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", dark);

  if (saved.accent && saved.accent !== "blue") root.dataset.accent = saved.accent;
  else delete root.dataset.accent;
}

/** Runs before first paint so the page never flashes the wrong theme, and follows OS changes. */
export const themeScript = `(${applyTheme})();matchMedia("(prefers-color-scheme: dark)").addEventListener("change",${applyTheme});`;

const listeners = new Set<() => void>();
let current: Theme | undefined;

function read(): Theme {
  if (current) return current;

  try {
    const saved = JSON.parse(localStorage.getItem("fileee-theme") ?? "{}") ?? {};

    current = {
      mode: MODES.includes(saved.mode) ? saved.mode : DEFAULT.mode,
      accent: saved.accent in ACCENTS ? saved.accent : DEFAULT.accent,
    };
  } catch {
    current = DEFAULT;
  }

  return current;
}

export function setTheme(change: Partial<Theme>) {
  current = { ...read(), ...change };

  try {
    localStorage.setItem("fileee-theme", JSON.stringify(current));
  } catch {}

  applyTheme();

  for (const listener of listeners) listener();
}

/** The saved preference; the server doesn't know it, so it renders the default first. */
export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    read,
    () => DEFAULT,
  );
}
