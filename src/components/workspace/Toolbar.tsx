'use client'

import {
  Pen,
  Highlighter,
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

export type DrawingMode =
  'draw' | 'highlighter' | 'select' | 'pan' | 'rect' | 'circle' | 'line' | 'text' | 'erase'
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
  const [inkOpen, setInkOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
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
    setShapesOpen(false)
    setInkOpen(false)
    setIsMobileExpanded(false)
  }

  const handleSetColor = (c: BrushColor) => {
    setColor(c)
  }

  const handleSetSize = (s: BrushSize) => {
    setSize(s)
  }

  const ActiveModeIcon =
    {
      select: MousePointer2,
      pan: Hand,
      draw: Pen,
      highlighter: Highlighter,
      erase: Eraser,
      text: Type,
      rect: Square,
      circle: Circle,
      line: Minus,
    }[mode] || Pen

  return (
    <>
      <div
        className={`bg-card border-border absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border p-1.5 shadow-sm transition-all duration-300 sm:hidden ${isMobileExpanded ? 'pointer-events-none translate-y-8 scale-95 opacity-0' : 'pointer-events-auto translate-y-0 scale-100 opacity-100'}`}
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

      <div
        className={`bg-card border-border absolute bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-sm transition-all duration-300 sm:top-4 sm:bottom-auto sm:max-w-2xl ${isMobileExpanded ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-8 scale-95 opacity-0 sm:pointer-events-auto sm:translate-y-0 sm:scale-100 sm:opacity-100'}`}
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
          title="Select and edit (V). Drag a line. Double-click to change the words."
        >
          <MousePointer2 className="h-4 w-4" />
        </button>

        <button
          onClick={() => handleSetMode('pan')}
          className={`rounded-xl p-2 transition-colors ${mode === 'pan' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Move the page (hold the wheel, or Shift and scroll)"
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
          onClick={() => handleSetMode('highlighter')}
          className={`rounded-xl p-2 transition-colors ${mode === 'highlighter' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
          title="Highlighter (H)"
        >
          <Highlighter className="h-4 w-4" />
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
          title="Text (T). Click existing writing to edit it."
        >
          <Type className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setShapesOpen((open) => !open)
              setInkOpen(false)
            }}
            aria-expanded={shapesOpen}
            className={`rounded-xl p-2 transition-colors ${mode === 'rect' || mode === 'circle' || mode === 'line' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}
            title="Shapes"
          >
            {mode === 'circle' ? (
              <Circle className="h-4 w-4" />
            ) : mode === 'line' ? (
              <Minus className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          {shapesOpen && (
            <div className="bg-card border-border absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-xl border p-1.5 shadow-sm sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0">
              <button
                onClick={() => handleSetMode('rect')}
                className={`rounded-lg p-2 ${mode === 'rect' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5'}`}
                title="Rectangle (R)"
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSetMode('circle')}
                className={`rounded-lg p-2 ${mode === 'circle' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5'}`}
                title="Circle (C)"
              >
                <Circle className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSetMode('line')}
                className={`rounded-lg p-2 ${mode === 'line' ? 'bg-primary-500/10 text-primary-500' : 'text-foreground/60 hover:bg-foreground/5'}`}
                title="Line (L)"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        <div className="relative">
          <button
            onClick={() => {
              setInkOpen((open) => !open)
              setShapesOpen(false)
            }}
            aria-expanded={inkOpen}
            aria-label="Ink"
            className={`border-border h-6 w-6 rounded-full border-2 ${inkOpen ? 'border-foreground/40' : ''}`}
            style={{ backgroundColor: color }}
            title="Ink color and width"
          />
          {inkOpen && (
            <div className="bg-card border-border absolute bottom-full left-1/2 mb-2 flex w-max -translate-x-1/2 flex-col gap-2 rounded-xl border p-3 shadow-sm sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0">
              <div className="flex items-center gap-1.5">
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
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-foreground/40' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    title="Set color"
                  />
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                {([1, 2, 4, 8, 12, 16] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSetSize(s)}
                    className={`hover:bg-foreground/5 flex h-6 w-6 items-center justify-center rounded-lg ${size === s ? 'bg-foreground/15' : ''}`}
                    title={`Width: ${s}px`}
                  >
                    <div
                      className="bg-foreground/70 rounded-full"
                      style={{ width: Math.min(s + 2, 14), height: Math.min(s + 2, 14) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
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
