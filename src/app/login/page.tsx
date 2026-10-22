import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { googleLoginAction } from "@/app/actions/auth";
import { googleEnabled } from "@/auth";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { allowedDomain, safeRedirectPath } from "@/server/auth-rules";
import { getCurrentUser } from "@/server/authz";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: `Please sign in with your @${allowedDomain()} Google account. If you already did, your account may be deactivated.`,
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/go");

  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Desktop brand panel; phones get the compact header in the form column. The rings echo the app icon. */}
      <section aria-hidden className="relative hidden overflow-hidden bg-brand text-brand-fg lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute -right-40 -bottom-40 size-[34rem] rounded-full border-[3.5rem] border-brand-fg/[0.06]" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 size-72 rounded-full border-[2rem] border-brand-fg/[0.08]" />
        <span className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-brand-fg text-brand">
            <LifeBuoy className="size-6" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight">CIA IT Helpdesk</span>
        </span>
        <div className="relative max-w-md">
          <p className="text-4xl leading-[1.1] font-bold tracking-tight text-balance xl:text-5xl">Something broken? We&apos;ll help you fix it.</p>
          <p className="mt-4 max-w-[38ch] text-lg text-brand-fg/80">Report a problem, follow its progress, and talk to the IT team in one place.</p>
        </div>
        <p className="relative text-sm text-brand-fg/75">For students and staff with a school account.</p>
      </section>

      <div className="grid place-items-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <BrandMark className="mb-4 size-14 rounded-xl lg:hidden [&_svg]:size-7" />
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="lg:hidden">CIA IT Helpdesk</span>
              <span className="hidden lg:inline">Sign in</span>
            </h1>
            <p className="mt-1 text-muted">Sign in to get help from the IT team.</p>
          </div>

          <Card className="space-y-5 p-5 sm:p-6">
            {error && <Alert>{error}</Alert>}

            {googleEnabled && (
              <>
                <form action={googleLoginAction}>
                  {next && <input type="hidden" name="next" value={next} />}
                  <Button type="submit" variant="secondary" size="lg" className="w-full">
                    <GoogleIcon /> Continue with Google
                  </Button>
                </form>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <LoginForm next={next} />
          </Card>

          <p className="mt-6 text-center text-sm text-muted lg:text-left">Forgot your password? Ask the IT office to reset it.</p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}
