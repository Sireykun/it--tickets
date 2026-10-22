import clsx from "clsx";
import { ChevronRight, MessageCircleReply } from "lucide-react";
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
};

// A row inside a <TicketList>. `variant` decides who the "waiting on you" hint is for.
export function TicketCard({ ticket, href, variant }: { ticket: CardTicket; href: string; variant: "requester" | "staff" }) {
  const last = ticket.thread[0]?.type;
  const waiting =
    ticket.status !== "CLOSED" && (variant === "requester" ? last === "AGENT_REPLY" : last === "CLIENT_MESSAGE");

  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2/70 sm:px-5",
        // Accent bar marks rows that need the viewer's attention; the text hint below carries the same meaning.
        waiting && "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-mono tracking-tight">{ticket.ticketNumber}</span>
          {ticket.helpTopic && <span className="truncate">{ticket.helpTopic.name}</span>}
          <span className="ml-auto shrink-0">{formatRelative(ticket.updatedAt)}</span>
        </div>
        <p className="truncate text-base font-bold">{ticket.subject}</p>
        {variant === "staff" && (
          <p className="truncate text-sm text-muted">
            {ticket.requester?.name} · {ticket.assignedAgent?.name ?? "Unassigned"}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
          <StatusChip status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {variant === "staff" && <SlaBadge ticket={ticket} compact />}
          {waiting && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <MessageCircleReply className="size-3.5" aria-hidden />
              {variant === "requester" ? "New reply from IT" : "Awaiting reply"}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function TicketList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={clsx("divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card", className)}>{children}</ul>;
}
