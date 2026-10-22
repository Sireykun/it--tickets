"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action-utils";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { prepareUploads } from "@/server/storage";
import { addCollaborator, addMessage, closeAsRequester, createTicket, removeCollaborator } from "@/server/tickets";
import {
  changePasswordSchema,
  collaboratorSchema,
  emailAlertsSchema,
  firstError,
  formToObject,
  messageSchema,
  newTicketSchema,
  profileSchema,
} from "@/server/validation";

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = newTicketSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const uploads = await prepareUploads(formData.getAll("files"));
  if (!uploads.ok) return { error: uploads.error };

  let ticketNumber = "";
  const result = await runAction(async () => {
    const { campusId, ...input } = parsed.data;
    ticketNumber = (await createTicket(user, input, uploads.files, { campusId })).ticketNumber;
  });
  if (result.error) return result;
  revalidatePath("/");
  redirect(`/tickets/${ticketNumber}?created=1`);
}

export async function postClientMessageAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = messageSchema.safeParse({ body: formData.get("body"), mode: "client" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const uploads = await prepareUploads(formData.getAll("files"));
  if (!uploads.ok) return { error: uploads.error };

  return runAction(async () => {
    await addMessage(user, ticketNumber, parsed.data, uploads.files);
    revalidatePath(`/tickets/${ticketNumber}`);
  });
}

export async function closeTicketAction(ticketNumber: string) {
  const user = await requireUser();
  await closeAsRequester(user, ticketNumber);
  revalidatePath(`/tickets/${ticketNumber}`);
  revalidatePath("/");
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/account");
  return { ok: true, nonce: Date.now() };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.passwordHash || !(await bcrypt.compare(parsed.data.currentPassword, row.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
  return { ok: true, nonce: Date.now() };
}

export async function addCcAction(ticketNumber: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = collaboratorSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  return runAction(async () => {
    await addCollaborator(user, ticketNumber, parsed.data);
    revalidatePath(`/tickets/${ticketNumber}`);
  });
}

export async function removeCcAction(ticketNumber: string, userId: string) {
  const user = await requireUser();
  await removeCollaborator(user, ticketNumber, userId);
  revalidatePath(`/tickets/${ticketNumber}`);
  revalidatePath("/");
  // Someone who removed themselves can no longer see the ticket.
  if (userId === user.id) redirect("/");
}

export async function emailAlertsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailAlertsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: { emailAlerts: parsed.data.emailAlerts } });
  revalidatePath("/account");
  return { ok: true, nonce: Date.now() };
}
