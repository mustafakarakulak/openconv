/**
 * Document converter plugin module.
 *
 * Exposes the document/text converter instances for registration with the
 * converter registry. All conversions run client-side in the browser.
 */
import type { Converter } from "@/core/ports/converter";
import { DocumentConverter } from "./document-converter";

export const documentConverters: Converter[] = [new DocumentConverter()];
