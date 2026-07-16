"use client";

import { Pen, MousePointer2, Trash2, X, Undo2, Redo2, Square, Circle, Minus, Hand, Grid, Upload } from "lucide-react";
import { useState, useRef } from "react";

export type DrawingMode = "draw" | "select" | "pan" | "rect" | "circle" | "line";
export type BrushColor = "#C05621" | "#1A1510" | "#2B6CB0" | "#D69E2E" | "#38A169" | "#805AD5" | "#E53E3E";
export type BrushSize = 1 | 2 | 4 | 8 | 12 | 16;

interface ToolbarProps {
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;
  color: BrushColor;
  setColor: (color: BrushColor) => void;
  size: BrushSize;
  setSize: (size: BrushSize) => void;
  onClear: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  onUploadFile?: (file: File) => void;
}

export function Toolbar({ mode, setMode, color, setColor, size, setSize, onClear, onDeleteSelected, hasSelection, canUndo, canRedo, onUndo, onRedo, showGrid, setShowGrid, onUploadFile }: ToolbarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap justify-center items-center gap-1.5 p-1.5 w-[95%] md:w-max max-w-2xl rounded-2xl bg-card/80 backdrop-blur-md border border-border shadow-sm">
      <button
        onClick={() => setMode("select")}
        className={`p-2 rounded-xl transition-colors ${mode === "select" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Select & Move (V)"
      >
        <MousePointer2 className="w-4 h-4" />
      </button>

      <button
        onClick={() => setMode("pan")}
        className={`p-2 rounded-xl transition-colors ${mode === "pan" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Pan Canvas (H or Spacebar)"
      >
        <Hand className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => setMode("draw")}
        className={`p-2 rounded-xl transition-colors ${mode === "draw" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Pen (P)"
      >
        <Pen className="w-4 h-4" />
      </button>

      <button
        onClick={() => setMode("rect")}
        className={`p-2 rounded-xl transition-colors ${mode === "rect" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Rectangle (R)"
      >
        <Square className="w-4 h-4" />
      </button>

      <button
        onClick={() => setMode("circle")}
        className={`p-2 rounded-xl transition-colors ${mode === "circle" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Circle (C)"
      >
        <Circle className="w-4 h-4" />
      </button>

      <button
        onClick={() => setMode("line")}
        className={`p-2 rounded-xl transition-colors ${mode === "line" ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Line (L)"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Colors */}
      <div className="flex items-center gap-1.5 px-2">
        {(["#C05621", "#1A1510", "#2B6CB0", "#D69E2E", "#38A169", "#805AD5", "#E53E3E"] as BrushColor[]).map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setMode("draw");
            }}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && mode === "draw" ? "scale-110 border-foreground/30 shadow-sm" : "border-transparent hover:scale-110"}`}
            style={{ backgroundColor: c }}
            title="Set Color"
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Brush Size */}
      <div className="flex items-center gap-0.5 px-1">
        {[1, 2, 4, 8, 12, 16].map((s) => (
          <button
            key={s}
            onClick={() => {
              setSize(s as BrushSize);
              setMode("draw");
            }}
            className={`flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:bg-foreground/5 ${size === s && mode === "draw" ? "bg-foreground/10" : ""}`}
            title={`Size: ${s}px`}
          >
            <div 
              className="rounded-full bg-foreground/70" 
              style={{ width: s + 2, height: s + 2 }}
            />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />
      
      <button
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        className="p-2 rounded-xl transition-colors text-red-500/80 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
        title="Delete Selected Stroke"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 rounded-xl transition-colors text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 rounded-xl transition-colors text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-2 rounded-xl transition-colors ${showGrid ? "bg-primary-500/10 text-primary-500" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}
        title="Toggle Grid"
      >
        <Grid className="w-4 h-4" />
      </button>

      {onUploadFile && (
        <>
          <div className="w-px h-6 bg-border mx-1" />
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl transition-colors text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
            title="Upload Image or PDF"
          >
            <Upload className="w-4 h-4" />
          </button>
        </>
      )}

      <div className="w-px h-6 bg-border mx-1" />

      <div className="relative">
        <button
          onClick={() => setShowClearConfirm(!showClearConfirm)}
          className="p-2 rounded-xl transition-colors text-foreground/50 hover:bg-red-500/10 hover:text-red-500"
          title="Clear Entire Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {showClearConfirm && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-card border border-border rounded-xl shadow-lg flex flex-col gap-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-100">
            <p className="text-sm font-medium text-foreground text-center">Clear canvas?</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 hover:bg-foreground/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onClear();
                  setShowClearConfirm(false);
                }}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
