import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove static export to enable API routes for Vercel
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
