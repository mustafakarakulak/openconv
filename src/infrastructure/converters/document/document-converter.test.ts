import { describe, it, expect } from "vitest";
import { FORMATS } from "@/core/domain/format";
import type { FileFormat } from "@/core/domain/format";
import { InvalidInputError } from "@/core/domain/errors";
import type {
  ConversionProgress,
  ConvertInput,
  ConverterContext,
} from "@/core/ports/converter";
import type { Logger, Span, SpanOptions, Tracer } from "@/core/ports/observability";
import { documentConverters } from "./index";
import { DocumentConverter, PDF_OPTION_DESCRIPTORS, titleFromFileName } from "./document-converter";

// --- Test doubles --------------------------------------------------------

function fakeLogger(): Logger {
  const logger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child: () => logger,
  };
  return logger;
}

function fakeSpan(): Span {
  return {
    traceId: "0".repeat(32),
    spanId: "0".repeat(16),
    logger: fakeLogger(),
    setAttribute() {},
    setAttributes() {},
    addEvent() {},
    recordError() {},
    setStatus() {},
    end() {},
  };
}

function fakeTracer(): Tracer {
  return {
    startSpan: (_name: string, _options?: SpanOptions) => fakeSpan(),
    withSpan: async (_name, fn) => fn(fakeSpan()),
  };
}

interface FakeContext extends ConverterContext {
  readonly progress: ConversionProgress[];
}

function makeContext(signal?: AbortSignal): FakeContext {
  const progress: ConversionProgress[] = [];
  return {
    signal: signal ?? new AbortController().signal,
    logger: fakeLogger(),
    tracer: fakeTracer(),
    reportProgress(p) {
      progress.push(p);
    },
    progress,
  };
}

function makeInput(
  text: string,
  source: FileFormat,
  target: FileFormat,
  options: Record<string, string | number | boolean> = {},
): ConvertInput {
  const mime = source.mimeTypes[0] ?? "text/plain";
  return {
    file: new Blob([text], { type: mime }),
    fileName: `sample.${source.extensions[0] ?? "txt"}`,
    source,
    target,
    options,
  };
}

const converter = new DocumentConverter();

// --- index export --------------------------------------------------------

describe("documentConverters export", () => {
  it("exports exactly one DocumentConverter instance", () => {
    expect(documentConverters).toHaveLength(1);
    expect(documentConverters[0]).toBeInstanceOf(DocumentConverter);
  });

  it("has a stable id and name", () => {
    expect(converter.id).toBe("document-text");
    expect(converter.name).toBe("Document & Text");
  });
});

// --- capability matrix ---------------------------------------------------

