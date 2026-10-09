import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  trailingSlash: true,
  transpilePackages: ["three"],
};

export default nextConfig;
