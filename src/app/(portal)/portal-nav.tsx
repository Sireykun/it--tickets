"use client";

import clsx from "clsx";
import { BookOpen, Inbox, PlusCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "My tickets", icon: Inbox, match: (p: string) => p === "/" || (p.startsWith("/tickets/") && p !== "/tickets/new") },
  { href: "/tickets/new", label: "New ticket", icon: PlusCircle, match: (p: string) => p === "/tickets/new" },
  { href: "/help", label: "Help", icon: BookOpen, match: (p: string) => p.startsWith("/help") },
  { href: "/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/account") },
];

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {tabs.map(({ href, label, icon: Icon, match }) => (
        <Link
          key={href}
          href={href}
          aria-current={match(pathname) ? "page" : undefined}
          className={clsx(
            "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-bold transition-colors",
            match(pathname) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold", active ? "text-primary" : "text-muted")}
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
