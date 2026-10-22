"use client";

import { ArrowLeft, ArrowRight, Paperclip } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/labels";
import type { TicketPriority } from "@/generated/prisma/enums";
import { createTicketAction } from "../../actions";

type Topic = { id: string; name: string; description: string | null; defaultPriority: TicketPriority };
type Campus = { id: string; name: string };

const steps = [
  { title: "What do you need help with?", description: "Choose the type of IT help you need." },
  { title: "How urgent is it?", description: "The IT team can adjust priority after reviewing your request." },
  { title: "Where is the problem?", description: "Tell us the campus and room so we can find you." },
  { title: "What happened?", description: "A short subject and a clear description help us respond faster." },
  { title: "Review and send", description: "Check your answers and add a photo or file if it helps." },
] as const;

export function NewTicketForm({ topics, campuses, requester, accept }: { topics: Topic[]; campuses: Campus[]; requester: { name: string; email: string }; accept: string }) {
  const [state, action] = useActionState(createTicketAction, initialActionState);
  const [step, setStep] = useState(0);
  const [topicId, setTopicId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  const [campusId, setCampusId] = useState("");
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
            <Field label="Help topic" htmlFor="helpTopicId" hint={selectedTopic?.description ?? "Choose one option to continue."}>
              <Select id="helpTopicId" className="border-l-[3px] border-l-gold" required value={topicId} onChange={(event) => {
                setTopicId(event.target.value);
                setPriority(topics.find((topic) => topic.id === event.target.value)?.defaultPriority ?? "NORMAL");
              }}>
                <option value="" disabled>Choose a help topic</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </Select>
            </Field>
          )}

          {step === 1 && (
            <Field label="Priority" htmlFor="priority" hint="Choose the urgency that best matches your issue.">
              <Select id="priority" className="border-l-[3px] border-l-gold" value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}
              </Select>
            </Field>
          )}

          {step === 2 && (
            <>
              <Field label="Campus" htmlFor="campusId" hint="Choose where the issue is happening.">
                <Select id="campusId" className="border-l-[3px] border-l-gold" required value={campusId} onChange={(event) => setCampusId(event.target.value)}>
                  <option value="" disabled>Choose a campus</option>
                  {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
                </Select>
              </Field>
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
        {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-bold hover:bg-surface-2"><ArrowLeft className="size-4" aria-hidden /> Back</button> : <span />}
        {step < steps.length - 1 ? (
          <button type="button" onClick={nextStep} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-5 font-bold text-action-fg hover:bg-action-hover">Continue <ArrowRight className="size-4" aria-hidden /></button>
        ) : (
          <SubmitButton size="lg" pendingText="Sending…">Submit ticket</SubmitButton>
        )}
      </div>
    </form>
  );
}
