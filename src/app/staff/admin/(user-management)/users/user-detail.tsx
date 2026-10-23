import Link from "next/link";
import { formatRelative } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/labels";
import type { getUserDetail } from "@/server/admin";

type Detail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

const ACTION_LABEL: Record<string, string> = {
  "user.save": "Account updated",
  "user.create": "Account created",
};

// Shown under the user form: what this person is working on and who changed their account.
export function UserDetail({ detail }: { detail: Detail }) {
  return (
    <div className="mt-5 space-y-4 border-t border-border pt-4 text-sm">
      <p className="text-muted">
        {detail.lastLoginAt ? `Last sign-in ${formatRelative(detail.lastLoginAt)}` : "Never signed in"} · Account created{" "}
        {formatRelative(detail.createdAt)}
      </p>
      <TicketList id="user-requested" title="Open tickets they requested" tickets={detail.requested} />
      <TicketList id="user-assigned" title="Open tickets assigned to them" tickets={detail.assigned} />
      <section aria-labelledby="user-history">
        <h3 id="user-history" className="mb-1 font-bold">
          Recent changes
        </h3>
        {detail.history.length === 0 ? (
          <p className="text-muted">No changes recorded.</p>
        ) : (
          <ul className="space-y-1">
            {detail.history.map((e) => (
              <li key={e.id}>
                {ACTION_LABEL[e.action] ?? e.action}
                <span className="text-muted">
                  {" "}
                  · {e.actor?.name ?? "System"} · {formatRelative(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TicketList({ id, title, tickets }: { id: string; title: string; tickets: Detail["requested"] }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-1 font-bold">
        {title}
      </h3>
      {tickets.length === 0 ? (
        <p className="text-muted">None.</p>
      ) : (
        <ul className="space-y-1">
          {tickets.map((t) => (
            <li key={t.ticketNumber} className="truncate">
              <Link href={`/staff/tickets/${t.ticketNumber}`} className="font-bold text-primary hover:underline">
                {t.ticketNumber}
              </Link>{" "}
              {t.subject} <span className="text-muted">· {STATUS_LABEL[t.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
