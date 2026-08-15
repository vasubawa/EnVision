import type { Metadata } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'sonner'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
          <div className="absolute top-4 right-4 z-50 flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span>{user.email}</span>
                <form action="/auth/signout" method="POST">
                  <button type="submit" className="text-muted-foreground hover:text-foreground">
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Sign In / Save Progress
              </Link>
            )}
          </div>
          {children}
          <Toaster position="bottom-right" richColors theme="system" />
        </ThemeProvider>
      </body>
    </html>
  )
}
