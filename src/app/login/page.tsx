import { ListChecks, MessagesSquare, TicketPlus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { googleLoginAction } from "@/app/actions/auth";
import { googleEnabled } from "@/auth";
import { HolidayMotif } from "@/components/holiday";
import { HolidayScene } from "@/components/holiday-scene";
import { AccentRule } from "@/components/ui/misc";
import { SEASON_INFO } from "@/lib/holidays";
import { allowedDomain, safeRedirectPath } from "@/server/auth-rules";
import { getCurrentUser } from "@/server/authz";
import { getActiveSeason } from "@/server/holidays";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

const HELP_DESK_POINTS = [
  { icon: TicketPlus, title: "Report a problem", detail: "Tell us what's wrong in about a minute." },
  { icon: ListChecks, title: "Follow its progress", detail: "See each step until it's fixed." },
  { icon: MessagesSquare, title: "Talk to the IT team", detail: "Reply in the ticket or by email." },
] as const;

const ERRORS: Record<string, string> = {
  AccessDenied: `Please log in with your @${allowedDomain()} Google account. If you already did, your account may be deactivated.`,
  Configuration: "Login is temporarily unavailable. Please try again later.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/go");
  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? "Login failed. Please try again.") : null;
  const season = await getActiveSeason();

  return (
    <main data-season={season ?? undefined} className="grid min-h-dvh grid-cols-1 bg-bg text-text lg:grid-cols-2">
      <section className="relative flex flex-col justify-between gap-8 overflow-hidden border-b-[3px] border-gold bg-cia-ink px-5 py-6 text-white sm:px-8 sm:py-8 lg:min-h-dvh lg:border-r-[3px] lg:border-b-0 lg:px-12 lg:py-10">
        {season ? <HolidayScene season={season} /> : <SchoolBackdrop />}
        {season && <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cia-ink via-cia-ink/80 to-cia-ink/40" />}

        <div className="relative z-10 flex items-center gap-4">
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-white p-1 ring-2 ring-cia-gold ring-offset-2 ring-offset-cia-ink lg:size-24">
            <Image src="/cia-first-logo.png" alt="" width={192} height={192} priority className="size-full object-contain" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-xl font-extrabold tracking-tight lg:text-3xl">CIA FIRST</p>
            <p className="text-xs font-bold tracking-[0.18em] text-cia-gold lg:text-sm">INTERNATIONAL SCHOOL</p>
            <p lang="km" className="mt-1 text-sm text-white/80 lg:text-base">សាលាអន្តរជាតិ ស៊ីអាយអេ ហ្វឺស្ទ</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          {season && (
            <div className="mb-4 inline-flex max-w-full items-center gap-3 rounded-xl border border-gold/40 bg-cia-black/85 py-2 pl-2 pr-4 shadow-lg backdrop-blur-md">
              <HolidayMotif season={season} className="size-11 shrink-0 text-gold" />
              <div className="min-w-0 leading-snug">
                <p lang="km" className="font-bold text-white">{SEASON_INFO[season].greetingKm}</p>
                <p className="text-xs text-white/70">{SEASON_INFO[season].greeting}</p>
              </div>
            </div>
          )}
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cia-blue">IT Help Desk</p>
          <h1 className="mt-2 max-w-[18ch] text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl xl:text-[44px]">
            Something broken?<br />We&apos;ll help you fix it.
          </h1>
          <AccentRule />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            Report a problem, follow its progress, and talk to the IT team in one place.
          </p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {HELP_DESK_POINTS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cia-gold/40 bg-white/5 text-cia-gold"><Icon className="size-5" aria-hidden /></span>
                <span><span className="block font-bold">{title}</span><span className="block text-sm text-white/70">{detail}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 hidden border-t border-white/15 pt-4 text-sm text-white/60 lg:block">For CIA FIRST students, teachers and staff.</p>
      </section>

      <section aria-label="Login to IT Help Desk" className="flex items-start justify-center bg-bg px-5 py-6 sm:px-10 sm:py-10 lg:min-h-dvh lg:items-center">
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

// Static decoration: the seal's dashed blue ring and gold bands, enlarged behind the panel.
function SchoolBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_100%,color-mix(in_srgb,var(--cia-blue)_20%,transparent),transparent_55%)]">
      <svg viewBox="0 0 600 600" fill="none" className="absolute -top-44 -right-44 size-[34rem] lg:-top-56 lg:-right-64 lg:size-[54rem]">
        <circle cx="300" cy="300" r="292" strokeWidth="10" strokeDasharray="14 10" className="stroke-cia-blue/35" />
        <circle cx="300" cy="300" r="262" strokeWidth="2" className="stroke-white/10" />
        <circle cx="300" cy="300" r="205" strokeWidth="2" className="stroke-cia-gold/30" />
        <circle cx="300" cy="300" r="150" strokeWidth="28" className="stroke-cia-gold/10" />
      </svg>
    </div>
  );
}
