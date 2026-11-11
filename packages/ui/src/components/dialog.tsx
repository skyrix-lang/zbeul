import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { cn, withBase } from "../lib/utils";

// A modal dialog: focus is trapped inside, Escape and the backdrop close it,
// and screen readers announce its title and description.

export function Dialog({
  children,
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Root> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Root {...props}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "bg-card text-card-foreground fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-6 shadow-xl transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100",
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={withBase("font-display text-2xl font-extrabold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={withBase("text-muted-foreground mt-2", className)}
      {...props}
    />
  );
}

/** The dialog's buttons, stacked on a phone. */
export function DialogActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/** Closes the dialog. Style it with `render={<Button … />}`. */
export const DialogClose = BaseDialog.Close;
