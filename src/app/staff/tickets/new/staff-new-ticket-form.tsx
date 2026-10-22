"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { staffCreateTicketAction } from "../../actions";

type Option = { id: string; name: string };

export function StaffNewTicketForm({ topics, campuses, accept }: { topics: Option[]; campuses: Option[]; accept: string }) {
  const [state, formAction, pending] = useActionState(staffCreateTicketAction, initialActionState);
  // Submit manually so a validation error doesn't wipe what the agent typed.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {state.error && <Alert>{state.error}</Alert>}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-muted">Requester</legend>
        <Field label="Email" htmlFor="requesterEmail">
          <Input id="requesterEmail" name="requesterEmail" type="email" inputMode="email" required placeholder="name@ciaschool.edu.kh" />
        </Field>
        <Field label="Name" htmlFor="requesterName" hint="Only needed if they don't have an account yet.">
          <Input id="requesterName" name="requesterName" maxLength={100} autoComplete="off" />
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How did they contact IT?" htmlFor="source">
          <Select id="source" name="source" defaultValue="PHONE">
            <option value="PHONE">Phone</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="EMAIL">Email</option>
            <option value="WEB">Other / web</option>
          </Select>
        </Field>
        {campuses.length > 1 && (
          <Field label="Campus" htmlFor="campusId" hint="Defaults to the requester's home campus.">
            <Select id="campusId" name="campusId" defaultValue="">
              <option value="">Requester's campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Help topic" htmlFor="helpTopicId">
          <Select id="helpTopicId" name="helpTopicId" required defaultValue="">
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" required minLength={3} maxLength={200} />
      </Field>
      <Field label="What's the problem?" htmlFor="body" hint="Write it as the requester described it. It's shown as their message.">
        <Textarea id="body" name="body" required rows={6} />
      </Field>
      <Field label="Attachments" htmlFor="files">
        <Input id="files" name="files" type="file" multiple accept={accept} className="py-2.5" />
      </Field>

      <SubmitButton size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create ticket"}
      </SubmitButton>
    </form>
  );
}
