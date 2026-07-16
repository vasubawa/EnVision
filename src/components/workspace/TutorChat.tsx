"use client";

import { Send, Loader2, Wand2, BrainCircuit } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useChat } from "ai/react";
import { MathRenderer } from "./MathRenderer";
import { ChatEntry } from "@/types/feedback";
import { toast } from "sonner";

export function TutorChat() {
  const { 
    chatHistory, 
    addChatEntry, 
    getCanvasImage, 
    lastCanvasUpdate,
    isAutoCheckEnabled,
    setIsAutoCheckEnabled,
    autoCheckDelay,
    setAutoCheckDelay
  } = useWorkspaceStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastAnalyzedRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    onError: (err: Error) => toast.error(err.message),
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Combine automated feedback and chat messages, sorted by time
  const allEntries = useMemo(() => {
    const aiMessages: ChatEntry[] = messages.map((m: any) => ({
      id: m.id,
      timestamp: m.createdAt?.getTime() || 0,
      role: m.role as 'user' | 'assistant',
      type: 'message',
      content: m.content
    }));

    const combined = [...chatHistory, ...aiMessages];
    combined.sort((a, b) => a.timestamp - b.timestamp);
    return combined;
  }, [chatHistory, messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allEntries, isAnalyzing]);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !getCanvasImage) return;

    const canvasBase64 = getCanvasImage();
    if (!canvasBase64) {
      toast.error("Could not capture canvas.");
      return;
    }

    // Submit to useChat, passing the image as an attachment/data
    handleSubmit(e, {
      data: { canvasBase64 }
    });
  };

  const handleCheckWork = async () => {
    if (!getCanvasImage) return;
    const canvasBase64 = getCanvasImage();
    if (!canvasBase64) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasBase64 }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();

      addChatEntry({
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        role: "assistant",
        type: "feedback",
        isCorrect: data.isCorrect,
        content: data.suggestion,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepAnalysis = async () => {
    if (!getCanvasImage) return;
    const canvasBase64 = getCanvasImage();
    if (!canvasBase64) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-work-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasBase64 }),
      });

      if (!res.ok) throw new Error("Deep analysis failed");
      const data = await res.json();

      addChatEntry({
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        role: "assistant",
        type: "feedback",
        isCorrect: data.isCorrect,
        content: data.suggestion,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
      lastAnalyzedRef.current = Date.now();
    }
  };

  // Automated feedback on inactivity (5 seconds)
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only trigger if auto-check is enabled, canvas actually updated, and we aren't currently analyzing
    if (isAutoCheckEnabled && lastCanvasUpdate > 0 && lastCanvasUpdate > lastAnalyzedRef.current && !isAnalyzing && !isLoading) {
      timeoutRef.current = setTimeout(() => {
        // Prevent double triggers
        if (lastCanvasUpdate > lastAnalyzedRef.current) {
          handleCheckWork();
        }
      }, autoCheckDelay);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [lastCanvasUpdate, isAnalyzing, isLoading, isAutoCheckEnabled, autoCheckDelay, handleCheckWork]);

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative">
      <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 scroll-smooth">
        {/* Welcome message */}
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-sm">
            <span className="font-serif font-bold text-primary-500 text-sm">AI</span>
          </div>
          <div className="flex-1 mt-1">
            <p className="text-foreground/80 leading-relaxed text-sm bg-card/60 backdrop-blur-sm p-4 rounded-2xl rounded-tl-none border border-border shadow-sm">
              I&apos;m ready! Start drawing your solution on the whiteboard. You can ask me questions anytime or click &quot;Check my work&quot;.
            </p>
          </div>
        </div>

        {/* Hybrid Feed */}
        {allEntries.map((entry) => (
          <div key={entry.id} className={`flex gap-4 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {entry.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-sm mt-1">
                <span className="font-serif font-bold text-primary-500 text-sm">AI</span>
              </div>
            )}

            <div className={`flex flex-col max-w-[85%] ${entry.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`
                p-4 rounded-2xl shadow-sm text-sm leading-relaxed
                ${entry.role === 'user'
                  ? 'bg-primary-500 text-white rounded-tr-none'
                  : entry.type === 'feedback'
                    ? `bg-card/80 backdrop-blur-sm border-l-4 ${entry.isCorrect ? 'border-l-green-500' : 'border-l-yellow-500'} border-y border-r border-border rounded-tl-none`
                    : 'bg-card/60 backdrop-blur-sm border border-border rounded-tl-none text-foreground/90'
                }
              `}>
                {entry.type === 'feedback' && (
                  <div className={`text-xs font-bold mb-2 uppercase tracking-wider ${entry.isCorrect ? 'text-green-500' : 'text-yellow-500'}`}>
                    {entry.isCorrect ? '✓ On Track!' : '💡 A thought...'}
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
            <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-sm mt-1">
              <span className="font-serif font-bold text-primary-500 text-sm">AI</span>
            </div>
            <div className="bg-card/60 backdrop-blur-sm p-4 rounded-2xl rounded-tl-none border border-border flex items-center gap-2 text-sm text-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 shrink-0 bg-card/40 backdrop-blur-md border-t border-border flex flex-col gap-3">
        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckWork}
              disabled={isAnalyzing || isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card border border-border hover:bg-foreground/5 transition-colors text-xs font-medium text-foreground/80 disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Check my work
            </button>
            <button
              onClick={handleDeepAnalysis}
              disabled={isAnalyzing || isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card border border-border hover:bg-foreground/5 transition-colors text-xs font-medium text-foreground/80 disabled:opacity-50"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              Deeper analysis
            </button>
          </div>

          {/* Auto-check Settings */}
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer hover:text-foreground transition-colors">
              <input 
                type="checkbox" 
                checked={isAutoCheckEnabled} 
                onChange={(e) => setIsAutoCheckEnabled(e.target.checked)}
                className="rounded border-border bg-card accent-primary-500 w-3.5 h-3.5 cursor-pointer"
              />
              Auto-check work
            </label>
            
            {isAutoCheckEnabled && (
              <div className="flex items-center gap-1.5 text-xs text-foreground/60 animate-in fade-in slide-in-from-left-2 duration-200">
                <span>after</span>
                <select
                  value={autoCheckDelay}
                  onChange={(e) => setAutoCheckDelay(Number(e.target.value))}
                  className="bg-card border border-border rounded-md px-1.5 py-0.5 text-xs outline-none focus:border-primary-500/50 cursor-pointer hover:border-border/80 transition-colors"
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
            onChange={handleInputChange}
            disabled={isAnalyzing || isLoading}
            placeholder="Ask a question about your work..."
            className="w-full h-11 rounded-xl bg-background border border-border px-4 pr-12 text-sm text-foreground focus:outline-none focus:border-primary-500/50 transition-colors shadow-sm disabled:opacity-50"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
            disabled={!input.trim() || isAnalyzing || isLoading}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
