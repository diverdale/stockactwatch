import type { NextConfig } from "next";

// Vercel handles Next.js natively — standalone output is only needed for Docker (GCP/Fly.io).
// Set NEXT_OUTPUT=standalone in your Docker build environment to enable it.
const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bioguide.congress.gov",
        pathname: "/bioguide/photo/**",
      },
    ],
  },
};

export default nextConfig;
