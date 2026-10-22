"use client";

import clsx from "clsx";
import { Lock, MessageSquareReply, Paperclip, TriangleAlert, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import type { LockHolder } from "@/server/locks";

const HEARTBEAT_MS = 60_000;

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  accept: string;
  // Staff get a Reply / Internal note toggle; requesters always post a client message.
  staff?: boolean;
  placeholder?: string;
  // Staff only: saved replies, already filled in for this ticket.
  canned?: { id: string; title: string; body: string }[];
  // Staff only: "someone else is replying" warning.
  lock?: {
    ticketId: string;
    holder: LockHolder | null;
    heartbeat: (ticketId: string) => Promise<LockHolder | null>;
    release: (ticketId: string) => Promise<void>;
  };
};

export function Composer({ action, accept, staff = false, placeholder, canned, lock }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [files, setFiles] = useState<File[]>([]);
  const [holder, setHolder] = useState<LockHolder | null>(lock?.holder ?? null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isNote = staff && mode === "note";
  const typing = body.trim() !== "";

  // While this agent has an unsent draft, hold the reply lock and learn whether someone else holds it.
  const lockRef = useRef(lock);
  lockRef.current = lock;
  useEffect(() => {
    const current = lockRef.current;
    if (!current || !typing) return;
    let cancelled = false;
    const beat = () =>
      current
        .heartbeat(current.ticketId)
        .then((h) => !cancelled && setHolder(h))
        // A missed heartbeat only delays the warning; the next one retries.
        .catch((err) => console.warn("Reply-lock heartbeat failed", err));
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      // An unreleased lock expires by itself after LOCK_TTL_MS.
      current.release(current.ticketId).catch((err) => console.warn("Reply-lock release failed", err));
    };
  }, [typing]);

  function insertCanned(id: string) {
    const reply = canned?.find((c) => c.id === id);
    if (!reply) return;
    setMode("reply");
    setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${reply.body}` : reply.body));
  }

  // React resets the file input after every action, so the chip list follows on every result.
  // The text is kept on errors (it's controlled) and only cleared once the message is sent.
  useEffect(() => {
    if (state === initialActionState) return;
    setFiles([]);
    if (state.nonce) setBody("");
  }, [state]);

  // Keep the <input type=file> in sync with the chip list so removing a chip removes the upload.
  function syncInput(next: File[]) {
    setFiles(next);
    if (!fileInput.current) return;
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    fileInput.current.files = dt.files;
  }

  return (
    <form
      action={formAction}
      className={clsx(
        "rounded-xl border bg-surface p-3 shadow-card",
        isNote ? "border-note-border border-dashed bg-note-bg" : "border-border",
      )}
    >
      <input type="hidden" name="mode" value={staff ? mode : "client"} />

      {holder && (
        <div role="status" className="mb-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm font-bold text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {holder.agentName} is also replying to this ticket (started{" "}
            {Math.max(1, Math.round((Date.now() - new Date(holder.acquiredAt).getTime()) / 60_000))} min ago).
          </span>
        </div>
      )}

      {staff && (
        <div role="radiogroup" aria-label="Message type" className="mb-3 inline-flex rounded-lg border border-border bg-surface-2 p-1">
          {(
            [
              ["reply", "Reply to requester", MessageSquareReply],
              ["note", "Internal note", Lock],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={clsx(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold",
                mode === value ? "bg-surface text-text shadow-card" : "text-muted",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}

      {canned && canned.length > 0 && (
        <div className="mb-2">
          <label htmlFor="canned-picker" className="sr-only">
            Insert canned reply
          </label>
          <select
            id="canned-picker"
            value=""
            onChange={(e) => insertCanned(e.target.value)}
            className="min-h-9 max-w-full rounded-lg border border-border bg-surface px-2 text-sm text-muted"
          >
            <option value="">Insert canned reply…</option>
            {canned.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <label htmlFor="composer-body" className="sr-only">
        {isNote ? "Internal note" : "Message"}
      </label>
      <textarea
        id="composer-body"
        name="body"
        required
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isNote ? "Only staff will see this note…" : (placeholder ?? "Write a reply…")}
        className="block min-h-24 w-full resize-y bg-transparent px-1 text-base leading-relaxed placeholder:text-muted/80 focus:outline-none"
      />

      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-surface-2 py-1 pr-1 pl-2.5 text-sm">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => syncInput(files.filter((_, j) => j !== i))}
                className="grid size-7 place-items-center rounded-lg hover:bg-border"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.error && (
        <div className="mt-3">
          <Alert>{state.error}</Alert>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 font-bold text-muted hover:bg-surface-2 hover:text-text">
          <Paperclip className="size-5" aria-hidden />
          <span>Attach</span>
          <input
            ref={fileInput}
            type="file"
            name="files"
            multiple
            accept={accept}
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <SubmitButton pendingText="Sending…">{isNote ? "Add note" : "Send"}</SubmitButton>
      </div>
    </form>
  );
}
