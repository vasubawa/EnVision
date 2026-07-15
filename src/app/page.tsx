"use client";

import { useState, useCallback } from "react";
import Typewriter from "typewriter-effect";
import { Camera, ArrowRight, FileText, UploadCloud, X, FlaskConical, Atom, FunctionSquare, Terminal, Cpu } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CameraModal } from "@/components/CameraModal";
import { toast } from "sonner";

// EnVision prism/eye brand mark
function EnVisionMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M14 3L25.5 23H2.5L14 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" opacity="0.6" />
      <ellipse cx="14" cy="17" rx="3.5" ry="3.5" fill="currentColor" />
      <line x1="14" y1="3" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}



// Humanistic academic writing — spread organically across the full page
// opacity-[light] dark:opacity-[dark] so both modes look great
const BACKGROUND_FORMULAS = [
  { 
    text: "∇ · E = ρ/ε₀\n∇ × E = −∂B/∂t\n∇ · B = 0\n∇ × B = μ₀J + μ₀ε₀(∂E/∂t)", 
    pos: "top-[5%] left-[4%]", size: "text-xl sm:text-2xl", rot: "rotate-[-4deg]" 
  },
  { 
    text: "iℏ(∂Ψ/∂t) = ĤΨ\nĤ = −(ℏ²/2m)∇² + V(r,t)", 
    pos: "top-[65%] right-[5%]", size: "text-lg sm:text-xl", rot: "rotate-[3deg]" 
  },
  { 
    text: "X(f) = ∫ x(t) e^(−i2πft) dt\nx(t) = ∫ X(f) e^(i2πft) df", 
    pos: "top-[15%] right-[6%]", size: "text-lg sm:text-xl", rot: "rotate-[6deg]" 
  },
  { 
    text: "ρ(∂u/∂t + u · ∇u) = −∇p + ∇ · τ + ρg", 
    pos: "bottom-[18%] left-[5%]", size: "text-xl sm:text-2xl", rot: "rotate-[-5deg]" 
  },
  { 
    text: "H(X) = −∑ P(x) log₂ P(x)", 
    pos: "top-[30%] left-[8%]", size: "text-lg sm:text-xl", rot: "rotate-[-2deg]" 
  },
  { 
    text: "f(x) = (1/σ√2π) e^[−½((x−μ)/σ)²]", 
    pos: "bottom-[35%] right-[8%]", size: "text-lg sm:text-xl", rot: "rotate-[-4deg]" 
  },
  { 
    text: "∂L/∂q − (d/dt)(∂L/∂q̇) = 0\nL = T − V", 
    pos: "top-[42%] right-[10%]", size: "text-lg sm:text-xl", rot: "rotate-[5deg]" 
  },
  { 
    text: "f(x) = ∑ [fⁿ(a)/n!] (x − a)ⁿ\neˣ = 1 + x + x²/2! + x³/3! + ...", 
    pos: "bottom-[25%] left-[12%]", size: "text-lg sm:text-xl", rot: "rotate-[7deg]" 
  },
  { 
    text: "P(A|B) = [P(B|A) P(A)] / P(B)", 
    pos: "top-[50%] left-[3%]", size: "text-lg sm:text-xl", rot: "rotate-[2deg]" 
  },
  { 
    text: "dS = δQ / T\nΔS_universe ≥ 0", 
    pos: "bottom-[10%] left-[28%]", size: "text-lg sm:text-xl", rot: "rotate-[-3deg]" 
  },
  { 
    text: "A v = λ v\ndet(A − λI) = 0", 
    pos: "top-[80%] left-[45%]", size: "text-lg sm:text-xl", rot: "rotate-[4deg]" 
  },
  { 
    text: "e^(iπ) + 1 = 0", 
    pos: "bottom-[52%] right-[12%]", size: "text-2xl sm:text-3xl", rot: "rotate-[8deg]" 
  }
];

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function LandingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const handleStartLearning = () => {
    if (!file) return;
    setIsUploading(true);
    setTimeout(() => {
      toast.success("Extraction started!", { id: "extract-toast", description: "Your problem set is being processed." });
      setIsUploading(false);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">

      {/* Background: humanistic formula layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        {BACKGROUND_FORMULAS.map(({ text, pos, size, rot }, i) => (
          <div key={i} className={`absolute ${pos} ${rot}`}>
            <span
              className={`block font-serif italic text-foreground ${size}
                          opacity-[0.25] dark:opacity-[0.12] whitespace-pre-wrap leading-tight`}
            >
              {text}
            </span>
          </div>
        ))}
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-20">
        <div className="flex items-center gap-2.5 text-foreground">
          <EnVisionMark className="w-7 h-7 text-primary-500" />
          <span className="text-[1.1rem] font-bold font-serif tracking-tight">EnVision</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center text-center mt-12">

        {/* Hero Heading */}
        <h1 className="text-5xl md:text-[4.5rem] font-serif tracking-tight mb-4 leading-[1.12] text-foreground">
          Clarity in every
          <br className="hidden md:block" />
          <span className="text-primary-500"> problem set.</span>
        </h1>

        {/* Editorial subtitle with Typewriter */}
        <div className="sr-only">
          Deconstruct complex Physics problems, Visualize Organic Chemistry mechanisms, Map out Calculus derivations, Understand Data Structures & Algorithms, Decode advanced Circuit Analysis
        </div>
        <div aria-hidden="true" className="text-lg md:text-xl font-serif text-foreground/60 mb-8 italic h-7 max-w-lg">
          <Typewriter
            options={{
              strings: [
                "Deconstruct complex Physics problems...", 
                "Visualize Organic Chemistry mechanisms...", 
                "Map out Calculus derivations...", 
                "Understand Data Structures & Algorithms...", 
                "Decode advanced Circuit Analysis..."
              ],
              autoStart: true, loop: true, delay: 50, deleteSpeed: 25,
            }}
          />
        </div>

        {/* ── Upload Zone (redesigned) ─────────────────────────────── */}
        <div className="w-full max-w-xl mx-auto">
          {!file ? (
            /* Empty state — drop zone */
            <div
              {...getRootProps()}
              className={`
                animate-fade-in-up
                group relative cursor-pointer rounded-2xl transition-all duration-300
                border
                flex flex-col items-center justify-center gap-5 px-8 py-12
                ${isDragActive
                  ? "border-primary-500 bg-primary-500/5 shadow-sm scale-[1.01]"
                  : "border-border bg-card/60 dark:bg-card/40 backdrop-blur-sm hover:bg-foreground/[0.02] dark:hover:bg-foreground/[0.03] shadow-sm hover:shadow"
                }
              `}
            >
              <input {...getInputProps()} />

              {/* Icon */}
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${isDragActive
                  ? "bg-primary-500/15 text-primary-500"
                  : "bg-foreground/5 dark:bg-foreground/8 text-foreground/30 group-hover:bg-primary-500/10 group-hover:text-primary-500"
                }
              `}>
                <UploadCloud className="w-7 h-7" strokeWidth={1.5} />
              </div>

              {/* Text */}
              <div className="flex flex-col items-center gap-1.5">
                <p className={`font-serif italic text-xl transition-colors duration-200 ${isDragActive ? "text-primary-500" : "text-foreground/70"}`}>
                  {isDragActive ? "Release to drop…" : "Drop your worksheet here"}
                </p>
                <p className="text-sm text-foreground/35 font-sans">
                  PDF, PNG, JPG or WEBP accepted
                </p>
              </div>

              {/* Action buttons */}
              {!isDragActive && (
                <div className="flex items-center gap-3">
                  <button
                    id="camera-btn"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                               border border-border bg-card hover:border-primary-500/40
                               text-foreground/70 hover:text-foreground hover:text-primary-500
                               transition-all duration-300 shadow-sm hover:shadow-md
                               hover:-translate-y-0.5 active:translate-y-0"
                    aria-label="Take a photo with camera"
                  >
                    <Camera className="w-4 h-4 transition-transform group-hover:scale-110 duration-300" />
                    Take photo
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* File selected state */
            <div className="
              animate-fade-in-up
              rounded-2xl border border-border bg-card/80 dark:bg-card/60 backdrop-blur-sm
              shadow-sm hover:shadow transition-shadow
              p-6 flex flex-col gap-5
            ">
              {/* File info row */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-foreground truncate text-sm">{file.name}</p>
                  <p className="text-xs text-foreground/40 mt-0.5">{formatFileSize(file.size)} · Ready to process</p>
                </div>
                <button
                  id="clear-file-btn"
                  onClick={() => setFile(null)}
                  disabled={isUploading}
                  className="p-2 rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40 shrink-0"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar placeholder (visual polish) */}
              <div className="w-full h-px bg-border" />

              {/* Action row */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/35 font-serif italic">
                  Ready to extract problems
                </p>
                <button
                  id="start-learning-btn"
                  onClick={handleStartLearning}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium
                             bg-primary-500 text-white hover:bg-primary-600
                             transition-colors disabled:opacity-50"
                >
                  {isUploading ? "Starting…" : "Start Learning"}
                  {!isUploading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* ─────────────────────────────────────────────────────────── */}

      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-5 pointer-events-none">
        <div className="w-24 h-px bg-border mb-4" />
        <span className="text-[0.65rem] font-medium tracking-[0.2em] text-foreground/25 uppercase">Made with Next.js</span>
      </footer>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(capturedFile) => { setFile(capturedFile); setIsCameraOpen(false); }}
      />
    </div>
  );
}
