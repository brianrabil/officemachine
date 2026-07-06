import type { NextConfig } from "next";
import { env } from "@workspace/config/env";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["web.localhost"],
  transpilePackages: ["@wterm/dom", "@wterm/react"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${env.APP_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
