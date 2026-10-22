"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Role, TicketPriority } from "@/generated/prisma/enums";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { PRIORITIES, PRIORITY_LABEL, ROLE_LABEL } from "@/lib/labels";
import {
  saveCampusAction,
  saveCannedAction,
  saveDepartmentAction,
  saveEmailTemplateAction,
  saveHelpTopicAction,
  saveOrganizationAction,
  saveSlaAction,
  saveTeamAction,
  saveUserAction,
} from "./actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };

// Submits via onSubmit instead of <form action> so React doesn't reset the fields on a validation error.
function AdminForm({
  action,
  cancelHref,
  id,
  submitLabel,
  children,
}: {
  action: Action;
  cancelHref: string;
  id?: string;
  submitLabel?: string; // defaults to "Save changes" when editing, "Create" otherwise
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <div className="flex gap-2 pt-1">
        <SubmitButton disabled={pending}>{submitLabel ?? (id ? "Save changes" : "Create")}</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}

function NameAndDescription({ name, description }: { name?: string; description?: string | null }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={name} />
      </Field>
      <Field label="Description" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" rows={2} className="min-h-20" maxLength={500} defaultValue={description ?? ""} />
      </Field>
    </>
  );
}

function ActiveToggle({ isActive = true, hint }: { isActive?: boolean; hint: string }) {
  return (
    <div className="sm:col-span-2">
      <Checkbox name="isActive" defaultChecked={isActive} label={<span className="font-bold">Active</span>} />
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

function OptionSelect({ id, label, options, value, empty }: { id: string; label: string; options: Option[]; value?: string | null; empty: string }) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} name={id} defaultValue={value ?? ""}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  organizationId: string | null;
  campusId: string | null;
  staffCampusIds: string[];
  manageCampusIds: string[];
  isActive: boolean;
  teamIds: string[];
  hasPassword: boolean;
};

