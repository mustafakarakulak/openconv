/**
 * DATA converter: structured-data interchange between json, yaml, toml, xml and
 * the tabular csv/tsv formats — entirely in the browser.
 *
 * Implemented as a single {@link BaseConverter} whose capability matrix is
 * derived from the pipeline's supported pairs, so the declared capabilities and
 * the runtime behaviour are guaranteed consistent.
 */
import { BaseConverter } from "@/application/base-converter";
import { FORMATS, type FileFormat, type FormatId } from "@/core/domain/format";
import { ConversionFailedError, InvalidInputError } from "@/core/domain/errors";
import type {
  ConversionCapability,
  ConverterOptionDescriptor,
  ConvertInput,
  ConvertOutput,
  ConverterContext,
} from "@/core/ports/converter";

import {
  buildSupportedPairs,
  type DataFormatId,
  type PipelineOptions,
  runPipeline,
} from "./pipeline";
import { clampIndent } from "./serialization";

/** Indent option (json/xml targets). */
export const INDENT_OPTION = {
  kind: "number",
  key: "indent",
  label: "Indent",
  default: 2,
  min: 0,
  max: 8,
  step: 1,
  unit: "spaces",
} as const satisfies ConverterOptionDescriptor;

/** Header option (csv/tsv targets). */
export const HEADER_OPTION = {
  kind: "boolean",
  key: "header",
  label: "Include header row",
  default: true,
} as const satisfies ConverterOptionDescriptor;

/** Maps a DATA format id to its shared {@link FileFormat} catalog entry. */
const FORMAT_BY_ID: Record<DataFormatId, FileFormat> = {
  json: FORMATS.json,
  yaml: FORMATS.yaml,
  toml: FORMATS.toml,
  xml: FORMATS.xml,
  csv: FORMATS.csv,
  tsv: FORMATS.tsv,
};

const TARGETS_WITH_INDENT = new Set<DataFormatId>(["json", "xml"]);
const TARGETS_WITH_HEADER = new Set<DataFormatId>(["csv", "tsv"]);

/** Returns the option descriptors that apply to a given target format. */
export function optionsForTarget(
  target: DataFormatId,
): readonly ConverterOptionDescriptor[] | undefined {
  if (TARGETS_WITH_INDENT.has(target)) return [INDENT_OPTION];
  if (TARGETS_WITH_HEADER.has(target)) return [HEADER_OPTION];
  return undefined;
}

/** Builds the declarative capability matrix from the pipeline's supported pairs. */
export function buildCapabilities(): ConversionCapability[] {
  return buildSupportedPairs().map(({ source, target }) => {
    const options = optionsForTarget(target);
    const capability: ConversionCapability = {
      source: FORMAT_BY_ID[source],
      target: FORMAT_BY_ID[target],
      ...(options ? { options } : {}),
    };
    return capability;
  });
}

/** Narrow an arbitrary FormatId to a DataFormatId, or undefined if unknown. */
export function asDataFormat(id: FormatId): DataFormatId | undefined {
  switch (id) {
    case "json":
    case "yaml":
    case "toml":
    case "xml":
    case "csv":
    case "tsv":
      return id;
    default:
      return undefined;
  }
}

export class DataConverter extends BaseConverter {
  readonly id = "data-structured";
  readonly name = "Structured Data Converter";
  readonly capabilities: readonly ConversionCapability[] = buildCapabilities();

  /** Resolves UI option values into the strongly-typed pipeline options. */
  resolveOptions(input: ConvertInput): PipelineOptions {
    const indent = clampIndent(this.numberOption(input.options, "indent", INDENT_OPTION.default));
    const header = this.booleanOption(input.options, "header", HEADER_OPTION.default);
    return { indent, header };
  }

  override async convert(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    return ctx.tracer.withSpan(
      "data.convert",
      async (span) => {
        this.throwIfAborted(ctx.signal);

        const source = asDataFormat(input.source.id);
        const target = asDataFormat(input.target.id);
        if (!source || !target) {
          throw new InvalidInputError(
            `Unsupported data conversion: ${input.source.id} → ${input.target.id}.`,
          );
        }

        const options = this.resolveOptions(input);
        span.setAttributes({
          "data.source": source,
          "data.target": target,
          "data.indent": options.indent,
          "data.header": options.header,
        });

        ctx.reportProgress({ ratio: 0, message: `Reading ${input.source.label}…` });
        const text = await input.file.text();
        ctx.logger.debug("Read source text", { bytes: text.length });

        this.throwIfAborted(ctx.signal);
        ctx.reportProgress({ ratio: 0.4, message: `Parsing ${input.source.label}…` });

        let output: string;
        try {
          output = runPipeline(source, target, text, options);
        } catch (cause) {
          // Domain errors (InvalidInput / ConversionFailed) already carry intent.
          if (cause instanceof InvalidInputError || cause instanceof ConversionFailedError) {
            ctx.logger.warn("Data conversion failed", {
              source,
              target,
              code: cause.code,
            });
            throw cause;
          }
          throw new ConversionFailedError(
            `Failed to convert ${input.source.label} to ${input.target.label}.`,
            { cause },
          );
        }

        this.throwIfAborted(ctx.signal);
        ctx.reportProgress({ ratio: 0.9, message: `Writing ${input.target.label}…` });

        const mime = input.target.mimeTypes[0] ?? "application/octet-stream";
        const blob = new Blob([output], { type: mime });

        span.setAttribute("data.outputBytes", blob.size);
        ctx.reportProgress({ ratio: 1, message: "Done" });
        ctx.logger.info("Data conversion complete", {
          source,
          target,
          outputBytes: blob.size,
        });

        return {
          blob,
          attributes: {
            source,
            target,
            outputBytes: blob.size,
          },
        };
      },
      { attributes: { converter: this.id }, kind: "internal" },
    );
  }
}
