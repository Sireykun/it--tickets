"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand, BrandMark } from "@/components/brand";
import { UserMenu } from "@/components/ui/user-menu";
import { StaffMobileNav, StaffSidebar } from "./staff-nav";

type Nav = ComponentProps<typeof StaffSidebar>;

export function StaffShell({ children, nav }: { children: ReactNode; nav: Nav }) {
  const pathname = usePathname();
  const ticketDetail = /^\/staff\/tickets\/(?!new(?:\/|$))[^/]+\/?$/.test(pathname);
  const adminDashboard = pathname === "/staff/admin";

  if (ticketDetail) {
    return (
      <div className="min-h-dvh bg-bg">
        <header className="sticky top-0 z-30 border-b border-border-strong bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[94rem] items-center gap-4 px-4 sm:px-6">
            <Link href="/staff" className="flex shrink-0 items-center gap-3">
              <BrandMark className="size-9" />
              <span className="text-base font-extrabold tracking-wide sm:text-lg">CIA FIRST</span>
            </Link>
            <span aria-hidden className="hidden h-7 w-px bg-border-strong sm:block" />
            <span className="hidden text-sm text-muted sm:block">IT Help Desk</span>
            <nav aria-label="Ticket workspace" className="ml-auto hidden h-full items-center gap-1 sm:flex">
              <Link href="/staff" className="inline-flex h-full items-center border-b-2 border-primary px-3 text-sm font-semibold text-text">Tickets</Link>
              <Link href="/help" className="inline-flex h-full items-center border-b-2 border-transparent px-3 text-sm text-muted hover:text-text">Knowledge base</Link>
              <Link href={nav.fullQueue ? "/staff?view=open" : "/staff"} className="inline-flex h-full items-center border-b-2 border-transparent px-3 text-sm text-muted hover:text-text">Status</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2 sm:ml-2">
              <div className="sm:hidden"><StaffMobileNav {...nav} /></div>
              <UserMenu name={nav.user.name} email={nav.user.email} hasPhoto={nav.user.hasPhoto} theme={nav.theme} switchTo="portal" />
            </div>
          </div>
        </header>
        <main className="motion-page mx-auto max-w-[94rem] px-4 py-5 sm:px-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface/70 lg:block">
        <StaffSidebar {...nav} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/85 px-2 backdrop-blur-md lg:hidden">
          <StaffMobileNav {...nav} />
          <Link href="/staff" className="mr-auto"><Brand subtitle="Staff console" /></Link>
          <UserMenu name={nav.user.name} email={nav.user.email} hasPhoto={nav.user.hasPhoto} theme={nav.theme} switchTo="portal" />
        </header>
        <main className={adminDashboard
          ? "motion-page w-full min-w-0 px-3 py-4 sm:px-4 lg:px-5 lg:pb-10"
          : "motion-page mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:pb-12 lg:pt-6"}>{children}</main>
      </div>
    </div>
  );
}
