import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";
import { withBase } from "../lib/utils";

/**
 * An on/off switch. Label it: wrap it in a <label>, or pass `aria-label` or
 * `aria-labelledby`.
 */
export function Switch({
  className,
  ...props
}: ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      className={withBase(
        "bg-input data-[checked]:bg-primary relative inline-flex h-8 w-14 shrink-0 cursor-pointer touch-manipulation items-center rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="bg-foreground data-[checked]:bg-primary-foreground block size-6 rounded-full shadow-sm transition-transform data-[checked]:translate-x-6 motion-reduce:transition-none" />
    </BaseSwitch.Root>
  );
}
