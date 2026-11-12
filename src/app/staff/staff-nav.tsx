"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import {
  AlarmClock,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquareText,
  PartyPopper,
  Plus,
  ScrollText,
  SlidersHorizontal,
  Tag,
  Timer,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { HolidayMotif } from "@/components/holiday";
import { logoutAction } from "@/app/actions/auth";
import { UserMenu } from "@/components/ui/user-menu";
import type { Season } from "@/lib/holidays";
import type { Theme } from "@/lib/theme";

type Counts = { personal: number; unassigned: number; mine: number; teams: number; open: number; overdue: number; tasks: number };
// `fullQueue`: admins get every queue and Tasks; agents only "My open tickets" and "New ticket".
// `admin`: "super" sees every settings page and Reports; "users" is a campus admin allowed to manage users.
type NavProps = {
  counts: Counts;
  fullQueue: boolean;
  admin: "super" | "users" | null;
  user: { name: string; email: string; hasPhoto: boolean };
  theme: Theme;
  season: Season | null;
  onNavigate?: () => void;
};

const views = [
  { view: "unassigned", label: "Unassigned", icon: Inbox },
  { view: "mine", label: "My tickets", icon: UserRound },
  { view: "teams", label: "My teams", icon: UsersRound },
  { view: "open", label: "All open", icon: ClipboardList },
  { view: "overdue", label: "Overdue", icon: AlarmClock },
] as const;

// The User management hub's tabs: Users and Campuses share one sidebar entry.
const USER_MANAGEMENT_PATHS = ["/staff/admin/users", "/staff/admin/campuses"];

const SETTINGS_GROUPS: { label: string; links: { href: string; label: string; icon: typeof Users; match?: string[] }[] }[] = [
  {
    label: "People",
    links: [
      { href: "/staff/admin/users", label: "User management", icon: Users, match: USER_MANAGEMENT_PATHS },
      { href: "/staff/admin/teams", label: "Teams", icon: UsersRound },
      { href: "/staff/admin/departments", label: "Departments", icon: Building2 },
    ],
  },
  {
    label: "Tickets",
    links: [
      { href: "/staff/admin/help-topics", label: "Help topics", icon: Tag },
      { href: "/staff/admin/sla", label: "SLA policies", icon: Timer },
      { href: "/staff/admin/canned", label: "Canned replies", icon: MessageSquareText },
    ],
  },
  {
    label: "Content & email",
    links: [
      { href: "/staff/admin/knowledge-base", label: "Knowledge base", icon: BookOpen },
      { href: "/staff/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/staff/admin/email", label: "Email", icon: Mail },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/staff/admin/holidays", label: "Holiday themes", icon: PartyPopper },
      { href: "/staff/admin/audit-log", label: "System log", icon: ScrollText },
    ],
  },
];

const SETTINGS_PATHS = SETTINGS_GROUPS.flatMap((group) => group.links.flatMap(({ href, match = [href] }) => match));

const itemClass = (active: boolean) =>
  clsx(
    "motion-nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm",
    active ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "font-medium text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong",
  );

const groupLabelClass = "mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted";

