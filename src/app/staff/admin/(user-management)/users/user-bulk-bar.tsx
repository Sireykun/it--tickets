"use client";

import { Home, Layers, School, UserCheck, UserMinus, UserX, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/dropdown-menu";
import { bulkUpdateUsersAction } from "../../actions";

export const USER_BULK_FORM = { id: "user-bulk-form", name: "users" };
type Option = { id: string; name: string };

const userBoxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[form="${USER_BULK_FORM.id}"][name="${USER_BULK_FORM.name}"]`)];

// Row checkboxes are rendered by the server list and join this form through `form="user-bulk-form"`.
export function UserBulkBar({ campuses }: { campuses: Option[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const update = () => setCount(userBoxes().filter((b) => b.checked).length);
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
    for (const box of userBoxes()) box.checked = false;
    setCount(0);
  };

  const campusMenu = (field: string, label: string, icon: ReactNode) => (
    <MenuSub>
      <MenuSubTrigger icon={icon}>{label}</MenuSubTrigger>
      <MenuSubContent>
        {campuses.map((c) => (
          <MenuItem key={c.id} onSelect={() => apply(field, c.id)}>
            {c.name}
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  );

  return (
    <form ref={formRef} id={USER_BULK_FORM.id} action={bulkUpdateUsersAction}>
      <input type="hidden" name="returnTo" value={`${pathname}?${params}`} />
      <input ref={fieldRef} type="hidden" name="field" />
      <input ref={valueRef} type="hidden" name="value" />
      {count > 0 && (
        <div
          role="region"
          aria-label="Bulk user actions"
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
              {campusMenu("addCampus", "Add to campus", <School />)}
              {campusMenu("removeCampus", "Remove from campus", <UserMinus />)}
              {campusMenu("homeCampus", "Set home campus", <Home />)}
              <MenuSeparator />
              <MenuItem icon={<UserCheck />} onSelect={() => apply("active", "true")}>
                Activate
              </MenuItem>
              <MenuItem icon={<UserX />} onSelect={() => apply("active", "false")}>
                Deactivate
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
