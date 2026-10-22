"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import {
  AlarmClock,
  Building,
  Building2,
  Mail,
  ClipboardList,
  Inbox,
  ListTodo,
  LogOut,
  Menu,
  MessageSquareText,
  School,
  PlusCircle,
  Tags,
  Timer,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { Avatar } from "@/components/ui/misc";

type Counts = { personal: number; unassigned: number; mine: number; teams: number; open: number; overdue: number; tasks: number };
// `fullQueue`: admins get every queue and Tasks; agents only "My open tickets" and "New ticket".
// `admin`: "super" sees every settings page; "users" is a campus admin allowed to manage users.
type NavProps = { counts: Counts; fullQueue: boolean; admin: "super" | "users" | null; userName: string; onNavigate?: () => void };

const views = [
  { view: "unassigned", label: "Unassigned", icon: Inbox },
  { view: "mine", label: "My tickets", icon: UserRound },
  { view: "teams", label: "My teams", icon: UsersRound },
  { view: "open", label: "All open", icon: ClipboardList },
  { view: "overdue", label: "Overdue", icon: AlarmClock },
] as const;

const adminLinks = [
  { href: "/staff/admin/users", label: "Users", icon: Users },
  { href: "/staff/admin/campuses", label: "Campuses", icon: School },
  { href: "/staff/admin/organizations", label: "Organizations", icon: Building },
  { href: "/staff/admin/canned", label: "Canned replies", icon: MessageSquareText },
  { href: "/staff/admin/email", label: "Email", icon: Mail },
  { href: "/staff/admin/teams", label: "Teams", icon: UsersRound },
  { href: "/staff/admin/departments", label: "Departments", icon: Building2 },
  { href: "/staff/admin/help-topics", label: "Help topics", icon: Tags },
  { href: "/staff/admin/sla", label: "SLA policies", icon: Timer },
];

const itemClass = (active: boolean) =>
  clsx(
    "flex min-h-10 items-center gap-3 rounded-lg px-3 font-bold transition-colors",
    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
  );

function NavLinks({ counts, fullQueue, admin, userName, onNavigate }: NavProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentView = pathname === "/staff" ? (params.get("view") ?? "unassigned") : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4">
        <Link href="/staff" onClick={onNavigate}>
          <Brand subtitle="Staff console" />
        </Link>
      </div>

      <nav aria-label="Staff" className="flex-1 space-y-6 overflow-y-auto px-3 pt-2 pb-4">
        {fullQueue ? (
          <FullQueueLinks counts={counts} currentView={currentView} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <ul className="space-y-0.5">
            <li>
              <Link href="/staff" onClick={onNavigate} aria-current={pathname === "/staff" ? "page" : undefined} className={itemClass(pathname === "/staff")}>
                <Inbox className="size-[1.125rem]" aria-hidden />
                <span className="flex-1">My open tickets</span>
                <span className="min-w-7 rounded-full bg-surface-2 px-2 text-center font-mono text-xs leading-5 text-muted">{counts.personal}</span>
              </Link>
            </li>
            <li>
              <Link href="/staff/tickets/new" onClick={onNavigate} aria-current={pathname === "/staff/tickets/new" ? "page" : undefined} className={itemClass(pathname === "/staff/tickets/new")}>
                <PlusCircle className="size-[1.125rem]" aria-hidden /> New ticket
              </Link>
            </li>
          </ul>
        )}

        {admin && (
          <div>
            <p className="mb-1.5 px-3 text-xs font-bold text-muted">Admin</p>
            <ul className="space-y-0.5">
              {(admin === "super" ? adminLinks : adminLinks.filter((l) => l.href === "/staff/admin/users")).map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} onClick={onNavigate} aria-current={pathname.startsWith(href) ? "page" : undefined} className={itemClass(pathname.startsWith(href))}>
                    <Icon className="size-[1.125rem]" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <Link href="/" onClick={onNavigate} className={itemClass(false)}>
            <UserRound className="size-[1.125rem]" aria-hidden /> Requester portal
          </Link>
        </div>
      </nav>

      <div className="flex items-center gap-3 border-t border-border p-4">
        <Avatar name={userName} />
        <span className="min-w-0 flex-1 truncate font-bold">{userName}</span>
        <form action={logoutAction}>
          <button type="submit" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out" title="Sign out">
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

function FullQueueLinks({
  counts,
  currentView,
  pathname,
  onNavigate,
}: Pick<NavProps, "counts" | "onNavigate"> & { currentView: string | null; pathname: string }) {
  return (
    <>
      <div>
        <p className="mb-1.5 px-3 text-xs font-bold text-muted">Queue</p>
        <ul className="space-y-0.5">
          {views.map(({ view, label, icon: Icon }) => (
            <li key={view}>
              <Link href={`/staff?view=${view}`} onClick={onNavigate} aria-current={currentView === view ? "page" : undefined} className={itemClass(currentView === view)}>
                <Icon className="size-[1.125rem]" aria-hidden />
                <span className="flex-1">{label}</span>
                <span className={clsx("min-w-7 rounded-full px-2 text-center font-mono text-xs leading-5", view === "overdue" && counts.overdue > 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted")}>
                  {counts[view]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 px-3 text-xs font-bold text-muted">Work</p>
        <ul className="space-y-0.5">
          <li>
            <Link href="/staff/tickets/new" onClick={onNavigate} aria-current={pathname === "/staff/tickets/new" ? "page" : undefined} className={itemClass(pathname === "/staff/tickets/new")}>
              <PlusCircle className="size-[1.125rem]" aria-hidden /> New ticket
            </Link>
          </li>
          <li>
            <Link href="/staff/tasks" onClick={onNavigate} aria-current={pathname.startsWith("/staff/tasks") ? "page" : undefined} className={itemClass(pathname.startsWith("/staff/tasks"))}>
              <ListTodo className="size-[1.125rem]" aria-hidden />
              <span className="flex-1">Tasks</span>
              <span className="min-w-7 rounded-full bg-surface-2 px-2 text-center font-mono text-xs leading-5 text-muted" title="Open tasks assigned to you">
                {counts.tasks}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

export function StaffSidebar(props: NavProps) {
  return (
    <Suspense>
      <NavLinks {...props} />
    </Suspense>
  );
}

export function StaffMobileNav(props: NavProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="grid size-11 place-items-center rounded-lg hover:bg-surface-2" aria-label="Open menu">
        <Menu className="size-6" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(20rem,85vw)] border-r border-border bg-surface shadow-raised focus:outline-none">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Close className="absolute top-4 right-3 grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="Close menu">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          <Suspense>
            <NavLinks {...props} onNavigate={() => setOpen(false)} />
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
