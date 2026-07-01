import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  typescript: {
    ignoreBuildErrors: true,
  },
} as any; // ここで型チェックを回避する

export default nextConfig;