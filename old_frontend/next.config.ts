import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "live.themewild.com" },
      { protocol: "https", hostname: "oncohealthmart-data-001.s3.ap-south-1.amazonaws.com" }
    ],
  },
};

export default nextConfig;
