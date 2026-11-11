import { useId, type ReactNode } from "react";
import { cn, Switch } from "@zbeul/ui";

/**
 * One choice among a few, as big touch targets: native radio buttons, so
 * arrow keys and screen readers work as usual.
 */
export function Choice<Value extends string | number>({
  label,
  name,
  value,
  options,
  onChange,
  className,
}: {
  /** What is being chosen, for screen readers. */
  label: string;
  /** Unique on the page. */
  name: string;
  value: Value;
  options: readonly { value: Value; label: ReactNode; hint?: string }[];
  onChange: (value: Value) => void;
  className?: string;
}) {
  return (
    <fieldset
      className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={String(option.value)}
          className="bg-secondary text-secondary-foreground has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-primary has-focus-visible:ring-ring has-focus-visible:ring-offset-background flex min-h-12 cursor-pointer touch-manipulation flex-col items-center justify-center rounded-md border px-2 py-2 text-center text-sm font-semibold transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-offset-2"
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
          {option.hint && (
            <span className="text-xs font-normal">{option.hint}</span>
          )}
        </label>
      ))}
    </fieldset>
  );
}

/** A switch with its label and an explanation, on one row. */
export function ToggleRow({
  title,
  hint,
  checked,
  onCheckedChange,
}: {
  title: string;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    // The whole row is the touch target; the switch carries the name.
    <label className="bg-card flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4">
      <span>
        <span id={`${id}-title`} className="block font-semibold">
          {title}
        </span>
        {hint && (
          <span
            id={`${id}-hint`}
            className="text-muted-foreground block text-sm"
          >
            {hint}
          </span>
        )}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={`${id}-title`}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </label>
  );
}
