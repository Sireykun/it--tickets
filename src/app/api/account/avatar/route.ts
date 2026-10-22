import { getCurrentUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { getStorage } from "@/server/storage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const avatar = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarStorageKey: true, avatarMimeType: true } });
  if (!avatar?.avatarStorageKey || !avatar.avatarMimeType) return new Response(null, { status: 404 });
  const data = await getStorage().read(avatar.avatarStorageKey);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": avatar.avatarMimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
