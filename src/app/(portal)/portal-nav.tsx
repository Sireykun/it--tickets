"use client";

import clsx from "clsx";
import { BookOpen, ExternalLink, Headset, History, Inbox, LifeBuoy, LogOut, PlusCircle, Settings, UserRound } from "lucide-react";
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

export function PortalSidebar({ name, roleLabel, hasPhoto, staff }: { name: string; roleLabel: string; hasPhoto: boolean; staff: boolean }) {
  const pathname = usePathname();
  const closed = useSearchParams().get("show") === "closed";
  const links = [
    { href: "/", label: "Active tickets", icon: Inbox, active: (pathname === "/" && !closed) || (pathname.startsWith("/tickets/") && pathname !== "/tickets/new") },
    { href: "/?show=closed", label: "Support history", icon: History, active: pathname === "/" && closed },
    { href: "/tickets/new", label: "New ticket", icon: PlusCircle, active: pathname === "/tickets/new" },
    { href: "/help", label: "Help center & guides", icon: BookOpen, active: pathname.startsWith("/help") },
    { href: "/account", label: "Settings", icon: Settings, active: pathname === "/account" },
  ];
  return (
    <aside data-portal-sidebar className="hidden min-h-dvh w-58 shrink-0 border-r border-border bg-surface/70 px-4 py-6 lg:block xl:w-64">
      <div className="sticky top-6 flex min-h-[calc(100dvh-3rem)] flex-col">
        <Link href="/" className="mb-8 block rounded-lg px-1 py-1"><Brand /></Link>
        <nav aria-label="Requester sidebar" className="space-y-1">
          {links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={clsx("flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 text-base font-bold transition-colors", label === "Help center & guides" && "text-lg", active ? "border-gold bg-primary-soft text-primary" : label === "Help center & guides" ? "border-transparent text-gold-text hover:bg-surface-2" : "border-transparent text-muted hover:bg-surface-2 hover:text-text")}>
            <Icon className="size-4" aria-hidden />{label}
          </Link>)}
          <a href="https://nexus.ciaschool.edu.kh/knowledge-base" target="_blank" rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-bold text-muted transition-colors hover:bg-surface-2 hover:text-text">
            <LifeBuoy className="size-4" aria-hidden />Knowledge base<span className="sr-only"> (opens in a new tab)</span><ExternalLink className="ml-auto size-3.5" aria-hidden />
          </a>
          {staff && <Link href="/staff" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-bold text-muted transition-colors hover:bg-surface-2 hover:text-text"><Headset className="size-4" aria-hidden />Staff console</Link>}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-4">
          <ProfileAvatar name={name} hasPhoto={hasPhoto} className="size-10 text-lg" />
          <span className="min-w-0"><span className="block break-words text-base font-bold leading-tight">{name}</span><span className="mt-1 block text-sm text-muted">{roleLabel}</span></span>
        </div>
        <form action={logoutAction} className="pt-3">
          <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-base font-bold text-danger transition-colors hover:bg-danger-soft"><LogOut className="size-4" aria-hidden />Sign out</button>
        </form>
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
                className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 text-sm font-bold", active ? "border-gold text-primary" : "border-transparent text-muted")}
              >
                <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-primary-soft")}>
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
