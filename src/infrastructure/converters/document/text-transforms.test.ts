// @vitest-environment jsdom
// DOMPurify (used by markdownToHtml/sanitizeHtml) needs a spec-faithful DOM;
// happy-dom mis-serialises sanitised output, so these tests run under jsdom.
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  escapeMarkdown,
  htmlToMarkdown,
  htmlToText,
  joinPdfLines,
  markdownToHtml,
  markdownToText,
  normalizeNewlines,
  sanitizeHtml,
  splitParagraphs,
  textToHtml,
  textToHtmlBody,
  textToMarkdown,
  tidyText,
  wrapHtmlDocument,
} from "./text-transforms";

describe("markdownToHtml", () => {
  it("renders headings", () => {
    const html = markdownToHtml("# Hello World");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello World");
  });

  it("renders unordered lists", () => {
    const html = markdownToHtml("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>three</li>");
  });

  it("renders ordered lists", () => {
    const html = markdownToHtml("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("first");
  });

  it("renders links", () => {
    const html = markdownToHtml("[OpenConv](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">OpenConv<");
  });

  it("renders bold and italic", () => {
    const html = markdownToHtml("**bold** and _italic_");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders fenced code blocks", () => {
    const html = markdownToHtml("```\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("const x = 1;");
  });

  it("renders inline code", () => {
    const html = markdownToHtml("Use `npm install` to install");
    expect(html).toContain("<code>npm install</code>");
  });

  it("returns a string synchronously", () => {
    const out = markdownToHtml("plain");
    expect(typeof out).toBe("string");
  });

  it("strips raw <script> embedded in Markdown", () => {
    const html = markdownToHtml("# Title\n\n<script>alert(document.cookie)</script>");
    expect(html).toContain("Title");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(document.cookie)");
  });

  it("strips event-handler attributes and javascript: URLs", () => {
    const html = markdownToHtml('<img src=x onerror="steal()">\n\n[x](javascript:steal())');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});

describe("sanitizeHtml", () => {
  it("removes <script> while keeping surrounding markup", () => {
    const out = sanitizeHtml("<p>safe</p><script>evil()</script>");
    expect(out).toContain("<p>safe</p>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil()");
  });

  it("removes inline event handlers", () => {
    const out = sanitizeHtml('<img src="x" onerror="evil()">');
    expect(out).not.toContain("onerror");
  });

  it("preserves benign formatting and links", () => {
    const out = sanitizeHtml('<h1>Hi</h1><a href="https://example.com">link</a>');
    expect(out).toContain("<h1>Hi</h1>");
    expect(out).toContain('href="https://example.com"');
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings to ATX", () => {
    expect(htmlToMarkdown("<h1>Title</h1>")).toContain("# Title");
    expect(htmlToMarkdown("<h2>Sub</h2>")).toContain("## Sub");
  });

  it("converts unordered lists with dash markers", () => {
    const md = htmlToMarkdown("<ul><li>a</li><li>b</li></ul>");
    // turndown pads list items with spaces after the marker.
    expect(md).toMatch(/^- +a$/m);
    expect(md).toMatch(/^- +b$/m);
  });

  it("converts links", () => {
    const md = htmlToMarkdown('<a href="https://example.com">site</a>');
    expect(md).toContain("[site](https://example.com)");
  });

  it("converts bold and italic with configured delimiters", () => {
    const md = htmlToMarkdown("<strong>b</strong> <em>i</em>");
    expect(md).toContain("**b**");
    expect(md).toContain("_i_");
  });

  it("converts code blocks to fenced", () => {
    const md = htmlToMarkdown("<pre><code>let y = 2;</code></pre>");
    expect(md).toContain("```");
    expect(md).toContain("let y = 2;");
  });

  it("ends with a single trailing newline", () => {
    const md = htmlToMarkdown("<p>hello</p>");
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });
});

describe("markdown <-> html round trip", () => {
  it("preserves a heading through md -> html -> md", () => {
    const original = "# A Heading";
    const back = htmlToMarkdown(markdownToHtml(original));
    expect(back).toContain("# A Heading");
  });

  it("preserves a list and link through a round trip", () => {
    const original = "- [link](https://x.io)\n- plain item";
    const back = htmlToMarkdown(markdownToHtml(original));
    expect(back).toContain("[link](https://x.io)");
    expect(back).toContain("plain item");
  });

  it("preserves emphasis through a round trip", () => {
    const back = htmlToMarkdown(markdownToHtml("This is **strong** text"));
    expect(back).toContain("**strong**");
  });
});

describe("escapeHtml", () => {
  it("escapes all five significant characters", () => {
    expect(escapeHtml("<a href=\"x\" class='y'> & </a>")).toBe(
      "&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt; &amp; &lt;/a&gt;",
    );
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("normalizeNewlines", () => {
  it("converts CRLF and CR to LF", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and trims empties", () => {
    expect(splitParagraphs("one\n\ntwo\n\n\n\nthree\n\n")).toEqual(["one", "two", "three"]);
  });

  it("keeps single newlines inside a paragraph", () => {
    expect(splitParagraphs("line1\nline2\n\npara2")).toEqual(["line1\nline2", "para2"]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(splitParagraphs("   \n\n  \n")).toEqual([]);
  });
});

describe("textToHtmlBody / textToHtml", () => {
  it("wraps paragraphs in <p> tags", () => {
    const body = textToHtmlBody("first para\n\nsecond para");
    expect(body).toContain("<p>first para</p>");
    expect(body).toContain("<p>second para</p>");
  });

  it("escapes HTML special characters in text", () => {
    const body = textToHtmlBody("a < b & c > d");
    expect(body).toContain("a &lt; b &amp; c &gt; d");
    expect(body).not.toContain("a < b");
  });

  it("uses <br> for intra-paragraph newlines", () => {
    const body = textToHtmlBody("line1\nline2");
    expect(body).toContain("line1<br>");
    expect(body).toContain("line2");
  });

  it("produces an empty paragraph for empty input", () => {
    expect(textToHtmlBody("")).toBe("<p></p>");
  });

  it("textToHtml wraps in a full document with title", () => {
    const html = textToHtml("hi", "My Title");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>My Title</title>");
    expect(html).toContain("<p>hi</p>");
  });

  it("escapes the title", () => {
    const html = textToHtml("body", "a<b>c");
    expect(html).toContain("<title>a&lt;b&gt;c</title>");
  });
});

describe("escapeMarkdown / textToMarkdown", () => {
  it("escapes leading markup characters", () => {
    expect(escapeMarkdown("# not a heading")).toBe("\\# not a heading");
    expect(escapeMarkdown("* not a bullet")).toContain("\\*");
  });

  it("escapes inline emphasis markers", () => {
    expect(escapeMarkdown("a_b_c")).toBe("a\\_b\\_c");
  });

  it("textToMarkdown separates paragraphs with a blank line", () => {
    const md = textToMarkdown("para one\n\npara two");
    expect(md).toContain("para one");
    expect(md).toContain("para two");
    expect(md).toContain("\n\n");
  });

  it("textToMarkdown escapes markup so plain text stays literal", () => {
    const md = textToMarkdown("# heading-like line");
    expect(md).toContain("\\#");
  });

  it("textToMarkdown ends with a newline", () => {
    expect(textToMarkdown("x").endsWith("\n")).toBe(true);
  });
});

describe("htmlToText", () => {
  it("strips tags and keeps text content", () => {
    expect(htmlToText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("separates block elements with blank lines", () => {
    const text = htmlToText("<p>one</p><p>two</p>");
    expect(text).toBe("one\n\ntwo");
  });

  it("renders list items as bullets", () => {
    const text = htmlToText("<ul><li>alpha</li><li>beta</li></ul>");
    expect(text).toContain("- alpha");
    expect(text).toContain("- beta");
  });

  it("turns <br> into a single newline", () => {
    expect(htmlToText("<p>a<br>b</p>")).toBe("a\nb");
  });

  it("drops script and style content", () => {
    const text = htmlToText("<style>p{color:red}</style><p>visible</p><script>alert(1)</script>");
    expect(text).toBe("visible");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("alert");
  });

  it("collapses excess whitespace", () => {
    expect(htmlToText("<p>a     b\t\tc</p>")).toBe("a b c");
  });
});

describe("tidyText", () => {
  it("collapses 3+ blank lines to one", () => {
    expect(tidyText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims each line and the whole string", () => {
    expect(tidyText("  a  \n  b  ")).toBe("a\nb");
  });
});

describe("markdownToText", () => {
  it("strips markdown to readable text", () => {
    const text = markdownToText("# Title\n\nSome **bold** text.");
    expect(text).toContain("Title");
    expect(text).toContain("Some bold text.");
    expect(text).not.toContain("#");
    expect(text).not.toContain("**");
  });

  it("renders markdown lists as bullets", () => {
    const text = markdownToText("- one\n- two");
    expect(text).toContain("- one");
    expect(text).toContain("- two");
  });
});

describe("wrapHtmlDocument", () => {
  it("produces a valid standalone document with charset and body", () => {
    const html = wrapHtmlDocument("<p>x</p>", "T");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<body>");
    expect(html).toContain("<p>x</p>");
    expect(html).toContain("</html>");
  });
});

describe("joinPdfLines", () => {
  it("joins per-page text with blank-line separators", () => {
    expect(joinPdfLines(["page one", "page two"])).toBe("page one\n\npage two");
  });

  it("drops empty pages", () => {
    expect(joinPdfLines(["", "kept", "   "])).toBe("kept");
  });

  it("tidies each page", () => {
    expect(joinPdfLines(["  a   b  "])).toBe("a b");
  });
});
