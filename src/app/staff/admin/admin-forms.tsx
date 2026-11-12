"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Role, TicketPriority } from "@/generated/prisma/enums";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { ANNOUNCEMENT_LEVEL_LABEL, ANNOUNCEMENT_LEVELS, type AnnouncementLevel } from "@/lib/announcements";
import { HOLIDAY_MODES, type HolidayMode, isSeason, SEASON_INFO, SEASONS } from "@/lib/holidays";
import { PRIORITIES, PRIORITY_LABEL, ROLE_LABEL } from "@/lib/labels";
import {
  addToCampusAction,
  deleteAnnouncementAction,
  deleteArticleAction,
  deleteCampusAction,
  deleteCannedAction,
  deleteDepartmentAction,
  deleteHelpTopicAction,
  deleteHolidayWindowAction,
  deleteSlaAction,
  deleteTeamAction,
  deleteUserAction,
  saveAnnouncementAction,
  saveArticleAction,
  saveCampusAction,
  saveCannedAction,
  saveDepartmentAction,
  saveEmailTemplateAction,
  saveHelpTopicAction,
  saveHolidayModeAction,
  saveHolidayWindowAction,
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
  remove,
  children,
}: {
  action: Action;
  cancelHref: string;
  id?: string;
  submitLabel?: string; // defaults to "Save changes" when editing, "Create" otherwise
  remove?: { action: Action; name: string; isPermanent?: boolean }; // shows a Delete button when editing
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  return (
    <form onSubmit={onSubmit} className="@container space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 @lg:grid-cols-2">{children}</div>
      <div className="flex gap-2 pt-1">
        <SubmitButton disabled={pending}>{submitLabel ?? (id ? "Save changes" : "Create")}</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
        {id && remove && <DeleteButton id={id} {...remove} />}
      </div>
    </form>
  );
}

// The confirm button is not a submit button: the dialog is portalled but still inside the
// edit form's React tree, so a nested <form> submit would bubble into the save handler.
function DeleteButton({ id, action, name, isPermanent }: { id: string; action: Action; name: string; isPermanent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, deleteAction, pending] = useActionState(action, initialActionState);
  function handleConfirm() {
    const data = new FormData();
    data.set("id", id);
    startTransition(() => deleteAction(data));
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="danger" className="ml-auto">
          <Trash2 className="size-5" aria-hidden /> Delete
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-raised focus:outline-none">
          <Dialog.Title className="pr-10 text-lg font-bold">Delete {name}?</Dialog.Title>
          <Dialog.Description className="mb-4 text-sm text-muted">
            {isPermanent ? "This can't be undone." : "It will be hidden everywhere. You can bring it back from “Show deleted”."}
          </Dialog.Description>
          <Dialog.Close className="absolute top-3 right-3 grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="Close">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          {state.error && (
            <div className="mb-4">
              <Alert>{state.error}</Alert>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={handleConfirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NameAndDescription({ name, description }: { name?: string; description?: string | null }) {
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={name} />
      </Field>
      <Field label="Description" htmlFor="description" className="@lg:col-span-2">
        <Textarea id="description" name="description" rows={2} className="min-h-20" maxLength={500} defaultValue={description ?? ""} />
      </Field>
    </>
  );
}

function ActiveToggle({ isActive = true, hint }: { isActive?: boolean; hint: string }) {
  return (
    <div className="@lg:col-span-2">
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
  campuses,
  roles,
  superadmin,
  isSelf,
}: {
  user?: UserRow;
  departments: Option[];
  teams: Option[];
  campuses: Option[]; // campuses the editor may assign
  roles: Role[]; // roles the editor may assign
  superadmin: boolean;
  isSelf: boolean;
}) {
  return (
    <AdminForm
      action={saveUserAction}
      cancelHref="/staff/admin/users"
      id={user?.id}
      remove={user?.isActive && !isSelf ? { action: deleteUserAction, name: user.name } : undefined}
    >
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
      <Field
        label={user?.hasPassword ? "New password" : "Password"}
        htmlFor="password"
        hint={user ? "Leave blank to keep the current password. Google users don't need one." : "Optional for Google sign-in users. At least 10 characters."}
        className="@lg:col-span-2"
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} />
      </Field>
      <fieldset className="@lg:col-span-2">
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
      <fieldset className="@lg:col-span-2">
        <legend className="mb-1 text-sm font-bold">Teams</legend>
        <p className="mb-1 text-sm text-muted">Agents and admins only.</p>
        <div className="grid @sm:grid-cols-2">
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
    <AdminForm action={saveCampusAction} cancelHref="/staff/admin/campuses" id={campus?.id} remove={campus?.isActive ? { action: deleteCampusAction, name: campus.name } : undefined}>
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

type Candidate = { id: string; name: string; email: string; role: Role };

// Staff start working at the campus; a requester gets it as their home campus.
export function CampusMemberForm({ campusId, candidates }: { campusId: string; candidates: Candidate[] }) {
  return (
    <AdminForm action={addToCampusAction} cancelHref="/staff/admin/campuses" submitLabel="Add">
      <input type="hidden" name="campusId" value={campusId} />
      <Field label="Person" htmlFor="userId" hint="Agents and admins not working here yet, and requesters with no home campus." className="@lg:col-span-2">
        <Select id="userId" name="userId" required defaultValue="">
          <option value="" disabled>
            Choose someone
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({ROLE_LABEL[c.role]}) · {c.email}
            </option>
          ))}
        </Select>
      </Field>
      <div className="@lg:col-span-2">
        <Checkbox name="canManageUsers" label="Manage users & agents" />
        <p className="text-sm text-muted">Only applies to campus admins.</p>
      </div>
    </AdminForm>
  );
}

