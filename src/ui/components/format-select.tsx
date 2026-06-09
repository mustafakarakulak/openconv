"use client";

import { useMemo } from "react";
import type { FileFormat, FormatId, MediaKind } from "@/core/domain/format";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/provider";

const KIND_ORDER: readonly MediaKind[] = ["image", "data", "document", "audio", "video"];

interface FormatSelectProps {
  id?: string;
  value: FormatId | null;
  formats: readonly FileFormat[];
  onChange: (formatId: FormatId) => void;
  disabled?: boolean;
  className?: string;
}

export function FormatSelect({
  id,
  value,
  formats,
  onChange,
  disabled,
  className,
}: FormatSelectProps) {
  const { dict } = useI18n();

  const grouped = useMemo(() => {
    const byKind = new Map<MediaKind, FileFormat[]>();
    for (const format of formats) {
      const list = byKind.get(format.kind) ?? [];
      list.push(format);
      byKind.set(format.kind, list);
    }
    return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
      kind,
      formats: (byKind.get(kind) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [formats]);

  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled || formats.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 transition-colors",
        "hover:border-zinc-600 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {formats.length === 0 && <option value="">{dict.formatSelect.none}</option>}
      {grouped.map((group) => (
        <optgroup key={group.kind} label={dict.kinds[group.kind]}>
          {group.formats.map((format) => (
            <option key={format.id} value={format.id}>
              {format.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
