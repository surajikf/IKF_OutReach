import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const basePath = rawBasePath ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}` : undefined;

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
