import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so render a full square.
export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} maskable />, size);
}
