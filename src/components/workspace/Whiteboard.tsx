'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { useTheme } from 'next-themes'
import * as fabric from 'fabric'
import * as pdfjsLib from 'pdfjs-dist'
import { toast } from 'sonner'
import { Toolbar, DrawingMode, BrushColor, BrushSize } from './Toolbar'
import { addTutorStep } from './placeTutorMath'
import { readProblemImage } from '@/lib/ocr/readPrinted'

// Same-origin worker from /public (copied from pdfjs-dist; must match installed version).
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

/** Toolbar sizes are what you see on screen. Divide by zoom so a closer view writes a smaller mark. */
function pageUnits(canvas: fabric.Canvas, screenPx: number) {
  const zoom = canvas.getZoom() || 1
  return screenPx / zoom
}

export function Whiteboard({
  initialCanvasState = null,
  workspaceId,
}: {
  initialCanvasState?: string | null
  workspaceId: string
}) {
  const {
    file,
    setGetCanvasImage,
    setGetInkImage,
    setGetCanvasJson,
    setLastCanvasUpdate,
    setPrintedRead,
    setPlaceTutorStep,
    highlightToken,
  } = useWorkspaceStore()
  const { resolvedTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  useEffect(() => {
    if (!highlightToken) return
    const canvas = fabricRef.current
    if (!canvas) return
    const selected = canvas.getActiveObjects().filter((object) => object.type === 'path')
    const paths = canvas.getObjects().filter((object) => object.type === 'path')
    const targets = selected.length > 0 ? selected : paths.slice(-3)
    const previous = targets.map((object) => ({ object, stroke: object.stroke }))
    targets.forEach((object) => object.set('stroke', '#7c3aed'))
    canvas.requestRenderAll()
    const timeout = window.setTimeout(() => {
      previous.forEach(({ object, stroke }) => object.set('stroke', stroke))
      canvas.requestRenderAll()
    }, 3000)
    return () => {
      window.clearTimeout(timeout)
      previous.forEach(({ object, stroke }) => object.set('stroke', stroke))
      fabricRef.current?.requestRenderAll()
    }
  }, [highlightToken])

  const [mode, setMode] = useState<DrawingMode>('draw')
  const [color, setColor] = useState<BrushColor>('#C05621')
  const [size, setSize] = useState<BrushSize>(4)
  const [hasSelection, setHasSelection] = useState(false)
  const [showGrid, setShowGrid] = useState(true)

  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isHistoryUpdate = useRef(false)
  const historyIndexRef = useRef(-1)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const saveHistory = useCallback(() => {
    if (isHistoryUpdate.current || !fabricRef.current) return
    const json = JSON.stringify(fabricRef.current.toJSON())
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndexRef.current + 1)
      const capped = truncated.length > 25 ? truncated.slice(truncated.length - 25) : truncated
      capped.push(json)
      const newIdx = capped.length - 1
      setHistoryIndex(newIdx)
      historyIndexRef.current = newIdx

      if (newIdx > 0) {
        queueMicrotask(() => setLastCanvasUpdate(Date.now()))
      }
      return capped
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

  const readProblem = useCallback(
    (source: Blob) => {
      setPrintedRead({ status: 'reading', text: '' })
      void readProblemImage(source, workspaceId)
        .then(({ text, rough }) => {
          setPrintedRead({ status: 'ready', text, rough })
        })
        .catch((err: unknown) => {
          setPrintedRead({
            status: 'failed',
            text: '',
            error: err instanceof Error ? err.message : 'Could not read that image.',
          })
        })
    },
    [setPrintedRead, workspaceId],
  )

  const handleAddFile = useCallback(
    (fileToLoad: File) => {
      if (!fileToLoad || !fabricRef.current) return

      if (fileToLoad.type.startsWith('image/')) {
        readProblem(fileToLoad)
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
              canvas.viewportCenterObject(img)

              canvas.add(img)
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

            const viewport = page.getViewport({ scale: 2.0 })
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

            const dataUrl = pdfCanvas.toDataURL('image/png')
            const imageBlob = await (await fetch(dataUrl)).blob()
            readProblem(imageBlob)
            const img = await fabric.FabricImage.fromURL(dataUrl)

            if (!fabricRef.current) return
            const canvas = fabricRef.current
            const scale = Math.min(
              (canvas.width! * 0.8) / img.width!,
              (canvas.height! * 0.8) / img.height!,
            )

            img.scale(scale)
            canvas.viewportCenterObject(img)
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
    [saveHistory, readProblem],
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return
      }

      const active = fabricRef.current?.getActiveObject()
      if (active instanceof fabric.IText && active.isEditing) return

      const items = Array.from(event.clipboardData?.items ?? [])
      const imageItem = items.find((item) => item.type.startsWith('image/'))

      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          event.preventDefault()
          handleAddFile(file)
          toast.success('Screenshot pasted onto canvas!')
          return
        }
      }

      const textData = event.clipboardData?.getData('text/plain')
      if (textData && textData.trim() && fabricRef.current) {
        event.preventDefault()
        const canvas = fabricRef.current
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
        const centerX = (-vpt[4] + (canvas.width || 800) / 2) / (vpt[0] || 1)
        const centerY = (-vpt[5] + (canvas.height || 600) / 2) / (vpt[3] || 1)

        const text = new fabric.IText(textData.trim(), {
          left: centerX - 100,
          top: centerY - 20,
          fill: color,
          fontSize: pageUnits(canvas, 20),
          fontFamily: 'Georgia, serif',
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        canvas.requestRenderAll()
        saveHistory()
        toast.success('Text pasted onto canvas!')
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleAddFile, color, saveHistory])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      const fileToLoad = files.find(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
      )
      if (fileToLoad) {
        handleAddFile(fileToLoad)
        toast.success('File dropped onto canvas!')
      }
    }

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)
    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
  }, [handleAddFile])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      selection: false,
    })
    fabricRef.current = canvas

    const capture = (hidePage: boolean) => {
      if (!fabricRef.current) return null
      const canvas = fabricRef.current
      const pages = hidePage
        ? canvas.getObjects().filter((object) => String(object.type).toLowerCase() === 'image')
        : []
      pages.forEach((object) => object.set('visible', false))
      const maxDim = Math.max(canvas.width || 800, canvas.height || 600)
      const multiplier = Math.min(1, 1024 / maxDim)
      const isDark = document.documentElement.classList.contains('dark')
      const prevBg = canvas.backgroundColor
      canvas.backgroundColor = isDark ? '#18181b' : '#ffffff'
      canvas.renderAll()
      const dataUrl = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.6,
        multiplier,
      })
      canvas.backgroundColor = prevBg
      pages.forEach((object) => object.set('visible', true))
      canvas.renderAll()
      return dataUrl
    }

    setGetCanvasImage(() => capture(false))
    setGetInkImage(() => capture(true))

    setGetCanvasJson(() => {
      if (!fabricRef.current) return null
      return JSON.stringify(fabricRef.current.toJSON())
    })

    setPlaceTutorStep((raw: string) => {
      const board = fabricRef.current
      if (!board) return
      void addTutorStep(board, raw).then((step) => {
        if (!step || fabricRef.current !== board) return
        setHasSelection(true)
        document.documentElement.setAttribute('data-draw-mode', 'select')
        board.isDrawingMode = false
        board.selection = true
        setMode('select')
        saveHistory()
      })
    })

    const brush = new fabric.PencilBrush(canvas)
    brush.color = color
    brush.width = pageUnits(canvas, size)
    canvas.freeDrawingBrush = brush

    if (initialCanvasState) {
      canvas.loadFromJSON(initialCanvasState).then(() => {
        canvas.renderAll()
        saveHistory()
        setLastCanvasUpdate(Date.now())
      })
    } else {
      saveHistory()

      if (file) {
        handleAddFile(file)
        setTimeout(() => {
          if (fabricRef.current) {
            const objs = fabricRef.current.getObjects()
            if (objs.length > 0) fabricRef.current.sendObjectToBack(objs[objs.length - 1])
          }
        }, 500)
      }
    }

    canvas.on('after:render', function () {
      if (document.documentElement.getAttribute('data-show-grid') !== 'true') return

      const ctx = canvas.contextContainer
      const vpt = canvas.viewportTransform!
      const zoom = canvas.getZoom()

      let step = 28
      let screenStep = step * zoom

      while (screenStep < 10) {
        step *= 2
        screenStep = step * zoom
      }

      while (screenStep > 90) {
        step /= 2
        screenStep = step * zoom
      }

      const offsetX = ((vpt[4] % screenStep) + screenStep) % screenStep
      const offsetY = ((vpt[5] % screenStep) + screenStep) % screenStep

      const dotRadius = Math.max(0.8, Math.min(2.2, 1.25 * Math.sqrt(zoom)))

      ctx.save()
      ctx.beginPath()
      const isDark = document.documentElement.classList.contains('dark')
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(28, 25, 23, 0.32)'

      for (let x = offsetX - screenStep; x < canvas.width! + screenStep; x += screenStep) {
        for (let y = offsetY - screenStep; y < canvas.height! + screenStep; y += screenStep) {
          ctx.moveTo(x, y)
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        }
      }
      ctx.fill()
      ctx.restore()
    })

    const getMode = () => document.documentElement.getAttribute('data-draw-mode') || 'draw'
    const getColor = () => document.documentElement.getAttribute('data-draw-color') || '#C05621'
    const getSize = () => parseInt(document.documentElement.getAttribute('data-draw-size') || '4')

    const fitBrush = () => {
      const active = canvas.freeDrawingBrush
      if (!active) return
      const screen = getMode() === 'highlighter' ? Math.max(16, getSize() * 3) : getSize()
      active.width = pageUnits(canvas, screen)
    }

    canvas.on('mouse:wheel', function (opt) {
      const e = opt.e
      const middleHeld = (e.buttons & 4) === 4
      if (middleHeld || e.shiftKey) {
        const vpt = canvas.viewportTransform
        if (vpt) {
          vpt[4] -= e.deltaX
          vpt[5] -= e.deltaY
          canvas.requestRenderAll()
        }
      } else {
        let zoom = canvas.getZoom()
        let dy = e.deltaY
        if (e.deltaMode === 1) dy *= 100
        if (e.deltaMode === 2) dy *= 800
        zoom *= 1.06 ** (-dy / 100)
        if (zoom > 50) zoom = 50
        if (zoom < 0.05) zoom = 0.05
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), zoom)
        fitBrush()
      }
      e.preventDefault()
      e.stopPropagation()
    })

    let isPanning = false
    let isErasing = false
    let erasedAny = false
    let lastPosX = 0
    let lastPosY = 0
    let initialTouchDistance = 0
    let lastTouchCenter: { x: number; y: number } | null = null

    let shapeObj: fabric.Object | null = null
    let origX = 0,
      origY = 0

    const openStepSource = (target: fabric.FabricObject) => {
      const source = target.get('tutorSource')
      if (typeof source !== 'string') return
      if (target instanceof fabric.IText) {
        canvas.setActiveObject(target)
        target.enterEditing()
        target.hiddenTextarea?.focus()
        return
      }
      const point = target.getPointByOrigin('center', 'top')
      canvas.remove(target)
      const editor = new fabric.IText(source, {
        originX: 'center',
        originY: 'top',
        fill: '#C05621',
        fontSize: pageUnits(canvas, 22),
        fontFamily: 'Georgia, serif',
        editable: true,
        hasControls: false,
        lockRotation: true,
      })
      editor.set('name', 'tutor-step-edit')
      editor.set('tutorSource', source)
      editor.setXY(point, 'center', 'top')
      canvas.add(editor)
      canvas.setActiveObject(editor)
      editor.enterEditing()
      editor.hiddenTextarea?.focus()
      editor.on('editing:exited', () => {
        const next = editor.text?.trim() ?? ''
        const where = editor.getPointByOrigin('center', 'top')
        canvas.remove(editor)
        if (!next) {
          canvas.requestRenderAll()
          saveHistory()
          return
        }
        void addTutorStep(canvas, next, where).then(() => {
          if (fabricRef.current !== canvas) return
          canvas.requestRenderAll()
          saveHistory()
        })
      })
    }

    canvas.on('mouse:dblclick', (opt) => {
      if (getMode() !== 'select') return
      const target = opt.target
      if (!target || target.get('name') !== 'tutor-step') return
      openStepSource(target)
    })

    canvas.on('mouse:down', function (opt) {
      const evt = opt.e as MouseEvent | TouchEvent
      const currentMode = getMode()
      if (currentMode === 'draw' || currentMode === 'highlighter') fitBrush()

      const isTouchEvent = (e: Event): e is TouchEvent =>
        typeof TouchEvent !== 'undefined' && e instanceof TouchEvent

      const getClientX = (e: MouseEvent | TouchEvent) =>
        isTouchEvent(e) && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX
      const getClientY = (e: MouseEvent | TouchEvent) =>
        isTouchEvent(e) && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY

      if (currentMode === 'erase') {
        isErasing = true
        erasedAny = false
        const target = opt.target
        if (target && target !== canvas.backgroundImage) {
          canvas.remove(target)
          canvas.requestRenderAll()
          erasedAny = true
        }
        return
      }

      if (currentMode === 'text') {
        const hit = opt.target
        if (hit && (hit.type === 'itext' || hit.type === 'textbox' || hit.type === 'text')) {
          if (hit instanceof fabric.IText) {
            canvas.setActiveObject(hit)
            hit.enterEditing()
            hit.hiddenTextarea?.focus()
          }
          return
        }
        if (hit?.get('name') === 'tutor-step') return
        const pointer = canvas.getScenePoint(evt)
        const text = new fabric.IText('', {
          left: pointer.x,
          top: pointer.y,
          originX: 'left',
          originY: 'top',
          fill: getColor(),
          fontSize: pageUnits(canvas, Math.max(20, getSize() * 5)),
          fontFamily: 'Georgia, serif',
          editable: true,
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        text.hiddenTextarea?.focus()

        text.on('editing:exited', () => {
          if (!text.text || !text.text.trim()) {
            canvas.remove(text)
            canvas.requestRenderAll()
          } else {
            saveHistory()
          }
        })
        return
      }

      const isMiddleClick = evt instanceof MouseEvent && evt.button === 1
      const isAltKey = evt instanceof MouseEvent && evt.altKey
      const isMultiTouch = isTouchEvent(evt) && evt.touches.length > 1

      if (isMultiTouch && isTouchEvent(evt)) {
        isPanning = true
        canvas.selection = false
        canvas.isDrawingMode = false
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

      if (isMiddleClick || isAltKey || currentMode === 'pan') {
        if (evt instanceof MouseEvent) evt.preventDefault()
        isPanning = true
        canvas.selection = false
        canvas.isDrawingMode = false
        lastPosX = getClientX(evt)
        lastPosY = getClientY(evt)
        canvas.defaultCursor = 'grabbing'
        return
      }

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
            originX: 'left',
            originY: 'top',
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: currentColor,
            strokeWidth: pageUnits(canvas, currentSize),
            objectCaching: false,
            selectable: false,
            evented: false,
          })
        } else if (currentMode === 'circle') {
          shapeObj = new fabric.Circle({
            left: origX,
            top: origY,
            originX: 'left',
            originY: 'top',
            radius: 0,
            fill: 'transparent',
            stroke: currentColor,
            strokeWidth: pageUnits(canvas, currentSize),
            objectCaching: false,
            selectable: false,
            evented: false,
          })
        } else if (currentMode === 'line') {
          shapeObj = new fabric.Line([origX, origY, origX, origY], {
            stroke: currentColor,
            strokeWidth: pageUnits(canvas, currentSize),
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          })
        }

        if (shapeObj) {
          canvas.add(shapeObj)
        }
      }
    })

    canvas.on('mouse:move', function (opt) {
      const evt = opt.e as MouseEvent | TouchEvent
      const isTouchEvent = (e: Event): e is TouchEvent =>
        typeof TouchEvent !== 'undefined' && e instanceof TouchEvent
      const getClientX = (e: MouseEvent | TouchEvent) =>
        isTouchEvent(e) && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX
      const getClientY = (e: MouseEvent | TouchEvent) =>
        isTouchEvent(e) && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY

      if (isErasing && getMode() === 'erase') {
        const target = opt.target
        if (target && target !== canvas.backgroundImage) {
          canvas.remove(target)
          canvas.requestRenderAll()
          erasedAny = true
        }
        return
      }

      if (isPanning) {
        const vpt = canvas.viewportTransform
        if (vpt) {
          if (isTouchEvent(evt) && evt.touches.length > 1) {
            evt.preventDefault()
            const t1 = evt.touches[0]
            const t2 = evt.touches[1]
            const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
            const currentCenter = {
              x: (t1.clientX + t2.clientX) / 2,
              y: (t1.clientY + t2.clientY) / 2,
            }

            if (initialTouchDistance > 0) {
              const scale = currentDistance / initialTouchDistance
              let zoom = canvas.getZoom() * scale
              if (zoom > 50) zoom = 50
              if (zoom < 0.05) zoom = 0.05
              canvas.zoomToPoint(new fabric.Point(currentCenter.x, currentCenter.y), zoom)
              fitBrush()
            }
            initialTouchDistance = currentDistance

            if (lastTouchCenter) {
              vpt[4] += currentCenter.x - lastTouchCenter.x
              vpt[5] += currentCenter.y - lastTouchCenter.y
              canvas.requestRenderAll()
            }
            lastTouchCenter = currentCenter
            return
          }

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
      if (isErasing) {
        isErasing = false
        if (erasedAny) {
          saveHistory()
          erasedAny = false
        }
      }

      if (isPanning) {
        canvas.setViewportTransform(canvas.viewportTransform!)
        isPanning = false
        initialTouchDistance = 0
        lastTouchCenter = null
        canvas.defaultCursor =
          getMode() === 'draw' || getMode() === 'highlighter' ? 'crosshair' : 'default'
        if (getMode() === 'select') canvas.selection = true
        if (getMode() === 'draw' || getMode() === 'highlighter') canvas.isDrawingMode = true
      }

      if (shapeObj) {
        shapeObj.setCoords()
        const box = shapeObj.getBoundingRect()
        if (box.width < 4 && box.height < 4) canvas.remove(shapeObj)
        else saveHistory()
        shapeObj = null
      }
    }

    canvas.on('mouse:up', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp)

    canvas.on('object:modified', saveHistory)
    canvas.on('path:created', (event) => {
      if ('path' in event && event.path instanceof fabric.FabricObject && getMode() !== 'select') {
        event.path.evented = false
        event.path.selectable = false
      }
      saveHistory()
    })

    canvas.on('selection:created', () => setHasSelection(true))
    canvas.on('selection:updated', () => setHasSelection(true))
    canvas.on('selection:cleared', () => setHasSelection(false))

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
      setPlaceTutorStep(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, handleAddFile, saveHistory, setGetCanvasImage, setGetInkImage])

  useEffect(() => {
    document.documentElement.setAttribute('data-draw-mode', mode)
    document.documentElement.setAttribute('data-draw-color', color)
    document.documentElement.setAttribute('data-draw-size', size.toString())
    document.documentElement.setAttribute('data-show-grid', showGrid ? 'true' : 'false')

    if (!fabricRef.current) return
    const canvas = fabricRef.current

    const drawing = mode === 'draw' || mode === 'highlighter'
    const shaping = mode === 'rect' || mode === 'circle' || mode === 'line'
    canvas.isDrawingMode = drawing
    canvas.selection = mode === 'select'
    canvas.skipTargetFind = drawing || shaping || mode === 'pan'

    canvas.forEachObject((object) => {
      const editing = object.get('name') === 'tutor-step-edit'
      const isText = object.type === 'itext' || object.type === 'textbox' || object.type === 'text'
      object.evented =
        mode === 'select' || mode === 'erase' || (mode === 'text' && isText) || editing
      object.selectable = mode === 'select' || (mode === 'text' && isText) || editing
    })

    if (canvas.freeDrawingBrush) {
      if (mode === 'highlighter') {
        const r = parseInt(color.slice(1, 3), 16) || 214
        const g = parseInt(color.slice(3, 5), 16) || 158
        const b = parseInt(color.slice(5, 7), 16) || 46
        canvas.freeDrawingBrush.color = `rgba(${r}, ${g}, ${b}, 0.35)`
        canvas.freeDrawingBrush.width = pageUnits(canvas, Math.max(16, size * 3))
      } else if (mode === 'draw') {
        canvas.freeDrawingBrush.color = color
        canvas.freeDrawingBrush.width = pageUnits(canvas, size)
      }
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
      canvas.defaultCursor = mode === 'draw' || mode === 'highlighter' ? 'crosshair' : 'default'
    }

    if (mode !== 'select') {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    }
  }, [mode, color, size, showGrid])

  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.requestRenderAll()
    }
  }, [resolvedTheme])

  const handleDeleteSelected = useCallback(() => {
    if (!fabricRef.current) return
    const activeObjects = fabricRef.current.getActiveObjects()
    if (activeObjects.length) {
      const editingObj = activeObjects.find(
        (obj) => (obj as unknown as { isEditing?: boolean }).isEditing,
      )
      if (editingObj) return

      fabricRef.current.discardActiveObject()
      activeObjects.forEach((obj) => fabricRef.current?.remove(obj))
      saveHistory()
    }
  }, [saveHistory])

  const handleBeautify = useCallback(() => {
    if (!fabricRef.current) return
    const activeObjects = fabricRef.current.getActiveObjects()
    if (activeObjects.length === 0) return

    let changed = false
    activeObjects.forEach((obj) => {
      if (obj.type === 'path') {
        const pathObj = obj as fabric.Path
        const bounds = pathObj.getBoundingRect()
        const width = bounds.width
        const height = bounds.height

        if (width < 5 && height < 5) return

        changed = true

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
    saveHistory()
  }, [saveHistory])

  const handleDownloadImage = useCallback(() => {
    if (!fabricRef.current) return
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    })
    const link = document.createElement('a')
    link.download = 'envision-whiteboard.png'
    link.href = dataUrl
    link.click()
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects.length > 0) {
      let modified = false
      activeObjects.forEach((obj) => {
        if (
          obj.type === 'path' ||
          obj.type === 'line' ||
          obj.type === 'rect' ||
          obj.type === 'circle'
        ) {
          obj.set('stroke', color)
          obj.set('strokeWidth', pageUnits(canvas, size))
          modified = true
        } else if (obj.type === 'itext' || obj.type === 'text') {
          obj.set('fill', color)
          modified = true
        }
      })
      if (modified) {
        canvas.requestRenderAll()
        saveHistory()
      }
    }
  }, [color, size, saveHistory])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return

      const activeObj = fabricRef.current?.getActiveObject()
      if (activeObj && (activeObj as unknown as { isEditing?: boolean }).isEditing) return

      const key = e.key.toLowerCase()

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

      if (key === 'v') setMode('select')
      if (key === 'p') setMode('draw')
      if (key === 'r') setMode('rect')
      if (key === 'c') setMode('circle')
      if (key === 'l') setMode('line')
      if (key === 'h') setMode('highlighter')
      if (key === 'e') setMode('erase')
      if (key === 't') setMode('text')

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
