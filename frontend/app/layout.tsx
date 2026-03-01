import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '../components/providers/ThemeProvider'
import { AuthProvider } from '../components/providers/AuthProvider'
import { ToastProvider } from '../components/providers/ToastProvider'
import { ClassContextProvider } from '@/lib/contexts/ClassContext'
import { SetupProvider } from '@/components/providers/SetupProvider'
import BrandWatermark from '@/components/BrandWatermark'
import DomainRedirect from '@/components/DomainRedirect'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LMS Platform',
  description: 'A modern, scalable Learning Management System with live classes and role-based permissions',
  keywords: 'LMS, learning, education, online courses, live classes, webrtc',
  authors: [{ name: 'LMS Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){
                w[l]=w[l]||[];
                w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0],
                    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                j.async=true;
                j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-WCWBRQPH');
            `,
          }}
        />
      </head>
      <body className={inter.className} style={{ backgroundColor: 'var(--color-background)' }}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WCWBRQPH"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <ThemeProvider>
          <SetupProvider>
            <AuthProvider>
              <ToastProvider>
                <ClassContextProvider>
                  <DomainRedirect />
                  {children}
                  <BrandWatermark />
                </ClassContextProvider>
              </ToastProvider>
            </AuthProvider>
          </SetupProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
