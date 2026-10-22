import { ImapFlow } from "imapflow";
import { type AddressObject, type ParsedMail, simpleParser } from "mailparser";
import { type InboundMessage, type InboundResult, processInbound } from "./inbound";

export function imapConfigured(): boolean {
  return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER);
}

function addresses(field: AddressObject | AddressObject[] | undefined) {
  return (Array.isArray(field) ? field : field ? [field] : [])
    .flatMap((a) => a.value)
    .filter((v): v is { address: string; name: string } => Boolean(v.address))
    .map((v) => ({ address: v.address, name: v.name || undefined }));
}

export function toInbound(mail: ParsedMail): InboundMessage {
  const from = addresses(mail.from)[0] ?? { address: "" };
  const headers: Record<string, string> = {};
  for (const [k, v] of mail.headers) headers[k.toLowerCase()] = typeof v === "string" ? v : JSON.stringify(v);
  return {
    messageId: mail.messageId ?? null,
    from,
    recipients: [...addresses(mail.to), ...addresses(mail.cc)],
    subject: mail.subject ?? "",
    // Prefer the plain-text part; fall back to HTML converted to text.
    text: mail.text ?? (typeof mail.html === "string" ? mail.html.replace(/<[^>]+>/g, " ") : ""),
    inReplyTo: mail.inReplyTo ?? null,
    references: mail.references ?? null,
    headers,
    attachments: mail.attachments.map((a) => ({ filename: a.filename ?? "attachment", content: a.content, size: a.size, related: a.related })),
    date: mail.date,
  };
}

// Reads unseen messages from the helpdesk inbox, processes each, and marks it seen.
export async function fetchInbox(): Promise<InboundResult[]> {
  if (!imapConfigured()) return [];
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASS ?? "" },
    logger: false,
  });
  const results: InboundResult[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        results.push(await processInbound(toInbound(await simpleParser(msg.source))));
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return results;
}
