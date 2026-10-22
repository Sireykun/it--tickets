"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { Field, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";

type Option = { id: string; name: string };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  ticket: {
    status: TicketStatus;
    priority: TicketPriority;
    campusId: string | null;
    departmentId: string;
    assignedTeamId: string | null;
    assignedAgentId: string | null;
  };
  campuses: Option[]; // campuses the viewer works at
  departments: Option[];
  teams: Option[];
  agents: Option[]; // agents at the ticket's campus
};

export function TicketFieldsForm({ action, ticket, campuses, departments, teams, agents }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      {/* Success shows as a system event in the thread; this form remounts after each save. */}
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={ticket.status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="priority">
        <Select id="priority" name="priority" defaultValue={ticket.priority}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </Field>
      {/* Only staff with more than one campus can move tickets between them. */}
      {campuses.length > 1 && (
        <Field label="Campus" htmlFor="campusId" hint="Moving a ticket unassigns an agent who doesn't work at the new campus.">
          <Select id="campusId" name="campusId" defaultValue={ticket.campusId ?? ""}>
            {!ticket.campusId && (
              <option value="" disabled>
                No campus
              </option>
            )}
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Department" htmlFor="departmentId">
        <Select id="departmentId" name="departmentId" defaultValue={ticket.departmentId}>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Team" htmlFor="assignedTeamId">
        <Select id="assignedTeamId" name="assignedTeamId" defaultValue={ticket.assignedTeamId ?? ""}>
          <option value="">No team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assignee" htmlFor="assignedAgentId">
        <Select id="assignedAgentId" name="assignedAgentId" defaultValue={ticket.assignedAgentId ?? ""}>
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}

// Collapsible on phones (so the conversation stays near the top), always open on large screens.
export function CollapsiblePanel({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left lg:hidden"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown className={clsx("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div className={clsx("border-t border-border p-4 lg:block lg:border-t-0", open ? "block" : "hidden")}>{children}</div>
    </div>
  );
}
