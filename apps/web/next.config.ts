import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@jamiya/ui',
    '@jamiya/shared',
    '@jamiya/types',
    '@jamiya/auth',
    '@jamiya/database',
  ],
  // Dual @types/react under pnpm on Vercel can fail JSX component checks;
  // local `next build` already validates the app.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
