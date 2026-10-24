"use client";

import type { AdminDashboard } from "@/server/admin-dashboard";

type Campus = AdminDashboard["campuses"][number];
export type HealthMode = "tubes" | "spline" | "radar";
export type CampusMode = "columns" | "topology";
export type GraphMetric = { key: string; label: string; value: number; color: string };

const campusColors = ["#60a5fa", "#fb923c", "#34d399", "#eab308", "#ec4899", "#a78bfa", "#22d3ee"];
const colorFor = (campus: Campus) => campusColors[(campus.slot ?? 0) % campusColors.length];

export function HealthGraph({ metrics, mode, scale, focused, onFocus }: {
  metrics: GraphMetric[]; mode: HealthMode; scale: "smart" | "linear"; focused: string | null; onFocus: (key: string) => void;
}) {
  const max = Math.max(1, ...metrics.map(m => m.value));
  const ratio = (value: number) => value === 0 ? 0 : scale === "smart" ? Math.sqrt(value / max) : value / max;
  if (mode === "tubes") return <div className="relative mt-4 grid min-h-44 flex-1 grid-cols-8 items-end gap-1 border-b border-border px-1 pb-1 sm:gap-2">
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
    {metrics.map(m => <button key={m.key} type="button" onClick={() => onFocus(m.key)} aria-label={`${m.label}: ${m.value}`} aria-pressed={focused === m.key} className="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span className="text-[11px] font-bold tabular-nums">{m.value}</span><span className={`flex h-28 w-full max-w-9 items-end overflow-hidden rounded-t-xl border bg-surface-2 p-0.5 ${focused === m.key ? "border-primary" : "border-border"}`}><span className="w-full rounded-t-lg transition-[height] duration-500" style={{ height: `${ratio(m.value) * 100}%`, background: `linear-gradient(180deg, ${m.color}, ${m.color}66)`, boxShadow: m.value ? `0 0 14px ${m.color}66` : "none" }} /></span><span className="w-full truncate text-center text-[9px] text-muted" title={m.label}>{m.label}</span></button>)}
  </div>;

  if (mode === "spline") {
    const points = metrics.map((m, i) => ({ ...m, x: 34 + i * 74, y: 136 - ratio(m.value) * 102 }));
    const path = points.reduce((d, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const previous = points[i - 1];
      const middle = (previous.x + p.x) / 2;
      return `${d} C ${middle} ${previous.y}, ${middle} ${p.y}, ${p.x} ${p.y}`;
    }, "");
    return <div className="mt-4 flex min-h-44 flex-1 items-center"><svg role="img" aria-label={metrics.map(m => `${m.label}: ${m.value}`).join(", ")} viewBox="0 0 590 170" className="h-full min-h-44 w-full" preserveAspectRatio="none"><defs><linearGradient id="health-spline-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#60a5fa" stopOpacity=".28" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient><linearGradient id="health-spline-stroke" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#60a5fa" /><stop offset=".48" stopColor="#f87171" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>{[45, 85, 125].map(y => <line key={y} x1="24" x2="570" y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 5" />)}<path d={`${path} L ${points.at(-1)?.x ?? 0} 140 L ${points[0]?.x ?? 0} 140 Z`} fill="url(#health-spline-fill)" /><path d={path} fill="none" stroke="url(#health-spline-stroke)" strokeWidth="3" strokeLinecap="round" />{points.map(p => <g key={p.key}><circle cx={p.x} cy={p.y} r="5" fill={p.color} stroke="var(--surface)" strokeWidth="2" /><text x={p.x} y={p.y - 11} textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700">{p.value}</text><text x={p.x} y="158" textAnchor="middle" fill="currentColor" opacity=".65" fontSize="8">{p.label}</text></g>)}</svg></div>;
  }

  const center = 110;
  const radius = 70;
  const points = metrics.map((m, i) => { const angle = i * Math.PI * 2 / metrics.length - Math.PI / 2; const distance = Math.max(0.04, ratio(m.value)) * radius; return { ...m, x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance, labelX: center + Math.cos(angle) * (radius + 32), labelY: center + Math.sin(angle) * (radius + 24) }; });
  return <div className="mt-4 flex min-h-44 flex-1 items-center justify-center"><svg role="img" aria-label={metrics.map(m => `${m.label}: ${m.value}`).join(", ")} viewBox="0 0 220 220" className="h-52 w-full max-w-sm">{[.33, .66, 1].map(step => <circle key={step} cx={center} cy={center} r={radius * step} fill="none" stroke="var(--border)" strokeDasharray="3 3" />)}{metrics.map((m, i) => { const angle = i * Math.PI * 2 / metrics.length - Math.PI / 2; return <line key={m.key} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="var(--border)" />; })}<polygon points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(96,165,250,.2)" stroke="#60a5fa" strokeWidth="2" />{points.map(p => <g key={p.key}><circle cx={p.x} cy={p.y} r="3.5" fill={p.color} /><text x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8">{p.label} {p.value}</text></g>)}</svg></div>;
}

export function CampusGraph({ campuses, core, mode, scale, onSelect, emailOn }: {
  campuses: Campus[]; core: Campus[]; mode: CampusMode; scale: "smart" | "linear"; onSelect: (campus: Campus) => void; emailOn: boolean;
}) {
  if (mode === "topology") {
    const other = campuses.filter(c => !core.some(primary => primary.id === c.id));
    return <div className="relative mt-4 grid min-h-56 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 overflow-hidden sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
      <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 1000 280" preserveAspectRatio="none"><path d="M 115 140 C 200 140, 240 35, 360 35 M 115 140 C 200 140, 240 105, 360 105 M 115 140 C 200 140, 240 175, 360 175 M 115 140 C 200 140, 240 245, 360 245" fill="none" stroke="#60a5fa" strokeOpacity=".6" strokeWidth="2" />{other.length > 0 && <path d="M 640 140 C 740 140, 770 140, 850 140" fill="none" stroke="var(--border-strong)" strokeDasharray="5 5" />}</svg>
      <div className="relative z-10 grid size-20 place-items-center rounded-full border-2 border-primary bg-primary-soft text-center text-xs font-bold text-primary shadow-card sm:size-24"><span>IT HUB<small className="block text-[9px] font-medium">Email {emailOn ? "on" : "off"}</small></span></div>
      <div className="relative z-10 grid gap-2">{core.map(c => <button type="button" key={c.id ?? "none"} onClick={() => onSelect(c)} className="flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-lg border bg-surface px-2.5 text-left text-xs font-semibold shadow-card hover:bg-surface-2" style={{ borderColor: colorFor(c) }}><span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(c) }} /><span className="truncate">{c.name}</span></span><strong className="tabular-nums" style={{ color: colorFor(c) }}>{c.open}</strong></button>)}</div>
      <div className="relative z-10 col-span-2 grid max-h-56 gap-1.5 overflow-y-auto sm:col-span-1">{other.length ? other.map(c => <button type="button" key={c.id ?? "none"} onClick={() => onSelect(c)} className="flex min-h-7 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-2 text-left text-[10px] text-muted hover:border-primary/40"><span className="flex min-w-0 items-center gap-1.5"><span className="size-1.5 shrink-0 rounded-full" style={{ background: colorFor(c) }} /><span className="truncate">{c.name}</span></span><span>{c.open}</span></button>) : <p className="text-xs text-muted">No other locations</p>}</div>
    </div>;
  }
  const max = Math.max(1, ...campuses.flatMap(c => [c.open, c.unassigned, c.overdue, c.urgent, c.createdDay]));
  const size = (value: number) => value === 0 ? 0 : (scale === "smart" ? Math.sqrt(value / max) : value / max) * 100;
  return <div className="mt-4 flex min-h-44 flex-1 gap-2 overflow-x-auto border-b border-border pb-2">{campuses.length ? campuses.map(c => <button type="button" key={c.id ?? "none"} onClick={() => onSelect(c)} className="flex min-w-20 flex-1 flex-col justify-end rounded-lg px-1 pt-2 text-center hover:bg-surface-2"><span className="mb-1 text-xs font-bold tabular-nums">{c.open}</span><span className="flex h-28 items-end justify-center gap-0.5"><Column value={c.open} size={size(c.open)} color="#60a5fa" /><Column value={c.unassigned} size={size(c.unassigned)} color="#fb923c" /><Column value={c.overdue} size={size(c.overdue)} color="#f87171" /><Column value={c.urgent} size={size(c.urgent)} color="#eab308" /><Column value={c.createdDay} size={size(c.createdDay)} color="#22d3ee" /></span><span className="mt-2 w-full truncate text-[10px] font-semibold" title={c.name}>{c.name}</span></button>) : <p className="m-auto text-sm text-muted">No campuses match your search.</p>}</div>;
}

function Column({ value, size, color }: { value: number; size: number; color: string }) { return <span className="w-2.5 max-w-[18%] flex-1 rounded-t-sm transition-[height] duration-500" style={{ height: value ? `${Math.max(size, 3)}%` : "2px", background: value ? color : "var(--border)" }} title={String(value)} />; }
