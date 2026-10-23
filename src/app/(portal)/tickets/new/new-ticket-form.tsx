"use client";

import { BookOpen, ExternalLink, Paperclip } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { createTicketAction } from "../../actions";

type Topic = { id: string; name: string; description: string | null };
type Campus = { id: string; name: string };
type Article = { id: string; title: string; helpTopicId: string | null };

const STOP_WORDS = new Set(["the", "and", "for", "not", "can't", "cant", "won't", "wont", "with", "my", "is", "in", "on", "to", "a", "it"]);

export function NewTicketForm({
  topics,
  campuses,
  articles,
  initialTopicId,
  requester,
  accept,
}: {
  topics: Topic[];
  campuses: Campus[];
  articles: Article[];
  initialTopicId: string;
  requester: { name: string; email: string };
  accept: string;
}) {
  const [state, action] = useActionState(createTicketAction, initialActionState);
  // Controlled so typed text survives a validation error.
  const [topicId, setTopicId] = useState(initialTopicId);
  const [campusId, setCampusId] = useState("");
  const [room, setRoom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const suggestions = suggestArticles(articles, topicId, subject);

  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}

      <section aria-label="Your details" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-card">
        <p className="mb-2 font-bold">Your details</p>
        <div className="grid gap-1 sm:grid-cols-[6rem_1fr]">
          <span className="text-muted">Email</span>
          <span className="break-all">{requester.email}</span>
          <span className="text-muted">Client</span>
          <span>{requester.name}</span>
        </div>
      </section>

      <Field label="Help Topic" htmlFor="helpTopicId" hint={topics.find((topic) => topic.id === topicId)?.description ?? "Choose the type of IT help you need."}>
        <Select id="helpTopicId" name="helpTopicId" required value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="" disabled>Choose a help topic</option>
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campus" htmlFor="campusId" hint="Choose where the issue is happening.">
          <Select id="campusId" name="campusId" required value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="" disabled>
              Choose a campus
            </option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Room" htmlFor="room" hint="Room number or location.">
          <Input id="room" name="room" required maxLength={100} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 204" />
        </Field>
      </div>

      <Field label="Issue Summary" htmlFor="subject" hint="A short summary, e.g. “Projector in room 12 won't turn on”.">
        <Input id="subject" name="subject" required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      <div aria-live="polite">
        {suggestions.length > 0 && (
          <section aria-label="Suggested help articles" className="rounded-xl border border-primary/30 bg-primary-soft/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <BookOpen className="size-4 text-primary" aria-hidden /> These articles might fix it right away
            </p>
            <ul className="space-y-1">
              {suggestions.map((a) => (
                <li key={a.id}>
                  {/* New tab, so nothing typed here is lost. */}
                  <a href={`/help/${a.id}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 font-bold text-primary hover:underline">
                    {a.title} <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Field label="Please Describe Your Issue" htmlFor="body" hint="What happened, what device is affected, and what have you tried?">
        <Textarea id="body" name="body" required rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-4 font-bold text-muted transition-colors hover:bg-surface-2 hover:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
          <Paperclip className="size-5" aria-hidden />
          {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? "s" : ""} attached` : "Add photos or files"}
          <input type="file" name="files" multiple accept={accept} className="sr-only" onChange={(e) => setFileCount(e.target.files?.length ?? 0)} />
        </label>
        <p className="mt-1.5 text-sm text-muted">Up to 5 files, 10 MB each. A photo of the error helps a lot.</p>
      </div>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Sending…">
        Submit ticket
      </SubmitButton>
    </form>
  );
}

// Subject words that appear in a title rank it first; same-topic articles fill in when nothing matches.
function suggestArticles(articles: Article[], topicId: string, subject: string): Article[] {
  const words = subject
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (!topicId && words.length === 0) return [];
  return articles
    .map((a) => {
      const title = a.title.toLowerCase();
      const hits = words.filter((w) => title.includes(w)).length;
      return { a, score: hits * 2 + (topicId && a.helpTopicId === topicId ? 1 : 0) };
    })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((s) => s.a);
}
