/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  poweredByHeader: false, // Hide X-Powered-By header
  
  // Build configuration - strict mode for production quality
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint checking during builds
  },
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript type checking during builds
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
    ]
  },
  
  // Image optimization security
  images: {
    domains: ['res.cloudinary.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
};module.exports = nextConfig;
