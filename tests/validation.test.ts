import { describe, expect, it } from "vitest";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/time";
import { formToObject, helpTopicSchema, taskSchema, ticketUpdateSchema } from "@/server/validation";

describe("school-timezone date inputs", () => {
  it("reads datetime-local values as Phnom Penh time (UTC+7)", () => {
    expect(parseLocalDateTime("2026-10-22T10:00", "Asia/Phnom_Penh")?.toISOString()).toBe("2026-10-22T03:00:00.000Z");
    expect(toLocalInputValue(new Date("2026-10-22T03:00:00Z"), "Asia/Phnom_Penh")).toBe("2026-10-22T10:00");
    expect(parseLocalDateTime("not a date")).toBeNull();
  });

  it("handles DST zones too", () => {
    expect(parseLocalDateTime("2026-07-01T09:30", "America/New_York")?.toISOString()).toBe("2026-07-01T13:30:00.000Z");
    expect(parseLocalDateTime("2026-01-01T09:30", "America/New_York")?.toISOString()).toBe("2026-01-01T14:30:00.000Z");
  });

  it("is applied by the task form", () => {
    const parsed = taskSchema.parse({ title: "x", assignedAgentId: "", assignedTeamId: "", dueAt: "2026-10-22T10:00" });
    expect(parsed.dueAt?.toISOString()).toBe("2026-10-22T03:00:00.000Z");
    expect(taskSchema.parse({ title: "x", dueAt: "" }).dueAt).toBeNull();
  });
});

describe("form validation", () => {
  it("treats a missing id (create forms) and empty selects as null", () => {
    const fd = new FormData();
    fd.set("name", "Smartboards");
    fd.set("description", "");
    fd.set("defaultPriority", "HIGH");
    fd.set("defaultDepartmentId", "");
    fd.set("defaultTeamId", "");
    fd.set("slaPolicyId", "");
    fd.set("isActive", "on");
    const parsed = helpTopicSchema.safeParse(formToObject(fd));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ id: null, description: null, defaultTeamId: null, isActive: true });
  });

  it("rejects ids that aren't UUIDs", () => {
    const parsed = ticketUpdateSchema.safeParse({ status: "OPEN", priority: "LOW", assignedTeamId: "abc", assignedAgentId: "" });
    expect(parsed.success).toBe(false);
  });

  it("reads an unchecked checkbox as false", () => {
    const fd = new FormData();
    fd.set("name", "X");
    fd.set("description", "");
    fd.set("defaultPriority", "LOW");
    expect(helpTopicSchema.parse(formToObject(fd)).isActive).toBe(false);
  });
});
