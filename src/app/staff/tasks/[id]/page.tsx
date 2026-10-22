import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Avatar, Card } from "@/components/ui/misc";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toLocalInputValue } from "@/lib/time";
import { requireStaff } from "@/server/authz";
import { getTask } from "@/server/tasks";
import { assignmentOptions } from "@/server/tickets";
import { taskCommentAction, updateTaskAction } from "../../actions";
import { TaskCommentForm, TaskForm } from "../task-forms";

export const metadata: Metadata = { title: "Task" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TaskPage({ params, searchParams }: PageProps<"/staff/tasks/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  if (!UUID.test(id)) notFound();
  const [task, options] = await Promise.all([getTask(user, id), assignmentOptions(user)]);
  if (!task) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/staff/tasks" className="inline-flex min-h-10 items-center gap-1.5 font-bold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Tasks
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight break-words">{task.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Created by {task.createdBy?.name ?? "someone"} on {formatDateTime(task.createdAt)}
          {task.ticket && (
            <>
              {" · for "}
              <Link href={`/staff/tickets/${task.ticket.ticketNumber}`} className="font-bold text-primary hover:underline">
                {task.ticket.ticketNumber}
              </Link>{" "}
              “{task.ticket.subject}”
            </>
          )}
        </p>
      </div>

      {saved && <Alert tone="success">Task saved.</Alert>}

      <Card className="p-4 sm:p-5">
        <TaskForm
          action={updateTaskAction.bind(null, task.id)}
          task={{
            title: task.title,
            description: task.description,
            status: task.status,
            assignedAgentId: task.assignedAgent?.id ?? null,
            assignedTeamId: task.assignedTeam?.id ?? null,
            dueAtLocal: toLocalInputValue(task.dueAt),
          }}
          agents={options.agents}
          teams={options.teams}
          submitLabel="Save task"
        />
      </Card>

      <section aria-labelledby="comments-heading" className="space-y-3">
        <h2 id="comments-heading" className="text-lg font-bold">
          Comments
        </h2>
        {task.comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author?.name ?? "?"} />
            <Card className="min-w-0 flex-1 px-4 py-3">
              <p className="mb-1 text-sm">
                <span className="font-bold">{c.author?.name ?? "Someone"}</span>{" "}
                <span className="text-muted">{formatRelative(c.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
            </Card>
          </div>
        ))}
        <TaskCommentForm action={taskCommentAction.bind(null, task.id)} />
      </section>
    </div>
  );
}
