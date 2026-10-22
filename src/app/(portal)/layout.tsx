import { Headset } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { isStaff, requireUser } from "@/server/authz";
import { DesktopNav, TabBar } from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link href="/" className="mr-auto rounded-lg">
            <Brand />
          </Link>
          <DesktopNav />
          {isStaff(user.role) && (
            <Link
              href="/staff"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-soft md:ml-2"
            >
              <Headset className="size-4" aria-hidden /> Staff console
            </Link>
          )}
        </div>
      </header>
      <main className="pb-tabbar mx-auto max-w-4xl px-4 py-8 md:pb-12">{children}</main>
      <TabBar />
    </div>
  );
}
