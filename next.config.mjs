/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone with a self-contained Node server for Docker.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["bcryptjs"],
  webpack: (config, { dev }) => {
    if (!dev) {
      // Avoid Node 23 / parallel terser JSON-stats truncation bug.
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
