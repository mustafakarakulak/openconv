/**
 * Tiny, pure translation helpers shared by the UI.
 *
 * The bulk of openConv's copy is read straight off the typed dictionary
 * (`dict.hero.title`), which gives full autocompletion and compile-time key
 * parity across locales. These two helpers cover the two cases direct access
 * cannot:
 *   - {@link interpolate} fills `{placeholder}` tokens in a template string,
 *   - {@link pick} looks a value up by a key only known at runtime (an error
 *     `code`, a converter option `key`, a `source→target` note), with a
 *     guaranteed fallback so untranslated entries degrade to English.
 */

/**
 * Replaces every `{name}` token in `template` with the matching value from
 * `params`. Tokens without a matching param are left untouched.
 */
export function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Looks `key` up in a flat record of translations, falling back to `fallback`
 * (typically the original English string carried by the domain) when the key
 * is absent. Keeps dynamic lookups total under `noUncheckedIndexedAccess`.
 */
export function pick(
  record: Record<string, string>,
  key: string,
  fallback: string,
): string {
  return record[key] ?? fallback;
}
