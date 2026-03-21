const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim();
const shouldProxyApi = Boolean(apiOrigin) && process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Reduce production bundle size - skip inline source maps
  productionBrowserSourceMaps: false,

  // Tree-shake known icon/UI packages at build time to reduce bundle and compile overhead
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async rewrites() {
    if (!shouldProxyApi) return [];

    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
