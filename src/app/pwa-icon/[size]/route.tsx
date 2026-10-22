import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/app-icon";

const SIZES = new Set([192, 512]);

export async function GET(request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable");
  return new ImageResponse(<AppIcon size={size} maskable={maskable} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
