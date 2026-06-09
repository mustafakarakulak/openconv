import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, dirFor, isLocale, resolveInitialLocale } from "./config";

describe("locale config", () => {
  it("ships en, tr and ar", () => {
    expect(LOCALES).toEqual(["en", "tr", "ar"]);
  });

  it("defaults to en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("dirFor", () => {
  it("marks Arabic rtl and the rest ltr", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
    expect(dirFor("tr")).toBe("ltr");
  });
});

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("tr")).toBe(true);
    expect(isLocale("ar")).toBe(true);
  });

  it("rejects unknown values and nullish input", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("resolveInitialLocale", () => {
  it("prefers a valid stored preference over the browser language", () => {
    expect(resolveInitialLocale("ar", ["en-US"])).toBe("ar");
  });

  it("ignores an invalid stored preference", () => {
    expect(resolveInitialLocale("de", ["tr-TR", "en"])).toBe("tr");
  });

  it("matches the browser language by its base tag", () => {
    expect(resolveInitialLocale(null, ["tr-TR"])).toBe("tr");
    expect(resolveInitialLocale(null, "ar-EG")).toBe("ar");
  });

  it("scans the language list in order for the first supported base", () => {
    expect(resolveInitialLocale(null, ["de-DE", "fr-FR", "ar"])).toBe("ar");
  });

  it("falls back to the default when nothing matches", () => {
    expect(resolveInitialLocale(null, ["de-DE"])).toBe("en");
    expect(resolveInitialLocale(null, [])).toBe("en");
    expect(resolveInitialLocale(undefined, undefined)).toBe("en");
  });
});
