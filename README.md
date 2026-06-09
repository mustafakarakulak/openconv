# openConv

**Open-source, fully client-side file converter.** Drop a file, pick a target format, download the result — your data never leaves the browser. There is no upload, no server-side processing, and no tracking of your files.

> Images · Structured data · Documents · Audio · Video — all converted locally with WebAssembly and native browser APIs.

---

## Why openConv

Most online converters upload your files to a server you don't control. openConv does everything **in your browser**:

- 🔒 **Private by architecture** — files are decoded, transformed and re-encoded on your device. Nothing is transmitted.
- ⚡ **No backend** — deploys as a static site; the "engine" is the user's browser.
- 🧩 **Pluggable** — adding a new converter is a single, self-contained module.
- 🔭 **Observable** — every conversion is traced and logged with OpenTelemetry, including a `traceId` surfaced in the UI for support.

## Supported conversions

| Family        | Conversions                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------- |
| **Images**    | `png` `jpeg` `webp` `gif` `bmp` `avif` `ico` `svg` → `png` `jpeg` `webp` (quality, flattening) |
| **Data**      | `json` `yaml` `toml` `xml` `csv` `tsv` interchange (indent, header options)                    |
| **Documents** | `markdown` ↔ `html` ↔ `txt`, `markdown`/`html` → `pdf`, `pdf` → `txt`                           |
| **Audio**     | `mp3` `wav` `ogg` `aac` `flac` `m4a` → `mp3` `wav` `ogg` `aac` (bitrate)                        |
| **Video**     | → `mp4` `webm`, audio extraction (`mp3`/`wav`), and `gif` (fps, width)                          |

Conversion engines: native **Canvas / OffscreenCanvas** (images), pure-JS parsers (data), **marked / turndown / jsPDF / pdf.js** (documents), and **ffmpeg.wasm** (audio/video).

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS v4**
- **OpenTelemetry** Web SDK — traces + logs with trace correlation
- **Vitest** + happy-dom for unit tests
- **i18n** — lightweight, dependency-free client-side translations (English · Türkçe · العربية) with automatic RTL

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build          # production build
npm run start          # serve the production build
npm run typecheck      # tsc --noEmit
npm run test           # run the unit test suite
npm run test:coverage  # tests with coverage
npm run format         # prettier
```

## Configuration

All configuration is client-side and exposed via `NEXT_PUBLIC_*` env vars (see [`.env.example`](./.env.example)). Copy it to `.env.local` to customise.

### Observability

| Variable                         | Default        | Description                                              |
| -------------------------------- | -------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_OTEL_ENABLED`       | `true`         | Master switch for the OpenTelemetry pipeline.            |
| `NEXT_PUBLIC_OTEL_SERVICE_NAME`  | `openconv-web` | `service.name` reported on spans and logs.               |
| `NEXT_PUBLIC_OTEL_ENVIRONMENT`   | `development`  | `deployment.environment.name`.                           |
| `NEXT_PUBLIC_OTEL_CONSOLE`       | `true`         | Mirror spans/logs to the browser console (trace-tagged). |
| `NEXT_PUBLIC_OTEL_OTLP_ENDPOINT` | _(empty)_      | OTLP/HTTP collector base URL. Empty ⇒ no network export. |
| `NEXT_PUBLIC_LOG_LEVEL`          | `info`         | `debug` \| `info` \| `warn` \| `error`.                  |

When an OTLP endpoint is set, traces are sent to `${endpoint}/v1/traces` and logs to `${endpoint}/v1/logs`.

### Media engine (ffmpeg.wasm)

