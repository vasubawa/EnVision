"use client";

import { Send } from "lucide-react";
import { useState } from "react";

export function TutorChat() {
  const [input, setInput] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setInput("");
    // Connect to AI tutor backend
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative">
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Mock welcome message */}
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-sm">
            <span className="font-serif font-bold text-primary-500 text-sm">AI</span>
          </div>
          <div className="flex-1 mt-1">
            <p className="text-foreground/80 leading-relaxed text-sm bg-card/60 backdrop-blur-sm p-4 rounded-2xl rounded-tl-none border border-border shadow-sm">
              I'm analyzing your problem set now. Feel free to start drawing your solution on the whiteboard! Let me know if you get stuck.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 shrink-0 bg-card/40 backdrop-blur-md border-t border-border">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask EnVision a question..."
            className="w-full h-11 rounded-xl bg-background border border-border px-4 pr-12 text-sm text-foreground focus:outline-none focus:border-primary-500/50 transition-colors shadow-sm"
          />
          <button 
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
