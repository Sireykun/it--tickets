"use client";

import { useEffect, useState } from "react";
import { updateThemeAction } from "../actions";

const choices = [
  { id: "ocean", label: "Ocean", swatch: "bg-[#79d9ed]" },
  { id: "violet", label: "Violet", swatch: "bg-[#c4a7ff]" },
  { id: "rose", label: "Rose", swatch: "bg-[#f7a2ca]" },
] as const;

export function ThemePicker({ initialTheme }: { initialTheme: string }) {
  const [selected, setSelected] = useState(initialTheme);
  useEffect(() => {
    setSelected(initialTheme);
    document.querySelector<HTMLElement>("[data-portal-theme]")?.setAttribute("data-portal-theme", initialTheme);
  }, [initialTheme]);

  return <div className="grid gap-3 sm:grid-cols-3">
    {choices.map(({ id, label, swatch }) => <form key={id} action={updateThemeAction.bind(null, id)}>
      <button type="submit" aria-pressed={selected === id} onClick={() => {
        setSelected(id);
        document.querySelector<HTMLElement>("[data-portal-theme]")?.setAttribute("data-portal-theme", id);
      }} className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 font-bold transition-colors hover:bg-surface-2 ${selected === id ? "border-primary bg-primary-soft" : "border-border"}`}>
        <span aria-hidden className={`size-6 rounded-full ${swatch}`} />{label}
        {selected === id && <span className="ml-auto text-sm text-primary">Selected</span>}
      </button>
    </form>)}
  </div>;
}
