import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/data-builder',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
