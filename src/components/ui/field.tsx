import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 text-base text-text shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-muted/60 focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/25 disabled:opacity-60";

export function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("grid content-start gap-2", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

// text-base (16px) on inputs stops iOS Safari from zooming in on focus.
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(control, "min-h-11 py-2", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(control, "min-h-32 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(control, "min-h-11 appearance-auto py-2", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={clsx("flex min-h-11 cursor-pointer items-center gap-3", className)}>
      <input type="checkbox" className="size-5 rounded accent-primary" {...props} />
      <span>{label}</span>
    </label>
  );
}
