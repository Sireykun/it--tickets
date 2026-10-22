import { toCsv } from "@/lib/csv";
import { PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { audit } from "@/server/audit";
import { getCurrentUser, isSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { parseQueueParams } from "@/server/queue-params";
import { listQueue } from "@/server/tickets";

const MAX_ROWS = 5000;

// CSV of the queue view the agent is looking at (same view + filters, no paging).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Exporting is superadmin-only.
  if (!user || !isSuperadmin(user)) return new Response("Not found", { status: 404 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const params = { ...parseQueueParams(sp), page: 0, limit: MAX_ROWS };
  const { tickets, total } = await listQueue(user, params);

  const csv = toCsv(
    ["Ticket", "Campus", "Subject", "Status", "Priority", "Source", "Requester", "Requester email", "Department", "Help topic", "Team", "Assignee", "Created", "First response due", "First responded", "Resolution due", "Resolved", "Closed", "Updated"],
    tickets.map((t) => [
      t.ticketNumber,
      t.campus?.name,
      t.subject,
      STATUS_LABEL[t.status],
      PRIORITY_LABEL[t.priority],
      SOURCE_LABEL[t.source],
      t.requester.name,
      t.requester.email,
      t.department.name,
      t.helpTopic?.name,
      t.assignedTeam?.name,
      t.assignedAgent?.name,
      t.createdAt,
      t.firstResponseDueAt,
      t.firstRespondedAt,
      t.resolutionDueAt,
      t.resolvedAt,
      t.closedAt,
      t.updatedAt,
    ]),
  );
  await audit(prisma, user, "ticket.export", { type: "queue", id: params.view }, { rows: tickets.length, total });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tickets-${params.view}-${stamp}.csv"`,
      "Cache-Control": "no-store",
      ...(total > MAX_ROWS ? { "X-Truncated": `${MAX_ROWS} of ${total}` } : {}),
    },
  });
}
