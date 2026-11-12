import clsx from "clsx";
import { CircleCheck, CircleHelp, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AccentRule } from "@/components/ui/misc";
import { ANNOUNCEMENT_LEVEL_LABEL, type AnnouncementLevel } from "@/lib/announcements";
import { formatDateTime, formatRelative } from "@/lib/format";

type Notice = { id: string; title: string; body: string; level: AnnouncementLevel; endsAt: Date | null; createdAt: Date; campus: { name: string } | null };

const levelStyle: Record<AnnouncementLevel, { box: string; label: string; icon: typeof Info }> = {
  info: { box: "border-open/30 bg-open-soft", label: "text-open", icon: Info },
  warning: { box: "border-warn/30 bg-warn-soft", label: "text-warn", icon: TriangleAlert },
  outage: { box: "border-danger/30 bg-danger-soft", label: "text-danger", icon: OctagonAlert },
};

export function ItStatus({ notices, className }: { notices: Notice[]; className?: string }) {
  return (
    <section aria-labelledby="it-status-title" className={clsx("rounded-xl border border-border bg-surface p-4 shadow-card", className)}>
      <h2 id="it-status-title" className="text-lg font-bold">IT status</h2>
      <AccentRule className="mt-2 w-10" />
      {notices.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-base font-bold text-resolved">
          <CircleCheck className="size-5 shrink-0" aria-hidden /> No known problems right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notices.map((notice) => {
            const { box, label, icon: Icon } = levelStyle[notice.level];
            return (
              <li key={notice.id} className={`rounded-lg border p-3 ${box}`}>
                <p className={`flex items-center gap-1.5 text-sm font-bold ${label}`}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {ANNOUNCEMENT_LEVEL_LABEL[notice.level]}
                  {notice.campus && <span className="font-semibold"> · {notice.campus.name}</span>}
                </p>
                <p className="mt-1 text-base font-bold">{notice.title}</p>
                <p className="mt-1 whitespace-pre-line break-words text-base">{notice.body}</p>
                <p className="mt-2 text-sm text-muted">
                  Posted {formatRelative(notice.createdAt)}
                  {notice.endsAt && ` · until ${formatDateTime(notice.endsAt)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-base text-muted">Something else not working?</p>
      <Link href="/tickets/new" className="mt-1 inline-flex items-center gap-1 text-base font-bold text-primary hover:underline">
        <CircleHelp className="size-4" aria-hidden /> Report an issue
      </Link>
    </section>
  );
}
