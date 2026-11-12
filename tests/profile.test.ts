import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_THEME, toTheme } from "@/lib/theme";
import { prisma } from "@/server/prisma";
import { saveColorMode } from "@/server/profile";
import type { AppUser } from "@/server/roles";
import { TicketError } from "@/server/tickets";
import { loadAppUser } from "@/server/users";
import { makeUser } from "./fixtures";

const tag = `p${Date.now()}`;
let teacher: AppUser;

beforeAll(async () => {
  teacher = await makeUser(tag, "ModeTeacher", "USER");
});

afterAll(() => prisma.$disconnect());

describe("light/dark mode", () => {
  it("follows the device until someone chooses", () => {
    expect(DEFAULT_THEME).toBe("system");
    expect(toTheme(undefined)).toBe("system");
    expect(toTheme("purple")).toBe("system");
    expect(toTheme("light")).toBe("light");
    expect(teacher.colorMode).toBeNull();
  });

  it("saves the choice on the account, audited", async () => {
    await saveColorMode(teacher.id, "light");
    expect((await loadAppUser(teacher.id))!.colorMode).toBe("light");

    await saveColorMode(teacher.id, "system");
    expect((await loadAppUser(teacher.id))!.colorMode).toBe("system");

    expect(await prisma.auditEvent.count({ where: { entityId: teacher.id, action: "user.color_mode.update", actorId: teacher.id } })).toBe(2);
  });

  it("rejects anything but light, dark or system", async () => {
    await expect(saveColorMode(teacher.id, "purple")).rejects.toThrow(TicketError);
    expect((await loadAppUser(teacher.id))!.colorMode).toBe("system");
  });
});
