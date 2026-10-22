"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Alert } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initialActionState);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="space-y-1.5">
        <label htmlFor="emailInput" className="block text-sm font-semibold text-text">Email</label>
        <Input id="emailInput" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="Your help desk email" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="passwordInput" className="block text-sm font-semibold text-text">Password</label>
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-controls="passwordInput" aria-pressed={showPassword}
            className="rounded text-sm font-semibold text-primary hover:text-primary-hover">{showPassword ? "Hide" : "Show"}</button>
        </div>
        <Input id="passwordInput" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Logging in…">
        Login
      </SubmitButton>
    </form>
  );
}
