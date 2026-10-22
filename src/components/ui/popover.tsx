"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import clsx from "clsx";
import type { ComponentProps } from "react";

export const Popover = RadixPopover.Root;
export const PopoverClose = RadixPopover.Close;

export function PopoverTrigger(props: ComponentProps<typeof RadixPopover.Trigger>) {
  return <RadixPopover.Trigger asChild {...props} />;
}

export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={clsx("z-50 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-raised focus:outline-none", className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
