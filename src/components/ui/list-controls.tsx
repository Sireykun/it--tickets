"use client";

import clsx from "clsx";
import { ArrowUpDown, ChevronDown, MoreHorizontal, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button, buttonClass, LinkButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Choice = { value: string; label: string; href: string };

// A dropdown of mutually exclusive links (sort order, date range, view…) that shows the current pick.
export function ChoiceMenu({
  label,
  choices,
  value,
  icon = <ArrowUpDown className="size-4" aria-hidden />,
}: {
  label: string;
  choices: Choice[];
  value: string;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const current = choices.find((c) => c.value === value) ?? choices[0];
  return (
    <Menu>
      <MenuTrigger>
        <button type="button" className={buttonClass({ variant: "secondary" })} aria-label={`${label}: ${current.label}`}>
          {icon}
          <span className="text-muted">{label}:</span> {current.label}
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>{label}</MenuLabel>
        <MenuRadioGroup value={current.value} onValueChange={(v) => router.push(choices.find((c) => c.value === v)?.href ?? current.href)}>
          {choices.map((c) => (
            <MenuRadioItem key={c.value} value={c.value}>
              {c.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

// A GET form inside a popover. `hidden` keeps the other query params (search, view, sort) on submit.
export function FiltersPopover({
  action,
  hidden,
  activeCount,
  clearHref,
  children,
}: {
  action: string;
  hidden: Record<string, string | undefined>;
  activeCount: number;
  clearHref: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger>
        <button type="button" className={buttonClass({ variant: "secondary", className: clsx(activeCount > 0 && "border-primary text-primary") })}>
          <SlidersHorizontal className="size-4" aria-hidden /> Filters
          {activeCount > 0 && (
            <span className="min-w-6 rounded-full bg-primary px-1.5 text-center font-mono text-xs leading-5 text-primary-fg">{activeCount}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <form method="get" action={action} className="space-y-4">
          {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            {activeCount > 0 && (
              <LinkButton href={clearHref} variant="ghost">
                Clear all
              </LinkButton>
            )}
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// Removable pills for the filters in effect; each links to the same page without that filter.
export function FilterChips({ chips }: { chips: { label: string; href: string }[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.label}>
          <Link
            href={c.href}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft py-1 pr-2 pl-3 text-sm font-bold text-primary hover:border-primary"
            aria-label={`Remove filter ${c.label}`}
          >
            {c.label} <X className="size-3.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MoreMenuButton({ label = "More actions", children }: { label?: string; children: ReactNode }) {
  return (
    <Menu>
      <MenuTrigger>
        <button type="button" className={buttonClass({ variant: "secondary", className: "px-3" })} aria-label={label} title={label}>
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent>{children}</MenuContent>
    </Menu>
  );
}
