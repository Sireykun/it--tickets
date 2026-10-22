import { LogOut, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ROLE_LABEL } from "@/lib/labels";
import { isStaff, requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { EmailAlertsForm, ProfileForm, ProfilePhotoForm } from "./account-forms";
import { removeAvatarAction } from "../actions";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await requireUser();
  const { emailAlerts, avatarStorageKey, themePreference } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailAlerts: true, avatarStorageKey: true, themePreference: true } });
  const params = await searchParams;
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Profile & appearance" subtitle="Make your help desk feel like yours." />
      {(params.photo || params.theme) && <p role="status" className="rounded-lg border border-resolved/30 bg-resolved-soft px-4 py-3 font-bold text-resolved">Settings saved.</p>}

      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <ProfileAvatar name={user.name} hasPhoto={Boolean(avatarStorageKey)} className="size-16 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted">
            {user.email} · {ROLE_LABEL[user.role]}
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">Display name</h2>
        <ProfileForm name={user.name} />
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">Profile photo</h2>
        <ProfilePhotoForm />
        {avatarStorageKey && <form action={removeAvatarAction} className="mt-3"><Button type="submit" variant="ghost"><Trash2 className="size-4" aria-hidden />Remove photo</Button></form>}
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 text-lg font-bold">Theme</h2>
        <p className="mb-4 text-muted">Choose the colors for your help desk.</p>
        <ThemePicker initialTheme={themePreference} />
      </Card>

      {isStaff(user.role) && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-bold">Email alerts</h2>
          <EmailAlertsForm enabled={emailAlerts} />
        </Card>
      )}

      <form action={logoutAction} className="lg:hidden">
        <Button type="submit" variant="danger" size="lg" className="w-full">
          <LogOut className="size-5" aria-hidden /> Sign out
        </Button>
      </form>
    </div>
  );
}
