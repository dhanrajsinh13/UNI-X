/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  eslint: {
    // Skip ESLint during production builds to avoid failing on lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip TypeScript type checking during production builds
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
