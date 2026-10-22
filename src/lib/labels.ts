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
