"use client";

/**
 * Owns the conversion job list and drives the engine. Keeps an immutable job
 * array via a reducer and tracks per-job AbortControllers for cancellation.
 */
import { useCallback, useReducer, useRef } from "react";
import type { ConversionOptions, InputFile } from "@/core/domain/conversion";
import { detectFormat, type FormatId } from "@/core/domain/format";
import { ConversionCanceledError, isOpenConvError, toErrorMessage } from "@/core/domain/errors";
import { resolveOptions } from "@/application/resolve-options";
import { createId } from "@/lib/id";
import { useConversionContext } from "@/ui/providers/conversion-provider";
import type { JobError, UiJob } from "@/ui/types";

type Action =
  | { type: "add"; jobs: UiJob[] }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "setTarget"; id: string; targetId: FormatId; options: ConversionOptions }
  | { type: "setOption"; id: string; key: string; value: string | number | boolean }
  | { type: "running"; id: string }
  | { type: "progress"; id: string; progress: UiJob["progress"] }
  | { type: "success"; id: string; result: NonNullable<UiJob["result"]> }
  | { type: "failure"; id: string; error: JobError }
  | { type: "canceled"; id: string };

function patch(jobs: UiJob[], id: string, change: Partial<UiJob>): UiJob[] {
  return jobs.map((job) => (job.id === id ? { ...job, ...change } : job));
}

function reducer(jobs: UiJob[], action: Action): UiJob[] {
  switch (action.type) {
    case "add":
      return [...jobs, ...action.jobs];
    case "remove":
      return jobs.filter((job) => job.id !== action.id);
    case "clear":
      return jobs.filter((job) => job.status === "running");
    case "setTarget":
      return patch(jobs, action.id, {
        targetId: action.targetId,
        options: action.options,
        status: "pending",
        result: null,
        error: null,
        progress: null,
      });
    case "setOption":
      return jobs.map((job) =>
        job.id === action.id
          ? { ...job, options: { ...job.options, [action.key]: action.value } }
          : job,
      );
    case "running":
      return patch(jobs, action.id, {
        status: "running",
        error: null,
        result: null,
        progress: null,
      });
    case "progress":
      return patch(jobs, action.id, { progress: action.progress });
    case "success":
      return patch(jobs, action.id, {
        status: "succeeded",
        result: action.result,
        progress: null,
      });
    case "failure":
      return patch(jobs, action.id, { status: "failed", error: action.error, progress: null });
    case "canceled":
      return patch(jobs, action.id, { status: "canceled", progress: null });
    default:
      return jobs;
  }
}

export function useConversions() {
  const { engine, registry, logger } = useConversionContext();
  const [jobs, dispatch] = useReducer(reducer, []);
  const jobsRef = useRef<UiJob[]>(jobs);
  jobsRef.current = jobs;
  const controllers = useRef(new Map<string, AbortController>());

  /** Picks the default target + resolved options for a source format. */
  const defaultsFor = useCallback(
    (sourceId: FormatId | undefined): { targetId: FormatId | null; options: ConversionOptions } => {
      if (!sourceId) return { targetId: null, options: {} };
      const target = registry.targetsFor(sourceId)[0];
      if (!target) return { targetId: null, options: {} };
      const capability = registry.getCapability(sourceId, target.id);
      return { targetId: target.id, options: resolveOptions(capability, {}) };
    },
    [registry],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const newJobs: UiJob[] = [];
      for (const file of files) {
        const sourceFormat = detectFormat({ name: file.name, type: file.type }) ?? null;
        const { targetId, options } = defaultsFor(sourceFormat?.id);
        newJobs.push({
          id: createId(),
          file,
          name: file.name,
          size: file.size,
          sourceFormat,
          targetId,
          options,
          status: "pending",
          progress: null,
          result: null,
          error: null,
        });
      }
      if (newJobs.length > 0) {
        logger.info("ui.files_added", { "openconv.files": newJobs.length });
        dispatch({ type: "add", jobs: newJobs });
      }
    },
    [defaultsFor, logger],
  );

  const setTarget = useCallback(
    (id: string, targetId: FormatId) => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job?.sourceFormat) return;
      const capability = registry.getCapability(job.sourceFormat.id, targetId);
      dispatch({ type: "setTarget", id, targetId, options: resolveOptions(capability, {}) });
    },
    [registry],
  );

  const setOption = useCallback(
    (id: string, key: string, value: string | number | boolean) => {
      dispatch({ type: "setOption", id, key, value });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    dispatch({ type: "remove", id });
  }, []);

  const clearFinished = useCallback(() => dispatch({ type: "clear" }), []);

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
  }, []);

  const start = useCallback(
    async (id: string): Promise<void> => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job || !job.sourceFormat || !job.targetId || job.status === "running") return;
      const target = registry.getFormat(job.targetId);
      if (!target) return;

      const controller = new AbortController();
      controllers.current.set(id, controller);
      dispatch({ type: "running", id });

      const input: InputFile = {
        id: job.id,
        name: job.name,
        size: job.size,
        format: job.sourceFormat,
        data: job.file,
      };

      try {
        const result = await engine.convert(
          { jobId: id, input, target, options: job.options },
          {
            signal: controller.signal,
            onProgress: (progress) => dispatch({ type: "progress", id, progress }),
          },
        );
        dispatch({ type: "success", id, result });
      } catch (error) {
        if (error instanceof ConversionCanceledError || controller.signal.aborted) {
          dispatch({ type: "canceled", id });
        } else {
          dispatch({
            type: "failure",
            id,
            error: {
              message: toErrorMessage(error),
              ...(isOpenConvError(error) ? { code: error.code } : {}),
            },
          });
        }
      } finally {
        controllers.current.delete(id);
      }
    },
    [engine, registry],
  );

  /** Runs every convertible, not-yet-succeeded job sequentially. */
  const startAll = useCallback(async (): Promise<void> => {
    const pending = jobsRef.current.filter(
      (job) =>
        job.sourceFormat &&
        job.targetId &&
        (job.status === "pending" || job.status === "failed" || job.status === "canceled"),
    );
    for (const job of pending) {
      await start(job.id);
    }
  }, [start]);

  return {
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
  };
}
