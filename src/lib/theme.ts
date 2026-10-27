// App themes (Settings → Appearance). The palettes live in src/index.css under [data-theme="…"];
// this file holds the list, the user's choice and applying it to the page.
//
// Where the choice is kept:
//   - this device (localStorage `kova_theme`), so the right colours show before sign-in finishes;
//   - the user's account (users/{uid}.appearance.theme, owner-writable), so it follows them to a new
//     phone or browser. Applied from the user document after sign-in (App.tsx).
// Premium themes show only while the plan is Premium. If Premium lapses, the app falls back to Midnight
// but remembers the choice, so it comes back after renewing.

import { useSyncExternalStore } from 'react';

export type ThemeId =
  | 'midnight'
  | 'dusk'
  | 'daylight'
  | 'solarized-light'
  | 'solarized-dark'
  | 'solarized-gold'
  | 'forest'
  | 'nord';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  premium: boolean;
  mode: 'dark' | 'light';
  /** Browser/Android status bar colour; matches the theme's page colour in index.css. */
  pageColor: string;
}

export const DEFAULT_THEME: ThemeId = 'midnight';

export const THEMES: ThemeOption[] = [
  { id: 'midnight', name: 'Midnight', description: "Kova's original deep black", premium: false, mode: 'dark', pageColor: '#000000' },
  { id: 'dusk', name: 'Dusk', description: 'Soft slate, gentler than black', premium: false, mode: 'dark', pageColor: '#14161b' },
  { id: 'daylight', name: 'Daylight', description: 'Warm paper, never glaring white', premium: false, mode: 'light', pageColor: '#f2efe8' },
  { id: 'solarized-light', name: 'Solarized Light', description: 'Classic cream, easy on the eyes', premium: true, mode: 'light', pageColor: '#fdf6e3' },
  { id: 'solarized-dark', name: 'Solarized Dark', description: 'Deep teal with warm text', premium: true, mode: 'dark', pageColor: '#002b36' },
  { id: 'solarized-gold', name: 'Solarized Gold', description: 'Gold parchment, rich brown ink', premium: true, mode: 'light', pageColor: '#f2e3bc' },
  { id: 'forest', name: 'Forest', description: 'Quiet evergreen', premium: true, mode: 'dark', pageColor: '#0d1511' },
  { id: 'nord', name: 'Nord Night', description: 'Cool polar blues', premium: true, mode: 'dark', pageColor: '#242933' },
];

const STORAGE_KEY = 'kova_theme';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value);
}

export function themeOption(id: ThemeId): ThemeOption {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

/** The theme to show: a Premium theme only while Premium is confirmed. Pure; unit-tested. */
export function effectiveThemeFor(chosen: ThemeId, premium: boolean | null): ThemeId {
  if (!themeOption(chosen).premium) return chosen;
  // Unknown (still loading): keep showing it, to avoid a flash on every app start for Premium users.
  if (premium === null) return chosen;
  return premium ? chosen : DEFAULT_THEME;
}

// ---- Store -------------------------------------------------------------------------------------

interface ThemeState {
  chosen: ThemeId;
  premium: boolean | null;
  effective: ThemeId;
}

function readStored(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writeStored(id: ThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the account copy still remembers it.
  }
}

let state: ThemeState = (() => {
  const chosen = typeof window === 'undefined' ? DEFAULT_THEME : readStored();
  return { chosen, premium: null, effective: chosen };
})();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

let switchTimer: ReturnType<typeof setTimeout> | undefined;

function applyToDocument(id: ThemeId, animate: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const option = themeOption(id);
  if (animate) {
    root.classList.add('kova-theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('kova-theme-switching'), 320);
  }
  root.dataset.theme = id;
  root.classList.toggle('dark', option.mode === 'dark');
  root.classList.toggle('light', option.mode === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', option.pageColor);
  // Android: the status and navigation bars stay Kova black with light icons in every theme
  // (capacitor.config.ts, KOVA-095). The area behind them is the native window, which the web theme
  // can't recolour, so switching icons to dark here would make them invisible on light themes.
}

function update(next: Partial<ThemeState>, animate: boolean) {
  const merged = { ...state, ...next };
  merged.effective = effectiveThemeFor(merged.chosen, merged.premium);
  const changed = merged.effective !== state.effective;
  state = merged;
  if (changed) applyToDocument(state.effective, animate);
  emit();
}

/** Applies the stored theme before the first render (called from main.tsx). */
export function initTheme() {
  applyToDocument(state.effective, false);
}

/** The user picked a theme in Settings. Saving to the account is the caller's job (userService). */
export function chooseTheme(id: ThemeId) {
  if (!isThemeId(id)) return;
  writeStored(id);
  update({ chosen: id }, true);
}

/** The account's saved theme, read from the user document after sign-in. */
export function adoptAccountTheme(id: unknown) {
  if (!isThemeId(id) || id === state.chosen) return;
  writeStored(id);
  update({ chosen: id }, true);
}

/** Called with the server-confirmed plan; null while it isn't known yet (e.g. signed out). */
export function setThemePremium(premium: boolean | null) {
  if (premium === state.premium) return;
  update({ premium }, true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return state;
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
