import { describe, expect, it } from "vitest";
import { isAllowedGoogleProfile, safeRedirectPath } from "@/server/auth-rules";
import { hitRateLimit } from "@/server/rate-limit";
import { campusAccess, canViewTicket } from "@/server/roles";
import { computeDueDates, formatDuration, slaState } from "@/server/sla";

const H = 3_600_000;

describe("SLA", () => {
  it("computes due dates from the policy hours", () => {
    const from = new Date("2026-10-21T08:00:00Z");
    const due = computeDueDates({ responseTimeHours: 2, resolutionTimeHours: 24 }, from);
    expect(due.firstResponseDueAt?.toISOString()).toBe("2026-10-21T10:00:00.000Z");
    expect(due.resolutionDueAt?.toISOString()).toBe("2026-10-22T08:00:00.000Z");
    expect(computeDueDates(null, from)).toEqual({ firstResponseDueAt: null, resolutionDueAt: null });
  });

  it("tracks the response timer until first reply, then resolution", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const base = {
      status: "OPEN" as const,
      firstResponseDueAt: new Date(now.getTime() - H),
      resolutionDueAt: new Date(now.getTime() + 10 * H),
      firstRespondedAt: null,
    };
    expect(slaState(base, now)).toMatchObject({ kind: "response", overdue: true });
    expect(slaState({ ...base, firstRespondedAt: now }, now)).toMatchObject({ kind: "resolution", overdue: false });
    expect(slaState({ ...base, status: "RESOLVED" }, now)).toEqual({ kind: "met" });
    expect(
      slaState({ ...base, firstResponseDueAt: null, resolutionDueAt: null }, now),
    ).toEqual({ kind: "none" });
  });

  it("formats durations compactly", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(3 * H)).toBe("3h");
    expect(formatDuration(52 * H)).toBe("2d 4h");
    expect(formatDuration(-2 * H)).toBe("2h");
  });
});

describe("Google sign-in rules", () => {
  const domain = "ciaschool.edu.kh";
  it("accepts verified school accounts only", () => {
    expect(isAllowedGoogleProfile({ email: "Kid@CIASchool.edu.kh", email_verified: true, hd: "ciaschool.edu.kh" }, domain)).toBe(true);
    expect(isAllowedGoogleProfile({ email: "kid@ciaschool.edu.kh", email_verified: false, hd: domain }, domain)).toBe(false);
    expect(isAllowedGoogleProfile({ email: "kid@gmail.com", email_verified: true, hd: undefined }, domain)).toBe(false);
    expect(isAllowedGoogleProfile({ email: "kid@gmail.com", email_verified: true, hd: domain }, domain)).toBe(false);
    expect(isAllowedGoogleProfile({ email: "kid@evil-ciaschool.edu.kh", email_verified: true, hd: domain }, domain)).toBe(false);
    expect(isAllowedGoogleProfile({ email: "kid@ciaschool.edu.kh", email_verified: true, hd: null }, domain)).toBe(false);
    expect(isAllowedGoogleProfile(undefined, domain)).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("only allows same-site paths", () => {
    expect(safeRedirectPath("/tickets/TKT-000001")).toBe("/tickets/TKT-000001");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath(undefined, "/staff")).toBe("/staff");
  });
});

describe("rate limit", () => {
  it("blocks after the limit within a window and resets after it", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(hitRateLimit(key, 3, 1000, 0)).toBe(false);
    expect(hitRateLimit(key, 3, 1000, 10)).toBe(true);
    expect(hitRateLimit(key, 3, 1000, 1001)).toBe(false);
  });
});

describe("canViewTicket", () => {
  it("lets requesters see their own, staff their campuses, superadmins everything", () => {
    const ticket = { requesterId: "a", campusId: "c1" };
    expect(canViewTicket({ id: "a", role: "USER", campusScope: [] }, ticket)).toBe(true);
    expect(canViewTicket({ id: "b", role: "USER", campusScope: [] }, ticket)).toBe(false);
    expect(canViewTicket({ id: "b", role: "AGENT", campusScope: ["c1"] }, ticket)).toBe(true);
    expect(canViewTicket({ id: "b", role: "AGENT", campusScope: ["c2"] }, ticket)).toBe(false);
    expect(canViewTicket({ id: "b", role: "ADMIN", campusScope: ["c2", "c1"] }, ticket)).toBe(true);
    expect(canViewTicket({ id: "b", role: "SUPERADMIN", campusScope: "all" }, ticket)).toBe(true);
    // A ticket with no campus (pre-campus data) is only visible to superadmins and participants.
    expect(canViewTicket({ id: "b", role: "AGENT", campusScope: ["c1"] }, { requesterId: "a", campusId: null })).toBe(false);
    expect(canViewTicket({ id: "b", role: "AGENT", campusScope: ["c2"] }, { ...ticket, collaborators: [{ userId: "b" }] })).toBe(true);
  });
});

describe("campusAccess", () => {
  it("derives scope and user-management rights from role and memberships", () => {
    const rows = [
      { campusId: "c1", permissions: ["users.manage"] },
      { campusId: "c2", permissions: [] },
    ];
    expect(campusAccess("SUPERADMIN", rows)).toEqual({ campusScope: "all", manageCampusIds: "all" });
    expect(campusAccess("ADMIN", rows)).toEqual({ campusScope: ["c1", "c2"], manageCampusIds: ["c1"] });
    // Only campus admins can hold the permission, even if a row says otherwise.
    expect(campusAccess("AGENT", rows)).toEqual({ campusScope: ["c1", "c2"], manageCampusIds: [] });
    expect(campusAccess("USER", rows)).toEqual({ campusScope: [], manageCampusIds: [] });
  });
});
