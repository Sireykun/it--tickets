import clsx from "clsx";
import { ChevronRight, FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/misc";

export type RowBadge = { label: string; tone?: "neutral" | "primary" | "gold" };

export type EntityRow = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  inactive?: boolean;
  leading?: ReactNode;
  badges?: RowBadge[];
};

const BADGE_TONES: Record<NonNullable<RowBadge["tone"]>, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  gold: "bg-gold/15 text-gold-text",
};

// Shared shell for the admin settings pages: header, "saved" notice, list, and an edit panel
// that sits beside the list on wide screens. `nested` pages live under a hub layout that
// already renders the page's H1 (the User management tabs), so they get a section header instead.
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
  nested,
  selectedId,
  isFormStacked,
  selectForm,
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
  nested?: boolean;
  selectedId?: string;
  isFormStacked?: boolean;
  selectForm?: { id: string; name: string }; // adds a row checkbox that joins this form (bulk actions)
}) {
  const isSplit = Boolean(form) && !isFormStacked;
  const newButton = (
    <LinkButton href={`${basePath}?edit=new`}>
      <Plus className="size-5" aria-hidden /> {newLabel}
    </LinkButton>
  );

  return (
    <>
      {nested ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              {title}
              <span className="rounded-full bg-surface-2 px-2 font-mono text-xs leading-5 text-muted">{rows.length}</span>
            </h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
          {newButton}
        </div>
      ) : (
        <PageHeader title={title} subtitle={subtitle} actions={newButton} />
      )}
      {saved && !form && (
        <div className="mb-4">
          <Alert tone="success">Saved.</Alert>
        </div>
      )}
      <div className={clsx(isSplit && "xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-6")}>
        {form && (
          <aside className={clsx("mb-6", isSplit && "xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:mb-0")}>
            <Card className="border-primary/25 p-4 shadow-raised sm:p-6">
              <h2 className="mb-4 text-lg font-bold">{editTitle}</h2>
              {form}
            </Card>
          </aside>
        )}
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          {toolbar}
          <Card>
            {rows.length === 0 ? (
              <EmptyState icon={<FolderOpen className="size-6" aria-hidden />} title="Nothing here yet">
                <Link href={`${basePath}?edit=new`} className="font-bold text-primary hover:underline">
                  {newLabel}
                </Link>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <li key={row.id} className={clsx(selectForm && "flex items-center")}>
                    {selectForm && (
                      // Outside the row link so ticking it doesn't open the editor.
                      <label className="grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center pl-2 sm:pl-3">
                        <input
                          type="checkbox"
                          form={selectForm.id}
                          name={selectForm.name}
                          value={row.id}
                          aria-label={`Select ${row.title}`}
                          className="size-5 rounded accent-primary"
                        />
                      </label>
                    )}
                    <div className="min-w-0 flex-1">
                      <EntityRowLink row={row} basePath={basePath} isCompact={isSplit} isSelected={row.id === selectedId} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export function editTarget<T extends { id: string }>(edit: unknown, rows: T[]): { show: boolean; item?: T } {
  if (edit === "new") return { show: true };
  const item = typeof edit === "string" ? rows.find((r) => r.id === edit) : undefined;
  return { show: Boolean(item), item };
}

function EntityRowLink({ row, basePath, isCompact, isSelected }: { row: EntityRow; basePath: string; isCompact: boolean; isSelected: boolean }) {
  return (
    <Link
      href={`${basePath}?edit=${row.id}`}
      aria-current={isSelected ? "page" : undefined}
      className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70 aria-[current=page]:bg-primary-soft sm:px-5"
    >
      {row.leading}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
          <span className={clsx("max-w-full shrink-0 truncate", row.inactive && "text-muted")}>{row.title}</span>
          {row.badges?.map((b) => (
            <span key={b.label} className={clsx("whitespace-nowrap rounded-full px-2 text-xs leading-5 font-bold", BADGE_TONES[b.tone ?? "neutral"])}>
              {b.label}
            </span>
          ))}
          {row.inactive && <span className="rounded-full border border-border px-2 text-xs leading-5 text-muted">Inactive</span>}
        </p>
        {row.subtitle && <p className="truncate text-sm text-muted">{row.subtitle}</p>}
      </div>
      {row.meta && <div className={clsx("hidden text-right text-sm text-muted", isCompact ? "2xl:block" : "sm:block")}>{row.meta}</div>}
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function IconTile({ children }: { children: ReactNode }) {
  return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary [&>svg]:size-[1.125rem]">{children}</span>;
}
