import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatBytes, formatDateTime } from "@/lib/format";
import { PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { requireStaff } from "@/server/authz";
import { getTicketForViewer } from "@/server/tickets";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/print/tickets/[number]">): Promise<Metadata> {
  return { title: `Print ${decodeURIComponent((await params).number)}` };
}

const ENTRY_LABEL = {
  CLIENT_MESSAGE: "Requester",
  AGENT_REPLY: "IT reply",
  INTERNAL_NOTE: "Internal note",
  SYSTEM_EVENT: "Event",
} as const;

// Plain, ink-friendly layout. Always light, whatever the device theme.
export default async function PrintTicketPage({ params }: PageProps<"/print/tickets/[number]">) {
  const user = await requireStaff();
  const ticket = await getTicketForViewer(user, (await params).number);
  if (!ticket) notFound();

  const facts: [string, string][] = [
    ["Status", STATUS_LABEL[ticket.status]],
    ["Priority", PRIORITY_LABEL[ticket.priority]],
    ["Source", SOURCE_LABEL[ticket.source]],
    ["Requester", `${ticket.requester.name} <${ticket.requester.email}>`],
    ["Department", ticket.department.name],
    ["Help topic", ticket.helpTopic?.name ?? "None"],
    ["Team", ticket.assignedTeam?.name ?? "None"],
    ["Assignee", ticket.assignedAgent?.name ?? "Unassigned"],
    ["SLA", ticket.slaPolicy?.name ?? "None"],
    ["Opened", formatDateTime(ticket.createdAt)],
    ...(ticket.resolvedAt ? ([["Resolved", formatDateTime(ticket.resolvedAt)]] as [string, string][]) : []),
    ...(ticket.closedAt ? ([["Closed", formatDateTime(ticket.closedAt)]] as [string, string][]) : []),
  ];

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-[13px] leading-normal text-black [color-scheme:light] print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-600">CIA IT Helpdesk · printed {formatDateTime(new Date())} by {user.name}</p>
          <h1 className="mt-1 text-2xl font-bold">
            {ticket.ticketNumber}: {ticket.subject}
          </h1>
        </div>
        <PrintButton />
      </div>

      <table className="mb-8 w-full border-collapse">
        <tbody>
          {facts.map(([k, v]) => (
            <tr key={k} className="border-b border-neutral-300">
              <th className="w-40 py-1.5 pr-4 text-left align-top font-bold">{k}</th>
              <td className="py-1.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-3 text-lg font-bold">Conversation</h2>
      <ol className="space-y-4">
        {ticket.thread.map((e) => (
          <li key={e.id} className={`break-inside-avoid border-l-4 pl-3 ${e.type === "INTERNAL_NOTE" ? "border-amber-500" : e.type === "SYSTEM_EVENT" ? "border-neutral-300" : "border-neutral-700"}`}>
            <p className="text-xs text-neutral-600">
              <strong className="text-black">{ENTRY_LABEL[e.type]}</strong> · {e.author?.name ?? "System"} · {formatDateTime(e.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{e.body}</p>
            {e.attachments.length > 0 && (
              <p className="mt-1 text-xs text-neutral-600">
                Attachments: {e.attachments.map((a) => `${a.fileName} (${formatBytes(a.sizeBytes)})`).join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
