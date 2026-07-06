import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["terminal.localhost"],
  transpilePackages: ["@wterm/core", "@wterm/dom", "@wterm/just-bash", "@wterm/react"],
};

export default nextConfig;
