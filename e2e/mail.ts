import { expect } from "@playwright/test";
import nodemailer from "nodemailer";

// Talks to the dev GreenMail server: send mail over SMTP, read mailboxes over its REST API.
const API = process.env.MAIL_API ?? "http://localhost:8025";
const SMTP_HOST = process.env.MAIL_SMTP_HOST ?? "localhost";

export type MailboxMessage = { "Message-ID": string; subject: string; mimeMessage: string };

export async function sendMail(opts: { from: string; subject: string; text: string; inReplyTo?: string; references?: string[] }) {
  await nodemailer.createTransport({ host: SMTP_HOST, port: 3025 }).sendMail({ to: "helpdesk@ciaschool.edu.kh", ...opts });
}

export async function inbox(email: string): Promise<MailboxMessage[]> {
  const res = await fetch(`${API}/api/user/${encodeURIComponent(email)}/messages/INBOX`);
  return res.ok ? ((await res.json()) as MailboxMessage[]) : [];
}

// Waits for a message whose subject matches; the worker sends every few seconds.
export async function waitForMail(email: string, subject: RegExp, timeout = 60_000): Promise<MailboxMessage> {
  let found: MailboxMessage | undefined;
  await expect
    .poll(
      async () => {
        found = (await inbox(email)).find((m) => subject.test(m.subject));
        return Boolean(found);
      },
      { timeout, intervals: [1000] },
    )
    .toBe(true);
  return found!;
}

// Quoted-printable soft line breaks ("=\r\n") split long lines in the raw MIME text.
export function plainText(m: MailboxMessage): string {
  return m.mimeMessage.replace(/=\r\n/g, "");
}
