import { cache } from "react";
import type { z } from "zod";
import { type HolidayMode, pickSeason, type Season } from "@/lib/holidays";
import { todayInAppZone } from "@/lib/time";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import type { AppUser } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import type { holidayWindowSchema } from "@/server/validation";

// Holiday themes are a shared setting, so only superadmins change them. Reading the active
// season needs no user: the login page shows it too.

export const getActiveSeason = cache(async (): Promise<Season | null> => {
  const today = todayInAppZone();
  const day = toDbDate(today);
  const setting = await prisma.holidayThemeSetting.findUnique({ where: { id: 1 } });
  const mode = setting?.mode ?? "auto";
  if (mode !== "auto") return pickSeason(today, mode, []);
  const windows = await prisma.holidayWindow.findMany({
    where: { startsOn: { lte: day }, endsOn: { gte: day } },
    orderBy: { startsOn: "asc" },
  });
  return pickSeason(today, mode, windows.map(toWindowDates));
});

export async function getHolidaySettings(actor: AppUser) {
  assertSuperadmin(actor);
  const setting = await prisma.holidayThemeSetting.findUnique({ where: { id: 1 } });
  const windows = await prisma.holidayWindow.findMany({ orderBy: { startsOn: "desc" } });
  return { mode: (setting?.mode ?? "auto") as HolidayMode, windows: windows.map((w) => ({ id: w.id, ...toWindowDates(w) })) };
}

export async function saveHolidayMode(actor: AppUser, mode: HolidayMode) {
  assertSuperadmin(actor);
  await prisma.$transaction(async (tx) => {
    await tx.holidayThemeSetting.upsert({ where: { id: 1 }, update: { mode }, create: { id: 1, mode } });
    await audit(tx, actor, "holiday_theme.mode", { type: "holiday_theme", id: "1" }, { mode });
  });
}

export async function saveHolidayWindow(actor: AppUser, input: z.infer<typeof holidayWindowSchema>) {
  assertSuperadmin(actor);
  const { id, season, startsOn, endsOn } = input;
  const data = { season, startsOn: toDbDate(startsOn), endsOn: toDbDate(endsOn) };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.holidayWindow.update({ where: { id }, data }) : await tx.holidayWindow.create({ data });
    await audit(tx, actor, "holiday_window.save", { type: "holiday_window", id: row.id }, { season, startsOn, endsOn });
  });
}

export async function deleteHolidayWindow(actor: AppUser, id: string) {
  assertSuperadmin(actor);
  await prisma.$transaction(async (tx) => {
    const row = await tx.holidayWindow.delete({ where: { id } });
    await audit(tx, actor, "holiday_window.delete", { type: "holiday_window", id }, { season: row.season });
  });
}

function assertSuperadmin(actor: Pick<AppUser, "role">) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
}

// @db.Date columns hold a calendar day; Prisma maps them to midnight UTC.
function toDbDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

function toWindowDates(w: { season: string; startsOn: Date; endsOn: Date }) {
  return { season: w.season, startsOn: w.startsOn.toISOString().slice(0, 10), endsOn: w.endsOn.toISOString().slice(0, 10) };
}
