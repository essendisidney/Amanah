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
    { media: '(prefers-color-scheme: light)', color: '#0b5c42' },
    { media: '(prefers-color-scheme: dark)', color: '#0b5c42' },
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
    <html lang={locale} className={manrope.variable}>
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
