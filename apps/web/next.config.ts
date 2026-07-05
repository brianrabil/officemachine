import type { NextConfig } from "next";
import { config } from "@workspace/config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["web.localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${config.APP_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
