import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudflare Workers does not support the Node.js APIs that Next.js image
    // optimization relies on. `unoptimized: true` disables the optimizer so
    // images pass through as-is, which is fine for a map app that serves no
    // dynamic <Image> components today.
    unoptimized: true,
  },
};

export default nextConfig;
