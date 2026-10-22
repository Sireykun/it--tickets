import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITIES, STATUSES } from "@/lib/labels";
import { QUEUE_VIEWS, type QueueParams } from "@/server/tickets";

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);

// Shared by the queue page and the CSV export so both see the same tickets.
export function parseQueueParams(sp: Record<string, string | string[] | undefined>): QueueParams {
  return {
    view: pick(sp.view, QUEUE_VIEWS) ?? "unassigned",
    status: pick<TicketStatus>(sp.status, STATUSES),
    priority: pick<TicketPriority>(sp.priority, PRIORITIES),
    teamId: str(sp.team),
    topicId: str(sp.topic),
    orgId: str(sp.org),
    campusId: str(sp.campus),
    q: str(sp.q),
    page: Math.max(0, Number(sp.page) || 0),
  };
}
