import { getCurrentUser } from "@/server/authz";
import { getStorage, INLINE_IMAGE_TYPES } from "@/server/storage";
import { getAttachmentForViewer } from "@/server/tickets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  // Same 404 for "doesn't exist" and "not yours", so ids can't be probed.
  const attachment = UUID.test(id) ? await getAttachmentForViewer(user, id) : null;
  if (!attachment) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await getStorage().read(attachment.storageKey);
  } catch (err) {
    console.error(`Attachment ${attachment.id} missing from storage (${attachment.storageKey})`, err);
    return new Response("File is no longer available", { status: 410 });
  }

  const inline = INLINE_IMAGE_TYPES.has(attachment.mimeType);
  const encodedName = encodeURIComponent(attachment.fileName);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
