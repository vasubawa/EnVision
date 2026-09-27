'use client'

import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthMenu } from '@/components/AuthMenu'
import { EnVisionMark } from '@/components/EnVisionMark'
import { UploadDropzone } from '@/components/UploadDropzone'

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="paper-dots pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />
      <header className="border-border relative z-20 flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2.5">
          <EnVisionMark className="text-primary-500 h-6 w-6" />
          <span className="font-serif text-base font-bold tracking-tight">EnVision</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <div className="bg-border hidden h-4 w-px sm:block" />
          <AuthMenu />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex w-full flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex flex-col items-center text-center lg:max-w-[28rem] lg:items-start lg:text-left">
            <h1 className="text-foreground font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-[4rem]">
              Clarity in every <span className="text-primary-500 italic">problem set.</span>
            </h1>
            <p className="text-foreground/60 mt-5 font-serif text-lg leading-snug">
              Drop a worksheet, or start on a blank page. The tutor follows your steps and leaves
              the last one to you.
            </p>
          </div>

          <div className="w-full lg:max-w-[440px]">
            <UploadDropzone />
          </div>
        </div>
      </main>
    </div>
  )
}
