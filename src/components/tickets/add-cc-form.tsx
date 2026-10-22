"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";

export function AddCcForm({ action, askName, hint }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; askName: boolean; hint?: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.nonce) ref.current?.reset();
  }, [state.nonce]);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <label htmlFor="cc-email" className="sr-only">
        Email to CC
      </label>
      <Input id="cc-email" name="email" type="email" inputMode="email" required placeholder="Add someone by email" />
      {askName && (
        <>
          <label htmlFor="cc-name" className="sr-only">
            Their name (if new)
          </label>
          <Input id="cc-name" name="name" maxLength={100} placeholder="Name (only if they're new)" />
        </>
      )}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <SubmitButton variant="secondary" className="w-full">
        Add to CC
      </SubmitButton>
    </form>
  );
}
