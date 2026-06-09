/**
 * Locale configuration for openConv's lightweight, client-side i18n.
 *
 * Pure and framework-agnostic: this module knows the supported locales, their
 * writing direction and how to pick a sensible initial locale. It pulls in no
 * React, no DOM and no dictionaries, so it is trivially unit-testable.
 */

/** Every locale openConv ships translations for. Order drives the switcher. */
export const LOCALES = ["en", "tr", "ar"] as const;

/** A supported locale code. */
export type Locale = (typeof LOCALES)[number];

/** The fallback locale used on the server and before a preference is known. */
export const DEFAULT_LOCALE: Locale = "en";

/** Text direction for an element's `dir` attribute. */
export type Direction = "ltr" | "rtl";

/** Locales written right-to-left. */
const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

/** Native display name for each locale, shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  ar: "العربية",
};

/** The writing direction for a locale. */
export function dirFor(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

/** Type guard: is an arbitrary string one of our supported locales? */
export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolves the locale to start with. Priority:
 *   1. an explicitly stored preference (e.g. from localStorage),
 *   2. the first browser language whose base tag we support (e.g. "tr-TR" → "tr"),
 *   3. {@link DEFAULT_LOCALE}.
 *
 * Pure — callers pass the stored value and the browser languages in, so it can
 * be exercised without a DOM.
 */
export function resolveInitialLocale(
  stored: string | null | undefined,
  languages: readonly string[] | string | undefined,
): Locale {
  if (isLocale(stored)) return stored;

  const list = typeof languages === "string" ? [languages] : (languages ?? []);
  for (const lang of list) {
    const base = lang.toLowerCase().split("-")[0] ?? "";
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
