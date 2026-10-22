"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { Checkbox } from "@/components/ui/field";
import { changePasswordAction, emailAlertsAction, updateProfileAction } from "../actions";

export function EmailAlertsForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(emailAlertsAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      {state.ok && <Alert tone="success">Saved.</Alert>}
      <Checkbox
        name="emailAlerts"
        defaultChecked={enabled}
        label={<span>Email me about new tickets for my teams, assignments, and requester replies</span>}
      />
      <SubmitButton variant="secondary">Save</SubmitButton>
    </form>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">Saved.</Alert>}
      <Field label="Display name" htmlFor="name">
        <Input id="name" name="name" required maxLength={100} defaultValue={name} autoComplete="name" />
      </Field>
      <SubmitButton variant="secondary">Save name</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">Password changed.</Alert>}
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 10 characters.">
        <Input id="newPassword" name="newPassword" type="password" required minLength={10} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" />
      </Field>
      <SubmitButton variant="secondary">Change password</SubmitButton>
    </form>
  );
}
