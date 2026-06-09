/**
 * Canvas-backed image converter.
 *
 * Decodes any supported raster/vector source into an in-memory bitmap and
 * re-encodes it as PNG, JPEG or WebP using `OffscreenCanvas.convertToBlob`
 * (preferred) or an `HTMLCanvasElement.toBlob` fallback. Runs entirely in the
 * browser; no bytes ever leave the device.
 *
 * The pure decision logic lives in `./helpers`; this file owns only the
 * browser-API orchestration, which cannot run under happy-dom and is therefore
 * exercised only at runtime.
 */
import { BaseConverter } from "@/application/base-converter";
import { ConversionFailedError, InvalidInputError } from "@/core/domain/errors";
import { FORMATS } from "@/core/domain/format";
import type { Attributes } from "@/core/ports/observability";
import type {
  ConversionCapability,
  ConvertInput,
  ConvertOutput,
  ConverterContext,
} from "@/core/ports/converter";
import {
  buildCapabilities,
  FALLBACK_MIME,
  resolveEncodeOptions,
  type ResolvedEncodeOptions,
} from "./helpers";

/** A decoded raster source ready to be drawn onto a canvas. */
interface DecodedImage {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  /** Releases any retained resources (e.g. ImageBitmap / object URL). */
  close(): void;
}

export class ImageCanvasConverter extends BaseConverter {
  readonly id = "image-canvas";
  readonly name = "Image (Canvas)";
  readonly capabilities: readonly ConversionCapability[] = buildCapabilities();

  async convert(input: ConvertInput, context: ConverterContext): Promise<ConvertOutput> {
    const { signal, tracer, logger } = context;
    this.throwIfAborted(signal);

    if (input.file.size === 0) {
      throw new InvalidInputError("Cannot convert an empty image file.", {
        context: { source: input.source.id, target: input.target.id },
      });
    }

    const encode = resolveEncodeOptions(input.target, input.options);
    logger.debug("Resolved image encode options", {
      source: input.source.id,
      target: input.target.id,
      mimeType: encode.mimeType,
      quality: encode.quality,
      flatten: encode.flatten,
    });

    context.reportProgress({ ratio: 0, message: "Decoding image" });

    const decoded = await tracer.withSpan(
      "image.decode",
      async (span) => {
        const result = await this.decode(input, signal);
        span.setAttributes({
          "image.width": result.width,
          "image.height": result.height,
          source: input.source.id,
        });
        return result;
      },
      { attributes: { source: input.source.id } },
    );

    try {
      this.throwIfAborted(signal);
      context.reportProgress({ ratio: 0.5, message: "Encoding image" });

      const blob = await tracer.withSpan(
        "image.encode",
        async (span) => {
          const out = await this.encode(decoded, encode, signal);
          span.setAttributes({ target: input.target.id, mimeType: encode.mimeType });
          return out;
        },
        { attributes: { target: input.target.id } },
      );

      context.reportProgress({ ratio: 1, message: "Done" });

      const attributes: Attributes = {
        width: decoded.width,
        height: decoded.height,
      };
      return { blob, attributes };
    } finally {
      decoded.close();
    }
  }

  /**
   * Decodes the source blob into a drawable bitmap. Prefers
   * `createImageBitmap`; rasterises SVG through an <img> element; and falls
   * back to an <img> element for any source the bitmap path rejects.
   */
  private async decode(input: ConvertInput, signal: AbortSignal): Promise<DecodedImage> {
    this.throwIfAborted(signal);

    if (input.source.id === FORMATS.svg.id) {
      return this.decodeViaImageElement(input.file, signal);
    }

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(input.file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close(),
        };
      } catch {
        // Fall through to the element-based decoder for codecs the platform's
        // ImageBitmap path cannot handle.
      }
    }

    return this.decodeViaImageElement(input.file, signal);
  }

  /** Loads a blob into an <img> element via an object URL and draws from it. */
  private decodeViaImageElement(file: Blob, signal: AbortSignal): Promise<DecodedImage> {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      throw new ConversionFailedError("This environment cannot decode images via <img>.");
    }
    const url = URL.createObjectURL(file);
    const image = new Image();

    return new Promise<DecodedImage>((resolve, reject) => {
      const onAbort = () => {
        cleanup();
        reject(new ConversionFailedError("Image decode aborted."));
      };
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
        image.onload = null;
        image.onerror = null;
      };

      image.onload = () => {
        signal.removeEventListener("abort", onAbort);
        image.onload = null;
        image.onerror = null;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (width === 0 || height === 0) {
          URL.revokeObjectURL(url);
          reject(new InvalidInputError("Decoded image has zero dimensions."));
          return;
        }
        resolve({
          source: image,
          width,
          height,
          close: () => URL.revokeObjectURL(url),
        });
      };
      image.onerror = () => {
        cleanup();
        URL.revokeObjectURL(url);
        reject(new ConversionFailedError("Failed to decode the source image."));
      };

      if (signal.aborted) {
        onAbort();
        URL.revokeObjectURL(url);
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      image.src = url;
    });
  }

  /** Draws the decoded image and encodes it to the resolved target format. */
  private async encode(
    decoded: DecodedImage,
    encode: ResolvedEncodeOptions,
    signal: AbortSignal,
  ): Promise<Blob> {
    this.throwIfAborted(signal);
    const { width, height } = decoded;

    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new ConversionFailedError("Failed to acquire a 2D OffscreenCanvas context.");
      }
      this.paint(ctx, decoded, encode);
      const blob = await canvas.convertToBlob(
        encode.quality !== undefined
          ? { type: encode.mimeType, quality: encode.quality }
          : { type: encode.mimeType },
      );
      return this.retypeBlob(blob, encode.mimeType);
    }

    return this.encodeViaHtmlCanvas(decoded, encode);
  }

  /** Fallback encode path using a detached `<canvas>` and `toBlob`. */
  private encodeViaHtmlCanvas(decoded: DecodedImage, encode: ResolvedEncodeOptions): Promise<Blob> {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      throw new ConversionFailedError("No canvas encoder is available in this environment.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ConversionFailedError("Failed to acquire a 2D canvas context.");
    }
    this.paint(ctx, decoded, encode);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new ConversionFailedError("Canvas failed to encode the image."));
            return;
          }
          resolve(this.retypeBlob(blob, encode.mimeType));
        },
        encode.mimeType,
        encode.quality,
      );
    });
  }

  /**
   * Paints the decoded source onto the context, first flattening transparency
   * onto the chosen background when the target cannot store alpha.
   */
  private paint(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    decoded: DecodedImage,
    encode: ResolvedEncodeOptions,
  ): void {
    if (encode.flatten) {
      ctx.fillStyle = encode.background;
      ctx.fillRect(0, 0, decoded.width, decoded.height);
    }
    ctx.drawImage(decoded.source, 0, 0);
  }

  /** Guarantees the returned blob carries the exact target MIME type. */
  private retypeBlob(blob: Blob, mimeType: string): Blob {
    const type = mimeType || FALLBACK_MIME;
    if (blob.type === type) return blob;
    return new Blob([blob], { type });
  }
}