function NavLinks({ counts, fullQueue, admin, user, theme, season, onNavigate }: NavProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentView = pathname === "/staff" ? (params.get("view") ?? "unassigned") : null;
  const isOnSettingsPage = admin === "super" && SETTINGS_PATHS.some((path) => pathname.startsWith(path));
  // A manual switch only holds on the page where it was made, so navigating shows the menu that page belongs to.
  const [settingsOverride, setSettingsOverride] = useState<{ pathname: string; isOpen: boolean } | null>(null);
  const isSettingsOpen = settingsOverride?.pathname === pathname ? settingsOverride.isOpen : isOnSettingsPage;
  // The button that switched views unmounts, so focus moves to its counterpart in the new view.
  const shouldMoveFocus = useRef(false);
  const focusAfterSwitch = (el: HTMLElement | null) => {
    if (el && shouldMoveFocus.current) {
      shouldMoveFocus.current = false;
      el.focus();
    }
  };
  const handleSettingsToggle = (isOpen: boolean) => {
    shouldMoveFocus.current = true;
    setSettingsOverride({ pathname, isOpen });
  };

  return (
    <div data-sidebar className="flex h-full flex-col bg-sidebar text-sidebar-strong">
      <div className="relative px-5 pb-4 pt-5">
        {season && <div aria-hidden className="holiday-band absolute inset-x-0 top-1" />}
        <Link href="/staff" onClick={onNavigate} className="block rounded-lg">
          <Brand subtitle="Staff console" tone="sidebar" />
        </Link>
        {season && <HolidayMotif season={season} className="absolute right-3 top-5 size-7 text-sidebar-accent" />}
      </div>

      {isSettingsOpen ? (
        <SettingsLinks pathname={pathname} onNavigate={onNavigate} onBack={() => handleSettingsToggle(false)} backRef={focusAfterSwitch} />
      ) : (
        <>
          <div className="px-4 pb-4">
            <Link
              href="/staff/tickets/new"
              onClick={onNavigate}
              aria-current={pathname === "/staff/tickets/new" ? "page" : undefined}
              className="motion-nav flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sidebar-cta px-3 text-sm font-semibold text-sidebar-cta-fg hover:bg-sidebar-cta-hover"
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden /> New ticket
            </Link>
          </div>

          <nav aria-label="Staff" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {fullQueue ? (
              <FullQueueLinks counts={counts} currentView={currentView} pathname={pathname} showReports={admin === "super"} onNavigate={onNavigate} />
            ) : (
              <ul className="space-y-0.5">
                <li>
                  <Link href="/staff" onClick={onNavigate} aria-current={pathname === "/staff" ? "page" : undefined} className={itemClass(pathname === "/staff")}>
                    <Inbox className="size-[1.125rem]" aria-hidden />
                    <span className="flex-1">My open tickets</span>
                    <Count value={counts.personal} />
                  </Link>
                </li>
              </ul>
            )}

            {admin === "super" && (
              <div>
                <p className={groupLabelClass}>Admin</p>
                <button ref={focusAfterSwitch} type="button" onClick={() => handleSettingsToggle(true)} className={clsx(itemClass(false), "w-full")}>
                  <SlidersHorizontal className="size-[1.125rem]" aria-hidden />
                  <span className="flex-1 text-left">Settings</span>
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            )}
            {admin === "users" && (
              <div>
                <p className={groupLabelClass}>Admin</p>
                <Link
                  href="/staff/admin/users"
                  onClick={onNavigate}
                  aria-current={pathname.startsWith("/staff/admin/users") ? "page" : undefined}
                  className={itemClass(pathname.startsWith("/staff/admin/users"))}
                >
                  <Users className="size-[1.125rem]" aria-hidden /> User management
                </Link>
              </div>
            )}
          </nav>
        </>
      )}

      <div className="space-y-1 border-t border-sidebar-border px-3 pb-5 pt-2">
        <Link href="/help" onClick={onNavigate} className={itemClass(false)}>
          <BookOpen className="size-[1.125rem]" aria-hidden /> Help center
        </Link>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <UserMenu name={user.name} email={user.email} hasPhoto={user.hasPhoto} theme={theme} switchTo="portal" showName subtitle="Staff" tone="sidebar" />
          </div>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sign out" title="Sign out" className="grid size-11 place-items-center rounded-lg text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong">
              <LogOut className="size-[1.125rem]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Count({ value, isAlert = false }: { value: number; isAlert?: boolean }) {
  if (isAlert && value > 0) {
    return <span className="min-w-6 rounded-full bg-sidebar-badge px-2 text-center text-xs font-semibold leading-5 tabular-nums text-sidebar-badge-fg">{value}</span>;
  }
  return <span className="text-xs tabular-nums opacity-80">{value}</span>;
}

function FullQueueLinks({
  counts,
  currentView,
  pathname,
  showReports,
  onNavigate,
}: Pick<NavProps, "counts" | "onNavigate"> & { currentView: string | null; pathname: string; showReports: boolean }) {
  return (
    <>
      <div>
        <p className={groupLabelClass}>Queue</p>
        <ul className="space-y-0.5">
          {showReports && (
            <li>
              <Link href="/staff/admin" onClick={onNavigate} aria-current={pathname === "/staff/admin" ? "page" : undefined} className={itemClass(pathname === "/staff/admin")}>
                <LayoutDashboard className="size-[1.125rem]" aria-hidden /> Dashboard
              </Link>
            </li>
          )}
          {views.map(({ view, label, icon: Icon }) => (
            <li key={view}>
              <Link href={`/staff?view=${view}`} onClick={onNavigate} aria-current={currentView === view ? "page" : undefined} className={itemClass(currentView === view)}>
                <Icon className="size-[1.125rem]" aria-hidden />
                <span className="flex-1">{label}</span>
                <Count value={counts[view]} isAlert={view === "overdue"} />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className={groupLabelClass}>Work</p>
        <ul className="space-y-0.5">
          <li>
            <Link href="/staff/tasks" onClick={onNavigate} aria-current={pathname.startsWith("/staff/tasks") ? "page" : undefined} className={itemClass(pathname.startsWith("/staff/tasks"))}>
              <ListTodo className="size-[1.125rem]" aria-hidden />
              <span className="flex-1">Tasks</span>
              <span title="Open tasks assigned to you">
                <Count value={counts.tasks} />
              </span>
            </Link>
          </li>
          {showReports && (
            <li>
              <Link href="/staff/reports" onClick={onNavigate} aria-current={pathname.startsWith("/staff/reports") ? "page" : undefined} className={itemClass(pathname.startsWith("/staff/reports"))}>
                <BarChart3 className="size-[1.125rem]" aria-hidden /> Reports
              </Link>
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

function SettingsLinks({
  pathname,
  onNavigate,
  onBack,
  backRef,
}: {
  pathname: string;
  onNavigate?: () => void;
  onBack: () => void;
  backRef: (el: HTMLElement | null) => void;
}) {
  return (
    <>
      <div className="border-b border-sidebar-border px-3 pb-3">
        <button ref={backRef} type="button" onClick={onBack} className="motion-nav flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong">
          <ArrowLeft className="size-4" aria-hidden /> Back to menu
        </button>
        <h2 className="px-3 pt-1 text-lg font-bold tracking-tight">Settings</h2>
      </div>
      <nav aria-label="Settings" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-3">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.label}>
            <p className={groupLabelClass}>{group.label}</p>
            <ul className="space-y-0.5">
              {group.links.map(({ href, label, icon: Icon, match = [href] }) => {
                const isActive = match.some((m) => pathname.startsWith(m));
                return (
                  <li key={href}>
                    <Link href={href} onClick={onNavigate} aria-current={isActive ? "page" : undefined} className={itemClass(isActive)}>
                      <Icon className="size-[1.125rem]" aria-hidden /> {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]" />
        <Dialog.Content data-sidebar className="fixed inset-y-0 left-0 z-50 w-[min(20rem,85vw)] bg-sidebar shadow-raised focus:outline-none">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Suspense>
            <NavLinks {...props} onNavigate={() => setOpen(false)} />
          </Suspense>
          <Dialog.Close className="absolute right-3 top-4 grid size-11 place-items-center rounded-lg text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong" aria-label="Close menu">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
