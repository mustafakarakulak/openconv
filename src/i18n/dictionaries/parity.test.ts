import { describe, expect, it } from "vitest";
import { LOCALES } from "../config";
import { DICTIONARIES } from "./index";

/** Every leaf key path of a nested dictionary, e.g. "hero.title". */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

/** Every leaf string value of a nested dictionary. */
function leafValues(value: unknown): string[] {
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(leafValues);
  }
  return [String(value)];
}

describe("dictionary parity", () => {
  const reference = keyPaths(DICTIONARIES.en).sort();

  it("registers a dictionary for every locale", () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale]).toBeDefined();
    }
  });

  it.each([...LOCALES])("'%s' has exactly the same keys as en", (locale) => {
    expect(keyPaths(DICTIONARIES[locale]).sort()).toEqual(reference);
  });

  it.each([...LOCALES])("'%s' has no blank translations", (locale) => {
    for (const value of leafValues(DICTIONARIES[locale])) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
