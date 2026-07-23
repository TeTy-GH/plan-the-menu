import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['192.168.10.104'],
  
} as any; // ここで型チェックを回避する

export default nextConfig;