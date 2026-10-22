import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { initials } from "@/lib/format";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "info" | "success"; children: ReactNode }) {
  const tones = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    info: "border-primary/30 bg-primary-soft text-text",
    success: "border-resolved/30 bg-resolved-soft text-resolved",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-lg border px-4 py-3 text-sm font-bold", tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-xl border border-primary/15 bg-primary-soft text-primary">{icon}</div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-muted">{children}</div>}
    </div>
  );
}

export function AccentRule({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("mt-3 block h-0.5 w-14 rounded-full bg-gold", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance md:text-[1.75rem]">{title}</h1>
        <AccentRule />
        {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={clsx("grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary", className)}>
      {initials(name)}
    </span>
  );
}
