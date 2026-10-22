import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIA IT Helpdesk",
    short_name: "IT Helpdesk",
    description: "Get help from the CIA IT team.",
    start_url: "/go",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#1a5b86",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
