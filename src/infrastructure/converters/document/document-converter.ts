/**
 * Document converter.
 *
 * Handles text-document interchange entirely in the browser:
 *   - markdown <-> html, and both -> txt / txt -> both (pure text transforms)
 *   - html / markdown -> pdf (jsPDF `.html()`, browser-only)
 *   - pdf -> txt (pdfjs-dist text extraction, browser-only)
 *
 * Pure transforms live in `./text-transforms`; browser-only PDF machinery lives
 * in `./pdf` and is dynamically imported there. This class is the orchestration
 * layer: capability matrix, option resolution, progress/tracing/cancellation.
 */
import { BaseConverter } from "@/application/base-converter";
import { FORMATS } from "@/core/domain/format";
import type { FormatId } from "@/core/domain/format";
import { ConversionFailedError, InvalidInputError } from "@/core/domain/errors";
import type {
  ConversionCapability,
  ConverterOptionDescriptor,
  ConvertInput,
  ConvertOutput,
  ConverterContext,
} from "@/core/ports/converter";
import {
  htmlToMarkdown,
  htmlToText,
  joinPdfLines,
  markdownToHtml,
  markdownToText,
  textToHtml,
  textToMarkdown,
  wrapHtmlDocument,
} from "./text-transforms";
import { extractPdfPages, renderHtmlToPdf, resolvePdfOptions } from "./pdf";

/** Shared option descriptors for any capability that targets PDF. */
export const PDF_OPTION_DESCRIPTORS: readonly ConverterOptionDescriptor[] = [
  {
    kind: "select",
    key: "pageSize",
    label: "Page size",
    default: "a4",
    choices: [
      { value: "a4", label: "A4" },
      { value: "letter", label: "Letter" },
    ],
  },
  {
    kind: "number",
    key: "margin",
    label: "Margin",
    default: 36,
    min: 0,
    max: 72,
    step: 1,
    unit: "pt",
  },
];

/** A `source:target` key used to dispatch within {@link DocumentConverter}. */
type PairKey = `${FormatId}:${FormatId}`;

function pairKey(source: FormatId, target: FormatId): PairKey {
  return `${source}:${target}`;
}

