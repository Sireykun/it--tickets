import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Hyperlegible for readers on small screens and in a second language; the mono sibling sets ticket numbers and counts.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body" });
const code = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  title: { default: "CIA FIRST IT Help Desk", template: "%s · CIA FIRST IT Help Desk" },
  description: "School technology support from the CIA FIRST IT team.",
  applicationName: "CIA FIRST IT Help Desk",
  appleWebApp: { capable: true, title: "CIA FIRST IT", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable}`}>
      <body className="min-h-dvh font-sans text-base leading-relaxed antialiased">{children}</body>
    </html>
  );
}
