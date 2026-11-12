"use client";

import { Headset, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { saveColorModeAction } from "@/app/(portal)/actions";
import { logoutAction } from "@/app/actions/auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuLinkItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown-menu";
import { applyTheme, type Theme } from "@/lib/theme";

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

type Props = {
  name: string;
  email: string;
  hasPhoto?: boolean;
  theme: Theme;
  // Where the "switch app" link goes: staff see the portal from the console and vice versa.
  switchTo: "portal" | "staff" | null;
  showName?: boolean;
};

export function UserMenu({ name, email, hasPhoto = false, theme, switchTo, showName }: Props) {
  const [current, setCurrent] = useState(theme);
  const [, startTransition] = useTransition();

  const handleThemeChange = (value: string) => {
    setCurrent(value as Theme);
    applyTheme(value as Theme);
    startTransition(() => saveColorModeAction(value));
  };

  return (
    <Menu>
      <MenuTrigger>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center gap-3 rounded-lg px-1 text-left hover:bg-surface-2 data-[state=open]:bg-surface-2"
          aria-label={`Account menu for ${name}`}
        >
          <ProfileAvatar name={name} hasPhoto={hasPhoto} className="size-9" />
          {showName && <span className="min-w-0 flex-1 truncate font-bold">{name}</span>}
        </button>
      </MenuTrigger>
      <MenuContent align={showName ? "start" : "end"} side={showName ? "top" : "bottom"}>
        <div className="px-3 py-2">
          <p className="truncate font-bold">{name}</p>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
        <MenuSeparator />
        <MenuLinkItem href="/account" icon={<UserRound />}>
          My account
        </MenuLinkItem>
        {switchTo === "staff" && (
          <MenuLinkItem href="/staff" icon={<Headset />}>
            Staff console
          </MenuLinkItem>
        )}
        {switchTo === "portal" && (
          <MenuLinkItem href="/" icon={<UserRound />}>
            Requester portal
          </MenuLinkItem>
        )}
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={current} onValueChange={handleThemeChange}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <MenuRadioItem key={value} value={value}>
              <Icon className="size-4 text-muted" aria-hidden /> {label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={() => startTransition(() => logoutAction())}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
