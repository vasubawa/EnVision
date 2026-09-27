'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { flushSync } from 'react-dom'

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  const toggleTheme = (e: React.MouseEvent) => {
    const nextTheme = isDark ? 'light' : 'dark'
    const x = e.clientX
    const y = e.clientY
    const endRadius =
      Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 48
    const root = document.documentElement
    root.style.setProperty('--tx', `${x}px`)
    root.style.setProperty('--ty', `${y}px`)
    root.style.setProperty('--tr', `${endRadius}px`)
    root.classList.remove('theme-shine', 'theme-pull')
    root.classList.add(nextTheme === 'light' ? 'theme-shine' : 'theme-pull')

    if (!document.startViewTransition) {
      setTheme(nextTheme)
      root.classList.remove('theme-shine', 'theme-pull')
      return
    }

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme)
      })
    })

    transition.finished.finally(() => {
      root.classList.remove('theme-shine', 'theme-pull')
    })
  }

  if (!mounted) {
    return <div className="h-10 w-10" />
  }

  return (
    <button
      onClick={toggleTheme}
      data-theme={isDark ? 'dark' : 'light'}
      className="theme-toggle text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-full p-2 transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
