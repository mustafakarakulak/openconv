import type { NextConfig } from "next";

/**
 * openConv — Next.js configuration.
 *
 * All file conversion happens client-side; there is no server runtime that
 * touches user data. We keep the config intentionally minimal and rely on
 * Turbopack defaults (Next.js 16).
 *
 * Note on cross-origin isolation: we deliberately do NOT enable COOP/COEP
 * headers. The media converter uses the single-threaded ffmpeg.wasm core,
 * which does not require SharedArrayBuffer, and enabling COEP would break
 * loading the ffmpeg core from a CDN. If you self-host a multi-threaded core,
 * add the appropriate headers here.
 */

const isDev = process.env.NODE_ENV !== "production";

/** Returns the origin of an absolute URL, or null for empty/relative values. */
function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Origin the ffmpeg.wasm core is fetched from at runtime, so `connect-src` can
 * allow it. Mirrors `coreBaseUrl()` in the media engine: unset ⇒ the unpkg CDN;
 * a relative path ⇒ same-origin (no extra origin needed); an absolute URL ⇒ its
 * origin.
 */
function ffmpegConnectOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_FFMPEG_CORE_URL;
  if (!raw) return "https://unpkg.com";
  if (raw.startsWith("/")) return null;
  return originOf(raw);
}

/**
 * Builds the Content-Security-Policy. It is deliberately pragmatic rather than
 * nonce-strict: Next's App Router emits inline bootstrap scripts, so a no-nonce
 * policy needs `'unsafe-inline'` for scripts. The real protection here is the
 * tight `connect-src`/`img-src` (an injected payload cannot exfiltrate to an
 * arbitrary origin) combined with HTML sanitisation in the document converter,
 * plus `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`.
 * WebAssembly (ffmpeg.wasm, pdf.js) needs `'wasm-unsafe-eval'`; the workers are
 * loaded from `blob:`. Upgrading to a nonce-based strict CSP is future work.
 */
function contentSecurityPolicy(): string {
  const connectSrc = [
    "'self'",
    "blob:",
    "data:",
    ffmpegConnectOrigin(),
    originOf(process.env.NEXT_PUBLIC_OTEL_OTLP_ENDPOINT),
    // Dev server uses websockets for HMR.
    ...(isDev ? ["ws:", "wss:"] : []),
  ]
    .filter(Boolean)
    .join(" ");

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "blob:",
    // React Fast Refresh uses eval() in development only.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    "worker-src 'self' blob:",
    `connect-src ${connectSrc}`,
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist and the ffmpeg client ship browser-only code; nothing here is
  // executed on the server, but we keep transpilePackages explicit for clarity.
  transpilePackages: ["pdfjs-dist"],
  // Security headers. NOTE: `headers()` only applies to a Next.js server
  // (`next start`) — a fully static `output: 'export'` deployment must set
  // these (especially the CSP) at the CDN/host layer instead.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
