import type { NextConfig } from "next";
import { config } from "@workspace/agent/config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["web.localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${config.HARNESS_API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
