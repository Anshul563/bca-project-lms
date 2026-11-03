import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lms/shared"],
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
