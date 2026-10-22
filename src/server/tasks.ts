import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { type AppUser, canWorkTicket, isStaff } from "@/server/roles";
import { TicketError } from "@/server/tickets";

type Actor = Pick<AppUser, "id" | "name" | "role" | "campusScope">;

// Tasks on tickets outside the actor's campuses are invisible to them; standalone tasks are shared.
function taskScope(actor: Actor): Prisma.TaskWhereInput {
  return actor.campusScope === "all" ? {} : { OR: [{ ticketId: null }, { ticket: { campusId: { in: actor.campusScope } } }] };
}

async function findTaskInScope(actor: Actor, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, ...taskScope(actor) } });
  if (!task) throw new TicketError("Task not found.");
  return task;
}

type TaskInput = {
  title: string;
  description: string | null;
  assignedAgentId: string | null;
  assignedTeamId: string | null;
  dueAt: Date | null;
};

function assertStaff(actor: Actor) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
}

async function checkAssignees(input: Pick<TaskInput, "assignedAgentId" | "assignedTeamId">) {
  if (input.assignedAgentId) {
    const agent = await prisma.user.findFirst({
      where: { id: input.assignedAgentId, isActive: true, role: { in: ["AGENT", "ADMIN", "SUPERADMIN"] } },
    });
    if (!agent) throw new TicketError("Tasks can only be assigned to active agents.");
  }
  if (input.assignedTeamId) {
    const team = await prisma.team.findFirst({ where: { id: input.assignedTeamId, isActive: true } });
    if (!team) throw new TicketError("That team doesn't exist or is inactive.");
  }
}

export async function createTask(actor: Actor, input: TaskInput & { ticketNumber?: string | null }) {
  assertStaff(actor);
  await checkAssignees(input);
  let ticketId: string | null = null;
  if (input.ticketNumber) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: input.ticketNumber.trim().toUpperCase() } });
    if (!ticket || !canWorkTicket(actor, ticket)) throw new TicketError("Ticket not found.");
    ticketId = ticket.id;
  }
  const { ticketNumber: _ignored, ...data } = input;
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({ data: { ...data, ticketId, createdById: actor.id } });
    if (ticketId) {
      await tx.ticketThread.create({
        data: { ticketId, authorId: actor.id, type: "SYSTEM_EVENT", body: `Task added: ${task.title}` },
      });
    }
    await audit(tx, actor, "task.create", { type: "task", id: task.id }, { title: task.title });
    return task;
  });
}

export async function updateTask(actor: Actor, taskId: string, input: TaskInput & { status: TaskStatus }) {
  assertStaff(actor);
  const task = await findTaskInScope(actor, taskId);
  await checkAssignees(input);

  const closing = input.status === "CLOSED" && task.status !== "CLOSED";
  const reopening = input.status === "OPEN" && task.status === "CLOSED";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { ...input, closedAt: closing ? new Date() : reopening ? null : task.closedAt },
    });
    if (task.ticketId && (closing || reopening)) {
      await tx.ticketThread.create({
        data: {
          ticketId: task.ticketId,
          authorId: actor.id,
          type: "SYSTEM_EVENT",
          body: closing ? `Task completed: ${task.title}` : `Task reopened: ${task.title}`,
        },
      });
    }
    await audit(tx, actor, "task.update", { type: "task", id: taskId }, { status: input.status });
    return updated;
  });
}

export async function addTaskComment(actor: Actor, taskId: string, body: string) {
  assertStaff(actor);
  await findTaskInScope(actor, taskId);
  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({ data: { taskId, authorId: actor.id, body } });
    await tx.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } });
    return comment;
  });
}

export const TASK_VIEWS = ["mine", "teams", "open", "done"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

const taskListInclude = {
  ticket: { select: { ticketNumber: true, subject: true } },
  assignedAgent: { select: { id: true, name: true } },
  assignedTeam: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

export async function listTasks(actor: Actor, view: TaskView) {
  assertStaff(actor);
  let where: Prisma.TaskWhereInput;
  switch (view) {
    case "mine":
      where = { status: "OPEN", assignedAgentId: actor.id };
      break;
    case "teams": {
      const teams = await prisma.teamMember.findMany({ where: { userId: actor.id }, select: { teamId: true } });
      where = { status: "OPEN", assignedTeamId: { in: teams.map((t) => t.teamId) } };
      break;
    }
    case "done":
      where = { status: "CLOSED" };
      break;
    default:
      where = { status: "OPEN" };
  }
  return prisma.task.findMany({
    where: { AND: [where, taskScope(actor)] },
    orderBy: view === "done" ? [{ closedAt: "desc" }] : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
    include: taskListInclude,
  });
}

export function tasksForTicket(ticketId: string) {
  return prisma.task.findMany({
    where: { ticketId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: taskListInclude,
  });
}

export async function getTask(actor: Actor, taskId: string) {
  assertStaff(actor);
  return prisma.task.findFirst({
    where: { id: taskId, ...taskScope(actor) },
    include: {
      ...taskListInclude,
      createdBy: { select: { name: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
}
