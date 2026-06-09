/**
 * English source dictionary — the single source of truth for openConv's copy.
 *
 * The {@link Dictionary} type is derived from this object (NOT `as const`, so
 * values widen to `string`); every other locale is typed `: Dictionary`, which
 * makes a missing or extra key a compile-time error. That keeps all locales in
 * lockstep without a runtime parity check.
 *
 * Three sections are looked up by a runtime key (see `helpers.pick`):
 *   - `options`  keyed by a converter option's `key`,
 *   - `notes`    keyed by `"<source>_<target>"`,
 *   - `errors`   keyed by a domain error `code`.
 * Unknown keys fall back to the English string the domain already carries, so
 * an untranslated entry degrades gracefully rather than showing a raw key.
 */

/** video → gif note, shared by every video source format. */
const GIF_NOTE: string = "Animated GIF; tune fps and width to balance size and smoothness.";

export const en = {
  app: {
    title: "openConv — private, client-side file converter",
    description:
      "Open-source file converter that runs entirely in your browser. Images, data, documents, audio and video — your files never leave your device.",
  },
  header: {
    github: "GitHub",
  },
  hero: {
    title: "Convert files without leaving your browser.",
    description:
      "openConv is an open-source, fully client-side file converter. Drop a file, pick a target format, and download — your data never touches a server.",
    privacy: "Private by architecture — no uploads, no tracking of your files.",
  },
  features: {
    clientSide: {
      title: "100% client-side",
      body: "Files are decoded, converted and re-encoded in your browser. Nothing is uploaded — ever.",
    },
    families: {
      title: "Five media families",
      body: "Images, structured data, documents, audio and video, all from one place.",
    },
    observable: {
      title: "Observable by design",
      body: "Every conversion is traced and logged with OpenTelemetry, complete with a trace id.",
    },
  },
  footer: {
    text: "openConv · MIT licensed · built with Next.js & WebAssembly. Conversions run locally on your device.",
  },
  dropzone: {
    idle: "Drag & drop files, or click to browse",
    active: "Drop your files",
    hint: "Images, data, documents, audio & video — converted right in your browser.",
    aria: "Add files to convert",
  },
  workspace: {
    fileOne: "{count} file",
    fileMany: "{count} files",
    clearFinished: "Clear finished",
    convertAll: "Convert all",
  },
  formatSelect: {
    none: "No conversions available",
  },
  kinds: {
    image: "Images",
    data: "Data",
    document: "Documents",
    audio: "Audio",
    video: "Video",
  },
  job: {
    unknownFormat: "Unknown format",
    unsupported: "No client-side conversion is available for this file type.",
    remove: "Remove",
    download: "Download",
    cancel: "Cancel",
    convert: "Convert",
    converting: "Converting…",
    doneIn: "Done in {ms} ms",
    trace: "trace",
    canceled: "Canceled.",
  },
  options: {
    quality: "Quality",
    background: "Background (flatten transparency)",
    indent: "Indent",
    header: "Include header row",
    pageSize: "Page size",
    margin: "Margin",
    audioBitrate: "Audio bitrate",
    fps: "Frames per second",
    width: "Width",
  },
  units: {
    spaces: "spaces",
  },
  choices: {
    "#ffffff": "White",
    "#000000": "Black",
    "#808080": "Grey",
  },
  notes: {
    markdown_html: "Renders Markdown to a standalone HTML document via marked.",
    html_markdown: "Converts HTML to Markdown via turndown.",
    markdown_txt: "Strips Markdown formatting to readable plain text.",
    html_txt: "Extracts readable plain text from HTML.",
    txt_html: "Wraps plain-text paragraphs in escaped HTML.",
    txt_markdown: "Treats plain text as Markdown, escaping stray markup.",
    html_pdf: "Renders HTML to PDF in the browser via jsPDF.",
    markdown_pdf: "Renders Markdown (via HTML) to PDF in the browser via jsPDF.",
    pdf_txt: "Extracts the text layer of a PDF via pdfjs-dist.",
    mp4_gif: GIF_NOTE,
    webm_gif: GIF_NOTE,
    mov_gif: GIF_NOTE,
    mkv_gif: GIF_NOTE,
    avi_gif: GIF_NOTE,
  },
  errors: {
    UNSUPPORTED_CONVERSION: "This conversion isn't supported.",
    CONVERSION_FAILED: "The conversion failed. Try a different file or format.",
    CONVERSION_CANCELED: "The conversion was canceled.",
    INVALID_INPUT: "The file couldn't be read or is malformed.",
    FORMAT_DETECTION_FAILED: "Couldn't determine this file's format.",
  },
  locale: {
    label: "Language",
  },
};

/** The shape every locale must implement. Derived from the English source. */
export type Dictionary = typeof en;
