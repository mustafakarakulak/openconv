"use client";

import type { ConversionOptions } from "@/core/domain/conversion";
import type { ConverterOptionDescriptor } from "@/core/ports/converter";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/provider";
import { pick } from "@/i18n/helpers";

interface OptionControlsProps {
  descriptors: readonly ConverterOptionDescriptor[];
  options: ConversionOptions;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}

export function OptionControls({ descriptors, options, onChange, disabled }: OptionControlsProps) {
  if (descriptors.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {descriptors.map((descriptor) => (
        <Control
          key={descriptor.key}
          descriptor={descriptor}
          value={options[descriptor.key]}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function Control({
  descriptor,
  value,
  onChange,
  disabled,
}: {
  descriptor: ConverterOptionDescriptor;
  value: string | number | boolean | undefined;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  const { dict } = useI18n();
  const labelClass = "text-xs font-medium text-zinc-400";
  // Option label/unit/choice translations are keyed by the descriptor's stable
  // `key`/`unit`/choice `value`; the English copy carried by the descriptor is
  // the fallback, so the converters need no i18n awareness.
  const label = pick(dict.options, descriptor.key, descriptor.label);

  if (descriptor.kind === "number") {
    const current = typeof value === "number" ? value : descriptor.default;
    const hasRange = descriptor.min !== undefined && descriptor.max !== undefined;
    const unit = descriptor.unit ? pick(dict.units, descriptor.unit, descriptor.unit) : "";
    return (
      <label className="flex items-center gap-2">
        <span className={labelClass}>{label}</span>
        {hasRange && (
          <input
            type="range"
            min={descriptor.min}
            max={descriptor.max}
            step={descriptor.step ?? 1}
            value={current}
            disabled={disabled}
            onChange={(e) => onChange(descriptor.key, Number(e.target.value))}
            className="h-1 w-28 cursor-pointer accent-[var(--color-accent)] disabled:opacity-50"
          />
        )}
        <span className="min-w-[3.5rem] font-mono text-xs text-zinc-300">
          {current}
          {unit ? ` ${unit}` : ""}
        </span>
      </label>
    );
  }

  if (descriptor.kind === "boolean") {
    const current = typeof value === "boolean" ? value : descriptor.default;
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={current}
          disabled={disabled}
          onChange={(e) => onChange(descriptor.key, e.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-[var(--color-accent)] disabled:opacity-50"
        />
        <span className={labelClass}>{label}</span>
      </label>
    );
  }

  // select
  const current = typeof value === "string" ? value : descriptor.default;
  return (
    <label className="flex items-center gap-2">
      <span className={labelClass}>{label}</span>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(descriptor.key, e.target.value)}
        className={cn(
          "rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100",
          "focus:border-accent focus:outline-none disabled:opacity-50",
        )}
      >
        {descriptor.choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {pick(dict.choices, choice.value, choice.label)}
          </option>
        ))}
      </select>
    </label>
  );
}
