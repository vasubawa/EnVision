'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useTheme } from 'next-themes'
import * as fabric from 'fabric'
import * as pdfjsLib from 'pdfjs-dist'
import { Toolbar, DrawingMode, BrushColor, BrushSize } from './Toolbar'

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

export function Whiteboard() {
  const { file, setGetCanvasImage, setLastCanvasUpdate } = useWorkspaceStore()
  const { resolvedTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  const [mode, setMode] = useState<DrawingMode>('draw')
  const [color, setColor] = useState<BrushColor>('#C05621')
  const [size, setSize] = useState<BrushSize>(4)
  const [hasSelection, setHasSelection] = useState(false)
  const [showGrid, setShowGrid] = useState(true)

  // Undo/Redo State
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isHistoryUpdate = useRef(false)
  const historyIndexRef = useRef(-1)

  // Expose undo/redo to Toolbar
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const saveHistory = useCallback(() => {
    if (isHistoryUpdate.current || !fabricRef.current) return
    const json = JSON.stringify(fabricRef.current.toJSON())
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndexRef.current + 1)
      newHistory.push(json)
      const newIdx = newHistory.length - 1
      setHistoryIndex(newIdx)
      historyIndexRef.current = newIdx

      // Don't trigger auto-analysis on the initial blank state
      // Defer out of the React state updater to avoid "setState during render" warning
      // (Zustand notifies TutorChat subscribers, which can't happen mid-reconciliation)
      if (newIdx > 0) {
        queueMicrotask(() => setLastCanvasUpdate(Date.now()))
      }
      return newHistory
    })
  }, [setLastCanvasUpdate])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && fabricRef.current) {
      isHistoryUpdate.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      historyIndexRef.current = newIndex
      fabricRef.current.loadFromJSON(history[newIndex]).then(() => {
        fabricRef.current?.renderAll()
        isHistoryUpdate.current = false
      })
    }
  }, [history, historyIndex])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && fabricRef.current) {
      isHistoryUpdate.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      historyIndexRef.current = newIndex
      fabricRef.current.loadFromJSON(history[newIndex]).then(() => {
        fabricRef.current?.renderAll()
        isHistoryUpdate.current = false
      })
    }
  }, [history, historyIndex])

  const handleAddFile = useCallback(
    (fileToLoad: File) => {
      if (!fileToLoad || !fabricRef.current) return

      if (fileToLoad.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          fabric.FabricImage.fromURL(dataUrl)
            .then((img) => {
              if (!fabricRef.current) return
              const canvas = fabricRef.current
              const scale = Math.min(
                (canvas.width! * 0.8) / img.width!,
                (canvas.height! * 0.8) / img.height!,
              )

              img.scale(scale)
              canvas.centerObject(img)

              // Make image a movable object instead of static background
              canvas.add(img)
              // Don't send to back if it's manually added via toolbar so it doesn't hide behind existing things
              saveHistory()
            })
            // eslint-disable-next-line no-console
            .catch(console.error)
        }
        reader.readAsDataURL(fileToLoad)
      } else if (fileToLoad.type === 'application/pdf') {
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const typedarray = new Uint8Array(reader.result as ArrayBuffer)
            const pdf = await pdfjsLib.getDocument({
              data: typedarray,
            }).promise
            const page = await pdf.getPage(1)

            // Render PDF to a hidden canvas
            const viewport = page.getViewport({ scale: 2.0 }) // High res
            const pdfCanvas = document.createElement('canvas')
            const context = pdfCanvas.getContext('2d')
            if (!context) return
            pdfCanvas.height = viewport.height
            pdfCanvas.width = viewport.width

            await page.render({
              canvasContext: context,
              canvas: pdfCanvas,
              viewport: viewport,
            }).promise

            // Convert to Fabric image
            const dataUrl = pdfCanvas.toDataURL('image/png')
            const img = await fabric.FabricImage.fromURL(dataUrl)

            if (!fabricRef.current) return
            const canvas = fabricRef.current
            const scale = Math.min(
              (canvas.width! * 0.8) / img.width!,
              (canvas.height! * 0.8) / img.height!,
            )

            img.scale(scale)
            canvas.centerObject(img)
            canvas.add(img)
            saveHistory()
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Error loading PDF', err)
          }
        }
        reader.readAsArrayBuffer(fileToLoad)
      }
    },
    [saveHistory],
  )

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    // Initialize Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      selection: false,
    })
    fabricRef.current = canvas

    // Register getCanvasImage
    setGetCanvasImage(() => {
      if (!fabricRef.current) return null
      return fabricRef.current.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1,
      })
    })

    // Set up drawing brush
    const brush = new fabric.PencilBrush(canvas)
    brush.color = color
    brush.width = size
    canvas.freeDrawingBrush = brush

    // Initialize blank state for history
    saveHistory()

    // Load file (Image or PDF)
    if (file) {
      handleAddFile(file)
      // For initial file, we want it to be at the back
      setTimeout(() => {
        if (fabricRef.current) {
          const objs = fabricRef.current.getObjects()
          if (objs.length > 0) fabricRef.current.sendObjectToBack(objs[objs.length - 1])
        }
      }, 500)
    }

    // --- INFINITE DOT GRID ---
    canvas.on('after:render', function () {
      if (document.documentElement.getAttribute('data-show-grid') !== 'true') return

      const ctx = canvas.contextContainer
      const vpt = canvas.viewportTransform!
      const zoom = canvas.getZoom()

      // Dynamic grid step calculation
      let step = 30 // Base step in canvas space
      let screenStep = step * zoom

      // If zoomed out too much, increase step to avoid rendering millions of dots
      while (screenStep < 20) {
        step *= 2
        screenStep = step * zoom
      }

      // If zoomed in too much, decrease step to keep grid visible
      while (screenStep > 80) {
        step /= 2
        screenStep = step * zoom
      }

      const offsetX = vpt[4] % screenStep
      const offsetY = vpt[5] % screenStep

      ctx.save()
      ctx.beginPath()
      const isDark = document.documentElement.classList.contains('dark')
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'

      // Draw dots slightly out of bounds to ensure seamless panning
      for (let x = offsetX - screenStep; x < canvas.width! + screenStep; x += screenStep) {
        for (let y = offsetY - screenStep; y < canvas.height! + screenStep; y += screenStep) {
          ctx.moveTo(x, y)
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        }
      }
      ctx.fill()
      ctx.restore()
    })

    // --- INFINITE CANVAS PAN/ZOOM & SHAPES ---
    canvas.on('mouse:wheel', function (opt) {
      const delta = opt.e.deltaY
      let zoom = canvas.getZoom()
      zoom *= 0.999 ** delta
      if (zoom > 500) zoom = 500
      if (zoom < 0.01) zoom = 0.01
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom)
      opt.e.preventDefault()
      opt.e.stopPropagation()
    })

    let isPanning = false
    let lastPosX = 0
    let lastPosY = 0
    let initialTouchDistance = 0
    let lastTouchCenter: { x: number; y: number } | null = null

    let shapeObj: fabric.Object | null = null
    let origX = 0,
      origY = 0

    // Use a ref to access current mode inside event listeners without re-binding them
    const getMode = () => document.documentElement.getAttribute('data-draw-mode') || 'draw'
    const getColor = () => document.documentElement.getAttribute('data-draw-color') || '#C05621'
    const getSize = () => parseInt(document.documentElement.getAttribute('data-draw-size') || '4')

    canvas.on('mouse:down', function (opt) {
      const evt = opt.e as MouseEvent | TouchEvent
      const currentMode = getMode()

      const getClientX = (e: MouseEvent | TouchEvent) =>
        e instanceof TouchEvent && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as MouseEvent).clientX
      const getClientY = (e: MouseEvent | TouchEvent) =>
        e instanceof TouchEvent && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as MouseEvent).clientY

      // Object Eraser Logic
      if (currentMode === 'erase') {
        const target = opt.target
        if (target && target !== canvas.backgroundImage) {
          canvas.remove(target)
          saveHistory()
        }
        return
      }

      // Text Tool Logic
      if (currentMode === 'text') {
        const pointer = canvas.getScenePoint(evt)
        const text = new fabric.IText('Type here...', {
          left: pointer.x,
          top: pointer.y,
          fill: getColor(),
          fontSize: Math.max(24, getSize() * 6),
          fontFamily: 'var(--font-sans)',
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        text.selectAll()
        // We do not auto-switch mode to 'select' here because we don't have access to setMode inside this effect easily without adding it to dependencies (which re-binds).
        // We'll just let them keep clicking to add text, or manually switch tools.
        saveHistory()
        return
      }

      const isMiddleClick = evt instanceof MouseEvent && evt.button === 1
      const isAltKey = evt instanceof MouseEvent && evt.altKey
      const isMultiTouch = evt instanceof TouchEvent && evt.touches.length > 1

      // Multi-touch Pan/Zoom
      if (isMultiTouch && evt instanceof TouchEvent) {
        isPanning = true
        canvas.selection = false
        canvas.isDrawingMode = false // Temporarily disable drawing
        const t1 = evt.touches[0]
        const t2 = evt.touches[1]
        initialTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        lastTouchCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        }
        canvas.defaultCursor = 'grabbing'
        return
      }

      // Middle click, Alt, or 'pan' mode for panning
      if (isMiddleClick || isAltKey || currentMode === 'pan') {
        isPanning = true
        canvas.selection = false
        lastPosX = getClientX(evt)
        lastPosY = getClientY(evt)
        canvas.defaultCursor = 'grabbing'
        return
      }

      // Shapes Logic
      if (['rect', 'circle', 'line'].includes(currentMode)) {
        const pointer = canvas.getScenePoint(evt)
        origX = pointer.x
        origY = pointer.y
        const currentColor = getColor()
        const currentSize = getSize()

        if (currentMode === 'rect') {
          shapeObj = new fabric.Rect({
            left: origX,
            top: origY,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: currentColor,
            strokeWidth: currentSize,
            objectCaching: false,
          })
        } else if (currentMode === 'circle') {
          shapeObj = new fabric.Circle({
            left: origX,
            top: origY,
            radius: 0,
            fill: 'transparent',
            stroke: currentColor,
            strokeWidth: currentSize,
            objectCaching: false,
          })
        } else if (currentMode === 'line') {
          shapeObj = new fabric.Line([origX, origY, origX, origY], {
            stroke: currentColor,
            strokeWidth: currentSize,
          })
        }

        if (shapeObj) {
          canvas.add(shapeObj)
        }
      }
    })

    canvas.on('mouse:move', function (opt) {
      const evt = opt.e as MouseEvent | TouchEvent
      const getClientX = (e: MouseEvent | TouchEvent) =>
        e instanceof TouchEvent && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as MouseEvent).clientX
      const getClientY = (e: MouseEvent | TouchEvent) =>
        e instanceof TouchEvent && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as MouseEvent).clientY

      if (isPanning) {
        const vpt = canvas.viewportTransform
        if (vpt) {
          // Multi-touch Zoom/Pan
          if (evt instanceof TouchEvent && evt.touches.length > 1) {
            evt.preventDefault() // prevent scroll
            const t1 = evt.touches[0]
            const t2 = evt.touches[1]
            const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
            const currentCenter = {
              x: (t1.clientX + t2.clientX) / 2,
              y: (t1.clientY + t2.clientY) / 2,
            }

            // Pinch to Zoom
            if (initialTouchDistance > 0) {
              const scale = currentDistance / initialTouchDistance
              let zoom = canvas.getZoom() * scale
              if (zoom > 500) zoom = 500
              if (zoom < 0.01) zoom = 0.01
              canvas.zoomToPoint(new fabric.Point(currentCenter.x, currentCenter.y), zoom)
            }
            initialTouchDistance = currentDistance

            // Pan
            if (lastTouchCenter) {
              vpt[4] += currentCenter.x - lastTouchCenter.x
              vpt[5] += currentCenter.y - lastTouchCenter.y
              canvas.requestRenderAll()
            }
            lastTouchCenter = currentCenter
            return
          }

          // Single pointer/mouse pan
          const cx = getClientX(evt)
          const cy = getClientY(evt)

          if (
            cx !== undefined &&
            cy !== undefined &&
            lastPosX !== undefined &&
            lastPosY !== undefined
          ) {
            vpt[4] += cx - lastPosX
            vpt[5] += cy - lastPosY
            canvas.requestRenderAll()
          }
          lastPosX = cx
          lastPosY = cy
        }
        return
      }

      if (shapeObj) {
        const pointer = canvas.getScenePoint(evt)
        const currentMode = getMode()
        if (currentMode === 'rect') {
          shapeObj.set({
            width: Math.abs(pointer.x - origX),
            height: Math.abs(pointer.y - origY),
          })
          shapeObj.set({
            left: Math.min(pointer.x, origX),
            top: Math.min(pointer.y, origY),
          })
        } else if (currentMode === 'circle') {
          const radius = Math.max(Math.abs(pointer.x - origX), Math.abs(pointer.y - origY)) / 2
          shapeObj.set({ radius: radius })
          shapeObj.set({
            left: Math.min(pointer.x, origX),
            top: Math.min(pointer.y, origY),
          })
        } else if (currentMode === 'line') {
          ;(shapeObj as fabric.Line).set({
            x2: pointer.x,
            y2: pointer.y,
          })
        }
        canvas.requestRenderAll()
      }
    })

    const handleMouseUp = () => {
      if (isPanning) {
        canvas.setViewportTransform(canvas.viewportTransform!)
        isPanning = false
        initialTouchDistance = 0
        lastTouchCenter = null
        canvas.defaultCursor = getMode() === 'draw' ? 'crosshair' : 'default'
        if (getMode() === 'select') canvas.selection = true
        if (getMode() === 'draw') canvas.isDrawingMode = true
      }

      if (shapeObj) {
        shapeObj.setCoords()
        shapeObj = null
        saveHistory() // Save after drawing a shape
      }
    }

    canvas.on('mouse:up', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp)

    // Handle History Events (Debounced slightly by checking isHistoryUpdate)
    canvas.on('object:modified', saveHistory)
    canvas.on('path:created', saveHistory) // Fired when freehand drawing finishes

    // Selection handlers
    canvas.on('selection:created', () => setHasSelection(true))
    canvas.on('selection:updated', () => setHasSelection(true))
    canvas.on('selection:cleared', () => setHasSelection(false))

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
        canvas.renderAll()
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [file, handleAddFile, saveHistory, setGetCanvasImage, color, size])

  // Update DOM attributes so Fabric event listeners can read current state without recreating canvas
  useEffect(() => {
    document.documentElement.setAttribute('data-draw-mode', mode)
    document.documentElement.setAttribute('data-draw-color', color)
    document.documentElement.setAttribute('data-draw-size', size.toString())
    document.documentElement.setAttribute('data-show-grid', showGrid ? 'true' : 'false')

    if (!fabricRef.current) return
    const canvas = fabricRef.current

    canvas.isDrawingMode = mode === 'draw'
    canvas.selection = mode === 'select'

    if (mode === 'draw' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color
      canvas.freeDrawingBrush.width = size
    }

    if (mode === 'pan') {
      canvas.defaultCursor = 'grab'
    } else if (['rect', 'circle', 'line'].includes(mode)) {
      canvas.defaultCursor = 'crosshair'
    } else if (mode === 'erase') {
      canvas.defaultCursor =
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='red' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4L20 11L11 20'/></svg>\") 0 24, pointer"
    } else if (mode === 'text') {
      canvas.defaultCursor = 'text'
    } else {
      canvas.defaultCursor = mode === 'draw' ? 'crosshair' : 'default'
    }

    // Deselect objects when going out of select mode
    if (mode !== 'select') {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    }
  }, [mode, color, size, showGrid])

  // Re-render when theme changes to update grid color
  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.requestRenderAll()
    }
  }, [resolvedTheme])

  const handleDeleteSelected = useCallback(() => {
    if (!fabricRef.current) return
    const activeObjects = fabricRef.current.getActiveObjects()
    if (activeObjects.length) {
      fabricRef.current.discardActiveObject()
      activeObjects.forEach((obj) => fabricRef.current?.remove(obj))
      saveHistory() // Save state after delete
    }
  }, [saveHistory])

  const handleBeautify = useCallback(() => {
    if (!fabricRef.current) return
    const activeObjects = fabricRef.current.getActiveObjects()
    if (activeObjects.length === 0) return

    let changed = false
    activeObjects.forEach((obj) => {
      // Only beautify paths (hand-drawn lines)
      if (obj.type === 'path') {
        const pathObj = obj as fabric.Path
        const bounds = pathObj.getBoundingRect()
        const width = bounds.width
        const height = bounds.height

        // Skip tiny dots/noise
        if (width < 5 && height < 5) return

        changed = true

        // If it's very thin in one dimension, it's likely meant to be a straight line
        if (width < 20 || height < 20) {
          const line = new fabric.Line(
            [bounds.left, bounds.top, bounds.left + width, bounds.top + height],
            {
              stroke: pathObj.stroke,
              strokeWidth: pathObj.strokeWidth,
            },
          )
          fabricRef.current!.add(line)
          fabricRef.current!.remove(pathObj)
          return
        }

        // If aspect ratio is close to 1:1, it's likely a circle or square
        const aspectRatio = width / height
        if (aspectRatio > 0.75 && aspectRatio < 1.33) {
          const radius = Math.max(width, height) / 2
          const circle = new fabric.Circle({
            left: bounds.left,
            top: bounds.top,
            radius: radius,
            stroke: pathObj.stroke,
            strokeWidth: pathObj.strokeWidth,
            fill: 'transparent',
          })
          fabricRef.current!.add(circle)
          fabricRef.current!.remove(pathObj)
        } else {
          // Otherwise assume rectangle
          const rect = new fabric.Rect({
            left: bounds.left,
            top: bounds.top,
            width: width,
            height: height,
            stroke: pathObj.stroke,
            strokeWidth: pathObj.strokeWidth,
            fill: 'transparent',
          })
          fabricRef.current!.add(rect)
          fabricRef.current!.remove(pathObj)
        }
      }
    })

    if (changed) {
      fabricRef.current.discardActiveObject()
      fabricRef.current.requestRenderAll()
      setHasSelection(false)
      saveHistory()
    }
  }, [saveHistory])

  const handleClear = useCallback(() => {
    if (!fabricRef.current) return
    const bg = fabricRef.current.backgroundImage
    fabricRef.current.clear()
    if (bg) {
      fabricRef.current.backgroundImage = bg
    }
    fabricRef.current.renderAll()
    saveHistory() // Save state after clear
  }, [saveHistory])

  const handleDownloadImage = useCallback(() => {
    if (!fabricRef.current) return
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2, // High res export
    })
    const link = document.createElement('a')
    link.download = 'envision-whiteboard.png'
    link.href = dataUrl
    link.click()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return

      const key = e.key.toLowerCase()

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        e.preventDefault()
        return
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        handleRedo()
        e.preventDefault()
        return
      }

      // Tools
      if (key === 'v') setMode('select')
      if (key === 'p') setMode('draw')
      if (key === 'r') setMode('rect')
      if (key === 'c') setMode('circle')
      if (key === 'l') setMode('line')
      if (key === 'h') setMode('pan')
      if (key === 'e') setMode('erase')
      if (key === 't') setMode('text')

      // Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDeleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, handleDeleteSelected])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-transparent"
    >
      <Toolbar
        mode={mode}
        setMode={setMode}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        onClear={handleClear}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={hasSelection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        onUploadFile={handleAddFile}
        onDownloadImage={handleDownloadImage}
        onBeautify={handleBeautify}
      />
      <div className="absolute inset-0 z-10">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
