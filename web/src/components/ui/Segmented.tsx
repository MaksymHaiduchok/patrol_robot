export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedProps<T extends string> = {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  strong?: boolean;
  disabled?: boolean;
};

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  strong = false,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid grid-cols-2 rounded-md border border-border bg-bg p-[3px] ${disabled ? "opacity-45" : ""}`}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const activeClasses = strong ? "bg-accent text-accent-on" : "bg-border-strong text-text";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`h-[34px] rounded-sm text-body ${
              checked ? `${activeClasses} font-semibold` : "font-medium text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
