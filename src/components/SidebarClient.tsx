'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createWorkspace } from '@/app/(main)/dashboard/actions'
import { Plus, MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react'
import { EnVisionMark } from '@/components/EnVisionMark'
import { AuthMenu } from '@/components/AuthMenu'
import { ThemeToggle } from '@/components/ThemeToggle'

interface Workspace {
  id: string
  title: string
  updated_at: string
}

export default function SidebarClient({
  workspaces,
  children,
}: {
  workspaces: Workspace[]
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(true)
  const pathname = usePathname()

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div
        className={`border-border bg-background fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300 md:relative ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:border-r-0'}`}
      >
        <div
          className={`flex h-full w-64 flex-col overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Header */}
          <div className="border-border/50 flex h-14 shrink-0 items-center justify-between border-b px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 transition-transform hover:scale-105"
            >
              <EnVisionMark className="text-primary-500 h-6 w-6" />
              <span className="font-serif font-medium tracking-tight">EnVision</span>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground rounded-md p-1.5"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New Workspace Button */}
          <div className="shrink-0 p-3">
            <form action={createWorkspace}>
              <button className="border-border/50 bg-background hover:bg-foreground/5 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm transition-colors">
                <span className="font-medium">New session</span>
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Workspace List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="text-foreground/50 mb-2 px-2 text-xs font-semibold">Recent</div>
            <div className="flex flex-col gap-0.5">
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/workspace/${ws.id}`}
                  className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    pathname === `/workspace/${ws.id}`
                      ? 'bg-foreground/10 text-foreground font-medium'
                      : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  <MessageSquare className="text-foreground/40 group-hover:text-foreground/70 h-4 w-4 shrink-0" />
                  <span className="truncate">{ws.title}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/50 shrink-0 border-t p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <AuthMenu />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content wrapper */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Floating open button when closed */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="text-foreground/50 hover:bg-foreground/5 hover:text-foreground border-border/50 bg-background/50 absolute top-4 left-4 z-40 rounded-md border p-2 shadow-sm backdrop-blur-sm"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* Main View */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
