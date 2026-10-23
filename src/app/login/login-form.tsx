"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Alert } from "@/components/ui/misc";
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
        <label htmlFor="emailInput" className="block text-sm font-semibold text-slate-100">Email</label>
        <input id="emailInput" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="Your help desk email"
          className="min-h-11 w-full rounded-lg border border-[#395572] bg-[#142338] px-3.5 py-2 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-[#6fd5eb] focus:ring-2 focus:ring-[#6fd5eb]/30" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="passwordInput" className="block text-sm font-semibold text-slate-100">Password</label>
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-controls="passwordInput" aria-pressed={showPassword}
            className="rounded text-xs font-semibold text-sky-300 hover:text-sky-100">{showPassword ? "Hide" : "Show"}</button>
        </div>
        <input id="passwordInput" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
          className="min-h-11 w-full rounded-lg border border-[#395572] bg-[#142338] px-3.5 py-2 text-base text-white outline-none transition-colors focus:border-[#6fd5eb] focus:ring-2 focus:ring-[#6fd5eb]/30" />
      </div>
      <SubmitButton size="lg" className="w-full border-0 bg-[#6fd5eb] text-[#071324] shadow-[0_0_22px_rgba(111,213,235,0.22)] hover:bg-[#a1eafa]" pendingText="Logging in…">
        Login
      </SubmitButton>
    </form>
  );
}
