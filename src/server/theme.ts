import { cookies } from "next/headers";
import { type Theme, THEME_COOKIE, toTheme } from "@/lib/theme";

export async function readTheme(): Promise<Theme> {
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}
