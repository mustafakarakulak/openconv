/**
 * Pure, side-effect-free text transforms shared by the document converter.
 *
 * Everything in this module runs happily in happy-dom (it relies only on
 * `marked`, `turndown` and the DOM's `DOMParser`/`textContent`), so it is fully
 * unit-testable without any browser-only heavy machinery (jsPDF / pdfjs).
 */
import { marked } from "marked";
import TurndownService from "turndown";

/**
 * Renders Markdown source to an HTML fragment string.
 *
 * `marked` is configured with `async: false` so the call is synchronous and
 * returns a plain `string` (the default overload is `string | Promise<string>`).
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true, breaks: false });
}

/**
 * Wraps a bare HTML fragment in a minimal, well-formed HTML document so the
 * output is a standalone `.html` file rather than a loose fragment.
 */
export function wrapHtmlDocument(bodyHtml: string, title = "Document"): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    bodyHtml.trim(),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** Converts an HTML string into Markdown via turndown (ATX headings, fenced code). */
export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
  });
  return service.turndown(html).trim() + "\n";
}

/** HTML special characters that must be escaped when emitting text into markup. */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes the five significant HTML characters in a plain-text string. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Normalises CRLF/CR line endings to LF. Centralised so every transform sees a
 * single canonical newline shape.
 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * Splits plain text into paragraphs on blank lines. Trailing/leading blank
 * lines are ignored; a paragraph may itself contain single newlines.
 */
export function splitParagraphs(text: string): string[] {
  return normalizeNewlines(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Converts plain text to an HTML body fragment: each blank-line-delimited block
 * becomes a `<p>`, with intra-paragraph newlines preserved as `<br>`. All text
 * is HTML-escaped first so the result is safe and faithful.
 */
export function textToHtmlBody(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return "<p></p>";
  return paragraphs
    .map((p) => {
      const lines = p.split("\n").map((line) => escapeHtml(line));
      return `<p>${lines.join("<br>\n")}</p>`;
    })
    .join("\n");
}

/** Plain text -> a standalone HTML document. */
export function textToHtml(text: string, title = "Document"): string {
  return wrapHtmlDocument(textToHtmlBody(text), title);
}

/**
 * Plain text -> Markdown. Plain text is (almost) valid Markdown already, but we
 * escape the leading inline-markup characters so the text round-trips literally
 * instead of being reinterpreted as markup, while preserving paragraph breaks.
 */
export function textToMarkdown(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return "\n";
  return (
    paragraphs
      .map((p) =>
        p
          .split("\n")
          .map((line) => escapeMarkdown(line))
          .join("  \n"),
      )
      .join("\n\n") + "\n"
  );
}

/**
 * Escapes Markdown structural characters at the start of a line and common
 * inline delimiters so arbitrary plain text does not accidentally become markup.
 */
export function escapeMarkdown(line: string): string {
  return line
    .replace(/([\\`*_{}[\]()#+\-!])/g, "\\$1")
    .replace(/^(\s*)\\([->])/, "$1\\$2");
}

/**
 * Extracts readable plain text from an HTML string using the DOM (`DOMParser`),
 * which is available under happy-dom. Block-level elements introduce paragraph
 * breaks, `<br>` introduces a single newline, and list items are bulleted, so
 * the result reads naturally rather than as one collapsed run.
 */
export function htmlToText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const root = doc.body ?? doc.documentElement;
  if (!root) return "";
  const raw = collectText(root);
  return tidyText(raw);
}

/** Block-level tags after which we force a paragraph (double-newline) break. */
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "TABLE",
  "TR",
  "HR",
]);

/** Tags whose content should be dropped entirely from extracted text. */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "TEMPLATE"]);

const NODE_TYPE_TEXT = 3;
const NODE_TYPE_ELEMENT = 1;

/** Recursively walks a DOM node, accumulating text with structural whitespace. */
function collectText(node: Node): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === NODE_TYPE_TEXT) {
      out += child.textContent ?? "";
      continue;
    }
    if (child.nodeType !== NODE_TYPE_ELEMENT) continue;
    const el = child as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === "BR") {
      out += "\n";
      continue;
    }
    const inner = collectText(el);
    if (tag === "LI") {
      out += `\n- ${inner.trim()}\n`;
    } else if (BLOCK_TAGS.has(tag)) {
      out += `\n\n${inner}\n\n`;
    } else {
      out += inner;
    }
  }
  return out;
}

/**
 * Collapses runs of spaces/tabs, trims each line, and squeezes 3+ blank lines
 * down to a single blank line so extracted text is clean and stable.
 */
export function tidyText(text: string): string {
  return normalizeNewlines(text)
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Markdown -> plain text. Rendered to HTML first (so list markup, emphasis,
 * code fences etc. are interpreted) and then stripped back to text, which
 * yields cleaner output than naive regex stripping of Markdown syntax.
 */
export function markdownToText(markdown: string): string {
  return htmlToText(markdownToHtml(markdown));
}

/**
 * Joins lines of extracted PDF text into paragraphs, used by the pdf->txt path.
 * Kept here (pure) so it is unit-testable without invoking pdfjs.
 */
export function joinPdfLines(pages: readonly string[]): string {
  return pages
    .map((page) => tidyText(page))
    .filter((page) => page.length > 0)
    .join("\n\n");
}
