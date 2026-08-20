import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { APP_DESCRIPTION, APP_NAME } from '@jamiya/shared';
import { InstallPrompt } from '@/components/install-prompt';
import { BootSplashMarkup } from '@/components/app-loader';
import { BootSplash } from '@/components/boot-splash';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import { getDictionary } from '@/i18n/get-dictionary';
import './globals.css';
import '@/components/app-loader.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
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
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4fc' },
    { media: '(prefers-color-scheme: dark)', color: '#062213' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dict } = await getDictionary();
  return (
    <html lang={locale} className={manrope.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;if(!localStorage.getItem('amanah-palette-v3')){localStorage.setItem('amanah-theme','light');localStorage.setItem('amanah-palette-v3','1')}var t=localStorage.getItem('amanah-theme');if(t!=='light'&&t!=='dark'&&t!=='auto'){t='light';localStorage.setItem('amanah-theme','light')}var h=(new Date()).getHours();var d=t==='dark'||(t==='auto'&&(h<6||h>=18));if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh font-sans">
        <BootSplashMarkup />
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
