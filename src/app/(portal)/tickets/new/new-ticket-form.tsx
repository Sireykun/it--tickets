"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Paperclip, Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/labels";
import type { TicketPriority } from "@/generated/prisma/enums";
import { createTicketAction } from "../../actions";

type Topic = { id: string; name: string; description: string | null; defaultPriority: TicketPriority };
type Campus = { id: string; name: string };
type Guide = { id: string; title: string; topicId: string };

const PRIORITY_HINT: Record<TicketPriority, string> = {
  LOW: "No rush. It can wait a few days.",
  NORMAL: "It's slowing me down, but I can still work.",
  HIGH: "I can't do my work or teach my class.",
  EMERGENCY: "Many people are affected, or it's a safety problem.",
};
// Below this many options a filter box is just clutter.
const SEARCH_FROM = 8;

const steps = [
  { title: "What do you need help with?", description: "Choose the type of IT help you need." },
  { title: "How urgent is it?", description: "The IT team can adjust priority after reviewing your request." },
  { title: "Where is the problem?", description: "Tell us the campus and room so we can find you." },
  { title: "What happened?", description: "A short subject and a clear description help us respond faster." },
  { title: "Review and send", description: "Check your answers and add a photo or file if it helps." },
] as const;

export function NewTicketForm({ topics, guides, campuses, homeCampusId, requester, accept }: { topics: Topic[]; guides: Guide[]; campuses: Campus[]; homeCampusId: string | null; requester: { name: string; email: string }; accept: string }) {
  const [state, action] = useActionState(createTicketAction, initialActionState);
  const [step, setStep] = useState(0);
  const [topicId, setTopicId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  // Starts on the requester's home campus, which is where most problems are.
  const [campusId, setCampusId] = useState(campuses.some((campus) => campus.id === homeCampusId) ? (homeCampusId ?? "") : "");
  const [room, setRoom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  function nextStep() {
    if (!formRef.current?.reportValidity()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const topicGuides = guides.filter((guide) => guide.topicId === topicId);
  const selectedCampus = campuses.find((campus) => campus.id === campusId);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="helpTopicId" value={topicId} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="campusId" value={campusId} />
      <input type="hidden" name="room" value={room} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="body" value={body} />

      {state.error && <Alert>{state.error}</Alert>}

      <div role="progressbar" aria-label="New ticket progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-gold-text">Step {step + 1} of {steps.length}</p>
        <div className="grid grid-cols-5 gap-2" aria-hidden>
          {steps.map((item, index) => <span key={item.title} className={`h-1.5 rounded-full ${index <= step ? "bg-gold" : "bg-border-strong"}`} />)}
        </div>
      </div>

      <section className="rounded-xl border border-gold/50 bg-surface p-5 sm:p-6" aria-labelledby="step-title">
        <h2 ref={headingRef} tabIndex={-1} id="step-title" className="text-xl font-bold leading-tight outline-none">{steps[step].title}</h2>
        <p className="mt-2 text-muted">{steps[step].description}</p>

        <div className="mt-6 space-y-5">
          {step === 0 && (
            <ChoiceCards
              legend="Help topic"
              name="topicChoice"
              options={topics.map((topic) => ({ id: topic.id, label: topic.name, detail: topic.description }))}
              value={topicId}
              onChange={(id) => {
                setTopicId(id);
                setPriority(topics.find((topic) => topic.id === id)?.defaultPriority ?? "NORMAL");
              }}
              searchLabel="Search help topics"
            />
          )}
          {step === 0 && topicGuides.length > 0 && (
            <TopicGuides guides={topicGuides} />
          )}

          {step === 1 && (
            <ChoiceCards
              legend="Priority"
              name="priorityChoice"
              options={PRIORITIES.map((value) => ({ id: value, label: PRIORITY_LABEL[value], detail: PRIORITY_HINT[value] }))}
              value={priority}
              onChange={(id) => setPriority(id as TicketPriority)}
            />
          )}

          {step === 2 && (
            <>
              <ChoiceCards
                legend="Campus"
                name="campusChoice"
                options={campuses.map((campus) => ({ id: campus.id, label: campus.name, detail: campus.id === homeCampusId ? "Your campus" : null }))}
                value={campusId}
                onChange={setCampusId}
              />
              <Field label="Room" htmlFor="room" hint="Room number or location.">
                <Input id="room" className="border-l-[3px] border-l-gold" required maxLength={100} value={room} onChange={(event) => setRoom(event.target.value)} placeholder="e.g. Room 204" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Issue summary" htmlFor="subject" hint="A short summary, e.g. “Projector in room 12 won't turn on”.">
                <Input id="subject" className="border-l-[3px] border-l-gold" required minLength={3} maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} />
              </Field>
              <Field label="Please describe your issue" htmlFor="body" hint="What happened, what device is affected, and what have you tried?">
                <Textarea id="body" className="border-l-[3px] border-l-gold" required rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <dl className="divide-y divide-border rounded-lg border border-border bg-surface-2 px-4">
                <div className="py-3"><dt className="text-sm font-bold text-muted">From</dt><dd className="break-all">{requester.name} · {requester.email}</dd></div>
                <div className="py-3"><dt className="text-sm font-bold text-muted">Help topic and priority</dt><dd>{selectedTopic?.name} · {PRIORITY_LABEL[priority]}</dd></div>
                <div className="py-3"><dt className="text-sm font-bold text-muted">Location</dt><dd>{selectedCampus?.name} · {room}</dd></div>
                <div className="py-3"><dt className="text-sm font-bold text-muted">Issue</dt><dd className="break-words font-bold">{subject}</dd><dd className="mt-1 whitespace-pre-wrap break-words text-muted">{body}</dd></div>
              </dl>
              <div>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gold/60 bg-surface-2 px-4 font-bold text-gold-text transition-colors hover:bg-gold/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
                  <Paperclip className="size-5" aria-hidden />
                  {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? "s" : ""} attached` : "Add photos or files"}
                  <input type="file" name="files" multiple accept={accept} className="sr-only" onChange={(event) => setFileCount(event.target.files?.length ?? 0)} />
                </label>
                <p className="mt-1.5 text-sm text-muted">Up to 5 files, 10 MB each. A photo of the error helps a lot.</p>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-bold hover:bg-surface-2"><ArrowLeft className="size-4" aria-hidden /> Back</button> : <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-bold text-gold-text hover:bg-surface-2"><ArrowLeft className="size-4" aria-hidden /> Back to tickets</Link>}
        {step < steps.length - 1 ? (
          <button type="button" onClick={nextStep} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-5 font-bold text-action-fg hover:bg-action-hover">Continue <ArrowRight className="size-4" aria-hidden /></button>
        ) : (
          <SubmitButton size="lg" pendingText="Sending…">Submit ticket</SubmitButton>
        )}
      </div>
    </form>
  );
}

type Choice = { id: string; label: string; detail: string | null };

// One-of-many as tappable cards. Passing `searchLabel` adds a filter box once the list is long.
function ChoiceCards({ legend, name, options, value, onChange, searchLabel }: { legend: string; name: string; options: Choice[]; value: string; onChange: (id: string) => void; searchLabel?: string }) {
  const [query, setQuery] = useState("");
  const isSearchable = Boolean(searchLabel) && options.length > SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  // The chosen card stays visible while filtering so the required radio group still has its answer.
  const shown = options.filter((option) => option.id === value || `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(needle));

  return (
    <fieldset>
      <legend className="text-sm font-bold">{legend}</legend>
      {isSearchable && (
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label={searchLabel}
            placeholder="e.g. Wi-Fi, printer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Enter would submit the whole ticket form from step one.
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
            className="pl-10"
          />
        </div>
      )}
      <div className={clsx("mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2", isSearchable && "max-h-[26rem] overflow-y-auto p-0.5")}>
        {shown.map((option) => (
          <label
            key={option.id}
            className={clsx(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              value === option.id ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong hover:bg-surface-2",
            )}
          >
            <input type="radio" name={name} required value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className="mt-1 size-4 shrink-0 accent-primary" />
            <span className="min-w-0">
              <span className="block break-words font-bold">{option.label}</span>
              {option.detail && <span className="block text-sm text-muted">{option.detail}</span>}
            </span>
          </label>
        ))}
      </div>
      {shown.length === 0 && <p role="status" className="mt-3 text-muted">Nothing matches “{query}”. Try another word.</p>}
    </fieldset>
  );
}

// Guides for the chosen topic. They open in a new tab so the half-filled ticket isn't lost.
function TopicGuides({ guides }: { guides: Guide[] }) {
  return (
    <aside aria-labelledby="topic-guides-title" className="rounded-lg border border-gold/50 bg-reply-bg p-4">
      <h3 id="topic-guides-title" className="flex items-center gap-2 font-bold">
        <BookOpen className="size-5 text-gold-text" aria-hidden /> These guides might fix it
      </h3>
      <p className="mt-1 text-sm text-muted">Try one first. If it doesn't help, carry on with your ticket.</p>
      <ul className="mt-3 space-y-1.5">
        {guides.map((guide) => (
          <li key={guide.id}>
            <a href={`/help/${guide.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline">
              {guide.title} <ExternalLink className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
