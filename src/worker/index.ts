// Background worker: sends queued email and polls the helpdesk mailbox.
// Run with `npx tsx src/worker/index.ts` (the `worker` compose service).
import { fetchInbox, imapConfigured } from "@/server/email/imap";
import { requeueStuck, sendDueEmails, smtpConfigured } from "@/server/email/smtp";
import { prisma } from "@/server/prisma";

const OUTBOX_EVERY_MS = 5_000;
const INBOX_EVERY_MS = Number(process.env.IMAP_POLL_SECONDS ?? 30) * 1000;

let stopping = false;

function log(msg: string) {
  console.log(`${new Date().toISOString()} worker: ${msg}`);
}

async function every(name: string, ms: number, job: () => Promise<string | null>) {
  while (!stopping) {
    try {
      const summary = await job();
      if (summary) log(`${name}: ${summary}`);
    } catch (err) {
      // Keep the loop alive; the next run retries (e.g. mail server restarting).
      log(`${name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, ms));
  }
}

async function main() {
  log(`starting (smtp ${smtpConfigured() ? "on" : "off"}, imap ${imapConfigured() ? "on" : "off"})`);
  await requeueStuck();
  await Promise.all([
    every("outbox", OUTBOX_EVERY_MS, async () => {
      const { sent, failed } = await sendDueEmails();
      return sent || failed ? `sent ${sent}, failed ${failed}` : null;
    }),
    every("inbox", INBOX_EVERY_MS, async () => {
      const results = await fetchInbox();
      return results.length ? results.map((r) => `${r.status}${r.ticketNumber ? ` ${r.ticketNumber}` : ""}${r.reason ? ` (${r.reason})` : ""}`).join("; ") : null;
    }),
  ]);
  await prisma.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig}, finishing current jobs`);
    stopping = true;
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
