import type { Prisma } from "@/generated/prisma/client";
import type { ThreadEntryType, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITY_LABEL } from "@/lib/labels";
import { REPLY_MARKER, REPLYABLE, renderTemplate, TEMPLATE_DEFS, type TemplateKey, type TemplateVars, textToHtml } from "./templates";
import { newMessageId } from "./tokens";

// Decides who gets which email for each ticket event and queues it in the outbox, inside the
// caller's transaction. The worker (src/worker) does the actual sending.

type Tx = Prisma.TransactionClient;
type Person = { id: string; name: string; email: string; isActive: boolean };

export function emailEnabled(): boolean {
  return process.env.EMAIL_OUTBOUND === "on";
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const personSelect = { id: true, name: true, email: true, isActive: true } as const;
const staffSelect = { ...personSelect, role: true, emailAlerts: true } as const;

async function loadTicket(tx: Tx, ticketId: string) {
  return tx.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      requester: { select: personSelect },
      collaborators: { include: { user: { select: personSelect } } },
      assignedAgent: { select: staffSelect },
      assignedTeam: { select: { name: true, members: { include: { user: { select: staffSelect } } } } },
      helpTopic: { select: { name: true } },
    },
  });
}
type LoadedTicket = Awaited<ReturnType<typeof loadTicket>>;

function baseVars(t: LoadedTicket): TemplateVars {
  return {
    "ticket.number": t.ticketNumber,
    "ticket.subject": t.subject,
    "ticket.topic": t.helpTopic?.name ?? "—",
    "ticket.priority": PRIORITY_LABEL[t.priority],
    "ticket.team": t.assignedTeam?.name ?? "—",
    "ticket.url": `${appUrl()}/tickets/${t.ticketNumber}`,
    "ticket.staffUrl": `${appUrl()}/staff/tickets/${t.ticketNumber}`,
    "requester.name": t.requester.name,
    "requester.email": t.requester.email,
    "app.url": appUrl(),
  };
}

// Requester + CCs (the people on the "customer" side).
function participants(t: LoadedTicket): Person[] {
  return [t.requester, ...t.collaborators.map((c) => c.user)];
}

// Staff who should hear about activity: the assignee, else the team, else the admins.
async function staffToAlert(tx: Tx, t: LoadedTicket): Promise<Person[]> {
  if (t.assignedAgent) return t.assignedAgent.emailAlerts ? [t.assignedAgent] : [];
  const team = t.assignedTeam?.members.map((m) => m.user).filter((u) => u.role !== "USER" && u.emailAlerts) ?? [];
  if (team.length > 0) return team;
  // No team: the campus admins of the ticket's campus, else the superadmins.
  const base = { isActive: true, emailAlerts: true };
  const campusAdmins = t.campusId
    ? await tx.user.findMany({ where: { ...base, role: "ADMIN", staffCampuses: { some: { campusId: t.campusId } } }, select: personSelect })
    : [];
  if (campusAdmins.length > 0) return campusAdmins;
  return tx.user.findMany({ where: { ...base, role: "SUPERADMIN" }, select: personSelect });
}

async function enqueue(tx: Tx, key: TemplateKey, t: LoadedTicket, recipients: Person[], actorId: string | null, vars: TemplateVars) {
  const seen = new Set<string>();
  const to = recipients.filter((p) => {
    if (!p.isActive || p.id === actorId || seen.has(p.email)) return false;
    seen.add(p.email);
    return true;
  });
  if (to.length === 0) return;

  const override = await tx.emailTemplate.findUnique({ where: { key } });
  if (override && !override.isActive) return;
  const tpl = override ?? TEMPLATE_DEFS[key];

  for (const person of to) {
    // Thread each person's emails about this ticket together, referencing only mail they received.
    const mine = { ticketId: t.id, toAddress: person.email };
    // Sequential on purpose: a transaction is one connection, and pg rejects overlapping queries.
    const root = await tx.emailOutbox.findFirst({ where: mine, orderBy: { createdAt: "asc" }, select: { messageId: true } });
    const latest = await tx.emailOutbox.findFirst({ where: mine, orderBy: { createdAt: "desc" }, select: { messageId: true } });
    const references = [...new Set([root?.messageId, latest?.messageId].filter((x): x is string => Boolean(x)))];

    const all: TemplateVars = { ...baseVars(t), ...vars, "recipient.name": person.name, "recipient.firstName": person.name.split(/\s+/)[0] };
    const subject = renderTemplate(tpl.subject, all).replace(/[\r\n]+/g, " ").slice(0, 250);
    let text = renderTemplate(tpl.body, all);
    if (REPLYABLE.has(key)) text = `${REPLY_MARKER}\n\n${text}`;
    await tx.emailOutbox.create({
      data: {
        toAddress: person.email,
        subject,
        textBody: text,
        htmlBody: textToHtml(text),
        messageId: newMessageId(t.ticketNumber),
        inReplyTo: latest?.messageId ?? null,
        references,
        templateKey: key,
        ticketId: t.id,
      },
    });
  }
}

export async function notifyTicketCreated(tx: Tx, ticketId: string, actorId: string, message: string) {
  if (!emailEnabled()) return;
  const t = await loadTicket(tx, ticketId);
  // The confirmation goes to the requester even when an agent logged it for them.
  await enqueue(tx, "ticket.autoreply", t, participants(t), null, { message });
  await enqueue(tx, "ticket.alert", t, await staffToAlert(tx, t), actorId, { message });
}

export async function notifyMessage(tx: Tx, ticketId: string, actor: { id: string; name: string }, type: ThreadEntryType, message: string) {
  if (!emailEnabled()) return;
  const t = await loadTicket(tx, ticketId);
  if (type === "AGENT_REPLY") {
    await enqueue(tx, "ticket.reply", t, participants(t), actor.id, { message, "agent.name": actor.name });
  } else if (type === "CLIENT_MESSAGE") {
    await enqueue(tx, "ticket.message.alert", t, await staffToAlert(tx, t), actor.id, { message, "author.name": actor.name });
  }
}

export async function notifyAssigned(tx: Tx, ticketId: string, actor: { id: string; name: string }) {
  if (!emailEnabled()) return;
  const t = await loadTicket(tx, ticketId);
  if (!t.assignedAgent?.emailAlerts) return;
  await enqueue(tx, "ticket.assigned", t, [t.assignedAgent], actor.id, { "agent.name": actor.name });
}

export async function notifyStatus(tx: Tx, ticketId: string, actor: { id: string }, status: TicketStatus) {
  if (!emailEnabled()) return;
  if (status !== "RESOLVED" && status !== "CLOSED") return;
  const t = await loadTicket(tx, ticketId);
  await enqueue(tx, status === "RESOLVED" ? "ticket.resolved" : "ticket.closed", t, participants(t), actor.id, {});
}
