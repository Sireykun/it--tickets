import { requireUserManager } from "@/server/authz";

// Superadmins and campus admins who may manage users. Each settings page other than
// Users additionally calls requireSuperadmin().
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUserManager();
  return <div className="max-w-6xl">{children}</div>;
}
