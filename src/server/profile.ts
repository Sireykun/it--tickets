import { randomUUID } from "node:crypto";
import { THEMES as COLOR_MODES, type Theme as ColorMode } from "@/lib/theme";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { getStorage } from "@/server/storage";
import { TicketError } from "@/server/tickets";

export const THEMES = ["ocean", "violet", "rose"] as const;
export type Theme = (typeof THEMES)[number];

function imageType(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function saveAvatar(userId: string, file: File) {
  if (file.size === 0 || file.size > 2 * 1024 * 1024) throw new TicketError("Choose a PNG, JPEG, or WebP image under 2 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const mimeType = imageType(data);
  if (!mimeType) throw new TicketError("Choose a PNG, JPEG, or WebP image.");
  const key = `profiles/${userId}/${randomUUID()}`;
  const store = getStorage();
  await store.put(key, data);
  let previous: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarStorageKey: true } });
      previous = user.avatarStorageKey;
      await tx.user.update({ where: { id: userId }, data: { avatarStorageKey: key, avatarMimeType: mimeType } });
      await audit(tx, { id: userId }, "user.avatar.update", { type: "user", id: userId });
    });
  } catch (error) {
    await store.remove(key);
    throw error;
  }
  if (previous) await store.remove(previous).catch(() => {});
}

export async function removeAvatar(userId: string) {
  let previous: string | null = null;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarStorageKey: true } });
    previous = user.avatarStorageKey;
    if (!previous) return;
    await tx.user.update({ where: { id: userId }, data: { avatarStorageKey: null, avatarMimeType: null } });
    await audit(tx, { id: userId }, "user.avatar.remove", { type: "user", id: userId });
  });
  if (previous) await getStorage().remove(previous).catch(() => {});
}

export async function saveTheme(userId: string, theme: string) {
  if (!THEMES.includes(theme as Theme)) throw new TicketError("Choose a valid theme.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { themePreference: theme } });
    await audit(tx, { id: userId }, "user.theme.update", { type: "user", id: userId }, { theme });
  });
}

// Light / Dark / System, saved on the account so it follows the person to every device.
export async function saveColorMode(userId: string, mode: string) {
  if (!COLOR_MODES.includes(mode as ColorMode)) throw new TicketError("Choose Light, Dark, or System.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { colorMode: mode } });
    await audit(tx, { id: userId }, "user.color_mode.update", { type: "user", id: userId }, { mode });
  });
}
