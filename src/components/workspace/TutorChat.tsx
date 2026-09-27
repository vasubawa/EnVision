'use client'

import { Send, Loader2, Wand2, BrainCircuit } from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useChat } from '@ai-sdk/react'

import { DefaultChatTransport, type UIMessage } from 'ai'
import { MathRenderer } from './MathRenderer'
import { ChatEntry } from '@/types/feedback'
import { toast } from 'sonner'
import { katexSource, shouldTypeset } from '@/lib/boardStep'

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
    getInkImage,
    canvasTranscription,
    setCanvasTranscription,
    learningPreferences,
    ocrText,
    printedRead,
    setPrintedRead,
    requestHighlight,
    placeTutorStep,
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
        isCorrect: m.is_correct,
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
      requestHighlight()
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

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !getCanvasImage || isLoading || isAnalyzing) return

    const canvasBase64 = (ocrText && getInkImage ? getInkImage() : getCanvasImage()) ?? null
    if (!canvasBase64) {
      toast.error('Could not read the page.')
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
        isCorrect: f.isCorrect ?? null,
        judgement: f.judgement,
      }))

    sendMessage(
      { text: trimmed, metadata: { createdAt: Date.now() } },
      {
        body: {
          canvasBase64: canvasChanged ? canvasBase64 : undefined,
          canvasChanged,
          cachedTranscription: canvasTranscription || undefined,
          recentFeedback,
          learningPreferences,
          ocrText: ocrText || undefined,
        },
      },
    )
    setInput('')
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  const handleCheckWork = useCallback(async () => {
    if (!getCanvasImage) return
    const canvasBase64 = (ocrText && getInkImage ? getInkImage() : getCanvasImage()) ?? null
    if (!canvasBase64) return

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasBase64, workspaceId, problemText: ocrText || '' }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Could not check this page. Try again.')
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
        judgement: data.judgement,
        content: data.suggestion,
      })
      if (data.judgement !== 'correct') requestHighlight()
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error(error.message)
    } finally {
      setIsAnalyzing(false)
      lastAnalyzedRef.current = Date.now()
    }
  }, [
    getCanvasImage,
    getInkImage,
    ocrText,
    addChatEntry,
    workspaceId,
    lastCanvasUpdate,
    setCanvasTranscription,
    requestHighlight,
  ])

  const handleDeepAnalysis = useCallback(async () => {
    if (!getCanvasImage) return
    const canvasBase64 = (ocrText && getInkImage ? getInkImage() : getCanvasImage()) ?? null
    if (!canvasBase64) return

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-work-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasBase64, workspaceId, problemText: ocrText || '' }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Could not take a closer look. Try again.')
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
        judgement: data.judgement,
        content: data.suggestion,
      })
      if (data.judgement !== 'correct') requestHighlight()
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error(error.message)
    } finally {
      setIsAnalyzing(false)
      lastAnalyzedRef.current = Date.now()
    }
  }, [
    getCanvasImage,
    getInkImage,
    ocrText,
    addChatEntry,
    workspaceId,
    lastCanvasUpdate,
    setCanvasTranscription,
    requestHighlight,
  ])

  const handleShowStep = async () => {
    if (!getCanvasImage || isAnalyzing || isLoading) return
    const canvasBase64 = (ocrText && getInkImage ? getInkImage() : getCanvasImage()) ?? null
    if (!canvasBase64) return
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/one-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasBase64, workspaceId, problemText: ocrText || '' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.step !== 'string') {
        throw new Error(data?.error || 'Could not write one step. Try again.')
      }
      placeTutorStep?.(data.step)
      requestHighlight()
      const shown = shouldTypeset(katexSource(data.step))
        ? `$${katexSource(data.step)}$`
        : data.step
      addChatEntry({
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        role: 'assistant',
        type: 'feedback',
        isCorrect: null,
        judgement: 'progress',
        content: shown,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error(error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-transparent">
      <div
        ref={scrollRef}
        className={`flex flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto p-6 ${
          learningPreferences.calm ? '' : 'scroll-smooth'
        }`}
      >
        {printedRead ? (
          <form
            className="border-border bg-background max-w-[40rem] rounded-2xl border p-3"
            aria-label="Uploaded problem"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Uploaded problem</p>
              <button
                type="button"
                className="text-foreground/60 hover:text-foreground text-xs"
                onClick={() => setPrintedRead(null)}
              >
                Dismiss
              </button>
            </div>
            {printedRead.status === 'reading' ? (
              <p className="text-foreground/70 text-sm">Reading the page.</p>
            ) : null}
            {printedRead.status === 'failed' ? (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                {printedRead.error ?? 'Could not read that image. Type the problem below.'}
              </p>
            ) : null}
            {printedRead.status !== 'reading' ? (
              <textarea
                value={printedRead.text}
                aria-label="Correct the uploaded problem"
                rows={4}
                className="border-border bg-card text-foreground w-full rounded-lg border px-2 py-1.5 text-sm"
                onChange={(event) => setPrintedRead({ status: 'ready', text: event.target.value })}
              />
            ) : null}
            {printedRead.status === 'ready' ? (
              <p className="text-foreground/50 mt-2 text-[11px]">
                {printedRead.rough
                  ? 'Plain-text guess only. Correct the notation before you rely on it.'
                  : 'Writing you add later is read separately.'}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="max-w-[40rem]">
          <p className="text-foreground/80 font-serif text-[15px] leading-relaxed">
            Draw the next step. Ask a question, or check the work on the page.
          </p>
        </div>

        {allEntries.map((entry) => (
          <div
            key={entry.id}
            className={`flex gap-4 ${entry.role === 'user' ? 'justify-end' : ''}`}
          >
            <div
              className={`flex max-w-[85%] min-w-0 flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`min-w-0 overflow-x-auto ${
                  learningPreferences.largeText ? 'text-[17px]' : 'text-[15px]'
                } leading-relaxed wrap-break-word ${
                  entry.role === 'user'
                    ? 'bg-foreground/5 text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5'
                    : entry.type === 'feedback'
                      ? `border-l-2 py-1 pl-4 font-serif ${
                          entry.judgement === 'correct' || (!entry.judgement && entry.isCorrect)
                            ? 'border-l-green-500'
                            : entry.judgement === 'progress'
                              ? 'border-l-sky-500'
                              : 'border-l-yellow-500'
                        }`
                      : 'text-foreground/90 pt-1 font-serif'
                } `}
              >
                {entry.type === 'feedback' && (
                  <div
                    className={`mb-2 text-xs font-bold tracking-wider uppercase ${
                      entry.judgement === 'correct' || (!entry.judgement && entry.isCorrect)
                        ? 'text-green-600 dark:text-green-400'
                        : entry.judgement === 'progress'
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {entry.judgement === 'progress'
                      ? 'Still in progress'
                      : entry.judgement === 'correct' || (!entry.judgement && entry.isCorrect)
                        ? 'On track'
                        : 'A thought'}
                  </div>
                )}
                <MathRenderer content={entry.content} />
              </div>
            </div>
          </div>
        ))}

        {(isLoading || isAnalyzing) && (
          <div className="text-foreground/50 flex items-center gap-2 font-serif text-[15px]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the page
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
              Look closer
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleShowStep()}
            disabled={isAnalyzing || isLoading}
            className="hover:bg-foreground/5 text-foreground/70 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Show one step
          </button>
          {allEntries.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                disabled={isAnalyzing || isLoading}
                onClick={() => ask('Can you explain that another way?')}
                className="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground shrink-0 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
              >
                Explain another way
              </button>
              <button
                type="button"
                disabled={isAnalyzing || isLoading}
                onClick={() => ask('Can you give me a smaller, simpler hint?')}
                className="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground shrink-0 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
              >
                Smaller hint
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleCustomSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAnalyzing || isLoading}
            placeholder="Ask about a step"
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
