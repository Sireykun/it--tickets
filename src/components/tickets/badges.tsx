import clsx from "clsx";
import { AlarmClock, CheckCircle2, Clock, Flag } from "lucide-react";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { formatDuration, slaState } from "@/server/sla";

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-open-soft text-open",
  IN_PROGRESS: "bg-progress-soft text-progress",
  RESOLVED: "bg-resolved-soft text-resolved",
  CLOSED: "bg-closed-soft text-closed",
};

export function StatusChip({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ring-current/15 ring-inset", statusStyles[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "text-p-low",
  NORMAL: "text-p-normal",
  HIGH: "text-p-high",
  EMERGENCY: "text-p-emergency",
};

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap", priorityStyles[priority], className)}>
      <Flag className="size-3.5" aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

type SlaTicket = Parameters<typeof slaState>[0];

export function SlaBadge({ ticket, now = new Date(), compact = false }: { ticket: SlaTicket; now?: Date; compact?: boolean }) {
  const state = slaState(ticket, now);
  if (state.kind === "none") return null;
  if (state.kind === "met") {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-resolved">
        <CheckCircle2 className="size-3.5" aria-hidden /> Done
      </span>
    );
  }
  const what = state.kind === "response" ? "Reply" : "Resolve";
  const time = formatDuration(state.msRemaining);
  const soon = !state.overdue && state.msRemaining < 2 * 3_600_000;
  return (
    <span
      title={`${state.kind === "response" ? "First response" : "Resolution"} due ${state.dueAt.toISOString()}`}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        state.overdue ? "bg-danger-soft text-danger" : soon ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted",
      )}
    >
      {state.overdue ? <AlarmClock className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
      {state.overdue ? `${what} overdue ${time}` : `${what} in ${time}`}
    </span>
  );
}
