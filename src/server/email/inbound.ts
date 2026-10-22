import { createHash } from "node:crypto";
import type { InboundStatus } from "@/generated/prisma/enums";
import { normalizeEmail } from "@/server/auth-rules";
import { prisma } from "@/server/prisma";
import { canWorkTicket, isParticipant } from "@/server/roles";
import { MAX_FILES_PER_MESSAGE, type PreparedFile, prepareUploads } from "@/server/storage";
import { addMessage, createTicket, TicketError } from "@/server/tickets";
import { ensureUser, loadAppUser } from "@/server/users";
import { REPLY_MARKER } from "./templates";
import { ticketFromHeaders, ticketFromSubject } from "./tokens";

// The parts of a parsed email we use. Built from mailparser's ParsedMail in imap.ts.
export type InboundMessage = {
  messageId: string | null;
  from: { address: string; name?: string };
  recipients: { address: string; name?: string }[]; // To + Cc
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[] | string | null;
  headers: Record<string, string>; // lower-cased names
  attachments: { filename: string; content: Buffer; size: number; related?: boolean }[];
  date?: Date;
};

export type InboundResult = { status: InboundStatus; reason?: string; ticketNumber?: string };

const helpdeskAddress = () => normalizeEmail(process.env.HELPDESK_ADDRESS ?? "helpdesk@localhost");

function allowedDomains(): string[] {
  return [process.env.ALLOWED_EMAIL_DOMAIN ?? "ciaschool.edu.kh", ...(process.env.INBOUND_EXTRA_DOMAINS ?? "").split(",")]
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function domainAllowed(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return allowedDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

// Vacation replies, bounces, mailing lists and our own mail must never create tickets,
// otherwise two auto-responders can ping-pong forever.
export function isAutomated(msg: Pick<InboundMessage, "from" | "headers">): string | null {
  const h = msg.headers;
  if (normalizeEmail(msg.from.address) === helpdeskAddress()) return "sent by the helpdesk itself";
  if (h["auto-submitted"] && h["auto-submitted"].toLowerCase() !== "no") return "auto-submitted";
  if (/^(bulk|junk|list|auto_reply)$/i.test(h["precedence"] ?? "")) return "bulk/auto precedence";
  if (h["x-autoreply"] || h["x-autorespond"] || h["list-id"]) return "auto-reply or list mail";
  if (/^(mailer-daemon|postmaster|no-?reply)@/i.test(msg.from.address)) return "system sender";
  return null;
}

// Keeps only what the person just wrote: drops our reply marker and everything after it,
// "On … wrote:" quote headers, Outlook "Original Message" blocks, ">" quotes and signatures.
export function stripQuoted(text: string): string {
  let body = text.replace(/\r\n/g, "\n");
  const marker = body.indexOf(REPLY_MARKER);
  if (marker >= 0) body = body.slice(0, marker);
  const cuts = [
    /^On\s[\s\S]{0,300}?wrote:\s*$/m,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{10,}\s*$/m, // Outlook separator before "From: … Sent: …"
    /^From:\s.+\n(?:Sent|Date):\s/m,
    /^--\s?$/m, // signature delimiter
  ];
  for (const re of cuts) {
    const m = re.exec(body);
    if (m) body = body.slice(0, m.index);
  }
  return body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
}

async function prepareEmailAttachments(atts: InboundMessage["attachments"]): Promise<{ files: PreparedFile[]; skipped: string[] }> {
  const files: PreparedFile[] = [];
  const skipped: string[] = [];
  for (const a of atts) {
    if (a.related && a.size < 20_000) continue; // signature logos and other inline decoration
    if (files.length >= MAX_FILES_PER_MESSAGE) {
      skipped.push(a.filename);
      continue;
    }
    const r = await prepareUploads([new File([new Uint8Array(a.content)], a.filename || "attachment")]);
    if (r.ok) files.push(...r.files);
    else skipped.push(a.filename || "attachment");
  }
  return { files, skipped };
}

function messageKey(msg: InboundMessage): string {
  if (msg.messageId) return msg.messageId.slice(0, 500);
  const h = createHash("sha256").update(`${msg.from.address}|${msg.subject}|${msg.date?.toISOString() ?? ""}|${msg.text}`).digest("hex");
  return `<synthetic.${h}>`;
}

async function defaultTopicId(): Promise<string | null> {
  const name = process.env.INBOUND_HELP_TOPIC;
  const named = name ? await prisma.helpTopic.findFirst({ where: { name, isActive: true } }) : null;
  if (named) return named.id;
  return (await prisma.helpTopic.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }))?.id ?? null;
}

function cleanSubject(subject: string): string {
  const s = subject.replace(/\s+/g, " ").trim().slice(0, 200);
  return s.length >= 3 ? s : `Email: ${s || "(no subject)"}`;
}

