'use client'

import { Send, Loader2, Wand2, BrainCircuit } from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useChat } from '@ai-sdk/react'

import { DefaultChatTransport, type UIMessage } from 'ai'
import { MathRenderer } from './MathRenderer'
import { ChatEntry } from '@/types/feedback'
import { toast } from 'sonner'

type ChatMessageMetadata = { createdAt?: number; canvasTranscription?: string }
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
    canvasTranscription,
    setCanvasTranscription,
  } = useWorkspaceStore()
  const lastCanvasUpdate = useWorkspaceStore((s) => s.lastCanvasUpdate)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [input, setInput] = useState('')
  const lastAnalyzedRef = useRef<number>(0)
  const lastVisionCanvasRef = useRef<number>(0)

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

  const initialChatMessages: ChatMessage[] = useMemo(() => {
    return (initialMessages as DBMessage[])
      .filter((m) => m.kind === 'chat')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
        metadata: { createdAt: new Date(m.created_at).getTime() },
      }))
  }, [initialMessages])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/chat?workspaceId=${workspaceId}` }),
    [workspaceId],
  )

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport,
    messages: initialChatMessages,
    onError: (err: Error) => toast.error(err.message),
    onFinish: ({ message }) => {
      if (message.metadata?.canvasTranscription) {
        setCanvasTranscription(message.metadata.canvasTranscription)
      }
    },
  })
  const isLoading = status === 'submitted' || status === 'streaming'

  const scrollRef = useRef<HTMLDivElement>(null)

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

    const hasExistingTranscription = !!canvasTranscription
    const canvasChanged =
      !hasExistingTranscription || lastCanvasUpdate > lastVisionCanvasRef.current

    if (canvasChanged) {
      lastVisionCanvasRef.current = lastCanvasUpdate || Date.now()
    }

    const recentFeedback = chatHistory
      .filter((entry) => entry.type === 'feedback')
      .slice(-4)
      .map((f) => ({
        content: f.content,
        isCorrect: f.isCorrect ?? false,
      }))

    sendMessage(
      { text: input, metadata: { createdAt: Date.now() } },
      {
        body: {
          canvasBase64: canvasChanged ? canvasBase64 : undefined,
          canvasChanged,
          cachedTranscription: canvasTranscription || undefined,
          recentFeedback,
        },
      },
    )
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

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Analysis failed. Please try again.')
      }

      if (data.canvasTranscription) {
        setCanvasTranscription(data.canvasTranscription)
        lastVisionCanvasRef.current = lastCanvasUpdate || Date.now()
      }

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
  }, [getCanvasImage, addChatEntry, workspaceId, lastCanvasUpdate, setCanvasTranscription])

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

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Deep analysis failed. Please try again.')
      }

      if (data.canvasTranscription) {
        setCanvasTranscription(data.canvasTranscription)
        lastVisionCanvasRef.current = lastCanvasUpdate || Date.now()
      }

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
  }, [getCanvasImage, addChatEntry, workspaceId, lastCanvasUpdate, setCanvasTranscription])

  return (
    <div className="relative flex h-full w-full flex-col bg-transparent">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto scroll-smooth p-6"
      >
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
        </div>

        <form onSubmit={handleCustomSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAnalyzing || isLoading}
            placeholder="Ask a question..."
            className="bg-foreground/5 text-foreground placeholder:text-foreground/40 focus:bg-foreground/10 h-11 w-full rounded-xl px-4 pr-12 text-base transition-colors focus:outline-none disabled:opacity-50 sm:text-sm"
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
