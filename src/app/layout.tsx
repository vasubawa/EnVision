import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'sonner'
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'EnVision | Master Your Subjects',
  description:
    'A physics, chemistry, and calculus-focused intelligent whiteboard. Upload your problem set and get Socratic feedback as you draw.',
  openGraph: {
    title: 'EnVision | Master Your Subjects',
    description:
      'A physics, chemistry, and calculus-focused intelligent whiteboard. Upload your problem set and get Socratic feedback as you draw.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body
        className={`${inter.variable} ${lora.variable} bg-background text-foreground antialiased transition-colors duration-500`}
      >
        {' '}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" richColors theme="system" />
        </ThemeProvider>
      </body>
    </html>
  )
}
