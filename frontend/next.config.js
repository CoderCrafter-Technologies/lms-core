/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
const apiOrigin = apiUrl.replace(/\/api\/?$/, '')
const internalApiOrigin = process.env.NEXT_INTERNAL_API_ORIGIN || apiOrigin
const internalApiUrl = `${internalApiOrigin.replace(/\/$/, '')}/api`

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001',
  },
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
    unoptimized: true
  },
  webpack: (config, { isServer }) => {
    // Fix for Konva/Canvas SSR issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        encoding: false,
      }
    } else {
      config.externals = config.externals || [];
      config.externals.push('canvas');
    }
    return config;
  },
  transpilePackages: ['react-konva', 'konva'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${internalApiOrigin.replace(/\/$/, '')}/uploads/:path*`
      }
    ]
  }
}

module.exports = nextConfig
