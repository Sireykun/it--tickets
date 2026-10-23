import { requireSuperadmin } from "@/server/authz";
import clsx from "clsx";
import { ChevronRight, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/misc";
import { formatRelative } from "@/lib/format";
import { TEMPLATE_DEFS, TEMPLATE_KEYS, TEMPLATE_VARIABLES, type TemplateKey } from "@/server/email/templates";
import { emailEnabled } from "@/server/email/notify";
import { prisma } from "@/server/prisma";
import { resetEmailTemplateAction } from "../actions";
import { EmailTemplateForm } from "../admin-forms";

export const metadata: Metadata = { title: "Email" };

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-resolved-soft text-resolved",
  PROCESSED: "bg-resolved-soft text-resolved",
  PENDING: "bg-surface-2 text-muted",
  SENDING: "bg-surface-2 text-muted",
  IGNORED: "bg-surface-2 text-muted",
  REJECTED: "bg-warn-soft text-warn",
  FAILED: "bg-danger-soft text-danger",
};

function Status({ value }: { value: string }) {
  return <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_STYLE[value])}>{value.toLowerCase()}</span>;
}

export default async function EmailAdminPage({ searchParams }: PageProps<"/staff/admin/email">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const editKey = TEMPLATE_KEYS.includes(sp.edit as TemplateKey) ? (sp.edit as TemplateKey) : null;
  const [overrides, outbox, inbound] = await Promise.all([
    prisma.emailTemplate.findMany(),
    prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { ticket: { select: { ticketNumber: true } } } }),
    prisma.inboundEmail.findMany({ orderBy: { receivedAt: "desc" }, take: 25, include: { ticket: { select: { ticketNumber: true } } } }),
  ]);
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  const editing = editKey ? (byKey.get(editKey) ?? { ...TEMPLATE_DEFS[editKey], isActive: true }) : null;

  return (
    <>
      <PageHeader title="Email" subtitle={`Outgoing email is ${emailEnabled() ? "on" : "off (EMAIL_OUTBOUND)"}. Replies to ticket emails come back into their ticket.`} />
      {sp.saved === "1" && !editKey && (
        <div className="mb-4">
          <Alert tone="success">Saved.</Alert>
        </div>
      )}

      {editKey && editing && (
        <Card className="mb-6 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{TEMPLATE_DEFS[editKey].label}</h2>
            {byKey.has(editKey) && (
              <form action={resetEmailTemplateAction.bind(null, editKey)}>
                <Button type="submit" variant="ghost" size="sm">
                  <RotateCcw className="size-4" aria-hidden /> Reset to default
                </Button>
              </form>
            )}
          </div>
          <EmailTemplateForm key={editKey} templateKey={editKey} subject={editing.subject} body={editing.body} isActive={editing.isActive} variables={TEMPLATE_VARIABLES} />
        </Card>
      )}

      <section aria-labelledby="templates-heading" className="mb-8">
        <h2 id="templates-heading" className="mb-2 text-lg font-bold">
          Templates
        </h2>
        <Card>
          <ul className="divide-y divide-border">
            {TEMPLATE_KEYS.map((key) => {
              const o = byKey.get(key);
              return (
                <li key={key}>
                  <Link href={`/staff/admin/email?edit=${key}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{TEMPLATE_DEFS[key].label}</span>
                      <span className="block truncate text-sm text-muted">{(o ?? TEMPLATE_DEFS[key]).subject}</span>
                    </span>
                    <span className="text-sm text-muted">{o ? (o.isActive ? "Customized" : "Off") : "Default"}</span>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="outbox-heading">
          <h2 id="outbox-heading" className="mb-2 text-lg font-bold">
            Recently sent
          </h2>
          <Card>
            <ul className="divide-y divide-border text-sm">
              {outbox.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Status value={m.status} />
                    <span className="min-w-0 flex-1 truncate font-bold">{m.subject}</span>
                  </p>
                  <p className="truncate text-muted">
                    to {m.toAddress} · {formatRelative(m.createdAt)}
                    {m.attempts > 1 && ` · ${m.attempts} attempts`}
                  </p>
                  {m.lastError && <p className="truncate text-danger">{m.lastError}</p>}
                </li>
              ))}
              {outbox.length === 0 && <li className="px-4 py-8 text-center text-muted">No email yet.</li>}
            </ul>
          </Card>
        </section>
        <section aria-labelledby="inbound-heading">
          <h2 id="inbound-heading" className="mb-2 text-lg font-bold">
            Recently received
          </h2>
          <Card>
            <ul className="divide-y divide-border text-sm">
              {inbound.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Status value={m.status} />
                    <span className="min-w-0 flex-1 truncate font-bold">{m.subject || "(no subject)"}</span>
                    {m.ticket && (
                      <Link href={`/staff/tickets/${m.ticket.ticketNumber}`} className="font-bold text-primary hover:underline">
                        {m.ticket.ticketNumber}
                      </Link>
                    )}
                  </p>
                  <p className="truncate text-muted">
                    from {m.fromAddress} · {formatRelative(m.receivedAt)}
                    {m.reason && ` · ${m.reason}`}
                  </p>
                </li>
              ))}
              {inbound.length === 0 && <li className="px-4 py-8 text-center text-muted">No email received yet.</li>}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