// ─── Departments & teams ────────────────────────────────────────────────────

type Named = { id: string; name: string; description: string | null; isActive: boolean };

export function DepartmentForm({ department }: { department?: Named }) {
  return (
    <AdminForm
      action={saveDepartmentAction}
      cancelHref="/staff/admin/departments"
      id={department?.id}
      remove={department?.isActive ? { action: deleteDepartmentAction, name: department.name } : undefined}
    >
      <NameAndDescription name={department?.name} description={department?.description} />
      <ActiveToggle isActive={department?.isActive} hint="Inactive departments are hidden when routing new tickets." />
    </AdminForm>
  );
}

export function TeamForm({ team, departments }: { team?: Named & { departmentId: string | null }; departments: Option[] }) {
  return (
    <AdminForm action={saveTeamAction} cancelHref="/staff/admin/teams" id={team?.id} remove={team?.isActive ? { action: deleteTeamAction, name: team.name } : undefined}>
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
    <AdminForm action={saveSlaAction} cancelHref="/staff/admin/sla" id={sla?.id} remove={sla?.isActive ? { action: deleteSlaAction, name: sla.name } : undefined}>
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
      <Field label="Subject" htmlFor="subject" className="@lg:col-span-2">
        <Input id="subject" name="subject" required maxLength={250} defaultValue={subject} />
      </Field>
      <Field
        label="Body"
        htmlFor="body"
        className="@lg:col-span-2"
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
    <AdminForm action={saveCannedAction} cancelHref="/staff/admin/canned" id={canned?.id} remove={canned?.isActive ? { action: deleteCannedAction, name: canned.title } : undefined}>
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required maxLength={100} defaultValue={canned?.title} placeholder="e.g. Wifi: forget and rejoin" />
      </Field>
      <OptionSelect id="departmentId" label="Department" options={departments} value={canned?.departmentId} empty="All departments" />
      <Field
        label="Reply"
        htmlFor="body"
        className="@lg:col-span-2"
        hint={<>Placeholders: {variables.map((v) => <code key={v} className="mr-1.5 rounded bg-surface-2 px-1">{v}</code>)}</>}
      >
        <Textarea id="body" name="body" required rows={8} defaultValue={canned?.body} />
      </Field>
      <ActiveToggle isActive={canned?.isActive} hint="Inactive replies are hidden from agents." />
    </AdminForm>
  );
}

// ─── Announcements ──────────────────────────────────────────────────────────

type Announcement = { id: string; title: string; body: string; level: AnnouncementLevel; campusId: string | null; endsAtLocal: string; isActive: boolean };

export function AnnouncementForm({ announcement, campuses }: { announcement?: Announcement; campuses: Option[] }) {
  return (
    <AdminForm
      action={saveAnnouncementAction}
      cancelHref="/staff/admin/announcements"
      id={announcement?.id}
      submitLabel={announcement ? undefined : "Post"}
      remove={announcement?.isActive ? { action: deleteAnnouncementAction, name: announcement.title } : undefined}
    >
      <Field label="Title" htmlFor="title" className="@lg:col-span-2">
        <Input id="title" name="title" required maxLength={120} defaultValue={announcement?.title} placeholder="e.g. Wi-Fi is down in Building B" />
      </Field>
      <Field label="Type" htmlFor="level">
        <Select id="level" name="level" defaultValue={announcement?.level ?? "info"}>
          {ANNOUNCEMENT_LEVELS.map((level) => (
            <option key={level} value={level}>
              {ANNOUNCEMENT_LEVEL_LABEL[level]}
            </option>
          ))}
        </Select>
      </Field>
      <OptionSelect id="campusId" label="Campus" options={campuses} value={announcement?.campusId} empty="All campuses" />
      <Field label="Message" htmlFor="body" className="@lg:col-span-2" hint="Say what is affected and when you expect it to be fixed.">
        <Textarea id="body" name="body" required rows={4} maxLength={2000} defaultValue={announcement?.body} />
      </Field>
      <Field label="Hide automatically at" htmlFor="endsAt" hint="Optional. Leave empty to keep it up until you take it down.">
        <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={announcement?.endsAtLocal} />
      </Field>
      <ActiveToggle isActive={announcement?.isActive} hint="Inactive announcements are hidden from everyone." />
    </AdminForm>
  );
}

