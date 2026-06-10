/**
 * Media converter — audio and video transcoding via ffmpeg.wasm.
 *
 * Handles audio↔audio, video↔video, video→audio extraction and video→GIF,
 * entirely client-side. All meaningful decision logic (capabilities, option
 * resolution, ffmpeg arg construction) lives in pure helpers
 * ({@link ./ffmpeg-args}) so it is unit-testable without WASM; this class is
 * the thin imperative shell that wires those into the ffmpeg engine.
 */
import { BaseConverter } from "@/application/base-converter";
import { ConversionFailedError } from "@/core/domain/errors";
import type { FileFormat } from "@/core/domain/format";
import type {
  ConversionCapability,
  ConvertInput,
  ConvertOutput,
  ConverterContext,
} from "@/core/ports/converter";
import {
  buildCapabilities,
  buildFfmpegArgs,
  ffmpegFileNames,
  resolveMediaOptions,
} from "./ffmpeg-args";
import type { ProgressEvent } from "@ffmpeg/ffmpeg";
import { getFfmpeg, loadFetchFile, runExclusiveMedia, terminateFfmpeg } from "./ffmpeg-engine";

export class MediaConverter extends BaseConverter {
  readonly id = "media-ffmpeg";
  readonly name = "Audio & Video (ffmpeg.wasm)";
  readonly capabilities: readonly ConversionCapability[] = buildCapabilities();

  async convert(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    this.throwIfAborted(ctx.signal);

    const source: FileFormat = input.source;
    const target: FileFormat = input.target;
    const options = resolveMediaOptions(input.options);
    const { inputName, outputName } = ffmpegFileNames(source, target);
    const args = buildFfmpegArgs(inputName, outputName, target.id, options);

    const log = ctx.logger.child({
      converter: this.id,
      source: source.id,
      target: target.id,
    });

    // Serialise against any other in-flight media conversion: the ffmpeg core
    // is a single shared instance on fixed filenames, so concurrent runs would
    // corrupt each other. Queued jobs that get aborted fail fast here.
    return runExclusiveMedia(() => {
      this.throwIfAborted(ctx.signal);
      return ctx.tracer.withSpan(
        "media.convert",
        async (span) => {
          span.setAttributes({
            "media.source": source.id,
            "media.target": target.id,
            "media.args": args.join(" "),
          });

          ctx.reportProgress({ ratio: 0, message: "Loading conversion engine…" });
          const ffmpeg = await getFfmpeg({
            onLoadStart: () => log.info("loading ffmpeg core"),
          });
          this.throwIfAborted(ctx.signal);

          const onProgress = ({ progress }: ProgressEvent): void => {
            if (typeof progress === "number" && Number.isFinite(progress)) {
              const ratio = Math.min(Math.max(progress, 0), 1);
              ctx.reportProgress({ ratio, message: "Transcoding…" });
            }
          };

          let aborted = false;
          const onAbort = (): void => {
            aborted = true;
            // ffmpeg.wasm can only cancel an in-flight exec by killing its worker.
            terminateFfmpeg();
          };
          ctx.signal.addEventListener("abort", onAbort, { once: true });
          ffmpeg.on("progress", onProgress);

          try {
            const fetchFile = await loadFetchFile();
            const bytes = await fetchFile(input.file);
            this.throwIfAborted(ctx.signal);

            await ffmpeg.writeFile(inputName, bytes);
            log.debug("wrote input to ffmpeg fs", { bytes: bytes.byteLength });

            ctx.reportProgress({ ratio: 0, message: "Transcoding…" });
            const exitCode = await ffmpeg.exec(args);
            if (aborted) {
              this.throwIfAborted(ctx.signal);
            }
            if (exitCode !== 0) {
              throw new ConversionFailedError(
                `ffmpeg exited with code ${exitCode} converting ${source.id} → ${target.id}.`,
                { context: { exitCode, args } },
              );
            }

            const data = await ffmpeg.readFile(outputName);
            const outputBytes = toUint8Array(data);
            if (outputBytes.byteLength === 0) {
              throw new ConversionFailedError(`ffmpeg produced an empty ${target.id} file.`, {
                context: { args },
              });
            }

            const blob = new Blob([toArrayBuffer(outputBytes)], {
              type: target.mimeTypes[0] ?? "application/octet-stream",
            });

            span.setAttribute("media.output_bytes", outputBytes.byteLength);
            ctx.reportProgress({ ratio: 1, message: "Done" });

            return {
              blob,
              attributes: {
                sourceBytes: input.file.size,
                outputBytes: outputBytes.byteLength,
                ffmpegArgs: args.join(" "),
              },
            };
          } catch (error) {
            if (error instanceof ConversionFailedError) throw error;
            // ConversionCanceledError (from throwIfAborted) should propagate as-is.
            if (isCanceled(error)) throw error;
            throw new ConversionFailedError(
              `Failed to convert ${source.id} → ${target.id}: ${describeError(error)}`,
              { cause: error, context: { args } },
            );
          } finally {
            ctx.signal.removeEventListener("abort", onAbort);
            // The instance may have been terminated on abort; guard cleanup.
            if (!aborted) {
              ffmpeg.off("progress", onProgress);
              await safeDelete(ffmpeg, inputName);
              await safeDelete(ffmpeg, outputName);
            }
          }
        },
        { attributes: { converter: this.id }, kind: "internal" },
      );
    });
  }
}

function isCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "CONVERSION_CANCELED"
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown error";
}

/** Narrows ffmpeg's `FileData` (Uint8Array | string) to bytes. */
function toUint8Array(data: Uint8Array | string): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  return data;
}

/** Produces a plain ArrayBuffer slice suitable for the Blob constructor. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function safeDelete(
  ffmpeg: { deleteFile: (path: string) => Promise<boolean> },
  path: string,
): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // File may not exist (e.g. exec failed before producing output).
  }
}
