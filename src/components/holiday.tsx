"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { type Season, SEASON_INFO } from "@/lib/holidays";

// Greeting shown above staff pages during a holiday. Dismissing it lasts until the next
// holiday (the key includes the season and year), and it stays hidden until mounted so a
// dismissed banner never flashes in.
export function HolidayBanner({ season }: { season: Season }) {
  const storageKey = `holiday-banner:${season}:${new Date().getFullYear()}`;
  const [isVisible, setIsVisible] = useState(false);
  const info = SEASON_INFO[season];

  useEffect(() => {
    setIsVisible(localStorage.getItem(storageKey) !== "dismissed");
  }, [storageKey]);

  function handleDismiss() {
    localStorage.setItem(storageKey, "dismissed");
    setIsVisible(false);
  }

  if (!isVisible) return null;
  return (
    <section
      aria-label={info.name}
      className="holiday-banner mb-5 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft py-2 pl-3 pr-1 text-text shadow-card sm:gap-4 sm:pl-4"
    >
      <HolidayMotif season={season} className="size-12 shrink-0 text-primary sm:size-14" />
      <div className="min-w-0 flex-1 py-1">
        <p lang="km" className="font-bold leading-snug text-primary">{info.greetingKm}</p>
        <p className="text-sm text-muted">{info.greeting}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss holiday greeting"
        className="grid size-11 shrink-0 place-items-center self-start rounded-lg text-muted hover:bg-surface hover:text-text"
      >
        <X className="size-5" aria-hidden />
      </button>
    </section>
  );
}

// Decorative artwork for each holiday. Petals and hulls use currentColor (the season's primary);
// flames, sparkles and fireworks use --gold. Elements with `holiday-twinkle` animate only when
// the user allows motion (globals.css).
export function HolidayMotif({ season, className }: { season: Season; className?: string }) {
  const svg = { viewBox: "0 0 64 64", fill: "none", "aria-hidden": true, className: clsx("holiday-motif", className) } as const;

  if (season === "khmer-new-year") {
    return (
      <svg {...svg}>
        <path d="M32 50c-9-4-14-12-12-22 6 2 10 7 12 14 2-7 6-12 12-14 2 10-3 18-12 22Z" fill="currentColor" opacity=".9" />
        <path d="M32 50c-4-6-5-14 0-24 5 10 4 18 0 24Z" fill="var(--gold)" />
        <path d="M32 50c-10 0-18-4-22-11 7-2 14 0 19 5M32 50c10 0 18-4 22-11-7-2-14 0-19 5" fill="currentColor" opacity=".55" />
        <path d="M18 54h28" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />
        <g className="holiday-twinkle" fill="var(--gold)">
          <path d="M12 14l1.5 4 4 1.5-4 1.5L12 25l-1.5-4-4-1.5 4-1.5Z" />
          <path d="M51 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
          <circle cx="47" cy="22" r="1.6" />
        </g>
      </svg>
    );
  }

  if (season === "pchum-ben") {
    return (
      <svg {...svg}>
        <path d="M8 50c8 6 40 6 48 0-6-3-14-4-24-4S14 47 8 50Z" fill="currentColor" opacity=".5" />
        <path d="M16 44c2 5 30 5 32 0l-3-5H19Z" fill="currentColor" />
        <path d="M19 39h26" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 38v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path className="holiday-twinkle" d="M32 33c-5-4-5-10 0-17 5 7 5 13 0 17Z" fill="var(--gold)" />
        <path d="M32 31c-2-2-2-5 0-8 2 3 2 6 0 8Z" fill="var(--primary-soft)" />
        <circle className="holiday-twinkle" cx="16" cy="18" r="1.6" fill="var(--gold)" />
        <circle className="holiday-twinkle" cx="49" cy="14" r="1.3" fill="var(--gold)" />
      </svg>
    );
  }

  return (
    <svg {...svg}>
      <g className="holiday-twinkle" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
        <path d="M18 10v4M18 22v4M10 18h4M22 18h4M12.5 12.5l2.5 2.5M21 21l2.5 2.5M12.5 23.5l2.5-2.5M21 15l2.5-2.5" />
        <path d="M46 6v3M46 15v3M40 12h3M49 12h3" />
      </g>
      <path d="M6 40c8 4 44 4 52 0l-3 6c-10 3-36 3-46 0Z" fill="currentColor" />
      <path d="M6 40c-1-4 0-7 3-9M58 40c1-4 0-7-3-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 41l-4 8M24 42l-4 8M32 42l-4 8M40 42l-4 8M48 41l-4 8" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 54c5-3 9 3 14 0s9 3 14 0 9 3 14 0 9 3 14 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
