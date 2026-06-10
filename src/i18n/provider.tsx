"use client";

/**
 * Client-side i18n provider.
 *
 * Strategy (no routing, no server runtime — openConv is a static, fully
 * client-side app):
 *   - Server and the first client render both use {@link DEFAULT_LOCALE} so the
 *     hydrated markup matches exactly (no mismatch warnings).
 *   - After mount we read the stored preference (or the browser language) and
 *     switch to it. The brief default-locale flash is the trade-off for not
 *     shipping locale routing/middleware.
 *   - The active locale is mirrored onto `<html lang/dir>` and `document.title`
 *     imperatively, and persisted to localStorage on change.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  dirFor,
  resolveInitialLocale,
  type Direction,
  type Locale,
} from "./config";
import { DICTIONARIES, type Dictionary } from "./dictionaries";

const STORAGE_KEY = "openconv.locale";

interface I18nContextValue {
  /** The active locale. */
  readonly locale: Locale;
  /** Writing direction for the active locale ("ltr" | "rtl"). */
  readonly dir: Direction;
  /** The active locale's dictionary; read copy straight off it (`dict.hero.title`). */
  readonly dict: Dictionary;
  /** Switches locale and persists the choice. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Apply the stored/browser preference once, after the first paint. Setting
  // the same value React already holds is a no-op, so the default case is free.
  useEffect(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const languages =
      typeof navigator !== "undefined" ? (navigator.languages ?? navigator.language) : undefined;
    setLocaleState(resolveInitialLocale(stored, languages));
  }, []);

  // Reflect the locale onto the document shell whenever it changes.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
    document.title = DICTIONARIES[locale].app.title;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can throw (private mode, quota); the in-memory switch still works.
    }
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: dirFor(locale), dict: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Reads the i18n context. Throws if used outside an {@link I18nProvider}. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
