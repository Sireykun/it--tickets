"use client";

import { CheckCircle2, Circle, ExternalLink, Pencil } from "lucide-react";
import { useTransition } from "react";
import { MenuItem, MenuLinkItem } from "@/components/ui/dropdown-menu";
import { MoreMenuButton } from "@/components/ui/list-controls";

export function TaskRowMenu({
  taskId,
  title,
  isOpen,
  ticketNumber,
  toggle,
}: {
  taskId: string;
  title: string;
  isOpen: boolean;
  ticketNumber: string | null;
  toggle: () => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  return (
    <MoreMenuButton label={`Actions for "${title}"`}>
      <MenuItem icon={isOpen ? <CheckCircle2 /> : <Circle />} onSelect={() => startTransition(() => toggle())}>
        {isOpen ? "Mark done" : "Reopen"}
      </MenuItem>
      <MenuLinkItem href={`/staff/tasks/${taskId}`} icon={<Pencil />}>
        Edit task
      </MenuLinkItem>
      {ticketNumber && (
        <MenuLinkItem href={`/staff/tickets/${ticketNumber}`} icon={<ExternalLink />}>
          Open {ticketNumber}
        </MenuLinkItem>
      )}
    </MoreMenuButton>
  );
}
