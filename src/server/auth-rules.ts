export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function allowedDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? "ciaschool.edu.kh").toLowerCase();
}

type GoogleProfile = { email?: string | null; email_verified?: boolean | null; hd?: string | null };

// Only verified accounts from the school's Google Workspace domain may sign in.
// `hd` is set by Google for Workspace accounts; the email suffix check guards against
// a missing or spoofed `hd` in the authorization request.
export function isAllowedGoogleProfile(profile: GoogleProfile | undefined, domain = allowedDomain()): boolean {
  if (!profile?.email || profile.email_verified !== true) return false;
  const email = normalizeEmail(profile.email);
  return email.endsWith(`@${domain}`) && profile.hd?.toLowerCase() === domain;
}

// Only allow same-site relative redirects after login, e.g. "/tickets/TKT-000001".
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
