import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mcps/openapi-engine", "@mcps/agent-os"],
};

export default nextConfig;
