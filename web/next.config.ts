import path from "node:path";
import type { NextConfig } from "next";

/* The site reads listings with the same parser, geography and ranking as the
   phone app, imported straight from ../src/lib — so the repository root, not
   this folder, is the root Turbopack resolves from. */
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Development only: kept clear of the phone tab bar at the bottom.
  devIndicators: { position: "top-right" },
  cacheLife: {
    /* A search page is read again at most every ten minutes: often enough to
       follow a market that moves daily, rarely enough not to lean on the
       sites the listings come from. */
    market: { stale: 300, revalidate: 600, expire: 3600 },
    /* What a place costs moves over weeks, not minutes: one sample of a
       neighbourhood serves every search for six hours. */
    place: { stale: 300, revalidate: 21_600, expire: 86_400 },
  },
};

export default nextConfig;
