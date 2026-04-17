import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const basePath = rawBasePath ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}` : undefined;
const backendInternalUrl = process.env.BACKEND_INTERNAL_URL?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    if (!backendInternalUrl) {
      return [];
    }

    return [
      {
        source: "/api/auth/sync-session",
        destination: `${backendInternalUrl}/api/auth/sync-session`,
      },
      {
        source: "/api/:path((?!auth).*)",
        destination: `${backendInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