describe("capabilities", () => {
  const pairs = converter.capabilities.map((c) => `${c.source.id}->${c.target.id}`);

  it("declares all nine expected capabilities", () => {
    expect(new Set(pairs)).toEqual(
      new Set([
        "markdown->html",
        "html->markdown",
        "markdown->txt",
        "html->txt",
        "txt->html",
        "txt->markdown",
        "html->pdf",
        "markdown->pdf",
        "pdf->txt",
      ]),
    );
  });

  it("has no duplicate pairs", () => {
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("attaches PDF options only to pdf targets", () => {
    for (const cap of converter.capabilities) {
      if (cap.target.id === FORMATS.pdf.id) {
        expect(cap.options).toBe(PDF_OPTION_DESCRIPTORS);
      } else {
        expect(cap.options).toBeUndefined();
      }
    }
  });

  it("every capability references a document format and has a note", () => {
    for (const cap of converter.capabilities) {
      expect(cap.note).toBeTruthy();
      expect([cap.source.kind, cap.target.kind]).toContain("document");
    }
  });
});

describe("PDF option descriptors", () => {
  it("declares a pageSize select with a4 default and a4/letter choices", () => {
    const pageSize = PDF_OPTION_DESCRIPTORS.find((o) => o.key === "pageSize");
    expect(pageSize?.kind).toBe("select");
    if (pageSize?.kind === "select") {
      expect(pageSize.default).toBe("a4");
      expect(pageSize.choices.map((c) => c.value)).toEqual(["a4", "letter"]);
    }
  });

  it("declares a margin number 0..72 default 36 in pt", () => {
    const margin = PDF_OPTION_DESCRIPTORS.find((o) => o.key === "margin");
    expect(margin?.kind).toBe("number");
    if (margin?.kind === "number") {
      expect(margin.default).toBe(36);
      expect(margin.min).toBe(0);
      expect(margin.max).toBe(72);
      expect(margin.unit).toBe("pt");
    }
  });
});

// --- supports() ----------------------------------------------------------

describe("supports", () => {
  it("returns true for declared pairs", () => {
    expect(converter.supports("markdown", "html")).toBe(true);
    expect(converter.supports("pdf", "txt")).toBe(true);
    expect(converter.supports("markdown", "pdf")).toBe(true);
  });

  it("returns false for undeclared pairs", () => {
    expect(converter.supports("txt", "pdf")).toBe(false);
    expect(converter.supports("png", "txt")).toBe(false);
    expect(converter.supports("html", "html")).toBe(false);
  });
});

// --- titleFromFileName ---------------------------------------------------

describe("titleFromFileName", () => {
  it("strips the extension", () => {
    expect(titleFromFileName("report.md")).toBe("report");
  });

  it("strips directory components", () => {
    expect(titleFromFileName("/docs/notes/My File.html")).toBe("My File");
  });

  it("falls back to Document for empty stems", () => {
    expect(titleFromFileName(".gitignore")).toBe(".gitignore");
    expect(titleFromFileName("")).toBe("Document");
  });
});

// --- convert(): text paths (run in happy-dom) ----------------------------

async function readBlob(input: ConvertInput): Promise<string> {
  const out = await converter.convert(input, makeContext());
  return out.blob.text();
}

describe("convert: text transforms", () => {
  it("markdown -> html produces a full document", async () => {
    const input = makeInput("# Hi\n\n- a\n- b", FORMATS.markdown, FORMATS.html);
    const text = await readBlob(input);
    expect(text).toContain("<!DOCTYPE html>");
    expect(text).toContain("<h1");
    expect(text).toContain("<li>a</li>");
  });

  it("markdown -> html sets the html mime type on the blob", async () => {
    const out = await converter.convert(
      makeInput("# Hi", FORMATS.markdown, FORMATS.html),
      makeContext(),
    );
    expect(out.blob.type).toBe("text/html");
    expect(out.attributes?.outputChars).toBeGreaterThan(0);
  });

  it("html -> markdown produces markdown", async () => {
    const text = await readBlob(
      makeInput("<h1>T</h1><ul><li>x</li></ul>", FORMATS.html, FORMATS.markdown),
    );
    expect(text).toContain("# T");
    expect(text).toMatch(/^- +x$/m);
  });

  it("markdown -> txt strips formatting", async () => {
    const text = await readBlob(
      makeInput("# Title\n\n**bold**", FORMATS.markdown, FORMATS.txt),
    );
    expect(text).toContain("Title");
    expect(text).toContain("bold");
    expect(text).not.toContain("#");
    expect(text).not.toContain("**");
  });

  it("html -> txt extracts text", async () => {
    const text = await readBlob(
      makeInput("<p>hello</p><p>world</p>", FORMATS.html, FORMATS.txt),
    );
    expect(text).toBe("hello\n\nworld");
  });

  it("txt -> html escapes and wraps", async () => {
    const text = await readBlob(
      makeInput("a < b\n\nsecond", FORMATS.txt, FORMATS.html),
    );
    expect(text).toContain("a &lt; b");
    expect(text).toContain("<p>second</p>");
  });

  it("txt -> markdown escapes stray markup", async () => {
    const text = await readBlob(
      makeInput("# not a heading", FORMATS.txt, FORMATS.markdown),
    );
    expect(text).toContain("\\#");
  });

  it("reports completion progress on text paths", async () => {
    const ctx = makeContext();
    await converter.convert(makeInput("hi", FORMATS.txt, FORMATS.html), ctx);
    expect(ctx.progress.at(-1)).toEqual({ ratio: 1, message: "Done" });
  });
});

// --- convert(): error / cancellation paths -------------------------------

describe("convert: guards", () => {
  it("throws InvalidInputError for an unsupported pair", async () => {
    const input = makeInput("x", FORMATS.txt, FORMATS.pdf); // txt->pdf not supported
    await expect(converter.convert(input, makeContext())).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("throws when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const input = makeInput("# Hi", FORMATS.markdown, FORMATS.html);
    await expect(
      converter.convert(input, makeContext(controller.signal)),
    ).rejects.toMatchObject({ code: "CONVERSION_CANCELED" });
  });
});
