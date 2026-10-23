"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action-utils";
import { safeRedirectPath } from "@/server/auth-rules";
import { requireStaff } from "@/server/authz";
import { acquireLock, type LockHolder, releaseLock } from "@/server/locks";
import { prisma } from "@/server/prisma";
import { prepareUploads } from "@/server/storage";
import { addTaskComment, createTask, updateTask } from "@/server/tasks";
import {
  addCollaborator,
  addMessage,
  type BulkChange,
  bulkUpdateTickets,
  createTicket,
  findOrCreateRequester,
  linkTickets,
  removeCollaborator,
  mergeTickets,
  TicketError,
  unlinkTickets,
  updateTicketFields,
} from "@/server/tickets";
import {
  bulkUpdateSchema,
  collaboratorSchema,
  firstError,
  formToObject,
  messageSchema,
  staffNewTicketSchema,
  taskCommentSchema,
  taskSchema,
  taskUpdateSchema,
  ticketPairSchema,
  ticketUpdateSchema,
} from "@/server/validation";

function revalidateTicket(ticketNumber: string) {
  revalidatePath(`/staff/tickets/${ticketNumber}`);
  revalidatePath("/staff", "layout"); // queue lists and sidebar counts
}

export async function postStaffMessageAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = messageSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.mode === "client") return { error: "Choose Reply or Internal note." };
  const uploads = await prepareUploads(formData.getAll("files"));
  if (!uploads.ok) return { error: uploads.error };

  return runAction(async () => {
    const entry = await addMessage(user, ticketNumber, parsed.data, uploads.files);
    await releaseLock(user, entry.ticketId);
    revalidateTicket(ticketNumber);
  });
}

export async function updateTicketAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = ticketUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  return runAction(async () => {
    await updateTicketFields(user, ticketNumber, parsed.data);
    revalidateTicket(ticketNumber);
  });
}

export async function assignToMeAction(ticketNumber: string) {
  const user = await requireStaff();
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
  if (!ticket) throw new TicketError("Ticket not found.");
  await updateTicketFields(user, ticketNumber, {
    status: ticket.status,
    priority: ticket.priority,
    assignedTeamId: ticket.assignedTeamId,
    assignedAgentId: user.id,
  });
  revalidateTicket(ticketNumber);
}

// ─── Bulk queue actions ─────────────────────────────────────────────────────

export async function bulkUpdateAction(formData: FormData) {
  const user = await requireStaff();
  const returnTo = safeRedirectPath(formData.get("returnTo"), "/staff");
  const back = new URL(returnTo.startsWith("/staff") ? returnTo : "/staff", "http://local");
  back.searchParams.delete("bulk");
  back.searchParams.delete("skipped");
  back.searchParams.delete("bulkError");

  const parsed = bulkUpdateSchema.safeParse({ ...formToObject(formData), tickets: formData.getAll("tickets") });
  if (!parsed.success) {
    back.searchParams.set("bulkError", firstError(parsed.error));
  } else {
    const { tickets, ...rest } = parsed.data;
    const change: BulkChange =
      rest.field === "status"
        ? { status: rest.value }
        : rest.field === "priority"
          ? { priority: rest.value }
          : rest.field === "agent"
            ? { assignedAgentId: rest.value === "me" ? user.id : rest.value }
            : { assignedTeamId: rest.value };
    const result = await runAction(async () => {
      const { updated, skipped } = await bulkUpdateTickets(user, tickets, change);
      back.searchParams.set("bulk", String(updated));
      if (skipped.length) back.searchParams.set("skipped", skipped.map((s) => `${s.ticketNumber}: ${s.reason}`).join("\n"));
    });
    if (result.error) back.searchParams.set("bulkError", result.error);
    revalidatePath("/staff", "layout");
  }
  redirect(`${back.pathname}${back.search}`);
}

// ─── Collision lock (called by the composer while an agent is typing) ───────

export async function heartbeatLockAction(ticketId: string): Promise<LockHolder | null> {
  const user = await requireStaff();
  return acquireLock(user, ticketId);
}

export async function releaseLockAction(ticketId: string) {
  const user = await requireStaff();
  await releaseLock(user, ticketId);
}

// ─── Links & merges ─────────────────────────────────────────────────────────

export async function linkAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = ticketPairSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  return runAction(async () => {
    await linkTickets(user, ticketNumber, parsed.data.other);
    revalidateTicket(ticketNumber);
    revalidateTicket(parsed.data.other);
  });
}

export async function unlinkAction(ticketNumber: string, other: string) {
  const user = await requireStaff();
  await unlinkTickets(user, ticketNumber, other);
  revalidateTicket(ticketNumber);
  revalidateTicket(other);
}

export async function mergeAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = ticketPairSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const result = await runAction(async () => {
    await mergeTickets(user, ticketNumber, parsed.data.other);
  });
  if (result.error) return result;
  revalidateTicket(ticketNumber);
  redirect(`/staff/tickets/${parsed.data.other}`);
}

// ─── Opening tickets for someone ────────────────────────────────────────────

export async function staffCreateTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = staffNewTicketSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const uploads = await prepareUploads(formData.getAll("files"));
  if (!uploads.ok) return { error: uploads.error };

  let ticketNumber = "";
  const result = await runAction(async () => {
    const { requesterEmail, requesterName, source, ...input } = parsed.data;
    const requester = await findOrCreateRequester(user, { email: requesterEmail, name: requesterName });
    const { campusId, ...ticketInput } = input;
    ticketNumber = (await createTicket(user, ticketInput, uploads.files, { requesterId: requester.id, source, campusId })).ticketNumber;
  });
  if (result.error) return result;
  revalidatePath("/staff", "layout");
  redirect(`/staff/tickets/${ticketNumber}`);
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function createTaskAction(ticketNumber: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = taskSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let taskId = "";
  const result = await runAction(async () => {
    taskId = (await createTask(user, { ...parsed.data, ticketNumber })).id;
  });
  if (result.error) return result;
  revalidatePath("/staff", "layout");
  if (ticketNumber) return { ok: true, nonce: Date.now() };
  redirect(`/staff/tasks/${taskId}`);
}

export async function updateTaskAction(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = taskUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const result = await runAction(async () => {
    await updateTask(user, taskId, parsed.data);
  });
  if (result.error) return result;
  // Refreshing the layout (sidebar counts) remounts the form, so the confirmation travels in the URL.
  revalidatePath("/staff", "layout");
  redirect(`/staff/tasks/${taskId}?saved=1`);
}

// One-click done/reopen from task lists.
export async function toggleTaskAction(taskId: string) {
  const user = await requireStaff();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new TicketError("Task not found.");
  await updateTask(user, taskId, {
    title: task.title,
    description: task.description,
    assignedAgentId: task.assignedAgentId,
    assignedTeamId: task.assignedTeamId,
    dueAt: task.dueAt,
    status: task.status === "OPEN" ? "CLOSED" : "OPEN",
  });
  revalidatePath("/staff", "layout");
}

export async function taskCommentAction(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = taskCommentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  return runAction(async () => {
    await addTaskComment(user, taskId, parsed.data.body);
    revalidatePath(`/staff/tasks/${taskId}`);
  });
}

// ─── CC ─────────────────────────────────────────────────────────────────────

export async function staffAddCcAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = collaboratorSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  return runAction(async () => {
    await addCollaborator(user, ticketNumber, parsed.data);
    revalidateTicket(ticketNumber);
  });
}

export async function staffRemoveCcAction(ticketNumber: string, userId: string) {
  const user = await requireStaff();
  await removeCollaborator(user, ticketNumber, userId);
  revalidateTicket(ticketNumber);
}
