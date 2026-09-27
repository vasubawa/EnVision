'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'
import { useWorkspaceStore, type LearningPreferences } from '@/store/useWorkspaceStore'

const OPTIONS: {
  key: keyof LearningPreferences
  label: string
  description: string
}[] = [
  {
    key: 'oneStep',
    label: 'One step at a time',
    description: 'One hint, then it waits',
  },
  {
    key: 'shortReplies',
    label: 'Short explanations',
    description: 'A sentence or two',
  },
  {
    key: 'largeText',
    label: 'Larger text',
    description: 'Bigger type in the tutor',
  },
  {
    key: 'calm',
    label: 'Calm motion',
    description: 'Less movement on the page',
  },
]

export function LearningControls() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { learningPreferences, setLearningPreferences } = useWorkspaceStore()

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Learning and accessibility settings"
        aria-expanded={isOpen}
        title="Help style"
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
          isOpen
            ? 'bg-primary-500/15 text-primary-500 font-semibold'
            : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Help style</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Learning preferences"
          className="bg-card/95 border-border/80 absolute right-0 z-50 mt-2 w-72 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl transition-all"
        >
          <div className="border-border/40 mb-2 border-b pb-2">
            <span className="text-foreground text-xs font-semibold tracking-wide">
              How the tutor helps
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {OPTIONS.map(({ key, label, description }) => {
              const isChecked = learningPreferences[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLearningPreferences({ [key]: !isChecked })}
                  className="hover:bg-foreground/5 flex w-full items-start justify-between rounded-xl p-2 text-left transition-colors"
                >
                  <div className="flex flex-col pr-2">
                    <span className="text-foreground text-xs font-medium">{label}</span>
                    <span className="text-foreground/50 text-[11px] leading-tight">
                      {description}
                    </span>
                  </div>
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isChecked
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-border bg-foreground/5'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
