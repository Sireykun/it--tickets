"use client";

import clsx from "clsx";
import { Lock, MessageSquareReply, Paperclip, SendHorizontal, Smile, TriangleAlert, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import type { LockHolder } from "@/server/locks";

const HEARTBEAT_MS = 60_000;
const EMOJI = ["😀", "😊", "👍", "🙏", "❤️", "🎉", "👋", "😅"];

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [holder, setHolder] = useState<LockHolder | null>(lock?.holder ?? null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
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

  // Let long drafts grow like a chat input, then scroll within the field.
  useEffect(() => {
    const input = bodyInput.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 224)}px`;
  }, [body]);

  // Keep the <input type=file> in sync with the chip list so removing a chip removes the upload.
  function syncInput(next: File[]) {
    setFiles(next);
    if (!fileInput.current) return;
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    fileInput.current.files = dt.files;
  }

  function insertEmoji(emoji: string) {
    const input = bodyInput.current;
    const start = input?.selectionStart ?? body.length;
    const end = input?.selectionEnd ?? start;
    setBody((current) => `${current.slice(0, start)}${emoji}${current.slice(end)}`);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <form
      action={formAction}
      className={clsx(
        "rounded-xl border bg-surface p-2 shadow-card",
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

      <div className="relative flex items-end gap-1">
        <label htmlFor="composer-body" className="sr-only">
          {isNote ? "Internal note" : "Message"}
        </label>
        <textarea
          ref={bodyInput}
          id="composer-body"
          name="body"
          required
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isNote ? "Only staff will see this note…" : (placeholder ?? "Write a reply…")}
          className="min-h-12 max-h-56 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-lg leading-relaxed placeholder:text-muted/80 focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <label title="Attach files" className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text has-focus-visible:outline-2 has-focus-visible:outline-focus">
            <Paperclip className="size-5" aria-hidden />
            <span className="sr-only">Attach files</span>
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
          <button type="button" aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
            <Smile className="size-5" aria-hidden />
          </button>
          <SubmitButton pendingText="Sending…" aria-label={isNote ? "Add note" : "Send message"} className="size-11 px-0 sm:w-auto sm:px-4">
            <SendHorizontal className="size-5" aria-hidden /> <span className="hidden sm:inline">{isNote ? "Add note" : "Send"}</span>
          </SubmitButton>
        </div>
        {emojiOpen && (
          <div role="group" aria-label="Emoji" onKeyDown={(event) => { if (event.key === "Escape") setEmojiOpen(false); }} className="absolute right-0 bottom-full z-10 mb-2 grid grid-cols-4 gap-1 rounded-xl border border-gold/50 bg-surface-2 p-2 shadow-raised">
            {EMOJI.map((emoji) => <button key={emoji} type="button" aria-label={`Insert ${emoji}`} onClick={() => insertEmoji(emoji)} className="grid size-11 place-items-center rounded-lg text-2xl hover:bg-primary-soft">{emoji}</button>)}
          </div>
        )}
      </div>

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

    </form>
  );
}
