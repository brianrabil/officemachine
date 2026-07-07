import type { NextConfig } from "next";

const DAEMON_ORIGIN = process.env.DAEMON_URL || "http://localhost:4848";
const WS_RELAY_ORIGIN = process.env.WS_RELAY_URL || "http://localhost:3011";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  devIndicators: false,
  env: {
    NEXT_PUBLIC_DAEMON_URL: DAEMON_ORIGIN,
    NEXT_PUBLIC_WS_RELAY_URL: WS_RELAY_ORIGIN,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${DAEMON_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default config;
