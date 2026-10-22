"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { Checkbox } from "@/components/ui/field";
import { emailAlertsAction, updateProfileAction, uploadAvatarAction } from "../actions";

export function ProfilePhotoForm() {
  const [state, action] = useActionState(uploadAvatarAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Choose a profile photo" htmlFor="photo" hint="PNG, JPEG, or WebP, up to 2 MB.">
        <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" required />
      </Field>
      <SubmitButton variant="secondary">Upload photo</SubmitButton>
    </form>
  );
}

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

