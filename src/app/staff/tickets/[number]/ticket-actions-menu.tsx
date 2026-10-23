"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Eye, EyeOff, GitMerge, Link2, Printer, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/action-state";
import { LinkTicketForm, MergeTicketForm } from "./related-forms";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function TicketActionsMenu({
  ticketNumber,
  isRequesterView,
  linkAction,
  mergeAction,
}: {
  ticketNumber: string;
  isRequesterView: boolean;
  linkAction: FormAction;
  mergeAction?: FormAction; // omitted once merged or closed
}) {
  const [dialog, setDialog] = useState<"link" | "merge" | null>(null);

  return (
    <>
      <Menu>
        <MenuTrigger>
          <Button variant="secondary">
            Actions <ChevronDown className="size-4 text-muted" aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLinkItem
            href={isRequesterView ? `/staff/tickets/${ticketNumber}` : `/staff/tickets/${ticketNumber}?view=requester`}
            icon={isRequesterView ? <EyeOff /> : <Eye />}
          >
            {isRequesterView ? "Back to staff view" : "Preview as requester"}
          </MenuLinkItem>
          <MenuLinkItem href={`/print/tickets/${ticketNumber}`} target="_blank" icon={<Printer />}>
            Print / PDF
          </MenuLinkItem>
          <MenuSeparator />
          <MenuItem icon={<Link2 />} onSelect={() => setDialog("link")}>
            Link ticket…
          </MenuItem>
          {mergeAction && (
            <MenuItem icon={<GitMerge />} tone="danger" onSelect={() => setDialog("merge")}>
              Merge into…
            </MenuItem>
          )}
        </MenuContent>
      </Menu>

      <ActionDialog open={dialog === "link"} onClose={() => setDialog(null)} title="Link a related ticket" description="Linked tickets show on each other's page.">
        <LinkTicketForm action={linkAction} onDone={() => setDialog(null)} />
      </ActionDialog>
      {mergeAction && (
        <ActionDialog
          open={dialog === "merge"}
          onClose={() => setDialog(null)}
          title={`Merge ${ticketNumber}`}
          description="Moves this ticket's conversation into another ticket and closes this one."
        >
          <MergeTicketForm action={mergeAction} ticketNumber={ticketNumber} />
        </ActionDialog>
      )}
    </>
  );
}

function ActionDialog({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-raised focus:outline-none">
          <Dialog.Title className="pr-10 text-lg font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mb-4 text-sm text-muted">{description}</Dialog.Description>
          <Dialog.Close className="absolute top-3 right-3 grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="Close">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
