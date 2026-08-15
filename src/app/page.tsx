'use client'

import Typewriter from 'typewriter-effect'
import { ThemeToggle } from '@/components/ThemeToggle'
import { EnVisionMark } from '@/components/EnVisionMark'
import { BackgroundMath } from '@/components/BackgroundMath'
import { UploadDropzone } from '@/components/UploadDropzone'

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <BackgroundMath />

      {/* Top Bar */}
      <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between p-5">
        <div className="text-foreground flex items-center gap-2.5">
          <EnVisionMark className="text-primary-500 h-7 w-7" />
          <span className="font-serif text-[1.1rem] font-bold tracking-tight">EnVision</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <main className="relative z-10 mx-auto mt-12 flex w-full max-w-3xl flex-col items-center text-center">
        {/* Hero Heading */}
        <h1 className="text-foreground mb-4 font-serif text-5xl leading-[1.12] tracking-tight md:text-[4.5rem]">
          Clarity in every
          <br className="hidden md:block" />
          <span className="text-primary-500"> problem set.</span>
        </h1>

        {/* Editorial subtitle with Typewriter */}
        <div className="sr-only">
          Deconstruct complex Physics problems, Visualize Organic Chemistry mechanisms, Map out
          Calculus derivations, Understand Data Structures & Algorithms, Decode advanced Circuit
          Analysis
        </div>
        <div
          aria-hidden="true"
          className="text-foreground/60 mb-8 h-7 max-w-lg font-serif text-lg italic md:text-xl"
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

        {/* Upload Zone Component */}
        <div className="mx-auto w-full max-w-xl">
          <UploadDropzone />
        </div>
      </main>

      {/* Footer */}
      <footer className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 flex flex-col items-center pb-5">
        <div className="bg-border mb-4 h-px w-24" />
        <span className="text-foreground/25 text-[0.65rem] font-medium tracking-[0.2em] uppercase">
          Made with Next.js
        </span>
      </footer>
    </div>
  )
}
