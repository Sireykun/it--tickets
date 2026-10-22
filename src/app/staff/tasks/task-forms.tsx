"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TaskStatus } from "@/generated/prisma/enums";
import { type ActionState, initialActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };

type TaskValues = {
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedAgentId: string | null;
  assignedTeamId: string | null;
  dueAtLocal: string; // datetime-local value in the school's timezone
};

// Used for both "new task" and "edit task". Submits without React's auto-reset so errors keep input.
export function TaskForm({ action, task, agents, teams, submitLabel }: { action: Action; task?: TaskValues; agents: Option[]; teams: Option[]; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} defaultValue={task?.title} />
      </Field>
      <Field label="Details" htmlFor="description">
        <Textarea id="description" name="description" rows={4} className="min-h-24" defaultValue={task?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agent" htmlFor="assignedAgentId">
          <Select id="assignedAgentId" name="assignedAgentId" defaultValue={task?.assignedAgentId ?? ""}>
            <option value="">No agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Team" htmlFor="assignedTeamId">
          <Select id="assignedTeamId" name="assignedTeamId" defaultValue={task?.assignedTeamId ?? ""}>
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due" htmlFor="dueAt">
          <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={task?.dueAtLocal} />
        </Field>
        {task && (
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={task.status}>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Done</option>
            </Select>
          </Field>
        )}
      </div>
      <SubmitButton disabled={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}

export function TaskCommentForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.nonce) ref.current?.reset();
  }, [state.nonce]);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <label htmlFor="task-comment" className="sr-only">
        Comment
      </label>
      <Textarea id="task-comment" name="body" required rows={3} className="min-h-20" placeholder="Add a comment for the team…" />
      <SubmitButton variant="secondary">Comment</SubmitButton>
    </form>
  );
}
