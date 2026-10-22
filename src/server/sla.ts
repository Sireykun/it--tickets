import type { TicketStatus } from "@/generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;

export function computeDueDates(
  sla: { responseTimeHours: number; resolutionTimeHours: number } | null,
  from: Date,
): { firstResponseDueAt: Date | null; resolutionDueAt: Date | null } {
  if (!sla) return { firstResponseDueAt: null, resolutionDueAt: null };
  return {
    firstResponseDueAt: new Date(from.getTime() + sla.responseTimeHours * HOUR_MS),
    resolutionDueAt: new Date(from.getTime() + sla.resolutionTimeHours * HOUR_MS),
  };
}

export type SlaState =
  | { kind: "none" }
  | { kind: "met" }
  | { kind: "response" | "resolution"; dueAt: Date; overdue: boolean; msRemaining: number };

type SlaFields = {
  status: TicketStatus;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstRespondedAt: Date | null;
};

// The timer that matters right now: first response until someone replies, then resolution.
export function slaState(ticket: SlaFields, now: Date = new Date()): SlaState {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return { kind: "met" };

  let kind: "response" | "resolution";
  let dueAt: Date | null;
  if (!ticket.firstRespondedAt && ticket.firstResponseDueAt) {
    kind = "response";
    dueAt = ticket.firstResponseDueAt;
  } else {
    kind = "resolution";
    dueAt = ticket.resolutionDueAt;
  }
  if (!dueAt) return { kind: "none" };

  const msRemaining = dueAt.getTime() - now.getTime();
  return { kind, dueAt, overdue: msRemaining < 0, msRemaining };
}

// "3h", "45m", "2d 4h"
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
