import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bun:sqlite", "sharp"],
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [process.env.DEV_ORIGIN ?? 'localhost'],
};

export default nextConfig;
