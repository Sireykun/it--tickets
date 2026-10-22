"use client";

import { useState } from "react";

type Day = { day: string; created: number; resolved: number };

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const formatDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

// Paired bars per day on one shared axis, with a hover readout; the table view carries the numbers for keyboard and screen-reader users.
export function DailyChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => Math.max(d.created, d.resolved)));
  const shown = active === null ? null : days[active];
  const tickEvery = Math.ceil(days.length / 6);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-primary" aria-hidden /> New
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-resolved" aria-hidden /> Resolved
        </span>
        <span className="ml-auto min-h-5 text-muted tabular-nums" aria-live="polite">
          {shown ? `${formatDay(shown.day)}: ${shown.created} new, ${shown.resolved} resolved` : `Peak ${max} per day`}
        </span>
      </div>

      <div className="relative h-44 border-b border-border" onMouseLeave={() => setActive(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" aria-hidden />
        <div className="flex h-full items-end gap-px" role="img" aria-label="Bar chart of new and resolved tickets per day; the table below has the numbers.">
          {days.map((d, i) => (
            <div
              key={d.day}
              onMouseEnter={() => setActive(i)}
              className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t-sm px-px ${active === i ? "bg-surface-2" : ""}`}
            >
              <span className="w-full max-w-3 rounded-t-[4px] bg-primary" style={{ height: `${(d.created / max) * 100}%` }} />
              <span className="w-full max-w-3 rounded-t-[4px] bg-resolved" style={{ height: `${(d.resolved / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex text-xs text-muted" aria-hidden>
        {days.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % tickEvery === 0 ? formatDay(d.day) : ""}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="inline-flex min-h-10 cursor-pointer items-center font-bold text-primary">Show as table</summary>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-bold">Day</th>
                <th className="px-3 py-2 text-right font-bold">New</th>
                <th className="px-3 py-2 text-right font-bold">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-1.5">{formatDay(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.created}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
