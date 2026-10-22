import clsx from "clsx";
import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("grid size-9 place-items-center overflow-hidden rounded-full bg-white p-0.5 shadow-card", className)}>
      <Image src="/cia-first-logo.png" alt="" width={64} height={64} className="size-full object-contain" priority />
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="leading-tight">
        <span className="block font-bold tracking-tight">CIA FIRST</span>
        <span className="block text-xs font-bold tracking-wide text-gold-text">INTERNATIONAL SCHOOL</span>
        {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
        <span aria-hidden className="mt-1 block h-0.5 w-10 rounded-full bg-gold" />
      </span>
    </span>
  );
}
