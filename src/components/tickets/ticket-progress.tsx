import clsx from "clsx";
import { Check } from "lucide-react";
import type { TicketStatus } from "@/generated/prisma/enums";

// Resolved and Closed have no hint: the ticket page already explains those two states.
const STEPS: { status: TicketStatus; label: string; hint?: string }[] = [
  { status: "OPEN", label: "Received", hint: "IT has your request and will pick it up soon." },
  { status: "IN_PROGRESS", label: "In progress", hint: "IT is working on it." },
  { status: "RESOLVED", label: "Resolved" },
  { status: "CLOSED", label: "Closed" },
];

/** Where a ticket is in its life, for requesters. The status chip stays the source of truth for colour. */
export function TicketProgress({ status }: { status: TicketStatus }) {
  const current = STEPS.findIndex((step) => step.status === status);
  return (
    <div className="mt-4 border-t border-border pt-4">
      <ol aria-label="Ticket progress" className="grid grid-cols-4">
        {STEPS.map((step, index) => {
          const isDone = index < current || status === "CLOSED";
          const isCurrent = index === current;
          return (
            <li key={step.status} aria-current={isCurrent ? "step" : undefined} className="relative flex flex-col items-center gap-1.5 text-center">
              {index > 0 && (
                <span aria-hidden className={clsx("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", index <= current ? "bg-primary" : "bg-border-strong")} />
              )}
              <span
                className={clsx(
                  // Above the next step's connector, which is painted later and would cross this circle.
                  "relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-bold",
                  isDone && "border-primary bg-primary text-primary-fg",
                  isCurrent && !isDone && "border-primary bg-surface text-primary ring-4 ring-primary-soft",
                  !isDone && !isCurrent && "border-border-strong bg-surface text-muted",
                )}
              >
                {isDone ? <Check className="size-4" aria-hidden strokeWidth={3} /> : index + 1}
              </span>
              <span className={clsx("px-0.5 text-xs leading-tight sm:text-sm", isCurrent ? "font-bold text-text" : "font-semibold text-muted")}>
                {step.label}
                {isDone && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {STEPS[current].hint && <p className="mt-3 text-sm text-muted">{STEPS[current].hint}</p>}
    </div>
  );
}
