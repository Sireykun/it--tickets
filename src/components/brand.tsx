import clsx from "clsx";
import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("brand-mark grid size-9 place-items-center overflow-hidden rounded-full bg-white p-0.5 shadow-card", className)}>
      <Image src="/cia-first-logo.png" alt="" width={64} height={64} className="size-full object-contain" priority />
    </span>
  );
}

// "sidebar": white and gold text for the dark teal sidebar.
export function Brand({ subtitle, tone = "default" }: { subtitle?: string; tone?: "default" | "sidebar" }) {
  const isSidebar = tone === "sidebar";
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="leading-tight">
        <span className={clsx("block font-bold tracking-tight", isSidebar && "text-sidebar-strong")}>CIA FIRST</span>
        <span className={clsx("block text-xs font-bold tracking-wide", isSidebar ? "text-sidebar-accent" : "text-gold-text")}>INTERNATIONAL SCHOOL</span>
        {subtitle && <span className={clsx("block text-xs", isSidebar ? "text-sidebar-muted" : "text-muted")}>{subtitle}</span>}
        {!isSidebar && <span aria-hidden className="mt-1 block h-0.5 w-10 rounded-full bg-gold" />}
      </span>
    </span>
  );
}