// ─── Help topics ────────────────────────────────────────────────────────────

type Topic = Named & { defaultPriority: TicketPriority; defaultDepartmentId: string | null; defaultTeamId: string | null; slaPolicyId: string | null };

export function HelpTopicForm({ topic, departments, teams, slas }: { topic?: Topic; departments: Option[]; teams: Option[]; slas: Option[] }) {
  return (
    <AdminForm
      action={saveHelpTopicAction}
      cancelHref="/staff/admin/help-topics"
      id={topic?.id}
      remove={topic?.isActive ? { action: deleteHelpTopicAction, name: topic.name } : undefined}
    >
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

// ─── Knowledge base ─────────────────────────────────────────────────────────

type Article = { id: string; title: string; body: string; helpTopicId: string | null; isPublished: boolean };

export function ArticleForm({ article, topics }: { article?: Article; topics: Option[] }) {
  return (
    <AdminForm
      action={saveArticleAction}
      cancelHref="/staff/admin/knowledge-base"
      id={article?.id}
      remove={article && { action: deleteArticleAction, name: article.title, isPermanent: true }}
    >
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required minLength={3} maxLength={200} defaultValue={article?.title} placeholder="e.g. How to connect to school Wi‑Fi" />
      </Field>
      <OptionSelect id="helpTopicId" label="Help topic" options={topics} value={article?.helpTopicId} empty="General" />
      <Field label="Article" htmlFor="body" className="@lg:col-span-2" hint="Plain text. Blank lines start a new paragraph; number your steps 1. 2. 3.">
        <Textarea id="body" name="body" required rows={12} defaultValue={article?.body} />
      </Field>
      <div className="@lg:col-span-2">
        <Checkbox name="isPublished" defaultChecked={article?.isPublished ?? true} label={<span className="font-bold">Published</span>} />
        <p className="text-sm text-muted">Drafts are only visible to superadmins.</p>
      </div>
    </AdminForm>
  );
}

// ─── Holiday themes ─────────────────────────────────────────────────────────

type HolidayWindow = { id: string; season: string; startsOn: string; endsOn: string };

export function HolidayWindowForm({ holiday }: { holiday?: HolidayWindow }) {
  return (
    <AdminForm
      action={saveHolidayWindowAction}
      cancelHref="/staff/admin/holidays"
      id={holiday?.id}
      remove={holiday && { action: deleteHolidayWindowAction, name: `${isSeason(holiday.season) ? SEASON_INFO[holiday.season].name : holiday.season} ${holiday.startsOn.slice(0, 4)}`, isPermanent: true }}
    >
      <Field label="Holiday" htmlFor="season" className="@lg:col-span-2">
        <Select id="season" name="season" required defaultValue={holiday?.season ?? ""}>
          <option value="" disabled>
            Choose a holiday
          </option>
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {SEASON_INFO[s].name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Theme starts" htmlFor="startsOn" hint="A few days before the holiday works well.">
        <Input id="startsOn" name="startsOn" type="date" required defaultValue={holiday?.startsOn} />
      </Field>
      <Field label="Theme ends" htmlFor="endsOn" hint="The last day of the holiday.">
        <Input id="endsOn" name="endsOn" type="date" required defaultValue={holiday?.endsOn} />
      </Field>
    </AdminForm>
  );
}

const MODE_LABEL: Record<HolidayMode, string> = {
  auto: "Automatic, by the dates below",
  off: "Off",
  "khmer-new-year": `Always show ${SEASON_INFO["khmer-new-year"].name}`,
  "pchum-ben": `Always show ${SEASON_INFO["pchum-ben"].name}`,
  "bon-om-touk": `Always show ${SEASON_INFO["bon-om-touk"].name}`,
};

export function HolidayModeForm({ mode }: { mode: HolidayMode }) {
  const [state, formAction, pending] = useActionState(saveHolidayModeAction, initialActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Holiday theme" htmlFor="mode" className="min-w-64 flex-1">
        <Select id="mode" name="mode" defaultValue={mode}>
          {HOLIDAY_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton disabled={pending}>Save</SubmitButton>
    </form>
  );
}
