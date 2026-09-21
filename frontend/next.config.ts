import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "live.themewild.com" },
      {
        protocol: "https",
        hostname: "oncohealthmart-data-001.s3.ap-south-1.amazonaws.com",
      },
    ],
    // Smaller, modern formats — fewer bytes over the wire, less jank while images load in.
    formats: ["image/avif", "image/webp"],
  },

  // Old URLs already crawled/indexed under the previous structure — 301 them
  // to the new paths so nothing 404s and rankings carry over instead of resetting.
  async redirects() {
    return [
      { source: "/category/:slug", destination: "/products/:slug", permanent: true },
      { source: "/category/:slug/about", destination: "/products/:slug/about", permanent: true },
      // No product id in the old URL — "0" is a placeholder segment; the page fetches
      // by slug regardless, and its own canonical tag then points crawlers to the
      // fully correct /product-details/:id/:slug so it gets indexed properly.
      { source: "/medicines/:slug", destination: "/product-details/0/:slug", permanent: true },
      { source: "/pages/:slug", destination: "/:slug", permanent: true },
    ];
  },
};

export default nextConfig;