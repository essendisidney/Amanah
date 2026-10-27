import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Members' money, admin and API routes are private; they redirect to sign-in anyway.
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/wallet',
        '/circles',
        '/finance',
        '/profile',
        '/ui-preview',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
