import type { Role, TaskStatus, TicketPriority, TicketSource, TicketStatus } from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  EMERGENCY: "Emergency",
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Requester",
  AGENT: "Agent",
  ADMIN: "Campus admin",
  SUPERADMIN: "Superadmin",
};

export const SOURCE_LABEL: Record<TicketSource, string> = {
  WEB: "Web",
  EMAIL: "Email",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  API: "API",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { OPEN: "Open", CLOSED: "Done" };

export const STATUSES = Object.keys(STATUS_LABEL) as TicketStatus[];
export const SOURCES = Object.keys(SOURCE_LABEL) as TicketSource[];
export const PRIORITIES = Object.keys(PRIORITY_LABEL) as TicketPriority[];
export const ROLES = Object.keys(ROLE_LABEL) as Role[];

export const AUDIT_CATEGORY_LABEL = {
  auth: "Sign-in & sign-out",
  user: "Users & profiles",
  ticket: "Tickets & tasks",
  settings: "Settings",
  export: "Exports",
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORY_LABEL;
export const AUDIT_CATEGORIES = Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[];

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed sign-in",
  "ticket.create": "Created ticket",
  "ticket.update": "Updated ticket",
  "ticket.reply": "Replied to ticket",
  "ticket.note": "Added internal note",
  "ticket.close": "Closed ticket",
  "ticket.reopen": "Reopened ticket",
  "ticket.kudo": "Gave kudos",
  "ticket.cc.add": "Added CC",
  "ticket.cc.remove": "Removed CC",
  "ticket.link": "Linked tickets",
  "ticket.unlink": "Unlinked tickets",
  "ticket.merge": "Merged ticket",
  "ticket.export": "Exported ticket queue",
  "report.export": "Exported report",
  "user.create": "Created user",
  "user.save": "Saved user",
  "user.avatar.update": "Changed profile photo",
  "user.avatar.remove": "Removed profile photo",
  "user.theme.update": "Changed theme",
  "email_template.save": "Saved email template",
  "email_template.reset": "Reset email template",
  "kb.save": "Saved knowledge base article",
  "kb.delete": "Deleted knowledge base article",
  "canned.save": "Saved canned reply",
  "canned.delete": "Deleted canned reply",
};

const VERB_LABEL: Record<string, string> = { save: "Saved", create: "Created", update: "Updated", reset: "Reset", remove: "Removed", add: "Added", delete: "Deleted" };

// Settings saves are named after their entity ("help_topic.save"), so unknown codes still read as English.
export function describeAction(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const parts = action.split(".");
  const verb = VERB_LABEL[parts.at(-1) ?? ""];
  return verb ? `${verb} ${parts.slice(0, -1).join(" ").replaceAll("_", " ")}` : action;
}
