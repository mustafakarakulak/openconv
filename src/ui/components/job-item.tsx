"use client";

import { useMemo } from "react";
import type { ConverterRegistry } from "@/application/converter-registry";
import type { FormatId } from "@/core/domain/format";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/bytes";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/provider";
import { interpolate, pick } from "@/i18n/helpers";
import type { UiJob } from "@/ui/types";
import { FormatSelect } from "./format-select";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  KindIcon,
  SpinnerIcon,
  TrashIcon,
} from "./icons";
import { OptionControls } from "./option-controls";

interface JobItemProps {
  job: UiJob;
  registry: ConverterRegistry;
  onSetTarget: (id: string, targetId: FormatId) => void;
  onSetOption: (id: string, key: string, value: string | number | boolean) => void;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

export function JobItem({
  job,
  registry,
  onSetTarget,
  onSetOption,
  onStart,
  onCancel,
  onRemove,
}: JobItemProps) {
  const { dict } = useI18n();
  const targets = useMemo(
    () => (job.sourceFormat ? registry.targetsFor(job.sourceFormat.id) : []),
    [registry, job.sourceFormat],
  );
  const capability = useMemo(
    () =>
      job.sourceFormat && job.targetId
        ? registry.getCapability(job.sourceFormat.id, job.targetId)
        : undefined,
    [registry, job.sourceFormat, job.targetId],
  );

  const unsupported = !job.sourceFormat || targets.length === 0;
  const isRunning = job.status === "running";
  const isDone = job.status === "succeeded";
  const controlsDisabled = isRunning;

  // Notes are keyed by "<source>_<target>"; the English note is the fallback.
  const note =
    capability?.note && job.sourceFormat && job.targetId
      ? pick(dict.notes, `${job.sourceFormat.id}_${job.targetId}`, capability.note)
      : undefined;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg text-zinc-300">
          <KindIcon kind={job.sourceFormat?.kind} />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100" title={job.name}>
                {job.name}
              </p>
              <p className="text-xs text-zinc-500">
                {job.sourceFormat ? job.sourceFormat.label : dict.job.unknownFormat} ·{" "}
                {formatBytes(job.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(job.id)}
              aria-label={dict.job.remove}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <TrashIcon className="text-base" />
            </button>
          </div>

          {unsupported ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <AlertIcon className="text-sm" />
              {dict.job.unsupported}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300">
                  {job.sourceFormat?.label}
                </span>
                <ArrowRightIcon className="text-sm text-zinc-600 rtl:-scale-x-100" />
                <FormatSelect
                  value={job.targetId}
                  formats={targets}
                  onChange={(targetId) => onSetTarget(job.id, targetId)}
                  disabled={controlsDisabled}
                />
              </div>

              {capability?.options && capability.options.length > 0 && (
                <OptionControls
                  descriptors={capability.options}
                  options={job.options}
                  onChange={(key, value) => onSetOption(job.id, key, value)}
                  disabled={controlsDisabled}
                />
              )}

              {note && <p className="text-xs text-zinc-500">{note}</p>}

              <JobStatus job={job} />
            </>
          )}
        </div>

        {!unsupported && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isDone && job.result ? (
              <button
                type="button"
                onClick={() => downloadBlob(job.result!.output.blob, job.result!.output.name)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                <DownloadIcon className="text-base" />
                {dict.job.download}
              </button>
            ) : isRunning ? (
              <button
                type="button"
                onClick={() => onCancel(job.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                <CloseIcon className="text-base" />
                {dict.job.cancel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStart(job.id)}
                disabled={!job.targetId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dict.job.convert}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function JobStatus({ job }: { job: UiJob }) {
  const { dict } = useI18n();

  if (job.status === "running") {
    const ratio = job.progress?.ratio;
    const pct = typeof ratio === "number" ? Math.round(Math.min(1, Math.max(0, ratio)) * 100) : null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <SpinnerIcon className="text-sm" />
          <span>{job.progress?.message ?? dict.job.converting}</span>
          {pct !== null && <span className="ms-auto font-mono text-zinc-300">{pct}%</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full rounded-full bg-accent transition-[width] duration-300",
              pct === null && "w-1/3 animate-pulse",
            )}
            style={pct !== null ? { width: `${pct}%` } : undefined}
          />
        </div>
      </div>
    );
  }

  if (job.status === "succeeded" && job.result) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-400">
        <CheckIcon className="text-sm" />
        {interpolate(dict.job.doneIn, { ms: Math.round(job.result.durationMs) })} ·{" "}
        {formatBytes(job.result.output.size)}
        <span className="font-mono text-[10px] text-zinc-600">
          {dict.job.trace} {job.result.traceId.slice(0, 12)}
        </span>
      </p>
    );
  }

  if (job.status === "failed" && job.error) {
    return (
      <p className="flex items-center gap-2 text-xs text-red-400">
        <AlertIcon className="text-sm" />
        {pick(dict.errors, job.error.code ?? "", job.error.message)}
      </p>
    );
  }

  if (job.status === "canceled") {
    return <p className="text-xs text-zinc-500">{dict.job.canceled}</p>;
  }

  return null;
}
