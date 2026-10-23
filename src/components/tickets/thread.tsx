import clsx from "clsx";
import { FileText, Lock, Settings2 } from "lucide-react";
import type { TicketDetail } from "@/server/tickets";
import { Avatar } from "@/components/ui/misc";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { INLINE_IMAGE_TYPES } from "@/server/storage";

type Entry = TicketDetail["thread"][number];

// `perspective` decides which side counts as "mine": the requester's messages, or staff replies and notes.
export function Thread({ entries, perspective, layout = "bubbles" }: { entries: Entry[]; perspective: "requester" | "staff"; layout?: "bubbles" | "timeline" }) {
  const now = new Date();
  if (layout === "timeline") {
    return (
      <ol className="relative space-y-5 before:pointer-events-none before:absolute before:inset-y-4 before:left-5 before:w-px before:bg-primary/35" aria-label="Conversation">
        {entries.map((entry) => entry.type === "SYSTEM_EVENT" ? (
          <li key={entry.id} className="relative z-10 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
            <span aria-hidden className="grid size-10 place-items-center rounded-full border border-border-strong bg-surface-2 text-primary"><Settings2 className="size-4" /></span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm"><strong>System</strong><time dateTime={entry.createdAt.toISOString()} title={formatDateTime(entry.createdAt)} className="text-xs text-muted">{formatRelative(entry.createdAt, now)}</time></div>
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">{entry.body}</p>
            </div>
          </li>
        ) : <TimelineMessage key={entry.id} entry={entry} now={now} />)}
      </ol>
    );
  }
  return (
    <ol className="relative space-y-5 before:pointer-events-none before:absolute before:inset-y-2 before:left-1/2 before:w-px before:bg-primary/25" aria-label="Conversation">
      {entries.map((entry) =>
        entry.type === "SYSTEM_EVENT" ? (
          <li key={entry.id} className="relative z-10 flex flex-col items-center gap-2 py-1">
            <span aria-hidden className="size-2.5 rounded-full bg-primary ring-4 ring-surface" />
            <p className="max-w-full bg-surface px-2 text-center text-sm leading-relaxed text-muted">
              <span className="font-bold">{entry.author?.name ?? "System"}</span> · {entry.body} ·{" "}
              <time dateTime={entry.createdAt.toISOString()} title={formatDateTime(entry.createdAt)}>
                {formatRelative(entry.createdAt, now)}
              </time>
            </p>
          </li>
        ) : (
          <Message key={entry.id} entry={entry} mine={perspective === "requester" ? entry.type === "CLIENT_MESSAGE" : entry.type !== "CLIENT_MESSAGE"} now={now} />
        ),
      )}
    </ol>
  );
}

function TimelineMessage({ entry, now }: { entry: Entry; now: Date }) {
  const note = entry.type === "INTERNAL_NOTE";
  const fromStaff = entry.type === "AGENT_REPLY";
  return (
    <li className="relative z-10 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <Avatar name={entry.author?.name ?? "?"} className="size-10 border border-border-strong bg-surface-2" />
      <article className="min-w-0">
        <header className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <strong>{entry.author?.name ?? "Unknown sender"}</strong>
          <span className={clsx("rounded-md border px-1.5 py-0.5 text-xs font-semibold", note ? "border-note-border text-note" : fromStaff ? "border-gold/50 text-gold-text" : "border-primary/30 text-primary")}>{note ? "Internal note" : fromStaff ? "IT team" : "Requester"}</span>
          <time dateTime={entry.createdAt.toISOString()} title={formatDateTime(entry.createdAt)} className="text-xs text-muted">{formatRelative(entry.createdAt, now)}</time>
        </header>
        <div className={clsx("rounded-xl border px-4 py-3 shadow-card", note ? "border-note-border border-dashed bg-note-bg" : fromStaff ? "border-primary/30 bg-primary-soft" : "border-border-strong bg-surface-2")}>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{entry.body}</div>
          <EntryAttachments entry={entry} />
        </div>
      </article>
    </li>
  );
}

function EntryAttachments({ entry }: { entry: Entry }) {
  const images = entry.attachments.filter((attachment) => INLINE_IMAGE_TYPES.has(attachment.mimeType));
  const files = entry.attachments.filter((attachment) => !INLINE_IMAGE_TYPES.has(attachment.mimeType));
  return (
    <>
      {images.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((attachment) => (
        <a key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, not optimizable */}
          <img src={`/api/attachments/${attachment.id}`} alt={attachment.fileName} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <span className="block truncate px-2 py-1 text-xs">{attachment.fileName}</span>
        </a>
      ))}</div>}
      {files.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{files.map((attachment) => (
        <li key={attachment.id}><a href={`/api/attachments/${attachment.id}`} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-2"><FileText className="size-4 shrink-0 text-muted" aria-hidden /><span className="truncate font-bold">{attachment.fileName}</span><span className="shrink-0 text-muted">{formatBytes(attachment.sizeBytes)}</span></a></li>
      ))}</ul>}
    </>
  );
}

function Message({ entry, mine, now }: { entry: Entry; mine: boolean; now: Date }) {
  const note = entry.type === "INTERNAL_NOTE";
  const fromStaff = entry.type !== "CLIENT_MESSAGE";
  const images = entry.attachments.filter((a) => INLINE_IMAGE_TYPES.has(a.mimeType));
  const files = entry.attachments.filter((a) => !INLINE_IMAGE_TYPES.has(a.mimeType));

  return (
    <li className={clsx("relative z-10 flex gap-2.5", mine && "flex-row-reverse")}>
      <Avatar name={entry.author?.name ?? "?"} className="mt-1 hidden sm:grid" />
      <article
        className={clsx(
          // On wider screens the bubble shrinks to its text but leaves room for the avatar column.
          "relative min-w-0 flex-1 rounded-xl border px-4 py-4 sm:min-w-72 sm:max-w-[min(calc(100%-3rem),42rem)] sm:flex-initial sm:px-5 md:min-w-96",
          note
            ? "border-note-border border-dashed bg-note-bg"
            : mine
              ? "border-primary/40 bg-primary-soft after:absolute after:top-5 after:-right-1.5 after:size-3 after:rotate-45 after:border-r after:border-t after:border-primary/40 after:bg-primary-soft"
              : "border-reply-border bg-reply-bg shadow-card after:absolute after:top-5 after:-left-1.5 after:size-3 after:rotate-45 after:border-b after:border-l after:border-reply-border after:bg-reply-bg",
        )}
      >
        <header className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base">
          <span className="font-bold text-gold-text">{entry.author?.name ?? "Unknown sender"}</span>
          {fromStaff && !note && <span className="font-bold text-primary">IT Team</span>}
          {note && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-note">
              <Lock className="size-3" aria-hidden /> Internal note · staff only
            </span>
          )}
          <time className="ml-auto text-sm text-muted" dateTime={entry.createdAt.toISOString()} title={formatDateTime(entry.createdAt)}>
            {formatRelative(entry.createdAt, now)}
          </time>
        </header>
        <div className="whitespace-pre-wrap break-words text-base leading-relaxed">{entry.body}</div>

        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((a) => (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, not optimizable */}
                <img src={`/api/attachments/${a.id}`} alt={a.fileName} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              </a>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/attachments/${a.id}`}
                  className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-2"
                >
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate font-bold">{a.fileName}</span>
                  <span className="shrink-0 text-muted">{formatBytes(a.sizeBytes)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}
