import type { NextConfig } from "next";

// Up to 5 attachments of 10 MB each per message, plus form overhead.
const MAX_BODY = "52mb";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "bcryptjs"],
  // The e2e container reaches the dev server as http://web:3000.
  allowedDevOrigins: ["web"],
  experimental: {
    serverActions: { bodySizeLimit: MAX_BODY },
    proxyClientMaxBodySize: MAX_BODY,
  },
};

export default nextConfig;
