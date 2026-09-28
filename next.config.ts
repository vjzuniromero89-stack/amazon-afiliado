import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Pin artwork fonts are read from disk at render time.
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/server/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
