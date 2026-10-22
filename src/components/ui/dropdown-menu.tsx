"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const surface =
  "z-50 min-w-56 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-text shadow-raised focus:outline-none";
const item =
  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-[15px] font-bold outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2";

export const Menu = DropdownMenu.Root;
export const MenuGroup = DropdownMenu.Group;
export const MenuSub = DropdownMenu.Sub;

export function MenuTrigger(props: ComponentProps<typeof DropdownMenu.Trigger>) {
  return <DropdownMenu.Trigger asChild {...props} />;
}

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content align={align} sideOffset={sideOffset} collisionPadding={16} className={clsx(surface, className)} {...props} />
    </DropdownMenu.Portal>
  );
}

type ItemProps = ComponentProps<typeof DropdownMenu.Item> & { icon?: ReactNode; tone?: "default" | "danger" };

export function MenuItem({ icon, tone = "default", className, children, ...props }: ItemProps) {
  return (
    <DropdownMenu.Item className={clsx(item, tone === "danger" && "text-danger data-[highlighted]:bg-danger-soft", className)} {...props}>
      {icon && <span className="grid size-5 shrink-0 place-items-center text-muted [&>svg]:size-[1.125rem]">{icon}</span>}
      {children}
    </DropdownMenu.Item>
  );
}

// `download` renders a plain <a> so the browser saves the file instead of client-side navigating.
export function MenuLinkItem({
  href,
  target,
  download,
  icon,
  children,
  ...props
}: Omit<ItemProps, "asChild"> & { href: string; target?: string; download?: boolean }) {
  const content = (
    <>
      {icon && <span className="grid size-5 shrink-0 place-items-center text-muted [&>svg]:size-[1.125rem]">{icon}</span>}
      {children}
    </>
  );
  return (
    <DropdownMenu.Item asChild className={item} {...props}>
      {download ? (
        <a href={href} download>
          {content}
        </a>
      ) : (
        <Link href={href} target={target}>
          {content}
        </Link>
      )}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={clsx("px-3 pt-2 pb-1 text-xs font-bold text-muted", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1.5 my-1.5 h-px bg-border" />;
}

export function MenuSubTrigger({ icon, children, className, ...props }: ComponentProps<typeof DropdownMenu.SubTrigger> & { icon?: ReactNode }) {
  return (
    <DropdownMenu.SubTrigger className={clsx(item, "data-[state=open]:bg-surface-2", className)} {...props}>
      {icon && <span className="grid size-5 shrink-0 place-items-center text-muted [&>svg]:size-[1.125rem]">{icon}</span>}
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-4 text-muted" aria-hidden />
    </DropdownMenu.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent sideOffset={4} collisionPadding={16} className={clsx(surface, "max-h-80 overflow-y-auto", className)} {...props} />
    </DropdownMenu.Portal>
  );
}

export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuRadioItem({ children, className, ...props }: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={clsx(item, className)} {...props}>
      <span className="grid size-5 shrink-0 place-items-center">
        <DropdownMenu.ItemIndicator>
          <Check className="size-4 text-primary" aria-hidden />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.RadioItem>
  );
}
