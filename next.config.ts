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
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist and the ffmpeg client ship browser-only code; nothing here is
  // executed on the server, but we keep transpilePackages explicit for clarity.
  transpilePackages: ["pdfjs-dist"],
};

export default nextConfig;
