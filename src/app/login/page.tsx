import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleLoginAction } from "@/app/actions/auth";
import { googleEnabled } from "@/auth";
import { BrandMark } from "@/components/brand";
import { AccentRule } from "@/components/ui/misc";
import { THEME_COOKIE, toTheme } from "@/lib/theme";
import { allowedDomain, safeRedirectPath } from "@/server/auth-rules";
import { getCurrentUser } from "@/server/authz";
import { LoginForm } from "./login-form";
import { LogoEagle } from "./logo-eagle";

export const metadata: Metadata = { title: "Login" };

const ERRORS: Record<string, string> = {
  AccessDenied: `Please log in with your @${allowedDomain()} Google account. If you already did, your account may be deactivated.`,
  Configuration: "Login is temporarily unavailable. Please try again later.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/go");
  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? "Login failed. Please try again.") : null;
  // Until someone picks a theme in this browser, the login page follows the device's light/dark setting.
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = saved ? toTheme(saved) : "system";

  return (
    <main data-theme={theme} className="grid min-h-dvh bg-bg text-text lg:grid-cols-2">
      {/* The brand panel is deep blue in every theme, so its gold text uses the dark-theme shades. */}
      <section data-theme="dark" className="relative flex min-h-[560px] flex-col gap-6 overflow-hidden bg-linear-to-br from-[#04223a] via-[#0b4f7a] to-[#1a8fc9] px-5 py-5 text-slate-100 sm:px-7 sm:py-7 lg:min-h-dvh">
        <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="inline-flex items-center gap-3 rounded-full border border-sky-300/25 bg-[#04223a]/80 px-3 py-2 shadow-lg backdrop-blur-md">
            <BrandMark className="size-9 shrink-0" />
            <div className="pr-1 leading-tight">
              <strong className="block text-sm font-extrabold tracking-wide text-white">CIA FIRST</strong>
              <span className="block text-[10px] font-medium text-gold-text">INTERNATIONAL SCHOOL · IT Help Desk</span>
            </div>
          </div>
          <p className="le-slogan text-left leading-tight drop-shadow-lg">
            <span className="block text-base font-extrabold tracking-wide text-white sm:text-lg">We Are CIA FIRST</span>
            <span className="block text-sm font-semibold italic text-gold-text sm:text-base">Where Dreams Come True</span>
          </p>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="le-floating w-full max-w-[240px] sm:max-w-[300px] xl:max-w-[360px]">
            <LogoEagle className="w-full drop-shadow-2xl" />
          </div>
        </div>

        <div className="relative z-10 max-w-xl lg:px-5 lg:pb-3">
          <h1 className="max-w-[18ch] text-2xl font-extrabold leading-[1.12] tracking-tight text-white drop-shadow-lg sm:text-3xl xl:text-4xl">
            Something broken?<br />We&apos;ll help you fix it.
          </h1>
          <AccentRule />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-100 sm:text-[15px]">
            Report a problem, follow its progress, and talk to the IT team in one place.
          </p>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#04223a]/90 to-transparent" />
        <div aria-hidden data-theme={theme} className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-bg to-transparent lg:block" />
      </section>

      <section aria-label="Login to IT Help Desk" className="flex min-h-[500px] items-center justify-center bg-bg px-5 py-10 sm:px-10 lg:min-h-dvh">
        <div className="w-full max-w-[380px]">
          <h2 className="text-2xl font-bold tracking-tight text-text">Login</h2>
          <AccentRule />
          <p className="mt-3 text-sm text-muted">Log in to request IT help and follow your tickets.</p>

          <div className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-raised sm:p-6">
            {error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
            {googleEnabled ? (
              <form action={googleLoginAction}>
                {next && <input type="hidden" name="next" value={next} />}
                <button type="submit" className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm font-semibold text-text transition-colors hover:bg-primary-soft">
                  <GoogleIcon /> Continue with Google
                </button>
              </form>
            ) : (
              <div>
                <button disabled type="button" aria-describedby="google-unavailable" className="flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold text-muted opacity-70">
                  <GoogleIcon /> Continue with Google
                </button>
                <p id="google-unavailable" className="mt-2 text-center text-sm text-muted">Google login is being set up. Use your email below.</p>
              </div>
            )}

            <div className="my-5 flex items-center gap-3 text-sm text-muted">
              <span className="h-px flex-1 bg-border" /> Login with email <span className="h-px flex-1 bg-border" />
            </div>
            <LoginForm next={next} />
          </div>
          <p className="mt-5 text-center text-sm text-muted">Forgot your password? Ask the IT office to reset it.</p>
        </div>
      </section>
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
