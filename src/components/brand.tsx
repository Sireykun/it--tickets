import clsx from "clsx";
import { LifeBuoy } from "lucide-react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("grid size-9 place-items-center rounded-lg bg-primary text-primary-fg shadow-card", className)}>
      <LifeBuoy className="size-5" strokeWidth={2.2} />
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="leading-tight">
        <span className="block font-bold tracking-tight">CIA IT Helpdesk</span>
        {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
