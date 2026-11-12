import { cookies } from "next/headers";
import { type Theme, THEME_COOKIE, toTheme } from "@/lib/theme";
import { getCurrentUser } from "@/server/authz";

// The signed-in person's saved choice wins, so it follows them across devices and shared PCs;
// otherwise this browser's last choice, else follow the device.
export async function readTheme(): Promise<Theme> {
  const user = await getCurrentUser();
  if (user?.colorMode) return user.colorMode;
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}