// Processes one message exactly once. Never throws for bad input: the outcome is recorded.
export async function processInbound(msg: InboundMessage): Promise<InboundResult> {
  const key = messageKey(msg);
  if (await prisma.inboundEmail.findUnique({ where: { messageId: key } })) return { status: "IGNORED", reason: "duplicate" };

  const record = async (result: InboundResult, ticketNumber?: string) => {
    const ticket = ticketNumber ? await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true } }) : null;
    await prisma.inboundEmail.create({
      data: {
        messageId: key,
        fromAddress: msg.from.address.slice(0, 254),
        subject: msg.subject.slice(0, 250),
        status: result.status,
        reason: result.reason?.slice(0, 500),
        ticketId: ticket?.id ?? null,
      },
    });
    return { ...result, ticketNumber };
  };

  try {
    const automated = isAutomated(msg);
    if (automated) return record({ status: "IGNORED", reason: automated });

    const fromEmail = normalizeEmail(msg.from.address);
    const { files, skipped } = await prepareEmailAttachments(msg.attachments);
    let body = stripQuoted(msg.text);
    if (skipped.length) body += `\n\n[Not attached (type or size not allowed, or too many files): ${skipped.join(", ")}]`;
    if (!body.trim() && files.length === 0) return record({ status: "IGNORED", reason: "empty message" });
    if (!body.trim()) body = "(see attachments)";

    // ── Reply to an existing ticket? ──
    const signed = ticketFromHeaders(msg.inReplyTo, msg.references);
    const ticketNumber = signed ?? ticketFromSubject(msg.subject);
    if (ticketNumber) {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { collaborators: { select: { userId: true } } },
      });
      const senderRow = await prisma.user.findUnique({ where: { email: fromEmail }, select: { id: true } });
      const sender = senderRow ? await loadAppUser(senderRow.id) : null; // null if deactivated
      if (ticket && sender) {
        const participant = isParticipant(sender.id, ticket);
        const staff = canWorkTicket(sender, ticket);
        if (participant || staff) {
          if (ticket.status === "CLOSED" && !staff) {
            // A reply to a closed ticket starts a new one, linked to the old.
            const topicId = ticket.helpTopicId ?? (await defaultTopicId());
            if (!topicId) return record({ status: "FAILED", reason: "no active help topic" });
            const created = await createTicket(sender, { helpTopicId: topicId, subject: cleanSubject(ticket.subject), body }, files, { source: "EMAIL" });
            await prisma.$transaction([
              prisma.ticketLink.create({ data: { fromTicketId: created.id, toTicketId: ticket.id, kind: "LINKED" } }),
              prisma.ticketThread.create({
                data: { ticketId: created.id, type: "SYSTEM_EVENT", body: `Follow-up to closed ticket ${ticket.ticketNumber}` },
              }),
            ]);
            return record({ status: "PROCESSED", reason: `follow-up to closed ${ticket.ticketNumber}` }, created.ticketNumber);
          }
          await addMessage(sender, ticket.ticketNumber, { body, mode: participant ? "client" : "reply" }, files);
          return record({ status: "PROCESSED", reason: participant ? "reply" : "staff reply" }, ticket.ticketNumber);
        }
      }
      if (signed) return record({ status: "REJECTED", reason: `sender is not on ${ticketNumber}` });
      // An unsigned subject tag from a stranger falls through and becomes a new ticket.
    }

    // ── New ticket ──
    if (!domainAllowed(fromEmail)) return record({ status: "REJECTED", reason: "sender domain not allowed" });
    const { user: senderRow } = await ensureUser({ email: fromEmail, name: msg.from.name }, { actorId: null, via: "email" });
    const sender = await loadAppUser(senderRow.id);
    if (!sender) return record({ status: "REJECTED", reason: "sender account deactivated" });
    const topicId = await defaultTopicId();
    if (!topicId) return record({ status: "FAILED", reason: "no active help topic" });

    const ccIds: string[] = [];
    for (const r of msg.recipients) {
      const email = normalizeEmail(r.address);
      if (email === helpdeskAddress() || email === fromEmail || !domainAllowed(email)) continue;
      const { user } = await ensureUser({ email, name: r.name }, { actorId: null, via: "email-cc" });
      if (user.isActive) ccIds.push(user.id);
    }

    const created = await createTicket(sender, { helpTopicId: topicId, subject: cleanSubject(msg.subject), body }, files, {
      source: "EMAIL",
      collaboratorIds: ccIds,
    });
    return record({ status: "PROCESSED", reason: "new ticket" }, created.ticketNumber);
  } catch (err) {
    const reason = err instanceof TicketError ? err.message : err instanceof Error ? err.message : String(err);
    return record({ status: err instanceof TicketError ? "REJECTED" : "FAILED", reason });
  }
}
