"use client";

import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
const Whiteboard = dynamic(() => import("@/components/workspace/Whiteboard").then(mod => mod.Whiteboard), { ssr: false });
import { TutorChat } from "@/components/workspace/TutorChat";

export default function WorkspacePage() {
  const file = useWorkspaceStore((state) => state.file);
  const router = useRouter();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleLeave = () => {
    if (window.confirm("Are you sure you want to leave? Your canvas progress will be lost.")) {
      router.push("/");
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-transparent text-foreground overflow-hidden">
      {/* Workspace Header */}
      <header className="h-14 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLeave}
            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-foreground/60 hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="font-serif font-medium truncate max-w-[200px] text-sm">
            {file?.name || "Blank Canvas"}
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Workspace Area (Split Screen) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Top/Left Side: Whiteboard */}
        <section className="h-[60vh] md:h-auto md:flex-[7] relative border-b md:border-b-0 md:border-r border-border bg-transparent shrink-0 md:shrink">
          <Whiteboard />
        </section>

        {/* Bottom/Right Side: AI Tutor Chat */}
        <section className="flex-1 md:flex-[3] relative bg-card/40 backdrop-blur-sm flex flex-col min-h-0">
          <TutorChat />
        </section>
      </main>
    </div>
  );
}
