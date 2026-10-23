"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action-utils";
import { safeRedirectPath } from "@/server/auth-rules";
import {
  addToCampus,
  bulkUpdateUsers,
  deleteSetting,
  deleteUser,
  removeFromCampus,
  resetEmailTemplate,
  saveCampus,
  saveDepartment,
  saveEmailTemplate,
  saveHelpTopic,
  saveSlaPolicy,
  saveTeam,
  saveUser,
  type UserBulkChange,
} from "@/server/admin";
import { type AppUser, requireSuperadmin, requireUserManager } from "@/server/authz";
import { deleteCanned, saveCanned } from "@/server/canned";
import { deleteArticle, saveArticle } from "@/server/kb";
import {
  adminUserSchema,
  campusMemberSchema,
  campusSchema,
  cannedSchema,
  emailTemplateSchema,
  firstError,
  formToObject,
  helpTopicSchema,
  idSchema,
  kbArticleSchema,
  namedEntitySchema,
  slaSchema,
  teamSchema,
  userBulkSchema,
} from "@/server/validation";

async function save<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  persist: (actor: AppUser, data: z.infer<S>) => Promise<unknown>,
  listPath: string,
  arrayKeys: string[] = [],
  // Shared settings are superadmin-only; the Users page also admits campus admins with "users.manage".
  guard: () => Promise<AppUser> = requireSuperadmin,
): Promise<ActionState> {
  const actor = await guard();
  const parsed = schema.safeParse(formToObject(formData, arrayKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const result = await runAction(async () => {
    await persist(actor, parsed.data);
  });
  if (result.error) return result;
  revalidatePath("/staff", "layout");
  redirect(`${listPath}?saved=1`);
}

async function remove(
  formData: FormData,
  persist: (actor: AppUser, id: string) => Promise<unknown>,
  listPath: string,
  guard: () => Promise<AppUser> = requireSuperadmin,
): Promise<ActionState> {
  const actor = await guard();
  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Not found." };
  const result = await runAction(async () => {
    await persist(actor, parsed.data.id);
  });
  if (result.error) return result;
  revalidatePath("/staff", "layout");
  redirect(`${listPath}?deleted=1`);
}

export async function deleteUserAction(_prev: ActionState, formData: FormData) {
  return remove(formData, deleteUser, "/staff/admin/users", requireUserManager);
}

export async function deleteCampusAction(_prev: ActionState, formData: FormData) {
  return remove(formData, (actor, id) => deleteSetting(actor, "campus", id), "/staff/admin/campuses");
}

export async function deleteDepartmentAction(_prev: ActionState, formData: FormData) {
  return remove(formData, (actor, id) => deleteSetting(actor, "department", id), "/staff/admin/departments");
}

export async function deleteTeamAction(_prev: ActionState, formData: FormData) {
  return remove(formData, (actor, id) => deleteSetting(actor, "team", id), "/staff/admin/teams");
}

export async function deleteSlaAction(_prev: ActionState, formData: FormData) {
  return remove(formData, (actor, id) => deleteSetting(actor, "sla_policy", id), "/staff/admin/sla");
}

export async function deleteHelpTopicAction(_prev: ActionState, formData: FormData) {
  return remove(formData, (actor, id) => deleteSetting(actor, "help_topic", id), "/staff/admin/help-topics");
}

export async function deleteCannedAction(_prev: ActionState, formData: FormData) {
  return remove(formData, deleteCanned, "/staff/admin/canned");
}

export async function deleteArticleAction(_prev: ActionState, formData: FormData) {
  return remove(formData, deleteArticle, "/staff/admin/knowledge-base");
}

export async function saveUserAction(_prev: ActionState, formData: FormData) {
  return save(formData, adminUserSchema, saveUser, "/staff/admin/users", ["teamIds", "staffCampusIds", "manageCampusIds"], requireUserManager);
}

export async function saveTeamAction(_prev: ActionState, formData: FormData) {
  return save(formData, teamSchema, saveTeam, "/staff/admin/teams");
}

export async function saveDepartmentAction(_prev: ActionState, formData: FormData) {
  return save(formData, namedEntitySchema, saveDepartment, "/staff/admin/departments");
}

export async function saveSlaAction(_prev: ActionState, formData: FormData) {
  return save(formData, slaSchema, saveSlaPolicy, "/staff/admin/sla");
}

export async function saveCannedAction(_prev: ActionState, formData: FormData) {
  return save(formData, cannedSchema, saveCanned, "/staff/admin/canned");
}

export async function saveHelpTopicAction(_prev: ActionState, formData: FormData) {
  return save(formData, helpTopicSchema, saveHelpTopic, "/staff/admin/help-topics");
}

export async function saveEmailTemplateAction(_prev: ActionState, formData: FormData) {
  return save(formData, emailTemplateSchema, saveEmailTemplate, "/staff/admin/email");
}

export async function resetEmailTemplateAction(key: string) {
  const actor = await requireSuperadmin();
  await resetEmailTemplate(actor, key);
  revalidatePath("/staff/admin/email");
  redirect("/staff/admin/email?saved=1");
}

export async function saveCampusAction(_prev: ActionState, formData: FormData) {
  return save(formData, campusSchema, saveCampus, "/staff/admin/campuses");
}

export async function saveArticleAction(_prev: ActionState, formData: FormData) {
  return save(formData, kbArticleSchema, saveArticle, "/staff/admin/knowledge-base");
}

// ─── User management (superadmin) ───────────────────────────────────────────

export async function bulkUpdateUsersAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const returnTo = safeRedirectPath(formData.get("returnTo"), "/staff/admin/users");
  const back = new URL(returnTo.startsWith("/staff/admin/users") ? returnTo : "/staff/admin/users", "http://local");
  for (const key of ["bulk", "skipped", "bulkError", "saved"]) back.searchParams.delete(key);

  const parsed = userBulkSchema.safeParse({ ...formToObject(formData), users: formData.getAll("users") });
  if (!parsed.success) {
    back.searchParams.set("bulkError", firstError(parsed.error));
  } else {
    const { users, ...rest } = parsed.data;
    const change: UserBulkChange =
      rest.field === "homeCampus"
        ? { homeCampusId: rest.value }
        : rest.field === "addCampus"
          ? { addCampusId: rest.value }
          : rest.field === "removeCampus"
            ? { removeCampusId: rest.value }
            : { isActive: rest.value === "true" };
    const result = await runAction(async () => {
      const { updated, skipped } = await bulkUpdateUsers(actor, users, change);
      back.searchParams.set("bulk", String(updated));
      if (skipped.length) back.searchParams.set("skipped", skipped.map((s) => `${s.name}: ${s.reason}`).join("\n"));
    });
    if (result.error) back.searchParams.set("bulkError", result.error);
    revalidatePath("/staff", "layout");
  }
  redirect(`${back.pathname}${back.search}`);
}

export async function addToCampusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireSuperadmin();
  const parsed = campusMemberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { campusId, userId, canManageUsers } = parsed.data;
  const result = await runAction(async () => {
    await addToCampus(actor, campusId, userId, { canManageUsers });
  });
  if (result.error) return result;
  revalidatePath("/staff", "layout");
  redirect(`/staff/admin/campuses?edit=${campusId}&saved=1`);
}

export async function removeFromCampusAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const parsed = campusMemberSchema.omit({ canManageUsers: true }).safeParse(formToObject(formData));
  if (!parsed.success) redirect("/staff/admin/campuses");
  const { campusId, userId } = parsed.data;
  const result = await runAction(async () => {
    await removeFromCampus(actor, campusId, userId);
  });
  revalidatePath("/staff", "layout");
  const error = result.error ? `&memberError=${encodeURIComponent(result.error)}` : "";
  redirect(`/staff/admin/campuses?edit=${campusId}${error}`);
}
