'use client'

import Typewriter from 'typewriter-effect'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthMenu } from '@/components/AuthMenu'
import { EnVisionMark } from '@/components/EnVisionMark'
import { UploadDropzone } from '@/components/UploadDropzone'

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#c05621]/6 blur-[120px]" />
        <div className="absolute -right-40 -bottom-40 h-[400px] w-[400px] rounded-full bg-[#c05621]/4 blur-[100px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-2.5">
          <EnVisionMark className="text-primary-500 h-6 w-6 sm:h-7 sm:w-7" />
          <span className="font-serif text-base font-bold tracking-tight sm:text-[1.05rem]">
            EnVision
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <div className="bg-border hidden h-4 w-px sm:block" />
          <AuthMenu />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex w-full flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">
          {/* Left — hero copy */}
          <div className="flex flex-col items-center text-center lg:max-w-[520px] lg:items-start lg:text-left">
            {/* Badge */}
            <div className="border-primary-500/30 bg-primary-500/6 text-primary-500 mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-semibold tracking-widest uppercase sm:px-4 sm:py-1.5 sm:text-xs">
              <span className="bg-primary-500 h-1.5 w-1.5 animate-pulse rounded-full" />
              AI Whiteboard Tutor
            </div>

            <h1 className="text-foreground mb-4 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-[4rem]">
              Clarity in every <span className="text-primary-500 italic">problem set.</span>
            </h1>

            {/* Typewriter subtitle */}
            <div className="sr-only">
              Deconstruct complex Physics problems, Visualize Organic Chemistry mechanisms, Map out
              Calculus derivations
            </div>
            <div
              aria-hidden="true"
              className="text-foreground/50 mb-8 h-6 font-serif text-base italic sm:h-7 sm:text-lg"
            >
              <Typewriter
                options={{
                  strings: [
                    'Deconstruct complex Physics problems...',
                    'Visualize Organic Chemistry mechanisms...',
                    'Map out Calculus derivations...',
                    'Understand Data Structures & Algorithms...',
                    'Decode advanced Circuit Analysis...',
                  ],
                  autoStart: true,
                  loop: true,
                  delay: 50,
                  deleteSpeed: 25,
                }}
              />
            </div>

            {/* Feature chips — hidden on smallest screens to save vertical space */}
            <div className="hidden flex-wrap justify-center gap-2 sm:flex lg:justify-start">
              {[
                'AI Socratic feedback',
                'Freehand whiteboard',
                'PDF & photo upload',
                'LaTeX rendering',
                'Auto work-check',
              ].map((label) => (
                <span
                  key={label}
                  className="border-border text-foreground/60 rounded-full border bg-transparent px-3 py-1 text-xs font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — upload zone */}
          <div className="w-full lg:max-w-[440px]">
            <div className="relative">
              <div className="bg-primary-500/10 absolute -inset-3 rounded-3xl blur-xl sm:-inset-4 sm:blur-2xl" />
              <div className="relative">
                <UploadDropzone />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-col items-center pt-2 pb-5">
        <div className="bg-border h-px w-12" />
        <span className="text-foreground/20 mt-3 text-[0.6rem] font-medium tracking-[0.18em] uppercase">
          Powered by Groq · Built with Next.js
        </span>
      </footer>
    </div>
  )
}
