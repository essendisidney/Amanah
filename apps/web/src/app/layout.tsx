import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { APP_NAME } from '@jamiya/shared';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';
import { InstallPrompt } from '@/components/install-prompt';
import { BootSplashMarkup } from '@/components/app-loader';
import { BootSplash } from '@/components/boot-splash';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import { getDictionary } from '@/i18n/get-dictionary';
import './globals.css';
import '@/components/app-loader.css';

// Fonts are served from the repo (latin subset, variable weight) so builds never depend on
// reaching Google Fonts. Both are SIL Open Font License; see fonts/LICENSE.md.
const manrope = localFont({
  src: './fonts/manrope-latin.woff2',
  variable: '--font-sans',
  weight: '200 800',
  display: 'swap',
});

/** Display face for marketing headlines (home page). */
const grotesk = localFont({
  src: './fonts/space-grotesk-latin.woff2',
  variable: '--font-grotesk',
  weight: '300 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: APP_NAME,
  metadataBase: new URL(SITE_URL),
  // No og:title/og:description here: a site-wide one would override every page's own title and
  // description in link previews. The image comes from opengraph-image.tsx.
  openGraph: {
    siteName: APP_NAME,
    type: 'website',
    locale: 'en_KE',
  },
  twitter: {
    card: 'summary_large_image',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/jameiyah-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/jameiyah-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/jameiyah-apple.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d5c45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dict } = await getDictionary();
  return (
    <html lang={locale} className={`${manrope.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;try{if(localStorage.getItem('jameiyah-hide-balance')==='1')r.setAttribute('data-hide-balance','');if(localStorage.getItem('jameiyah-lock')&&sessionStorage.getItem('jameiyah-unlocked')!=='1')r.setAttribute('data-locked','')}catch(h){}if(!localStorage.getItem('jameiyah-palette-v5')){localStorage.setItem('jameiyah-theme','light');localStorage.setItem('jameiyah-palette-v5','1')}var t=localStorage.getItem('jameiyah-theme');if(t!=='light'&&t!=='dark'&&t!=='auto'){t='light';localStorage.setItem('jameiyah-theme','light')}var d=t==='dark'||(t==='auto'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){try{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}catch(x){}}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh font-sans">
        <BootSplashMarkup />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(sessionStorage.getItem('jameiyah-booted')==='1'){document.documentElement.setAttribute('data-booted','1')}}catch(e){}})();`,
          }}
        />
        <Providers>
          {children}
          <BootSplash />
          <PwaRegister />
          <InstallPrompt labels={dict.install} />
        </Providers>
      </body>
    </html>
  );
}
