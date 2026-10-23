"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { useStaffClosure } from "@/components/tickets/staff-closure";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";

type Option = { id: string; name: string; role?: string };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  ticket: {
    status: TicketStatus;
    priority: TicketPriority;
    campusId: string | null;
    departmentId: string;
    assignedTeamId: string | null;
    assignedAgentId: string | null;
    assignedAgentName: string | null;
  };
  campuses: Option[];
  departments: Option[];
  teams: Option[];
  agents: Option[];
};

export function TicketFieldsForm({ action, ticket, campuses, departments, teams, agents }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const closure = useStaffClosure();
  const preparingClose = status === "CLOSED" && ticket.status !== "CLOSED";
  const admins = agents.filter((agent) => agent.role === "ADMIN" || agent.role === "SUPERADMIN");
  const currentIsAdmin = admins.some((admin) => admin.id === ticket.assignedAgentId);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden />
        <h2 className="font-bold">Ticket controls</h2>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="divide-y divide-border">
        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 py-2">
          <label htmlFor="status" className="text-sm text-muted">Status</label>
          <Select id="status" name="status" value={status} onChange={(event) => {
            const next = event.target.value as TicketStatus;
            setStatus(next);
            closure?.setClosing(next === "CLOSED" && ticket.status !== "CLOSED");
            if (next === "CLOSED" && ticket.status !== "CLOSED") {
              document.getElementById("staff-reply-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}>
            {STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 py-2">
          <label htmlFor="priority" className="text-sm text-muted">Priority</label>
          <Select id="priority" name="priority" defaultValue={ticket.priority}>
            {PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 py-2">
          <label htmlFor="assignedAgentId" className="text-sm text-muted">Assigned to</label>
          <Select id="assignedAgentId" name="assignedAgentId" defaultValue={ticket.assignedAgentId ?? ""}>
            <option value="">Unassigned</option>
            {ticket.assignedAgentId && !currentIsAdmin && (
              <option value={ticket.assignedAgentId}>{ticket.assignedAgentName ?? "Current assignee"}</option>
            )}
            {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
          </Select>
        </div>
      </div>
      <SubmitButton className="w-full" pendingText="Saving…" disabled={preparingClose}>Save changes</SubmitButton>
      {preparingClose && <p role="status" className="text-sm text-gold-text">Review the prepared reply in the conversation, then send it to close this ticket.</p>}
      <details className="group border-t border-border pt-3">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted hover:text-text [&::-webkit-details-marker]:hidden">
          More routing <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-3 pt-3">
          {campuses.length > 1 && (
            <Field label="Campus" htmlFor="campusId" hint="Moving a ticket may unassign an agent outside that campus.">
              <Select id="campusId" name="campusId" defaultValue={ticket.campusId ?? ""}>
                {!ticket.campusId && <option value="" disabled>No campus</option>}
                {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Department" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId" defaultValue={ticket.departmentId}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
          </Field>
          <Field label="Team" htmlFor="assignedTeamIdRouting">
            <Select id="assignedTeamIdRouting" name="assignedTeamId" defaultValue={ticket.assignedTeamId ?? ""}>
              <option value="">No team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </Select>
          </Field>
        </div>
      </details>
    </form>
  );
}
