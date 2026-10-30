"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { auth, signIn, signOut } from "@/auth";
import type { ActionState } from "@/lib/action-state";
import { THEME_COOKIE } from "@/lib/theme";
import { recordSignOut } from "@/server/audit-log";
import { safeRedirectPath } from "@/server/auth-rules";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeRedirectPath(formData.get("next"), "/go"),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      return {
        error:
          code === "rate_limited"
            ? "Too many attempts. Please wait 15 minutes and try again."
            : "That email and password don't match an active account.",
      };
    }
    throw err; // includes the redirect on success
  }
}

export async function googleLoginAction(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirectPath(formData.get("next"), "/go") });
}

export async function logoutAction() {
  const userId = (await auth())?.user?.id;
  if (userId) await recordSignOut(userId);
  // The choice lives on the account; on a shared PC the next person starts from their own (or the device's).
  (await cookies()).delete(THEME_COOKIE);
  await signOut({ redirectTo: "/login" });
}
