import clsx from "clsx";
import { ChevronRight, MessageCircleReply, Ticket } from "lucide-react";
import Link from "next/link";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { formatRelative } from "@/lib/format";
import { PriorityBadge, SlaBadge, StatusChip } from "./badges";

type CardTicket = {
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: Date;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstRespondedAt: Date | null;
  helpTopic: { name: string } | null;
  thread: { type: string }[];
  requester?: { name: string };
  assignedAgent?: { name: string } | null;
  assignedTeam?: { name: string } | null;
  campus?: { name: string } | null;
};

// A row inside a <TicketList>. `variant` decides who the "waiting on you" hint is for.
const ticketAccent = {
  gold: "bg-gold/10 text-gold-text",
  green: "bg-accent-green-soft text-accent-green",
  cyan: "bg-primary-soft text-primary",
} as const;

export function TicketCard({ ticket, href, variant, accent = "cyan" }: { ticket: CardTicket; href: string; variant: "requester" | "staff"; accent?: keyof typeof ticketAccent }) {
  const last = ticket.thread[0]?.type;
  const waiting =
    ticket.status !== "CLOSED" && (variant === "requester" ? last === "AGENT_REPLY" : last === "CLIENT_MESSAGE");

  if (variant === "requester") {
    return (
      <Link href={href} className="group flex items-start gap-3 rounded-lg border border-border border-l-[3px] border-l-gold bg-surface-2 p-4 transition-colors hover:border-primary/50 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <span className={clsx("grid size-10 shrink-0 place-items-center rounded-lg", ticketAccent[accent])}><Ticket className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-muted">
            <span className="font-mono font-bold tracking-tight text-gold-text">{ticket.ticketNumber}</span>
            {ticket.helpTopic && <span className="truncate">{ticket.helpTopic.name}</span>}
          </span>
          <span className="mt-1 block break-words text-base font-bold">{ticket.subject}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={ticket.status} className="text-sm" />
            <PriorityBadge priority={ticket.priority} className="text-sm" />
            {waiting && <span className="inline-flex items-center gap-1 text-sm font-bold text-primary"><MessageCircleReply className="size-4" aria-hidden />New reply from IT</span>}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-sm font-semibold text-gold-text">{formatRelative(ticket.updatedAt)}</span>
          <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary-soft/50 sm:px-5",
        // Accent bar marks rows that need the viewer's attention; the text hint below carries the same meaning.
        waiting && "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Ticket className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-mono font-bold tracking-tight text-gold-text">{ticket.ticketNumber}</span>
          {ticket.helpTopic && <span className="truncate">{ticket.helpTopic.name}</span>}
          <span className="ml-auto shrink-0 rounded-md border border-gold/40 bg-gold/10 px-2 py-1 font-semibold text-gold-text">{formatRelative(ticket.updatedAt)}</span>
        </div>
        <p className="break-words text-base font-bold">{ticket.subject}</p>
        <p className="text-sm text-muted">
          {[ticket.campus?.name, ticket.requester?.name, ticket.assignedAgent?.name ?? "Unassigned", ticket.assignedTeam?.name].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
          <StatusChip status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge ticket={ticket} compact />
          {waiting && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <MessageCircleReply className="size-3.5" aria-hidden />
              Awaiting reply
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function TicketList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={clsx("space-y-2", className)}>{children}</ul>;
}
