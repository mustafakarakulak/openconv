"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/provider";
import { UploadIcon } from "./icons";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

export function Dropzone({ onFiles }: DropzoneProps) {
  const { dict } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={dict.dropzone.aria}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={handleDrop}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors outline-none",
        "border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/70",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40",
        dragging && "border-accent bg-accent/10",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-colors",
          "bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700",
          dragging && "bg-accent text-accent-foreground",
        )}
      >
        <UploadIcon />
      </span>
      <div className="space-y-1">
        <p className="text-base font-medium text-zinc-100">
          {dragging ? dict.dropzone.active : dict.dropzone.idle}
        </p>
        <p className="text-sm text-zinc-500">{dict.dropzone.hint}</p>
      </div>
    </div>
  );
}
