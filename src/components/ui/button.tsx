import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-card hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-text shadow-card hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
};

// Every size keeps at least a 44px touch target except `sm`, used only in dense desktop tables.
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4",
  lg: "min-h-12 px-5 text-base",
};

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return clsx(
    // active:scale is the "push" feedback; transform-only so it stays cheap.
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
