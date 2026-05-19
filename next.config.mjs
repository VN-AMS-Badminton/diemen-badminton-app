/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone with a self-contained Node server for Docker.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["bcryptjs"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      // Avoid Node 23 / parallel terser JSON-stats truncation bug.
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
