/**
 * Lazy, shared ffmpeg.wasm engine.
 *
 * A single {@link FFmpeg} instance is reused across every media conversion in
 * the tab. The (expensive) WASM core download + instantiation happens at most
 * once: the load promise is memoised at module scope. All ffmpeg imports are
 * dynamic so this module is safe to import during SSR — the heavy code only
 * runs when {@link getFfmpeg} is awaited in the browser.
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";

/** Default CDN base for the single-threaded ffmpeg core (self-hostable). */
const DEFAULT_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

/** Resolves the core base URL, honouring the public env override. */
export function coreBaseUrl(): string {
  return process.env.NEXT_PUBLIC_FFMPEG_CORE_URL || DEFAULT_CORE_BASE;
}

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/** Optional hook invoked once while the core is (down)loading. */
export interface FfmpegLoadHooks {
  onLoadStart?(): void;
}

/**
 * Returns the shared, loaded {@link FFmpeg} instance, loading it on first use.
 * Concurrent callers share the same in-flight load promise.
 */
export async function getFfmpeg(hooks?: FfmpegLoadHooks): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = loadFfmpeg(hooks).catch((error: unknown) => {
    // Reset so a later attempt can retry rather than reusing a rejected promise.
    loadPromise = null;
    ffmpegInstance = null;
    throw error;
  });
  return loadPromise;
}

async function loadFfmpeg(hooks?: FfmpegLoadHooks): Promise<FFmpeg> {
  hooks?.onLoadStart?.();

  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const base = coreBaseUrl();
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/** Dynamically loads `fetchFile` from @ffmpeg/util (kept off the SSR path). */
export async function loadFetchFile(): Promise<(file: Blob) => Promise<Uint8Array>> {
  const { fetchFile } = await import("@ffmpeg/util");
  return fetchFile;
}

/**
 * Tears down the shared instance — used when a conversion is aborted, since
 * ffmpeg.wasm can only cancel an in-flight `exec` by terminating its worker.
 * The next conversion will transparently reload the core.
 */
export function terminateFfmpeg(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      // Best-effort: a failed terminate must not mask the original error.
    }
  }
  ffmpegInstance = null;
  loadPromise = null;
}

/** Test-only: clears memoised state so each test starts from a clean slate. */
export function __resetFfmpegForTests(): void {
  ffmpegInstance = null;
  loadPromise = null;
}
