'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RotateCcw, X } from 'lucide-react'
import {
  preparePlot,
  prepareSlope,
  sampleCurve,
  firstExpression,
  type PreparedPlot,
} from '@/lib/graph/plot'

const COLORS = ['#0d9488', '#7c3aed', '#ea580c', '#2563eb']

type Row = { id: string; text: string; color: string }
type View = { xMin: number; xMax: number; yMin: number; yMax: number }

const HOME: View = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }

function niceStep(span: number): number {
  const rough = span / 8
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  if (normalized < 1.5) return magnitude
  if (normalized < 3.5) return 2 * magnitude
  if (normalized < 7.5) return 5 * magnitude
  return 10 * magnitude
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View,
  dark: boolean,
) {
  ctx.clearRect(0, 0, width, height)
  const toX = (x: number) => ((x - view.xMin) / (view.xMax - view.xMin)) * width
  const toY = (y: number) => ((view.yMax - y) / (view.yMax - view.yMin)) * height
  const xStep = niceStep(view.xMax - view.xMin)
  const yStep = niceStep(view.yMax - view.yMin)
  ctx.lineWidth = 1
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  ctx.font = '11px sans-serif'
  ctx.beginPath()
  for (let x = Math.ceil(view.xMin / xStep) * xStep; x <= view.xMax; x += xStep) {
    const sx = Math.round(toX(x)) + 0.5
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (let y = Math.ceil(view.yMin / yStep) * yStep; y <= view.yMax; y += yStep) {
    const sy = Math.round(toY(y)) + 0.5
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  if (view.yMin < 0 && view.yMax > 0) {
    const axis = Math.round(toY(0)) + 0.5
    ctx.moveTo(0, axis)
    ctx.lineTo(width, axis)
  }
  if (view.xMin < 0 && view.xMax > 0) {
    const axis = Math.round(toX(0)) + 0.5
    ctx.moveTo(axis, 0)
    ctx.lineTo(axis, height)
  }
  ctx.stroke()
  return { toX, toY }
}

export function EquationGraph({ initial, onClose }: { initial: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rows, setRows] = useState<Row[]>([{ id: 'a', text: initial, color: COLORS[0] }])
  const [sliders, setSliders] = useState<Record<string, number>>({})
  const [view, setView] = useState<View>(HOME)
  const [hover, setHover] = useState<string>('')
  const drag = useRef<{ x: number; y: number; view: View } | null>(null)

  const prepared = useMemo(() => {
    return rows.map((row) => {
      const slope = prepareSlope(row.text)
      if (slope)
        return { row, plot: null as PreparedPlot | null, slope, error: null as string | null }
      try {
        return { row, plot: preparePlot(row.text), slope: null, error: null as string | null }
      } catch (err) {
        return {
          row,
          plot: null,
          slope: null,
          error: err instanceof Error ? err.message : 'Cannot graph that',
        }
      }
    })
  }, [rows])

  const sliderNames = [
    ...new Set(prepared.flatMap((item) => item.plot?.sliders ?? item.slope?.sliders ?? [])),
  ].sort()
  const axisName = prepared.find((item) => item.plot)?.plot?.axis ?? 'x'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * ratio
    canvas.height = canvas.clientHeight * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const dark = document.documentElement.classList.contains('dark')
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const { toX, toY } = drawGrid(ctx, width, height, view, dark)
    for (const item of prepared) {
      if (item.slope) {
        const values = Object.fromEntries(
          item.slope.sliders.map((name) => [name, sliders[name] ?? 1]),
        )
        ctx.strokeStyle = item.row.color
        ctx.lineWidth = 1.5
        const columns = 14
        const gridRows = 10
        for (let col = 0; col < columns; col += 1) {
          for (let gridRow = 0; gridRow < gridRows; gridRow += 1) {
            const x = view.xMin + ((col + 0.5) / columns) * (view.xMax - view.xMin)
            const y = view.yMin + ((gridRow + 0.5) / gridRows) * (view.yMax - view.yMin)
            let slope: number
            try {
              slope = item.slope.at(x, y, values)
            } catch {
              continue
            }
            if (!Number.isFinite(slope)) continue
            const angle = Math.atan(slope)
            const length = 10
            const cx = toX(x)
            const cy = toY(y)
            ctx.beginPath()
            ctx.moveTo(cx - (Math.cos(angle) * length) / 2, cy + (Math.sin(angle) * length) / 2)
            ctx.lineTo(cx + (Math.cos(angle) * length) / 2, cy - (Math.sin(angle) * length) / 2)
            ctx.stroke()
          }
        }
        continue
      }
      if (!item.plot) continue
      const points = sampleCurve(
        item.plot,
        Object.fromEntries(item.plot.sliders.map((name) => [name, sliders[name] ?? 1])),
        view.xMin,
        view.xMax,
        Math.round(width),
      )
      ctx.strokeStyle = item.row.color
      ctx.lineWidth = 2
      ctx.beginPath()
      let drawing = false
      for (const point of points) {
        if (!point) {
          drawing = false
          continue
        }
        const [x, y] = point
        if (y < view.yMin - (view.yMax - view.yMin) || y > view.yMax + (view.yMax - view.yMin)) {
          drawing = false
          continue
        }
        if (!drawing) {
          ctx.moveTo(toX(x), toY(y))
          drawing = true
        } else ctx.lineTo(toX(x), toY(y))
      }
      ctx.stroke()
    }
  }, [prepared, sliders, view])

  const location = useCallback(
    (clientX: number, clientY: number, bounds: DOMRect) => {
      const px = clientX - bounds.left
      const py = clientY - bounds.top
      const x = view.xMin + (px / bounds.width) * (view.xMax - view.xMin)
      const y = view.yMax - (py / bounds.height) * (view.yMax - view.yMin)
      return { x, y }
    },
    [view],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = canvas.getBoundingClientRect()
      const { x, y } = location(event.clientX, event.clientY, bounds)
      const factor = event.deltaY > 0 ? 1.12 : 0.88
      setView((current) => ({
        xMin: x - (x - current.xMin) * factor,
        xMax: x + (current.xMax - x) * factor,
        yMin: y - (y - current.yMin) * factor,
        yMax: y + (current.yMax - y) * factor,
      }))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [location])

  return (
    <section
      className="border-border bg-card absolute bottom-4 left-4 z-30 flex w-[min(100%-2rem,560px)] flex-col gap-3 rounded-2xl border p-3 shadow-lg"
      aria-label="Graph"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-sm font-medium">Graph</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Reset view"
            className="rounded p-1"
            onClick={() => setView(HOME)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Close graph" className="rounded p-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {rows.map((row, index) => {
        const error = prepared[index]?.error
        return (
          <label key={row.id} className="flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
              Expression {index + 1}
            </span>
            <input
              value={row.text}
              aria-label={`Expression ${index + 1}`}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.id === row.id ? { ...item, text: event.target.value } : item,
                  ),
                )
              }
              className="border-border bg-background rounded-lg border px-2 py-1.5 text-sm"
            />
            {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : null}
          </label>
        )
      })}
      <button
        type="button"
        className="text-foreground/70 flex items-center gap-1 text-xs"
        onClick={() =>
          setRows((current) => [
            ...current,
            { id: `${Date.now()}`, text: '', color: COLORS[current.length % COLORS.length] },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add expression
      </button>
      {sliderNames.map((name) => (
        <label key={name} className="flex items-center gap-2 text-xs">
          <span className="w-4">{name}</span>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={sliders[name] ?? 1}
            aria-label={`Value of ${name}`}
            onChange={(event) =>
              setSliders((current) => ({ ...current, [name]: Number(event.target.value) }))
            }
            className="flex-1"
          />
          <span className="w-10 text-right">{(sliders[name] ?? 1).toFixed(1)}</span>
        </label>
      ))}
      <canvas
        ref={canvasRef}
        className="border-border h-72 w-full touch-none rounded-xl border"
        role="img"
        aria-label={`Curves plotted against ${axisName}. Drag to pan, scroll to zoom.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, view }
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const { x, y } = location(event.clientX, event.clientY, bounds)
          setHover(`${axisName} = ${x.toFixed(2)}, y = ${y.toFixed(2)}`)
          const active = drag.current
          if (!active) return
          const dx =
            ((event.clientX - active.x) / bounds.width) * (active.view.xMax - active.view.xMin)
          const dy =
            ((event.clientY - active.y) / bounds.height) * (active.view.yMax - active.view.yMin)
          setView({
            xMin: active.view.xMin - dx,
            xMax: active.view.xMax - dx,
            yMin: active.view.yMin + dy,
            yMax: active.view.yMax + dy,
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      />
      <p className="text-foreground/50 text-[11px]">
        {hover || `Drag to move, scroll to zoom. Horizontal axis is ${axisName}.`}
      </p>
    </section>
  )
}

export function firstPlottable(text: string | null | undefined): string {
  return firstExpression(text)
}