export function UserForm({
  user,
  departments,
  teams,
  organizations,
  campuses,
  roles,
  superadmin,
}: {
  user?: UserRow;
  departments: Option[];
  teams: Option[];
  organizations: Option[];
  campuses: Option[]; // campuses the editor may assign
  roles: Role[]; // roles the editor may assign
  superadmin: boolean;
}) {
  return (
    <AdminForm action={saveUserAction} cancelHref="/staff/admin/users" id={user?.id}>
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={user?.name} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required defaultValue={user?.email} />
      </Field>
      <Field label="Role" htmlFor="role">
        <Select id="role" name="role" defaultValue={user?.role ?? "USER"}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Home campus" htmlFor="campusId" hint="New tickets from this person go to this campus.">
        <Select id="campusId" name="campusId" required={!superadmin} defaultValue={user ? (user.campusId ?? "") : superadmin ? "auto" : (campuses[0]?.id ?? "")}>
          {superadmin && <option value="auto">Match by email domain</option>}
          {superadmin && <option value="">None</option>}
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <OptionSelect id="departmentId" label="Department" options={departments} value={user?.departmentId} empty="None" />
      <Field label="Organization" htmlFor="organizationId">
        <Select id="organizationId" name="organizationId" defaultValue={user ? (user.organizationId ?? "") : "auto"}>
          <option value="auto">Match by email domain</option>
          <option value="">None</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={user?.hasPassword ? "New password" : "Password"}
        htmlFor="password"
        hint={user ? "Leave blank to keep the current password. Google users don't need one." : "Optional for Google sign-in users. At least 10 characters."}
        className="sm:col-span-2"
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-sm font-bold">Campus access</legend>
        <p className="mb-2 text-sm text-muted">
          Agents and campus admins only see tickets from the campuses they work at. Superadmins see every campus.
          {superadmin && " “Manage users & agents” only applies to campus admins."}
        </p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {campuses.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-6 px-3 py-1">
              <span className="min-w-32 flex-1 font-bold">{c.name}</span>
              <Checkbox name="staffCampusIds" value={c.id} defaultChecked={user?.staffCampusIds.includes(c.id)} label="Works here" />
              {superadmin && (
                <Checkbox name="manageCampusIds" value={c.id} defaultChecked={user?.manageCampusIds.includes(c.id)} label="Manage users & agents" />
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-sm font-bold">Teams</legend>
        <p className="mb-1 text-sm text-muted">Agents and admins only.</p>
        <div className="grid sm:grid-cols-2">
          {teams.map((t) => (
            <Checkbox key={t.id} name="teamIds" value={t.id} defaultChecked={user?.teamIds.includes(t.id)} label={t.name} />
          ))}
        </div>
      </fieldset>
      <ActiveToggle isActive={user?.isActive} hint="Inactive users can't sign in. Their open tickets are unassigned." />
    </AdminForm>
  );
}

// ─── Campuses ───────────────────────────────────────────────────────────────

type CampusRow = { id: string; name: string; emailDomains: string[]; isActive: boolean };

export function CampusForm({ campus }: { campus?: CampusRow }) {
  return (
    <AdminForm action={saveCampusAction} cancelHref="/staff/admin/campuses" id={campus?.id}>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={campus?.name} placeholder="e.g. Toul Kork Campus" />
      </Field>
      <Field label="Email domains" htmlFor="emailDomains" hint="New users with these domains get this home campus. Separate with commas.">
        <Input id="emailDomains" name="emailDomains" defaultValue={campus?.emailDomains.join(", ")} placeholder="tk.ciaschool.edu.kh" autoComplete="off" />
      </Field>
      <ActiveToggle isActive={campus?.isActive} hint="Inactive campuses can't receive new tickets or be assigned to people." />
    </AdminForm>
  );
}

// ─── Departments & teams ────────────────────────────────────────────────────

type Named = { id: string; name: string; description: string | null; isActive: boolean };

export function DepartmentForm({ department }: { department?: Named }) {
  return (
    <AdminForm action={saveDepartmentAction} cancelHref="/staff/admin/departments" id={department?.id}>
      <NameAndDescription name={department?.name} description={department?.description} />
      <ActiveToggle isActive={department?.isActive} hint="Inactive departments are hidden when routing new tickets." />
    </AdminForm>
  );
}

export function TeamForm({ team, departments }: { team?: Named & { departmentId: string | null }; departments: Option[] }) {
  return (
    <AdminForm action={saveTeamAction} cancelHref="/staff/admin/teams" id={team?.id}>
      <NameAndDescription name={team?.name} description={team?.description} />
      <OptionSelect id="departmentId" label="Department" options={departments} value={team?.departmentId} empty="None" />
      <ActiveToggle isActive={team?.isActive} hint="Inactive teams can't be assigned new tickets." />
    </AdminForm>
  );
}

// ─── SLA policies ───────────────────────────────────────────────────────────

type Sla = Named & { responseTimeHours: number; resolutionTimeHours: number };

export function SlaForm({ sla }: { sla?: Sla }) {
  return (
    <AdminForm action={saveSlaAction} cancelHref="/staff/admin/sla" id={sla?.id}>
      <NameAndDescription name={sla?.name} description={sla?.description} />
      <Field label="First response within (hours)" htmlFor="responseTimeHours">
        <Input id="responseTimeHours" name="responseTimeHours" type="number" inputMode="numeric" min={1} required defaultValue={sla?.responseTimeHours ?? 8} />
      </Field>
      <Field label="Resolve within (hours)" htmlFor="resolutionTimeHours">
        <Input id="resolutionTimeHours" name="resolutionTimeHours" type="number" inputMode="numeric" min={1} required defaultValue={sla?.resolutionTimeHours ?? 72} />
      </Field>
      <ActiveToggle isActive={sla?.isActive} hint="Inactive policies aren't applied to new tickets. Existing due dates stay." />
    </AdminForm>
  );
}

// ─── Organizations ──────────────────────────────────────────────────────────

type Org = { id: string; name: string; domains: string[]; notes: string | null; isActive: boolean };

export function OrganizationForm({ org }: { org?: Org }) {
  return (
    <AdminForm action={saveOrganizationAction} cancelHref="/staff/admin/organizations" id={org?.id}>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={org?.name} placeholder="e.g. High School students" />
      </Field>
      <Field label="Email domains" htmlFor="domains" hint="New users with these domains join automatically. Separate with commas.">
        <Input id="domains" name="domains" defaultValue={org?.domains.join(", ")} placeholder="students.ciaschool.edu.kh" autoComplete="off" />
      </Field>
      <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={3} className="min-h-20" defaultValue={org?.notes ?? ""} />
      </Field>
      <ActiveToggle isActive={org?.isActive} hint="Inactive organizations stop auto-assigning new users." />
    </AdminForm>
  );
}

// ─── Email templates ────────────────────────────────────────────────────────

export function EmailTemplateForm({
  templateKey,
  subject,
  body,
  isActive,
  variables,
}: {
  templateKey: string;
  subject: string;
  body: string;
  isActive: boolean;
  variables: readonly string[];
}) {
  return (
    <AdminForm action={saveEmailTemplateAction} cancelHref="/staff/admin/email" submitLabel="Save changes">
      <input type="hidden" name="key" value={templateKey} />
      <Field label="Subject" htmlFor="subject" className="sm:col-span-2">
        <Input id="subject" name="subject" required maxLength={250} defaultValue={subject} />
      </Field>
      <Field
        label="Body"
        htmlFor="body"
        className="sm:col-span-2"
        hint={<>Placeholders: {variables.map((v) => <code key={v} className="mr-1.5 inline-block rounded bg-surface-2 px-1">{`{{${v}}}`}</code>)}</>}
      >
        <Textarea id="body" name="body" required rows={12} defaultValue={body} className="font-mono text-sm" />
      </Field>
      <ActiveToggle isActive={isActive} hint="Turn off to stop sending this email entirely." />
    </AdminForm>
  );
}

// ─── Canned responses ───────────────────────────────────────────────────────

type Canned = { id: string; title: string; body: string; departmentId: string | null; isActive: boolean };

export function CannedForm({ canned, departments, variables }: { canned?: Canned; departments: Option[]; variables: readonly string[] }) {
  return (
    <AdminForm action={saveCannedAction} cancelHref="/staff/admin/canned" id={canned?.id}>
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required maxLength={100} defaultValue={canned?.title} placeholder="e.g. Wifi: forget and rejoin" />
      </Field>
      <OptionSelect id="departmentId" label="Department" options={departments} value={canned?.departmentId} empty="All departments" />
      <Field
        label="Reply"
        htmlFor="body"
        className="sm:col-span-2"
        hint={<>Placeholders: {variables.map((v) => <code key={v} className="mr-1.5 rounded bg-surface-2 px-1">{v}</code>)}</>}
      >
        <Textarea id="body" name="body" required rows={8} defaultValue={canned?.body} />
      </Field>
      <ActiveToggle isActive={canned?.isActive} hint="Inactive replies are hidden from agents." />
    </AdminForm>
  );
}

// ─── Help topics ────────────────────────────────────────────────────────────

type Topic = Named & { defaultPriority: TicketPriority; defaultDepartmentId: string | null; defaultTeamId: string | null; slaPolicyId: string | null };

export function HelpTopicForm({ topic, departments, teams, slas }: { topic?: Topic; departments: Option[]; teams: Option[]; slas: Option[] }) {
  return (
    <AdminForm action={saveHelpTopicAction} cancelHref="/staff/admin/help-topics" id={topic?.id}>
      <NameAndDescription name={topic?.name} description={topic?.description} />
      <Field label="Default priority" htmlFor="defaultPriority">
        <Select id="defaultPriority" name="defaultPriority" defaultValue={topic?.defaultPriority ?? "NORMAL"}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </Field>
      <OptionSelect id="slaPolicyId" label="SLA policy" options={slas} value={topic?.slaPolicyId} empty="No SLA" />
      <OptionSelect id="defaultDepartmentId" label="Route to department" options={departments} value={topic?.defaultDepartmentId} empty="Default department" />
      <OptionSelect id="defaultTeamId" label="Assign to team" options={teams} value={topic?.defaultTeamId} empty="No team" />
      <ActiveToggle isActive={topic?.isActive} hint="Inactive topics are hidden from the new-ticket form." />
    </AdminForm>
  );
}
