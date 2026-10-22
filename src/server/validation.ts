import { z } from "zod";
import { parseLocalDateTime } from "@/lib/time";

// Missing field, "" (an empty <select> option) and null all mean "none".
const optionalId = z.preprocess(
  (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v),
  z.uuid().nullable(),
);

const status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const priority = z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]);
const role = z.enum(["USER", "AGENT", "ADMIN", "SUPERADMIN"]);
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const newTicketSchema = z.object({
  helpTopicId: z.uuid({ message: "Please choose a help topic." }),
  priority: priority.optional(),
  campusId: z.uuid({ message: "Please choose a campus." }),
  room: z.string().trim().min(1, "Please enter a room.").max(100),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(200),
  body: z.string().trim().min(1, "Please describe the problem.").max(20_000),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty.").max(20_000),
  mode: z.enum(["client", "reply", "note"]),
});

export const ticketUpdateSchema = z.object({
  status,
  priority,
  assignedTeamId: optionalId,
  assignedAgentId: optionalId,
  departmentId: z.uuid().optional(),
  // "" (no campus picked) and missing both mean "keep".
  campusId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
});

const ticketNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^TKT-\d{6}$/, "Enter a ticket number like TKT-000042.");

export const ticketPairSchema = z.object({ other: ticketNumber });

// Staff opening a ticket for someone else.
export const staffNewTicketSchema = newTicketSchema.omit({ campusId: true, room: true }).extend({
  requesterEmail: z.email("Enter the requester's email.").max(254),
  requesterName: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  source: z.enum(["PHONE", "WALK_IN", "EMAIL", "WEB"]),
  // "" = the requester's home campus (or the agent's own if they don't work there).
  campusId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  room: z.string().trim().max(100).optional(),
});

// Accepts datetime-local strings (read in the school's timezone), Dates, or empty.
const optionalDate = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "string") return parseLocalDateTime(v) ?? v;
    return v;
  },
  z.coerce.date({ message: "Enter a valid date." }).nullable(),
);

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => v || null),
  assignedAgentId: optionalId,
  assignedTeamId: optionalId,
  dueAt: optionalDate,
});

export const taskUpdateSchema = taskSchema.extend({ status: z.enum(["OPEN", "CLOSED"]) });

export const taskCommentSchema = z.object({ body: z.string().trim().min(1, "Comment can't be empty.").max(5000) });

export const collaboratorSchema = z.object({
  email: z.email("Enter a valid email.").max(254),
  name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || null),
});

const domainList = z
  .string()
  .transform((v) =>
    v
      .split(/[\s,]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter domains like students.ciaschool.edu.kh.")).max(20));

export const campusSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Name is required.").max(100),
  emailDomains: domainList,
  isActive: checkbox,
});

export const organizationSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Name is required.").max(100),
  domains: domainList,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
  isActive: checkbox,
});

export const emailTemplateSchema = z.object({
  key: z.string().min(1),
  subject: z.string().trim().min(1, "Subject is required.").max(250),
  body: z.string().trim().min(1, "Body is required.").max(20_000),
  isActive: checkbox,
});

export const emailAlertsSchema = z.object({ emailAlerts: checkbox });

export const cannedSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(1, "Title is required.").max(100),
  body: z.string().trim().min(1, "Reply text is required.").max(10_000),
  departmentId: optionalId,
  isActive: checkbox,
});

const password = z.string().min(10, "Password must be at least 10 characters.").max(200);

export const profileSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const adminUserSchema = z.object({
  id: optionalId,
  email: z.email("Enter a valid email.").max(254),
  name: z.string().trim().min(1, "Name is required.").max(100),
  role,
  departmentId: optionalId,
  // "auto" = match by email domain; "" = none.
  organizationId: z.union([z.literal("auto"), optionalId]).default("auto"),
  campusId: z.union([z.literal("auto"), optionalId]).default("auto"),
  isActive: checkbox,
  password: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(password.nullable()),
  teamIds: z.array(z.uuid()).default([]),
  staffCampusIds: z.array(z.uuid()).default([]),
  manageCampusIds: z.array(z.uuid()).default([]),
});

export const namedEntitySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Name is required.").max(100),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
  isActive: checkbox,
});

export const teamSchema = namedEntitySchema.extend({ departmentId: optionalId });

export const slaSchema = namedEntitySchema.extend({
  responseTimeHours: z.coerce.number().int().min(1, "Must be at least 1 hour.").max(24 * 365),
  resolutionTimeHours: z.coerce.number().int().min(1, "Must be at least 1 hour.").max(24 * 365),
});

export const helpTopicSchema = namedEntitySchema.extend({
  defaultPriority: priority,
  defaultDepartmentId: optionalId,
  defaultTeamId: optionalId,
  slaPolicyId: optionalId,
});

// FormData → plain object; repeated keys (e.g. checkboxes) become arrays only where listed.
export function formToObject(formData: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal action fields
    out[key] = arrayKeys.includes(key) ? formData.getAll(key) : formData.get(key);
  }
  for (const key of arrayKeys) out[key] ??= [];
  return out;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
