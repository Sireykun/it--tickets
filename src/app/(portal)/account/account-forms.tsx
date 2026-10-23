"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { THEME_OPTIONS } from "@/components/ui/user-menu";
import { initialActionState } from "@/lib/action-state";
import { applyTheme, type Theme } from "@/lib/theme";
import { changePasswordAction, emailAlertsAction, updateProfileAction, uploadAvatarAction } from "../actions";

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

export function ThemePicker({ theme }: { theme: Theme }) {
  const [value, setValue] = useState(theme);
  return (
    <fieldset>
      <legend className="sr-only">Theme</legend>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ value: v, label, icon: Icon }) => (
          <label
            key={v}
            className={clsx(
              "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-sm font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              value === v ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:border-border-strong hover:text-text",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={v}
              checked={value === v}
              onChange={() => {
                setValue(v);
                applyTheme(v);
              }}
              className="sr-only"
            />
            <Icon className="size-5" aria-hidden />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
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