/**
 * Derives a human title from the source filename (basename without extension),
 * used for the `<title>` of generated HTML documents.
 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const trimmed = stem.trim();
  return trimmed.length > 0 ? trimmed : "Document";
}

export class DocumentConverter extends BaseConverter {
  readonly id = "document-text";
  readonly name = "Document & Text";

  readonly capabilities: readonly ConversionCapability[] = [
    // --- Markup interchange (pure, fast) ---------------------------------
    {
      source: FORMATS.markdown,
      target: FORMATS.html,
      note: "Renders Markdown to a standalone HTML document via marked.",
    },
    {
      source: FORMATS.html,
      target: FORMATS.markdown,
      note: "Converts HTML to Markdown via turndown.",
    },
    {
      source: FORMATS.markdown,
      target: FORMATS.txt,
      note: "Strips Markdown formatting to readable plain text.",
    },
    {
      source: FORMATS.html,
      target: FORMATS.txt,
      note: "Extracts readable plain text from HTML.",
    },
    {
      source: FORMATS.txt,
      target: FORMATS.html,
      note: "Wraps plain-text paragraphs in escaped HTML.",
    },
    {
      source: FORMATS.txt,
      target: FORMATS.markdown,
      note: "Treats plain text as Markdown, escaping stray markup.",
    },
    // --- PDF generation (browser-only, jsPDF) ----------------------------
    {
      source: FORMATS.html,
      target: FORMATS.pdf,
      options: PDF_OPTION_DESCRIPTORS,
      note: "Renders HTML to PDF in the browser via jsPDF.",
    },
    {
      source: FORMATS.markdown,
      target: FORMATS.pdf,
      options: PDF_OPTION_DESCRIPTORS,
      note: "Renders Markdown (via HTML) to PDF in the browser via jsPDF.",
    },
    // --- PDF text extraction (browser-only, pdfjs) -----------------------
    {
      source: FORMATS.pdf,
      target: FORMATS.txt,
      note: "Extracts the text layer of a PDF via pdfjs-dist.",
    },
  ];

  async convert(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    const key = pairKey(input.source.id, input.target.id);
    if (!this.capabilityFor(input.source.id, input.target.id)) {
      throw new InvalidInputError(
        `Unsupported document conversion: ${input.source.id} → ${input.target.id}.`,
        { context: { source: input.source.id, target: input.target.id } },
      );
    }

    this.throwIfAborted(ctx.signal);
    ctx.logger.debug("document conversion started", {
      source: input.source.id,
      target: input.target.id,
    });

    switch (key) {
      case pairKey(FORMATS.markdown.id, FORMATS.html.id):
        return this.markdownToHtml(input, ctx);
      case pairKey(FORMATS.html.id, FORMATS.markdown.id):
        return this.htmlToMarkdown(input, ctx);
      case pairKey(FORMATS.markdown.id, FORMATS.txt.id):
        return this.markdownToTxt(input, ctx);
      case pairKey(FORMATS.html.id, FORMATS.txt.id):
        return this.htmlToTxt(input, ctx);
      case pairKey(FORMATS.txt.id, FORMATS.html.id):
        return this.txtToHtml(input, ctx);
      case pairKey(FORMATS.txt.id, FORMATS.markdown.id):
        return this.txtToMarkdown(input, ctx);
      case pairKey(FORMATS.html.id, FORMATS.pdf.id):
      case pairKey(FORMATS.markdown.id, FORMATS.pdf.id):
        return this.toPdf(input, ctx);
      case pairKey(FORMATS.pdf.id, FORMATS.txt.id):
        return this.pdfToTxt(input, ctx);
      default:
        // Unreachable: capabilityFor guards above, but keeps the switch total.
        throw new InvalidInputError(`Unsupported document conversion: ${key}.`);
    }
  }

  // --- Pure text transforms ----------------------------------------------

  private async markdownToHtml(
    input: ConvertInput,
    ctx: ConverterContext,
  ): Promise<ConvertOutput> {
    const md = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const body = markdownToHtml(md);
    const html = wrapHtmlDocument(body, titleFromFileName(input.fileName));
    return this.textOutput(input, html, ctx, { sourceChars: md.length });
  }

  private async htmlToMarkdown(
    input: ConvertInput,
    ctx: ConverterContext,
  ): Promise<ConvertOutput> {
    const html = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const md = htmlToMarkdown(html);
    return this.textOutput(input, md, ctx, { sourceChars: html.length });
  }

  private async markdownToTxt(
    input: ConvertInput,
    ctx: ConverterContext,
  ): Promise<ConvertOutput> {
    const md = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const txt = markdownToText(md);
    return this.textOutput(input, txt, ctx, { sourceChars: md.length });
  }

  private async htmlToTxt(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    const html = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const txt = htmlToText(html);
    return this.textOutput(input, txt, ctx, { sourceChars: html.length });
  }

  private async txtToHtml(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    const txt = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const html = textToHtml(txt, titleFromFileName(input.fileName));
    return this.textOutput(input, html, ctx, { sourceChars: txt.length });
  }

  private async txtToMarkdown(
    input: ConvertInput,
    ctx: ConverterContext,
  ): Promise<ConvertOutput> {
    const txt = await input.file.text();
    this.throwIfAborted(ctx.signal);
    const md = textToMarkdown(txt);
    return this.textOutput(input, md, ctx, { sourceChars: txt.length });
  }

  /** Encodes a string result as a Blob with the target MIME type. */
  private textOutput(
    input: ConvertInput,
    text: string,
    ctx: ConverterContext,
    attributes: Record<string, string | number | boolean>,
  ): ConvertOutput {
    ctx.reportProgress({ ratio: 1, message: "Done" });
    const mime = input.target.mimeTypes[0] ?? "application/octet-stream";
    const blob = new Blob([text], { type: mime });
    ctx.logger.info("document conversion succeeded", {
      target: input.target.id,
      outputBytes: blob.size,
    });
    return { blob, attributes: { ...attributes, outputChars: text.length } };
  }

  // --- Browser-only heavy paths ------------------------------------------

  private toPdf(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    return ctx.tracer.withSpan("document.toPdf", async (span) => {
      const options = resolvePdfOptions({
        pageSize: this.stringOption(input.options, "pageSize", "a4"),
        margin: this.numberOption(input.options, "margin", 36),
      });
      span.setAttributes({ pageSize: options.pageSize, margin: options.margin });

      const source = await input.file.text();
      this.throwIfAborted(ctx.signal);
      ctx.reportProgress({ ratio: 0.2, message: "Rendering markup" });

      const body =
        input.source.id === FORMATS.markdown.id ? markdownToHtml(source) : source;

      ctx.reportProgress({ ratio: 0.5, message: "Generating PDF" });
      try {
        const buffer = await renderHtmlToPdf(body, options);
        this.throwIfAborted(ctx.signal);
        ctx.reportProgress({ ratio: 1, message: "Done" });
        const mime = input.target.mimeTypes[0] ?? "application/octet-stream";
        const blob = new Blob([buffer], { type: mime });
        span.logger.info("pdf generated", { outputBytes: blob.size });
        return {
          blob,
          attributes: { pageSize: options.pageSize, margin: options.margin, outputBytes: blob.size },
        };
      } catch (cause) {
        if (cause instanceof ConversionFailedError) throw cause;
        throw new ConversionFailedError("Failed to generate PDF.", { cause });
      }
    });
  }

  private pdfToTxt(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    return ctx.tracer.withSpan("document.pdfToTxt", async (span) => {
      const buffer = await input.file.arrayBuffer();
      this.throwIfAborted(ctx.signal);
      const data = new Uint8Array(buffer);
      ctx.reportProgress({ ratio: 0.1, message: "Loading PDF" });

      try {
        const pages = await extractPdfPages(data, (pageIndex, pageCount) => {
          this.throwIfAborted(ctx.signal);
          ctx.reportProgress({
            ratio: pageCount > 0 ? pageIndex / pageCount : undefined,
            message: `Extracting page ${pageIndex} of ${pageCount}`,
          });
        });
        const text = joinPdfLines(pages);
        ctx.reportProgress({ ratio: 1, message: "Done" });
        const mime = input.target.mimeTypes[0] ?? "application/octet-stream";
        const blob = new Blob([text], { type: mime });
        span.setAttributes({ pageCount: pages.length, outputChars: text.length });
        span.logger.info("pdf text extracted", { pageCount: pages.length });
        return {
          blob,
          attributes: { pageCount: pages.length, outputChars: text.length },
        };
      } catch (cause) {
        if (cause instanceof ConversionFailedError) throw cause;
        throw new ConversionFailedError("Failed to extract text from PDF.", { cause });
      }
    });
  }
}
