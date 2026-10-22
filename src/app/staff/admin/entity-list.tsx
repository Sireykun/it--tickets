import clsx from "clsx";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/misc";

export type EntityRow = { id: string; title: string; subtitle?: ReactNode; meta?: ReactNode; inactive?: boolean };

// Shared shell for the admin settings pages: header, "saved" notice, inline edit form, list.
export function AdminPage({
  title,
  subtitle,
  newLabel,
  basePath,
  saved,
  editTitle,
  form,
  rows,
  toolbar,
}: {
  title: string;
  subtitle: string;
  newLabel: string;
  basePath: string;
  saved: boolean;
  editTitle?: string;
  form?: ReactNode;
  rows: EntityRow[];
  toolbar?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          !form && (
            <LinkButton href={`${basePath}?edit=new`}>
              <Plus className="size-5" aria-hidden /> {newLabel}
            </LinkButton>
          )
        }
      />
      {saved && !form && (
        <div className="mb-4">
          <Alert tone="success">Saved.</Alert>
        </div>
      )}
      {form && (
        <Card className="mb-6 border-primary/25 p-4 shadow-raised sm:p-6">
          <h2 className="mb-4 text-lg font-bold">{editTitle}</h2>
          {form}
        </Card>
      )}
      {toolbar}
      <Card>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${basePath}?edit=${row.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70 sm:px-5">
                <div className={clsx("min-w-0 flex-1", row.inactive && "opacity-60")}>
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    <span className="truncate">{row.title}</span>
                    {row.inactive && <span className="rounded-full bg-surface-2 px-2 text-xs text-muted">Inactive</span>}
                  </p>
                  {row.subtitle && <p className="truncate text-sm text-muted">{row.subtitle}</p>}
                </div>
                {row.meta && <div className="hidden text-right text-sm text-muted sm:block">{row.meta}</div>}
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-muted">Nothing here yet.</li>}
        </ul>
      </Card>
    </>
  );
}

export function editTarget<T extends { id: string }>(edit: unknown, rows: T[]): { show: boolean; item?: T } {
  if (edit === "new") return { show: true };
  const item = typeof edit === "string" ? rows.find((r) => r.id === edit) : undefined;
  return { show: Boolean(item), item };
}
