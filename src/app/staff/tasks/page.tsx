import clsx from "clsx";
import { CheckCircle2, Circle, ListTodo, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/server/authz";
import { listTasks, TASK_VIEWS, type TaskView } from "@/server/tasks";
import { assignmentOptions } from "@/server/tickets";
import { createTaskAction, toggleTaskAction } from "../actions";
import { TaskForm } from "./task-forms";

export const metadata: Metadata = { title: "Tasks" };

const VIEW_LABEL: Record<TaskView, string> = { mine: "Mine", teams: "My teams", open: "All open", done: "Done" };

export default async function TasksPage({ searchParams }: PageProps<"/staff/tasks">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const view = (TASK_VIEWS as readonly string[]).includes(sp.view as string) ? (sp.view as TaskView) : "mine";
  const showNew = sp.new === "1";
  const [tasks, options] = await Promise.all([listTasks(user, view), showNew ? assignmentOptions(user) : null]);
  const now = Date.now();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Tasks"
        subtitle="Internal to-dos, on their own or attached to a ticket."
        actions={
          !showNew && (
            <LinkButton href="/staff/tasks?new=1">
              <Plus className="size-5" aria-hidden /> New task
            </LinkButton>
          )
        }
      />

      {showNew && options && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-bold">New task</h2>
          <TaskForm action={createTaskAction.bind(null, null)} agents={options.agents} teams={options.teams} submitLabel="Create task" />
        </Card>
      )}

      <nav aria-label="Task views" className="mb-4 inline-flex flex-wrap rounded-lg border border-border bg-surface-2 p-1">
        {TASK_VIEWS.map((v) => (
          <Link
            key={v}
            href={`/staff/tasks?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={clsx("min-h-10 rounded-lg px-4 py-2 text-sm font-bold", view === v ? "bg-surface shadow-card" : "text-muted")}
          >
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </nav>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState icon={<ListTodo className="size-7" />} title="No tasks here" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {tasks.map((t) => {
              const overdue = t.status === "OPEN" && t.dueAt && t.dueAt.getTime() < now;
              return (
                <li key={t.id} className="flex items-start gap-2 px-2 py-2 sm:px-3">
                  <form action={toggleTaskAction.bind(null, t.id)}>
                    <button
                      type="submit"
                      className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2"
                      aria-label={t.status === "OPEN" ? `Mark "${t.title}" done` : `Reopen "${t.title}"`}
                    >
                      {t.status === "OPEN" ? <Circle className="size-6" aria-hidden /> : <CheckCircle2 className="size-6 text-resolved" aria-hidden />}
                    </button>
                  </form>
                  <Link href={`/staff/tasks/${t.id}`} className="min-w-0 flex-1 py-2 hover:underline">
                    <span className={clsx("block", t.status === "CLOSED" ? "text-muted line-through" : "font-bold")}>{t.title}</span>
                    <span className="block text-sm text-muted">
                      {t.assignedAgent?.name ?? t.assignedTeam?.name ?? "Unassigned"}
                      {t.ticket && ` · ${t.ticket.ticketNumber}`}
                      {t._count.comments > 0 && ` · ${t._count.comments} comment${t._count.comments === 1 ? "" : "s"}`}
                    </span>
                    {t.dueAt && (
                      <span className={clsx("block text-sm", overdue ? "font-bold text-danger" : "text-muted")}>
                        {overdue ? "Overdue · " : "Due "}
                        {formatDateTime(t.dueAt)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
