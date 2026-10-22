import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/server/prisma";

const MAX_ATTEMPTS = 5;

let transport: Transporter | undefined;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

// Retry delays: 1, 2, 4, 8 minutes.
export function backoffMs(attempts: number): number {
  return 60_000 * 2 ** Math.max(0, attempts - 1);
}

// Emails a worker crashed in the middle of sending go back in the queue.
export async function requeueStuck(olderThanMs = 10 * 60_000) {
  return prisma.emailOutbox.updateMany({
    where: { status: "SENDING", nextAttemptAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "PENDING" },
  });
}

// Claims a batch with SKIP LOCKED (safe with several workers), sends, and records the outcome.
export async function sendDueEmails(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!smtpConfigured()) return { sent: 0, failed: 0 };
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "email_outbox" SET "status" = 'SENDING', "attempts" = "attempts" + 1, "next_attempt_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "email_outbox"
      WHERE "status" = 'PENDING' AND "next_attempt_at" <= now()
      ORDER BY "created_at" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;

  let sent = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const mail = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
    try {
      await getTransport().sendMail({
        from: process.env.MAIL_FROM ?? process.env.HELPDESK_ADDRESS,
        replyTo: process.env.HELPDESK_ADDRESS,
        to: mail.toAddress,
        subject: mail.subject,
        text: mail.textBody,
        html: mail.htmlBody,
        messageId: mail.messageId,
        inReplyTo: mail.inReplyTo ?? undefined,
        references: mail.references.length ? mail.references : undefined,
        headers: {
          // RFC 3834: tells other auto-responders not to answer. Human replies don't get it.
          ...(mail.templateKey === "ticket.reply" ? {} : { "Auto-Submitted": mail.templateKey === "ticket.autoreply" ? "auto-replied" : "auto-generated" }),
          "X-Auto-Response-Suppress": "All",
        },
      });
      await prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (err) {
      const giveUp = mail.attempts >= MAX_ATTEMPTS;
      await prisma.emailOutbox.update({
        where: { id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(Date.now() + backoffMs(mail.attempts)),
          lastError: (err instanceof Error ? err.message : String(err)).slice(0, 1000),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
