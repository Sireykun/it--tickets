"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action-utils";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { prepareUploads } from "@/server/storage";
import { removeAvatar, saveAvatar, saveTheme } from "@/server/profile";
import { addCollaborator, addMessage, closeAsRequester, createTicket, giveKudo, removeCollaborator, reopenAsRequester } from "@/server/tickets";
import {
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

export async function reopenTicketAction(ticketNumber: string) {
  const user = await requireUser();
  await reopenAsRequester(user, ticketNumber);
  revalidatePath(`/tickets/${ticketNumber}`);
  revalidatePath("/");
}

export async function giveKudoAction(ticketNumber: string) {
  const user = await requireUser();
  await giveKudo(user, ticketNumber);
  revalidatePath(`/tickets/${ticketNumber}`);
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/account");
  return { ok: true, nonce: Date.now() };
}

export async function uploadAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Choose a photo to upload." };
  const result = await runAction(async () => { await saveAvatar(user.id, file); });
  if (result.error) return result;
  revalidatePath("/", "layout");
  redirect("/account?photo=saved");
}

export async function removeAvatarAction() {
  const user = await requireUser();
  await removeAvatar(user.id);
  revalidatePath("/", "layout");
  redirect("/account?photo=removed");
}

export async function updateThemeAction(theme: string) {
  const user = await requireUser();
  await saveTheme(user.id, theme);
  revalidatePath("/", "layout");
  redirect("/account?theme=saved");
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
