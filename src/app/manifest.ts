import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIA FIRST IT Help Desk",
    short_name: "CIA FIRST IT",
    description: "School technology support from the CIA FIRST IT team.",
    start_url: "/go",
    display: "standalone",
    background_color: "#0e0e0e",
    theme_color: "#171818",
    icons: [{ src: "/cia-first-logo.png", sizes: "512x512", type: "image/png" }],
  };
}
