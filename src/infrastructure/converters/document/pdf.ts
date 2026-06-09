/**
 * PDF helpers for the document converter.
 *
 * The heavy runtime paths (jsPDF rendering, pdfjs text extraction) are
 * BROWSER-ONLY and dynamically import their libraries inside the exported
 * async functions so they never participate in SSR or the test bundle. The
 * small, pure argument-building helpers are exported separately so the option
 * resolution / geometry logic stays unit-testable under happy-dom.
 */
import { ConversionFailedError } from "@/core/domain/errors";

/** Supported page sizes for PDF output. */
export type PageSize = "a4" | "letter";

/** Resolved, validated rendering options for the html/markdown -> pdf path. */
export interface PdfRenderOptions {
  readonly pageSize: PageSize;
  /** Page margin in PostScript points (1/72 inch). */
  readonly margin: number;
}

/** Clamp helper, exported for testing. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Normalises an arbitrary string into one of the supported page sizes. */
export function normalizePageSize(value: string): PageSize {
  return value.toLowerCase() === "letter" ? "letter" : "a4";
}

/**
 * Resolves the raw option bag into a fully-validated {@link PdfRenderOptions}.
 * Pure so the option/clamping logic can be tested without jsPDF.
 */
export function resolvePdfOptions(input: {
  pageSize: string;
  margin: number;
}): PdfRenderOptions {
  return {
    pageSize: normalizePageSize(input.pageSize),
    margin: Math.round(clamp(input.margin, 0, 72)),
  };
}

/** Page dimensions in points: `[width, height]`. Pure + tested. */
export function pageDimensions(size: PageSize): readonly [number, number] {
  // jsPDF point units (1pt = 1/72in).
  return size === "letter" ? [612, 792] : [595.28, 841.89];
}

/**
 * Builds the constructor arguments for a jsPDF document for a given page size.
 * Extracted as a pure function so the wiring is verifiable in tests.
 */
export function jsPdfConstructorArgs(size: PageSize): {
  orientation: "portrait";
  unit: "pt";
  format: PageSize;
} {
  return { orientation: "portrait", unit: "pt", format: size };
}

/**
 * Renders an HTML body fragment to PDF bytes using jsPDF's `.html()` engine.
 * BROWSER-ONLY: requires a real layout engine / canvas, so it is never exercised
 * in happy-dom tests.
 */
export async function renderHtmlToPdf(
  bodyHtml: string,
  options: PdfRenderOptions,
): Promise<ArrayBuffer> {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF(jsPdfConstructorArgs(options.pageSize));
    const [pageWidth] = pageDimensions(options.pageSize);
    const printableWidth = pageWidth - options.margin * 2;

    await doc.html(bodyHtml, {
      x: options.margin,
      y: options.margin,
      width: printableWidth,
      windowWidth: Math.max(printableWidth, 1),
      margin: options.margin,
    });

    return doc.output("arraybuffer");
  } catch (cause) {
    throw new ConversionFailedError("Failed to render HTML to PDF.", { cause });
  }
}

/**
 * Configures the pdfjs worker source. Turbopack/webpack resolve the worker via
 * `new URL(..., import.meta.url)`. Kept as a tiny helper so the convert path
 * stays readable.
 */
function pdfWorkerSrc(): string {
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
}

/**
 * Extracts the text of every page of a PDF as an array of per-page strings,
 * using pdfjs-dist. BROWSER-ONLY (needs the pdfjs worker), so it is not run in
 * happy-dom tests.
 *
 * @param onPage optional callback invoked after each page is extracted, used by
 *   the converter to report progress and cooperate with cancellation.
 */
export async function extractPdfPages(
  data: Uint8Array,
  onPage?: (pageIndex: number, pageCount: number) => void,
): Promise<string[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc();

    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(textContentToString(content));
      page.cleanup();
      onPage?.(pageNumber, pageCount);
    }

    await pdf.cleanup();
    return pages;
  } catch (cause) {
    throw new ConversionFailedError("Failed to extract text from PDF.", { cause });
  }
}

/** Minimal structural shape of a pdfjs text item we depend on. */
interface PdfTextItemLike {
  readonly str: string;
  /** pdfjs sets this on items that end a line. */
  readonly hasEOL?: boolean;
}

function isTextItem(item: unknown): item is PdfTextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

/**
 * Flattens a pdfjs `TextContent` into a string, inserting newlines on items
 * flagged with `hasEOL`. Pure relative to its (already-extracted) input, so the
 * assembly logic is tested directly via {@link assemblePageText}.
 */
function textContentToString(content: { items: readonly unknown[] }): string {
  return assemblePageText(content.items.filter(isTextItem));
}

/**
 * Joins pdfjs text items into a single page string. Extracted and exported so
 * the line-break logic is unit-testable without invoking pdfjs.
 */
export function assemblePageText(items: readonly PdfTextItemLike[]): string {
  let out = "";
  for (const item of items) {
    out += item.str;
    if (item.hasEOL) out += "\n";
  }
  return out;
}
