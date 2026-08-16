'use client'

import {
  Pen,
  MousePointer2,
  Trash2,
  X,
  Undo2,
  Redo2,
  Square,
  Circle,
  Minus,
  Hand,
  Grid,
  Upload,
  Eraser,
  Type,
  Download,
  Wand2,
  ChevronDown,
} from 'lucide-react'
import { useState, useRef } from 'react'

export type DrawingMode = 'draw' | 'select' | 'pan' | 'rect' | 'circle' | 'line' | 'text' | 'erase'
export type BrushColor =
  '#C05621' | '#1A1510' | '#2B6CB0' | '#D69E2E' | '#38A169' | '#805AD5' | '#E53E3E'
export type BrushSize = 1 | 2 | 4 | 8 | 12 | 16

interface ToolbarProps {
  mode: DrawingMode
  setMode: (mode: DrawingMode) => void
  color: BrushColor
  setColor: (color: BrushColor) => void
  size: BrushSize
  setSize: (size: BrushSize) => void
  onClear: () => void
  onDeleteSelected: () => void
  hasSelection: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  showGrid: boolean
  setShowGrid: (show: boolean) => void
  onUploadFile?: (file: File) => void
  onDownloadImage?: () => void
  onBeautify?: () => void
}

export function Toolbar({
  mode,
  setMode,
  color,
  setColor,
  size,
  setSize,
  onClear,
  onDeleteSelected,
  hasSelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showGrid,
  setShowGrid,
  onUploadFile,
  onDownloadImage,
  onBeautify,
}: ToolbarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUploadFile) {
      onUploadFile(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setIsMobileExpanded(false)
  }

  const handleSetMode = (newMode: DrawingMode) => {
    setMode(newMode)
    setIsMobileExpanded(false)
  }

  const handleSetColor = (c: BrushColor) => {
    setColor(c)
    setMode('draw')
    setIsMobileExpanded(false)
  }

  const handleSetSize = (s: BrushSize) => {
    setSize(s)
    setMode('draw')
    setIsMobileExpanded(false)
  }

  const ActiveModeIcon =
    {
      select: MousePointer2,
      pan: Hand,
      draw: Pen,
      erase: Eraser,
      text: Type,
      rect: Square,
      circle: Circle,
      line: Minus,
    }[mode] || Pen

  return (
    <>
      {/* Compact Mobile Toolbar */}
      <div
        className={`bg-card/80 border-border absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border p-1.5 shadow-sm backdrop-blur-md transition-all duration-300 sm:hidden ${isMobileExpanded ? 'pointer-events-none translate-y-8 scale-95 opacity-0' : 'pointer-events-auto translate-y-0 scale-100 opacity-100'}`}
      >
        <button
          onClick={() => setIsMobileExpanded(true)}
          className="bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 flex items-center justify-center rounded-xl p-2 transition-colors"
          title="Open Tools"
        >
          <ActiveModeIcon className="h-5 w-5" />
        </button>

        <div className="bg-border mx-1 h-6 w-px" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo"
        >
          <Undo2 className="h-5 w-5" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo"
        >
          <Redo2 className="h-5 w-5" />
        </button>

        {hasSelection && (
          <>
            <div className="bg-border mx-1 h-6 w-px" />
            <button
              onClick={onDeleteSelected}
              className="rounded-xl p-2 text-red-500/80 transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete Selected"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Full Expanded Toolbar */}
      <div
        className={`bg-card/80 border-border absolute bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-lg backdrop-blur-md transition-all duration-300 sm:top-4 sm:bottom-auto sm:max-w-2xl ${isMobileExpanded ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-8 scale-95 opacity-0 sm:pointer-events-auto sm:translate-y-0 sm:scale-100 sm:opacity-100'}`}
      >
        <div className="mb-1 flex w-full items-center justify-between px-1 sm:hidden">
          <span className="text-foreground/50 text-xs font-medium tracking-wider uppercase">
            Tools
          </span>
          <button
            onClick={() => setIsMobileExpanded(false)}
            className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-1 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        {isMobileExpanded && <div className="bg-border mb-1 h-px w-full sm:hidden" />}

        <button
          onClick={() => handleSetMode('select')}
          className={`rounded-xl p-2 transition-colors ${mode === 'select' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Select & Move (V)"
        >
          <MousePointer2 className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('pan')}
          className={`rounded-xl p-2 transition-colors ${mode === 'pan' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Pan Canvas (H or Spacebar)"
        >
          <Hand className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('draw')}
          className={`rounded-xl p-2 transition-colors ${mode === 'draw' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Pen (P)"
        >
          <Pen className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('erase')}
          className={`rounded-xl p-2 transition-colors ${mode === 'erase' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Object Eraser (E)"
        >
          <Eraser className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('text')}
          className={`rounded-xl p-2 transition-colors ${mode === 'text' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Text (T)"
        >
          <Type className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('rect')}
          className={`rounded-xl p-2 transition-colors ${mode === 'rect' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Rectangle (R)"
        >
          <Square className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('circle')}
          className={`rounded-xl p-2 transition-colors ${mode === 'circle' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Circle (C)"
        >
          <Circle className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('line')}
          className={`rounded-xl p-2 transition-colors ${mode === 'line' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Line (L)"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="bg-border mx-1 h-6 w-px" />

        {/* Colors */}
        <div className="flex items-center gap-1.5 px-2">
          {(
            [
              '#C05621',
              '#1A1510',
              '#2B6CB0',
              '#D69E2E',
              '#38A169',
              '#805AD5',
              '#E53E3E',
            ] as BrushColor[]
          ).map((c) => (
            <button
              key={c}
              onClick={() => handleSetColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c && mode === 'draw' ? 'border-foreground/30 scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
              style={{ backgroundColor: c }}
              title="Set Color"
            />
          ))}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        {/* Brush Size */}
        <div className="flex items-center gap-0.5 px-1">
          {[1, 2, 4, 8, 12, 16].map((s) => (
            <button
              key={s}
              onClick={() => handleSetSize(s as BrushSize)}
              className={`hover:bg-foreground/5 flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${size === s && mode === 'draw' ? 'bg-foreground/10' : ''}`}
              title={`Size: ${s}px`}
            >
              <div
                className="bg-foreground/70 rounded-full"
                style={{ width: s + 2, height: s + 2 }}
              />
            </button>
          ))}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        <button
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          className="rounded-xl p-2 text-red-500/80 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Delete Selected Stroke"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-border mx-1 hidden h-6 w-px sm:block" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground hidden rounded-xl p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent sm:flex"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground hidden rounded-xl p-2 transition-colors disabled:opacity-30 disabled:hover:bg-transparent sm:flex"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="bg-border mx-1 h-6 w-px" />

        <button
          onClick={() => {
            setShowGrid(!showGrid)
            setIsMobileExpanded(false)
          }}
          className={`rounded-xl p-2 transition-colors ${showGrid ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Toggle Grid"
        >
          <Grid className="h-4 w-4" />
        </button>

        {onUploadFile && (
          <>
            <div className="bg-border mx-1 h-6 w-px" />
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-2 transition-colors"
              title="Upload Image or PDF"
            >
              <Upload className="h-4 w-4" />
            </button>
          </>
        )}

        {onBeautify && (
          <button
            onClick={() => {
              onBeautify()
              setIsMobileExpanded(false)
            }}
            disabled={!hasSelection}
            className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-2 transition-colors disabled:opacity-30"
            title="Beautify Selection (Snap to shapes)"
          >
            <Wand2 className="h-4 w-4" />
          </button>
        )}

        {onDownloadImage && (
          <button
            onClick={() => {
              onDownloadImage()
              setIsMobileExpanded(false)
            }}
            className="text-foreground/60 hover:bg-foreground/5 hover:text-foreground rounded-xl p-2 transition-colors"
            title="Save as Image"
          >
            <Download className="h-4 w-4" />
          </button>
        )}

        <div className="bg-border mx-1 h-6 w-px" />

        <div className="relative">
          <button
            onClick={() => setShowClearConfirm(!showClearConfirm)}
            className="text-foreground/50 rounded-xl p-2 transition-colors hover:bg-red-500/10 hover:text-red-500"
            title="Clear Entire Canvas"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {showClearConfirm && (
            <div className="bg-card border-border min-w-160px animate-in fade-in zoom-in-95 absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col gap-2 rounded-xl border p-3 shadow-lg duration-100 sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0">
              <p className="text-foreground text-center text-sm font-medium">Clear canvas?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="bg-foreground/5 hover:bg-foreground/10 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClear()
                    setShowClearConfirm(false)
                    setIsMobileExpanded(false)
                  }}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
