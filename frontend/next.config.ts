import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const basePath = rawBasePath ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}` : undefined;
const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL?.trim().replace(/\/+$/, "") || "http://localhost:3001";

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth).*)",
        destination: `${backendInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
