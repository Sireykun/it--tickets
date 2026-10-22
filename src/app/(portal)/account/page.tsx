import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/labels";
import { isStaff, requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { EmailAlertsForm, PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const { emailAlerts } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailAlerts: true } });
  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Account" />

      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted">
            {user.email} · {ROLE_LABEL[user.role]}
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">Profile</h2>
        <ProfileForm name={user.name} />
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">Password</h2>
        {user.hasPassword ? <PasswordForm /> : <p className="text-muted">You sign in with your school Google account, so there's no password to change here.</p>}
      </Card>

      {isStaff(user.role) && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-bold">Email alerts</h2>
          <EmailAlertsForm enabled={emailAlerts} />
        </Card>
      )}

      <form action={logoutAction}>
        <Button type="submit" variant="danger" size="lg" className="w-full">
          <LogOut className="size-5" aria-hidden /> Sign out
        </Button>
      </form>
    </div>
  );
}
