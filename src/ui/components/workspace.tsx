"use client";

import { useMemo } from "react";
import { useConversions } from "@/ui/hooks/use-conversions";
import { useI18n } from "@/i18n/provider";
import { interpolate } from "@/i18n/helpers";
import { Dropzone } from "./dropzone";
import { JobItem } from "./job-item";

const FINISHED = new Set(["succeeded", "failed", "canceled"]);

export function Workspace() {
  const { dict } = useI18n();
  const {
    jobs,
    addFiles,
    setTarget,
    setOption,
    remove,
    clearFinished,
    cancel,
    start,
    startAll,
    registry,
  } = useConversions();

  const { convertibleCount, hasFinished } = useMemo(() => {
    let convertibleCount = 0;
    let hasFinished = false;
    for (const job of jobs) {
      if (
        job.sourceFormat &&
        job.targetId &&
        job.status !== "running" &&
        job.status !== "succeeded"
      ) {
        convertibleCount += 1;
      }
      if (FINISHED.has(job.status)) hasFinished = true;
    }
    return { convertibleCount, hasFinished };
  }, [jobs]);

  return (
    <section className="space-y-5">
      <Dropzone onFiles={addFiles} />

      {jobs.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              {interpolate(jobs.length === 1 ? dict.workspace.fileOne : dict.workspace.fileMany, {
                count: jobs.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearFinished}
                disabled={!hasFinished}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dict.workspace.clearFinished}
              </button>
              <button
                type="button"
                onClick={() => void startAll()}
                disabled={convertibleCount === 0}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dict.workspace.convertAll}
                {convertibleCount > 0 ? ` (${convertibleCount})` : ""}
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {jobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                registry={registry}
                onSetTarget={setTarget}
                onSetOption={setOption}
                onStart={(id) => void start(id)}
                onCancel={cancel}
                onRemove={remove}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
