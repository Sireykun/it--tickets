"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };

// Clears its fields after a successful submit.
function useResettingForm(action: Action) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.nonce) ref.current?.reset();
  }, [state.nonce]);
  return { state, formAction, ref };
}

export function LinkTicketForm({ action }: { action: Action }) {
  const { state, formAction, ref } = useResettingForm(action);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-2">
        <label htmlFor="link-other" className="sr-only">
          Ticket number to link
        </label>
        <Input id="link-other" name="other" placeholder="TKT-000123" required className="min-w-0 flex-1 not-placeholder-shown:uppercase" autoComplete="off" />
        <SubmitButton variant="secondary">Link</SubmitButton>
      </div>
    </form>
  );
}

// Two-step so a merge (which closes this ticket) is never a single accidental tap.
export function MergeTicketForm({ action, ticketNumber }: { action: Action; ticketNumber: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={formAction} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-2">
        <label htmlFor="merge-other" className="sr-only">
          Merge into ticket number
        </label>
        <Input
          id="merge-other"
          name="other"
          placeholder="Merge into TKT-…"
          required
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setConfirming(false);
          }}
          className="min-w-0 flex-1 not-placeholder-shown:uppercase"
          autoComplete="off"
        />
        {!confirming && (
          <Button variant="secondary" onClick={() => target.trim() && setConfirming(true)}>
            Merge
          </Button>
        )}
      </div>
      {confirming && (
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          <p className="mb-2 font-bold text-warn">
            Move all of {ticketNumber}'s messages into {target.toUpperCase()} and close {ticketNumber}? Its requester will be CC'd on{" "}
            {target.toUpperCase()}.
          </p>
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm">
              Yes, merge
            </SubmitButton>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function QuickTaskForm({ action, agents, teams }: { action: Action; agents: Option[]; teams: Option[] }) {
  const { state, formAction, ref } = useResettingForm(action);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="New task" htmlFor="task-title">
        <Input id="task-title" name="title" required maxLength={200} placeholder="e.g. Replace access point in room 204" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Select name="assignedAgentId" aria-label="Assign task to agent" defaultValue="">
          <option value="">No agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select name="assignedTeamId" aria-label="Assign task to team" defaultValue="">
          <option value="">No team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <Field label="Due" htmlFor="task-due">
        <Input id="task-due" name="dueAt" type="datetime-local" />
      </Field>
      <SubmitButton variant="secondary" className="w-full">
        Add task
      </SubmitButton>
    </form>
  );
}
