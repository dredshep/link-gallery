import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bun:sqlite", "sharp"],
  images: {
    unoptimized: true,
  },
  // allow also 192.168.1.151
  allowedDevOrigins: [process.env.DEV_ORIGIN ?? 'localhost', '192.168.1.151'],
};

export default nextConfig;
