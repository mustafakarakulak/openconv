/**
 * Locale → dictionary registry. Importing the three dictionaries here is the
 * one place that materialises every translation; the provider reads from
 * {@link DICTIONARIES} by the active locale.
 */
import type { Locale } from "../config";
import { en, type Dictionary } from "./en";
import { tr } from "./tr";
import { ar } from "./ar";

export type { Dictionary };

/** Every locale's dictionary, keyed by locale code. */
export const DICTIONARIES: Record<Locale, Dictionary> = { en, tr, ar };
