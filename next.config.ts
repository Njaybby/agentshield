import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Overridable so a verification build/dev server doesn't clobber a running `next start` on .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
