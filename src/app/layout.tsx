import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Kantumruy_Pro, Plus_Jakarta_Sans } from "next/font/google";
import { readTheme } from "@/server/theme";
import "./globals.css";

// CIA FIRST brand type: Plus Jakarta Sans for Latin, Kantumruy Pro for Khmer; the mono sets ticket numbers and counts.
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });
// Not preloaded: the browser fetches it only when a page contains Khmer text.
const khmer = Kantumruy_Pro({ subsets: ["khmer"], variable: "--font-khmer", preload: false });

export const metadata: Metadata = {
  title: { default: "CIA FIRST IT Help Desk", template: "%s · CIA FIRST IT Help Desk" },
  description: "School technology support from the CIA FIRST IT team.",
  applicationName: "CIA FIRST IT Help Desk",
  appleWebApp: { capable: true, title: "CIA FIRST IT", statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await readTheme();
  const light = "#f0f6fc";
  const dark = "#0e0e0e";
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: light },
            { media: "(prefers-color-scheme: dark)", color: dark },
          ]
        : theme === "light"
          ? light
          : dark,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await readTheme();
  return (
    <html lang="en" data-theme={theme} className={`${body.variable} ${code.variable} ${khmer.variable}`}>
      <body className="min-h-dvh font-sans text-base leading-relaxed antialiased">{children}</body>
    </html>
  );
}
