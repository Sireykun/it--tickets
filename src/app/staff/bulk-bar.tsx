"use client";

import { CheckCheck, CircleDot, Flag, Layers, UserPlus, UserRound, UsersRound, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bulkUpdateAction } from "@/app/staff/actions";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/dropdown-menu";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";

export const BULK_FORM_ID = "bulk-form";
type Option = { id: string; name: string };

const ticketBoxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM_ID}"][name="tickets"]`)];

// Row checkboxes live in the server-rendered table and join this form through `form="bulk-form"`.
export function BulkBar({ agents, teams }: { agents: Option[]; teams: Option[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    // Phone cards and the desktop table both render a box per ticket, so count tickets, not boxes.
    const update = () => setCount(new Set(ticketBoxes().filter((b) => b.checked).map((b) => b.value)).size);
    update();
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, [params]);

  const apply = (field: string, value: string) => {
    if (!fieldRef.current || !valueRef.current) return;
    fieldRef.current.value = field;
    valueRef.current.value = value;
    formRef.current?.requestSubmit();
  };

  const clear = () => {
    for (const box of ticketBoxes()) box.checked = false;
    document.querySelectorAll<HTMLInputElement>("[data-select-all]").forEach((b) => (b.checked = false));
    setCount(0);
  };

  return (
    <form ref={formRef} id={BULK_FORM_ID} action={bulkUpdateAction}>
      <input type="hidden" name="returnTo" value={`${pathname}?${params}`} />
      <input ref={fieldRef} type="hidden" name="field" />
      <input ref={valueRef} type="hidden" name="value" />
      {count > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-primary/30 bg-surface p-2 pl-4 shadow-raised safe-bottom lg:left-[calc(17rem+1rem)]"
        >
          <span className="flex-1 font-bold" aria-live="polite">
            {count} selected
          </span>
          <Menu>
            <MenuTrigger>
              <Button>
                <Layers className="size-5" aria-hidden /> Bulk actions
              </Button>
            </MenuTrigger>
            <MenuContent side="top">
              <MenuItem icon={<UserPlus />} onSelect={() => apply("agent", "me")}>
                Assign to me
              </MenuItem>
              <MenuSub>
                <MenuSubTrigger icon={<UserRound />}>Assign to agent</MenuSubTrigger>
                <MenuSubContent>
                  <MenuItem onSelect={() => apply("agent", "")}>Unassigned</MenuItem>
                  {agents.map((a) => (
                    <MenuItem key={a.id} onSelect={() => apply("agent", a.id)}>
                      {a.name}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger icon={<UsersRound />}>Assign to team</MenuSubTrigger>
                <MenuSubContent>
                  <MenuItem onSelect={() => apply("team", "")}>No team</MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t.id} onSelect={() => apply("team", t.id)}>
                      {t.name}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
              <MenuSeparator />
              <MenuSub>
                <MenuSubTrigger icon={<CircleDot />}>Set status</MenuSubTrigger>
                <MenuSubContent>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} onSelect={() => apply("status", s)}>
                      {STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger icon={<Flag />}>Set priority</MenuSubTrigger>
                <MenuSubContent>
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p} onSelect={() => apply("priority", p)}>
                      {PRIORITY_LABEL[p]}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
              <MenuSeparator />
              <MenuItem icon={<CheckCheck />} onSelect={() => apply("status", "RESOLVED")}>
                Mark resolved
              </MenuItem>
            </MenuContent>
          </Menu>
          <Button variant="ghost" onClick={clear} aria-label="Clear selection" className="px-3">
            <X className="size-5" aria-hidden />
          </Button>
        </div>
      )}
    </form>
  );
}

export function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      data-select-all
      aria-label="Select all tickets on this page"
      className="relative z-10 size-5 cursor-pointer rounded accent-primary"
      // This change event still bubbles to the BulkBar's document listener after the boxes are set.
      onChange={(e) => {
        for (const box of ticketBoxes()) if (box.checkVisibility()) box.checked = e.target.checked;
      }}
    />
  );
}
