import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/ui/user-menu";
import { isStaff, requireUser } from "@/server/authz";
import { readTheme } from "@/server/theme";
import { DesktopNav, TabBar } from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, theme] = await Promise.all([requireUser(), readTheme()]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link href="/" className="mr-auto rounded-lg">
            <Brand />
          </Link>
          <DesktopNav />
          <UserMenu name={user.name} email={user.email} theme={theme} switchTo={isStaff(user.role) ? "staff" : null} />
        </div>
      </header>
      <main className="pb-tabbar mx-auto max-w-4xl px-4 py-8 md:pb-12">{children}</main>
      <TabBar />
    </div>
  );
}
