/**
 * DATA converter family registration.
 *
 * Exposes structured-data interchange (json/yaml/toml/xml) and tabular
 * (csv/tsv) conversions as ready-to-register {@link Converter} instances.
 */
import type { Converter } from "@/core/ports/converter";

import { DataConverter } from "./data-converter";

export const dataConverters: Converter[] = [new DataConverter()];
