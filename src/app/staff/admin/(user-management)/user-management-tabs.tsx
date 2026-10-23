"use client";

import clsx from "clsx";
import { School, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff/admin/users", label: "Users", icon: Users },
  { href: "/staff/admin/campuses", label: "Campuses", icon: School },
];

export function UserManagementTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="User management" className="mb-6 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "-mb-px flex min-h-11 items-center gap-2 border-b-[3px] px-3 font-bold transition-colors",
                  isActive ? "border-gold text-primary" : "border-transparent text-muted hover:text-text",
                )}
              >
                <Icon className="size-[1.125rem]" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
