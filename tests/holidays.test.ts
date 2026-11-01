import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteHolidayWindow, getActiveSeason, getHolidaySettings, saveHolidayMode, saveHolidayWindow } from "@/server/holidays";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import { allCampusIds, makeUser } from "./fixtures";

const tag = `h${Date.now()}`;
let superadmin: AppUser, campusAdmin: AppUser, agent: AppUser;

beforeAll(async () => {
  const [c1] = await allCampusIds();
  superadmin = await makeUser(tag, "Holiday Super", "SUPERADMIN");
  campusAdmin = await makeUser(tag, "Holiday Admin", "ADMIN", { campusIds: [c1], manage: [c1] });
  agent = await makeUser(tag, "Holiday Agent", "AGENT", { campusIds: [c1] });
});

afterAll(async () => {
  await prisma.holidayThemeSetting.upsert({ where: { id: 1 }, update: { mode: "auto" }, create: { id: 1 } });
});

describe("holiday themes", () => {
  it("lets only superadmins change them", async () => {
    for (const actor of [campusAdmin, agent]) {
      await expect(saveHolidayMode(actor, "off")).rejects.toThrow(TicketError);
      await expect(
        saveHolidayWindow(actor, { id: null, season: "pchum-ben", startsOn: "2030-10-01", endsOn: "2030-10-03" }),
      ).rejects.toThrow(TicketError);
      await expect(getHolidaySettings(actor)).rejects.toThrow(TicketError);
    }
  });

  it("forces or turns off the theme, with an audit record", async () => {
    await saveHolidayMode(superadmin, "bon-om-touk");
    expect(await getActiveSeason()).toBe("bon-om-touk");
    await saveHolidayMode(superadmin, "off");
    expect(await getActiveSeason()).toBeNull();
    const events = await prisma.auditEvent.findMany({ where: { actorId: superadmin.id, action: "holiday_theme.mode" } });
    expect(events.map((e) => (e.data as { mode: string }).mode)).toEqual(["bon-om-touk", "off"]);
  });

  it("saves, edits and deletes date windows as calendar days", async () => {
    await saveHolidayWindow(superadmin, { id: null, season: "pchum-ben", startsOn: "2030-10-01", endsOn: "2030-10-03" });
    let row = (await getHolidaySettings(superadmin)).windows.find((w) => w.startsOn === "2030-10-01");
    expect(row).toMatchObject({ season: "pchum-ben", endsOn: "2030-10-03" });

    await saveHolidayWindow(superadmin, { id: row!.id, season: "pchum-ben", startsOn: "2030-10-01", endsOn: "2030-10-05" });
    row = (await getHolidaySettings(superadmin)).windows.find((w) => w.id === row!.id);
    expect(row?.endsOn).toBe("2030-10-05");

    await deleteHolidayWindow(superadmin, row!.id);
    expect(await prisma.holidayWindow.findUnique({ where: { id: row!.id } })).toBeNull();
    const actions = await prisma.auditEvent.findMany({ where: { entityId: row!.id }, orderBy: { createdAt: "asc" }, select: { action: true } });
    expect(actions.map((a) => a.action)).toEqual(["holiday_window.save", "holiday_window.save", "holiday_window.delete"]);
  });

  it("rejects bad values in the database too", async () => {
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    await expect(prisma.holidayWindow.create({ data: { season: "halloween", startsOn: day("2030-01-01"), endsOn: day("2030-01-02") } })).rejects.toThrow();
    await expect(prisma.holidayWindow.create({ data: { season: "pchum-ben", startsOn: day("2030-01-05"), endsOn: day("2030-01-02") } })).rejects.toThrow();
    await expect(prisma.holidayThemeSetting.create({ data: { id: 2 } })).rejects.toThrow();
    await expect(prisma.holidayThemeSetting.update({ where: { id: 1 }, data: { mode: "party" } })).rejects.toThrow();
  });
});
