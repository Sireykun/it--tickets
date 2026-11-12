"use client";

import clsx from "clsx";
import { BookOpen, ExternalLink, Headset, History, Inbox, LifeBuoy, LogOut, Plus, PlusCircle, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Brand } from "@/components/brand";
import { ProfileAvatar } from "@/components/profile-avatar";
import { logoutAction } from "@/app/actions/auth";

const tabs = [
  { href: "/", label: "My tickets", icon: Inbox, match: (p: string, closed: boolean) => (p === "/" && !closed) || (p.startsWith("/tickets/") && p !== "/tickets/new") },
  { href: "/?show=closed", label: "History", icon: History, match: (p: string, closed: boolean) => p === "/" && closed },
  { href: "/tickets/new", label: "New ticket", icon: PlusCircle, match: (p: string) => p === "/tickets/new" },
  { href: "/help", label: "Help", icon: BookOpen, match: (p: string) => p.startsWith("/help") },
  { href: "/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/account") },
];

const sidebarItemClass = (active: boolean) =>
  clsx(
    "motion-nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm",
    active ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "font-medium text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong",
  );

const sidebarGroupLabelClass = "mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted";

export function PortalSidebar({ name, roleLabel, hasPhoto, staff }: { name: string; roleLabel: string; hasPhoto: boolean; staff: boolean }) {
  const pathname = usePathname();
  const closed = useSearchParams().get("show") === "closed";
  const requestLinks = [
    { href: "/", label: "Active tickets", icon: Inbox, active: (pathname === "/" && !closed) || (pathname.startsWith("/tickets/") && pathname !== "/tickets/new") },
    { href: "/?show=closed", label: "Support history", icon: History, active: pathname === "/" && closed },
  ];
  const isHelpActive = pathname.startsWith("/help");
  const isAccountActive = pathname === "/account";
  return (
    <aside data-portal-sidebar data-sidebar className="hidden min-h-dvh w-58 shrink-0 bg-sidebar text-sidebar-strong lg:block xl:w-64">
      <div className="sticky top-0 flex h-dvh flex-col">
        <Link href="/" className="mx-3 mb-1 mt-4 block rounded-lg px-2 py-1"><Brand tone="sidebar" /></Link>
        <div className="px-4 pb-4 pt-3">
          <Link
            href="/tickets/new"
            aria-current={pathname === "/tickets/new" ? "page" : undefined}
            className="motion-nav flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sidebar-cta px-3 text-sm font-semibold text-sidebar-cta-fg hover:bg-sidebar-cta-hover"
          >
            <Plus className="size-4" strokeWidth={2.5} aria-hidden /> New ticket
          </Link>
        </div>
        <nav aria-label="Requester sidebar" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          <div>
            <p className={sidebarGroupLabelClass}>My requests</p>
            <ul className="space-y-0.5">
              {requestLinks.map(({ href, label, icon: Icon, active }) => (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={sidebarItemClass(active)}>
                    <Icon className="size-[1.125rem]" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={sidebarGroupLabelClass}>Get help</p>
            <ul className="space-y-0.5">
              <li>
                <Link href="/help" aria-current={isHelpActive ? "page" : undefined} className={sidebarItemClass(isHelpActive)}>
                  <BookOpen className="size-[1.125rem]" aria-hidden /> Help center
                </Link>
              </li>
              <li>
                <a href="https://nexus.ciaschool.edu.kh/knowledge-base" target="_blank" rel="noopener noreferrer" className={sidebarItemClass(false)}>
                  <LifeBuoy className="size-[1.125rem]" aria-hidden />
                  <span className="flex-1">Knowledge base</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
              <li>
                <Link href="/account" aria-current={isAccountActive ? "page" : undefined} className={sidebarItemClass(isAccountActive)}>
                  <Settings className="size-[1.125rem]" aria-hidden /> Settings
                </Link>
              </li>
              {staff && (
                <li>
                  <Link href="/staff" className={sidebarItemClass(false)}>
                    <Headset className="size-[1.125rem]" aria-hidden /> Staff console
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </nav>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-4 pb-5 pt-3">
          <ProfileAvatar name={name} hasPhoto={hasPhoto} className="size-9" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs text-sidebar-muted">{roleLabel}</span>
          </span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sign out" title="Sign out" className="grid size-11 place-items-center rounded-lg text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong">
              <LogOut className="size-[1.125rem]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const closed = useSearchParams().get("show") === "closed";
  return (
    <nav data-portal-tabbar aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md lg:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname, closed);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-0.5 text-[0.7rem] font-bold tracking-tight", active ? "border-gold text-primary" : "border-transparent text-muted")}
              >
                <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-primary-soft")}>
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
