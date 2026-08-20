import type { MetadataRoute } from 'next';
import { APP_DESCRIPTION, APP_NAME } from '@jamiya/shared';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: 'en',
    // Prefer an always-public entry so Android Chrome install criteria stay green
    // even when the session cookie is missing on first launch from the home screen.
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#19b879',
    categories: ['finance', 'business'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
