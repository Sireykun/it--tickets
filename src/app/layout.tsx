import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Hyperlegible for readers on small screens and in a second language; the mono sibling sets ticket numbers and counts.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body" });
const code = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  title: { default: "CIA IT Helpdesk", template: "%s · CIA IT Helpdesk" },
  description: "Get help from the CIA IT team.",
  applicationName: "CIA IT Helpdesk",
  appleWebApp: { capable: true, title: "IT Helpdesk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1016" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable}`}>
      <body className="min-h-dvh font-sans text-[15px] leading-relaxed antialiased">{children}</body>
    </html>
  );
}
