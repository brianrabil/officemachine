import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["terminal.localhost", "127.0.0.1"],
  transpilePackages: [
    "@wterm/core",
    "@wterm/dom",
    "@wterm/ghostty",
    "@wterm/just-bash",
    "@wterm/react",
  ],
  serverExternalPackages: ["node-pty"],
};

export default nextConfig;
