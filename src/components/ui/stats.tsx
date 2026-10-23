import clsx from "clsx";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/misc";

// Icon badge + top edge colours. Semantic: each matches the meaning used elsewhere (open, overdue, resolved…).
const ACCENTS = {
  open: { chip: "bg-open-soft text-open", edge: "border-t-open" },
  progress: { chip: "bg-progress-soft text-progress", edge: "border-t-progress" },
  resolved: { chip: "bg-resolved-soft text-resolved", edge: "border-t-resolved" },
  warn: { chip: "bg-warn-soft text-warn", edge: "border-t-warn" },
  danger: { chip: "bg-danger-soft text-danger", edge: "border-t-danger" },
  primary: { chip: "bg-primary-soft text-primary", edge: "border-t-primary" },
  gold: { chip: "bg-note-bg text-gold-text", edge: "border-t-gold" },
} as const;

export type StatAccent = keyof typeof ACCENTS;

export function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
  href,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "danger" | "warn";
  href?: string;
  accent?: StatAccent;
}) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-sm font-bold text-muted [&_svg]:size-4">
        {accent ? <span className={clsx("grid size-7 place-items-center rounded-full", ACCENTS[accent].chip)}>{icon}</span> : icon}
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </>
  );
  const edge = accent && clsx("border-t-4", ACCENTS[accent].edge);
  return href ? (
    <a
      href={href}
      className={clsx("rounded-xl border border-border bg-surface p-4 shadow-card", accent ? "transition-shadow hover:shadow-raised" : "transition-colors hover:border-primary/40", edge)}
    >
      {body}
    </a>
  ) : (
    <Card className={clsx("p-4", edge)}>{body}</Card>
  );
}

export function Breakdown({ title, rows, empty = "No tickets in this range." }: { title: string; rows: { label: string; count: number }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-3 font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="h-2.5 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right font-bold tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