| Variable                      | Default                                           | Description                                               |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_FFMPEG_CORE_URL` | `https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd` | Base URL the single-threaded ffmpeg core is fetched from. |

For offline / air-gapped deployments, host `ffmpeg-core.js` + `ffmpeg-core.wasm` yourself and point this at them (e.g. `/ffmpeg`). The single-threaded core needs **no** `SharedArrayBuffer` and therefore **no** COOP/COEP headers.

## Internationalization (i18n)

openConv ships in **English**, **Türkçe** and **العربية (Arabic)**. The UI, error
messages, converter option labels and conversion notes are all translated; format
names (`PNG`, `JSON`, …) stay as-is since they're proper nouns.

The implementation is deliberately lightweight — no routing, no extra dependency:

- A typed dictionary per locale lives in [`src/i18n/dictionaries`](./src/i18n/dictionaries). The English dictionary is the source of truth; `tr` and `ar` are typed against it, so a **missing key is a compile-time error** (a parity test guards it at runtime too).
- `I18nProvider` ([`src/i18n/provider.tsx`](./src/i18n/provider.tsx)) resolves the active locale from `localStorage`, falling back to the browser language and then English. It mirrors the choice onto `<html lang/dir>`, so Arabic automatically switches the document to **RTL**.
- Components read copy straight off the typed dictionary (`dict.hero.title`). Two helpers cover the rest: `interpolate` fills `{placeholder}` tokens, and `pick` resolves a value by a runtime key (an error `code`, a converter option `key`, a `source→target` note) with an English fallback. **Converters stay i18n-agnostic** — they only expose stable keys, never localized strings.

> Note: transient converter progress phases (e.g. "Encoding image") are emitted by the engine and currently surface in English; everything the user reads at rest is translated.

### Adding a language

1. Copy `src/i18n/dictionaries/en.ts` to `<locale>.ts` and translate the values.
2. In [`src/i18n/config.ts`](./src/i18n/config.ts), add the code to `LOCALES`, its native name to `LOCALE_NAMES`, and — if right-to-left — to `RTL_LOCALES`.
3. Register the dictionary in `src/i18n/dictionaries/index.ts`.

TypeScript enforces key parity, so you'll get errors until the new dictionary is complete.

## Architecture

openConv follows a clean / hexagonal layering. Dependencies point inward; the core knows nothing about React or OpenTelemetry.

```
src/
├── core/                     # Domain + ports (pure, framework-agnostic)
│   ├── domain/               # FileFormat catalog, conversion model, errors
│   └── ports/                # Converter, Logger, Tracer interfaces
├── application/              # Use cases
│   ├── conversion-engine.ts  # Orchestrates one conversion, fully instrumented
│   ├── converter-registry.ts # Format graph + converter lookup
│   └── base-converter.ts     # Ergonomic base class for converters
├── infrastructure/           # Adapters
│   ├── observability/        # OpenTelemetry-backed Logger/Tracer + no-op fallback
│   └── converters/           # image · data · document · media plugins
├── ui/                       # React providers, hooks, components
├── lib/                      # Small shared utilities
└── app/                      # Next.js App Router shell
```

### How a conversion flows

1. The UI detects a file's format from its name/MIME (`detectFormat`).
2. The `ConverterRegistry` exposes the reachable target formats.
3. The `ConversionEngine` opens a `conversion.execute` span, resolves the right `Converter`, applies option defaults, and invokes it inside a span-correlated logger/tracer context.
4. The converter reads the `Blob`, does its work (reporting progress, honouring the `AbortSignal`), and returns output bytes.
5. The engine derives the output filename, records duration/size on the span, and returns a `ConversionResult` carrying the `traceId`.

### Adding a converter

1. Create `src/infrastructure/converters/<name>/`.
2. Extend `BaseConverter`: declare `id`, `name`, a `capabilities` array (referencing `FORMATS`), and implement `convert(input, ctx)`.
3. Export `export const <name>Converters: Converter[] = [...]` from the module's `index.ts`.
4. Register it in `src/infrastructure/converters/index.ts`.

That's it — the registry, UI format pickers, option controls and observability wire up automatically.

## Observability

Every conversion produces an OpenTelemetry trace (`conversion.execute` → `image.decode`, `image.encode`, `data.convert`, `media.convert`, …) and structured logs. Log records are correlated with the active span (`traceId`/`spanId`) regardless of `await` boundaries, because the engine hands each converter a **span-scoped logger** rather than relying on async context propagation. The result's `traceId` is shown in the UI so a user can quote it when reporting an issue.

## License

[MIT](./LICENSE) © Mustafa Karakulak
