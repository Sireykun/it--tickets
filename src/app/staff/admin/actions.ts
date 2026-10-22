"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/action-utils";
import {
  resetEmailTemplate,
  saveCampus,
  saveDepartment,
  saveEmailTemplate,
  saveHelpTopic,
  saveOrganization,
  saveSlaPolicy,
  saveTeam,
  saveUser,
} from "@/server/admin";
import { type AppUser, requireSuperadmin, requireUserManager } from "@/server/authz";
import { saveCanned } from "@/server/canned";
import { saveArticle } from "@/server/kb";
import {
  adminUserSchema,
  campusSchema,
  cannedSchema,
  emailTemplateSchema,
  organizationSchema,
  firstError,
  formToObject,
  helpTopicSchema,
  kbArticleSchema,
  namedEntitySchema,
  slaSchema,
  teamSchema,
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

export async function saveOrganizationAction(_prev: ActionState, formData: FormData) {
  return save(formData, organizationSchema, saveOrganization, "/staff/admin/organizations");
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
