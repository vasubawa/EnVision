'use client'

import { Send, Loader2, Wand2, BrainCircuit } from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { MathRenderer } from './MathRenderer'
import { ChatEntry } from '@/types/feedback'
import { toast } from 'sonner'

type ChatMessageMetadata = { createdAt?: number }
type ChatMessage = UIMessage<ChatMessageMetadata>

function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export function TutorChat({
  workspaceId,
  initialMessages = [],
}: {
  workspaceId: string
  initialMessages?: unknown[]
}) {
  interface DBMessage {
    id: string
    created_at: string
    role: string
    kind: string
    content: string
    is_correct: boolean | null
  }

  const {
    chatHistory,
    addChatEntry,
    setChatHistory,
    getCanvasImage,
    lastCanvasUpdate,
    isAutoCheckEnabled,
    setIsAutoCheckEnabled,
    autoCheckDelay,
    setAutoCheckDelay,
  } = useWorkspaceStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [input, setInput] = useState('')
  const lastAnalyzedRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize feedback messages from DB
  useEffect(() => {
    const feedbackMessages = (initialMessages as DBMessage[])
      .filter((m) => m.kind === 'feedback')
      .map((m) => ({
        id: m.id,
        timestamp: new Date(m.created_at).getTime(),
        role: m.role as 'assistant',
        type: 'feedback' as const,
        content: m.content,
        isCorrect: m.is_correct || false,
      }))
    setChatHistory(feedbackMessages)
  }, [initialMessages, setChatHistory])

  // Extract initial chat messages for useChat
  const initialChatMessages = useMemo(() => {
    return (initialMessages as DBMessage[])
      .filter((m) => m.kind === 'chat')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        metadata: { createdAt: new Date(m.created_at).getTime() },
      }))
  }, [initialMessages])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/chat?workspaceId=${workspaceId}` }),
    [workspaceId],
  )

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport,
    // @ts-expect-error - initialMessages type might mismatch
    initialMessages: initialChatMessages,
    onError: (err: Error) => toast.error(err.message),
  })
  const isLoading = status === 'submitted' || status === 'streaming'

  const scrollRef = useRef<HTMLDivElement>(null)

  // Combine automated feedback and chat messages, sorted by time.
  // Timestamps for chat messages come from `metadata.createdAt`, stamped
  // client-side at send time and server-side at stream start (see
  // handleCustomSubmit and /api/chat's messageMetadata option) rather than
  // computed here — React Compiler forbids impure calls like Date.now()
  // during render.
  const allEntries = useMemo(() => {
    const aiMessages: ChatEntry[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        timestamp: m.metadata?.createdAt || 0,
        role: m.role as 'user' | 'assistant',
        type: 'message',
        content: getMessageText(m),
      }))

    const combined = [...chatHistory, ...aiMessages]
    combined.sort((a, b) => a.timestamp - b.timestamp)
    return combined
  }, [chatHistory, messages])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allEntries, isAnalyzing])

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !getCanvasImage) return

    const canvasBase64 = getCanvasImage()
    if (!canvasBase64) {
      toast.error('Could not capture canvas.')
      return
    }

    sendMessage({ text: input, metadata: { createdAt: Date.now() } }, { body: { canvasBase64 } })
    setInput('')
  }

  const handleCheckWork = useCallback(async () => {
    if (!getCanvasImage) return
    const canvasBase64 = getCanvasImage()
    if (!canvasBase64) return

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasBase64, workspaceId }),
      })

      if (!res.ok) throw new Error('Analysis failed')
      const data = await res.json()

      addChatEntry({
        id: data.id || Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        role: 'assistant',
        type: 'feedback',
        isCorrect: data.isCorrect,
        content: data.suggestion,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error(error.message)
    } finally {
      setIsAnalyzing(false)
      lastAnalyzedRef.current = Date.now()
    }
  }, [getCanvasImage, addChatEntry, workspaceId])

  const handleDeepAnalysis = useCallback(async () => {
    if (!getCanvasImage) return
    const canvasBase64 = getCanvasImage()
    if (!canvasBase64) return

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-work-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasBase64, workspaceId }),
      })

      if (!res.ok) throw new Error('Deep analysis failed')
      const data = await res.json()

      addChatEntry({
        id: data.id || Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        role: 'assistant',
        type: 'feedback',
        isCorrect: data.isCorrect,
        content: data.suggestion,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error(error.message)
    } finally {
      setIsAnalyzing(false)
      lastAnalyzedRef.current = Date.now()
    }
  }, [getCanvasImage, addChatEntry, workspaceId])

  // Automated feedback on inactivity (5 seconds)
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Only trigger if auto-check is enabled, canvas actually updated, and we aren't currently analyzing
    if (
      isAutoCheckEnabled &&
      lastCanvasUpdate > 0 &&
      lastCanvasUpdate > lastAnalyzedRef.current &&
      !isAnalyzing &&
      !isLoading
    ) {
      timeoutRef.current = setTimeout(() => {
        // Prevent double triggers
        if (lastCanvasUpdate > lastAnalyzedRef.current) {
          handleCheckWork()
        }
      }, autoCheckDelay)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [
    lastCanvasUpdate,
    isAnalyzing,
    isLoading,
    isAutoCheckEnabled,
    autoCheckDelay,
    handleCheckWork,
  ])

  return (
    <div className="relative flex h-full w-full flex-col bg-transparent">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto scroll-smooth p-6"
      >
        {/* Welcome message */}
        <div className="flex gap-4">
          <div className="bg-primary-500/10 border-primary-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm">
            <span className="text-primary-500 font-serif text-sm font-bold">AI</span>
          </div>
          <div className="mt-1 flex-1">
            <p className="text-foreground/90 font-serif text-[15px] leading-relaxed">
              I&apos;m ready! Start drawing your solution on the whiteboard. You can ask me
              questions anytime or click &quot;Check my work&quot;.
            </p>
          </div>
        </div>

        {/* Hybrid Feed */}
        {allEntries.map((entry) => (
          <div
            key={entry.id}
            className={`flex gap-4 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {entry.role === 'assistant' && (
              <div className="bg-primary-500/10 border-primary-500/20 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm">
                <span className="text-primary-500 font-serif text-sm font-bold">AI</span>
              </div>
            )}

            <div
              className={`flex max-w-[85%] min-w-0 flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`min-w-0 overflow-x-auto text-[15px] leading-relaxed wrap-break-word ${
                  entry.role === 'user'
                    ? 'bg-foreground/5 text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5'
                    : entry.type === 'feedback'
                      ? `border-l-2 py-1 pl-4 font-serif ${entry.isCorrect ? 'border-l-green-500' : 'border-l-yellow-500'}`
                      : 'text-foreground/90 pt-1 font-serif'
                } `}
              >
                {entry.type === 'feedback' && (
                  <div
                    className={`mb-2 text-xs font-bold tracking-wider uppercase ${entry.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}
                  >
                    {entry.isCorrect ? '✓ On Track' : '💡 A thought'}
                  </div>
                )}
                <MathRenderer content={entry.content} />
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {(isLoading || isAnalyzing) && (
          <div className="flex gap-4">
            <div className="bg-primary-500/10 border-primary-500/20 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm">
              <span className="text-primary-500 font-serif text-sm font-bold">AI</span>
            </div>
            <div className="text-foreground/50 flex items-center gap-2 pt-1 font-serif text-[15px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="bg-card/95 border-border flex shrink-0 flex-col gap-3 border-t p-4 backdrop-blur-md">
        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckWork}
              disabled={isAnalyzing || isLoading}
              className="hover:bg-foreground/5 text-foreground/70 hover:text-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Check my work
            </button>
            <div className="bg-border h-4 w-px" />
            <button
              onClick={handleDeepAnalysis}
              disabled={isAnalyzing || isLoading}
              className="hover:bg-foreground/5 text-foreground/70 hover:text-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Deep analysis
            </button>
          </div>

          {/* Auto-check Settings */}
          <div className="flex items-center gap-3 px-1">
            <label className="text-foreground/80 hover:text-foreground flex cursor-pointer items-center gap-2 text-xs transition-colors">
              <input
                type="checkbox"
                checked={isAutoCheckEnabled}
                onChange={(e) => setIsAutoCheckEnabled(e.target.checked)}
                className="border-border bg-card accent-primary-500 h-3.5 w-3.5 cursor-pointer rounded"
              />
              Auto-check work
            </label>

            {isAutoCheckEnabled && (
              <div className="text-foreground/60 animate-in fade-in slide-in-from-left-2 flex items-center gap-1.5 text-xs duration-200">
                <span>after</span>
                <select
                  value={autoCheckDelay}
                  onChange={(e) => setAutoCheckDelay(Number(e.target.value))}
                  className="bg-card border-border focus:border-primary-500/50 hover:border-border/80 cursor-pointer rounded-md border px-1.5 py-0.5 text-xs transition-colors outline-none"
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={15000}>15s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
                <span>idle</span>
              </div>
            )}
          </div>
        </div>

        {/* Chat Input */}
        <form onSubmit={handleCustomSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAnalyzing || isLoading}
            placeholder="Ask a question..."
            className="bg-foreground/5 text-foreground placeholder:text-foreground/40 focus:bg-foreground/10 h-11 w-full rounded-xl px-4 pr-12 text-sm transition-colors focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            className="bg-primary-500 hover:bg-primary-600 absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-1.5 text-white transition-colors disabled:opacity-50"
            disabled={!input.trim() || isAnalyzing || isLoading}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
