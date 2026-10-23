import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { recordFailedSignIn, recordSignIn } from "@/server/audit-log";
import { allowedDomain, isAllowedGoogleProfile, normalizeEmail } from "@/server/auth-rules";
import { prisma } from "@/server/prisma";
import { hitRateLimit, resetRateLimit } from "@/server/rate-limit";
import { ensureUser } from "@/server/users";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const email = normalizeEmail(parsed.data.email);

      const limitKey = `login:${email}`;
      if (hitRateLimit(limitKey, 10, 15 * 60 * 1000)) throw new RateLimited();

      const user = await prisma.user.findUnique({ where: { email } });
      const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !user.passwordHash) return null;
      if (!ok || !user.isActive) {
        await recordFailedSignIn(user.id, ok ? "inactive" : "password", "password");
        return null;
      }

      resetRateLimit(limitKey);
      await recordSignIn(user.id, "password");
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (googleEnabled) {
  providers.push(
    Google({
      authorization: { params: { hd: allowedDomain(), prompt: "select_account" } },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!isAllowedGoogleProfile(profile)) return false;

      // First Google sign-in creates a requester account; later ones link by email.
      const { user } = await ensureUser({ email: profile!.email!, name: profile!.name }, { actorId: null, via: "google" });
      if (!user.isActive) {
        await recordFailedSignIn(user.id, "inactive", "google");
        return false;
      }
      await recordSignIn(user.id, "google");
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // Store our database id in `sub` (for Google, `user.id` is Google's own id).
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: normalizeEmail(profile.email) } });
        if (dbUser) token.sub = dbUser.id;
      } else if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
