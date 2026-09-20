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
    <html lang={locale} className={manrope.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;if(!localStorage.getItem('amanah-palette-v5')){localStorage.setItem('amanah-theme','light');localStorage.setItem('amanah-palette-v5','1')}var t=localStorage.getItem('amanah-theme');if(t!=='light'&&t!=='dark'&&t!=='auto'){t='light';localStorage.setItem('amanah-theme','light')}var d=t==='dark';if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){try{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}catch(x){}}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh font-sans">
        <BootSplashMarkup />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(sessionStorage.getItem('jameiyah-booted')==='1'){var s0=document.getElementById('boot-splash');if(s0){s0.remove();return}}}catch(e){}function h(hard){var s=document.getElementById('boot-splash');if(!s)return;if(s.getAttribute('data-out')&&!hard)return;s.setAttribute('data-out','1');s.classList.add('amanah-boot-splash--out');s.style.pointerEvents='none';try{sessionStorage.setItem('jameiyah-booted','1')}catch(e){}var done=function(){try{s.remove()}catch(e){}};if(hard){done();return}setTimeout(done,480)}if(document.readyState==='complete'){setTimeout(function(){h(false)},400)}else{window.addEventListener('load',function(){setTimeout(function(){h(false)},400)},{once:true})}setTimeout(function(){h(false)},1400);setTimeout(function(){h(true)},2000)})();`,
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
