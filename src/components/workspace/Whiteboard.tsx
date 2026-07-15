"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useTheme } from "next-themes";
import * as fabric from "fabric";
import * as pdfjsLib from "pdfjs-dist";
import { Toolbar, DrawingMode, BrushColor, BrushSize } from "./Toolbar";

// Set up PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export function Whiteboard() {
  const file = useWorkspaceStore((state) => state.file);
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  const [mode, setMode] = useState<DrawingMode>("draw");
  const [color, setColor] = useState<BrushColor>("#C05621");
  const [size, setSize] = useState<BrushSize>(4);
  const [hasSelection, setHasSelection] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Undo/Redo State
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryUpdate = useRef(false);

  // Expose undo/redo to Toolbar
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const saveHistory = useCallback(() => {
    if (isHistoryUpdate.current || !fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(json);
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && fabricRef.current) {
      isHistoryUpdate.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      fabricRef.current.loadFromJSON(history[newIndex]).then(() => {
        fabricRef.current?.renderAll();
        isHistoryUpdate.current = false;
      });
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && fabricRef.current) {
      isHistoryUpdate.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      fabricRef.current.loadFromJSON(history[newIndex]).then(() => {
        fabricRef.current?.renderAll();
        isHistoryUpdate.current = false;
      });
    }
  }, [history, historyIndex]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      selection: false,
    });
    fabricRef.current = canvas;

    // Set up drawing brush
    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = size;
    canvas.freeDrawingBrush = brush;

    // Initialize blank state for history
    saveHistory();

    // Load file (Image or PDF)
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          fabric.FabricImage.fromURL(dataUrl).then((img) => {
            if (!fabricRef.current) return;
            const canvas = fabricRef.current;
            const scale = Math.min(
              (canvas.width! * 0.8) / img.width!,
              (canvas.height! * 0.8) / img.height!
            );
            
            img.scale(scale);
            canvas.centerObject(img);
            
            // Make image a movable object instead of static background
            canvas.add(img);
            canvas.sendObjectToBack(img);
            saveHistory(); 
          }).catch(console.error);
        };
        reader.readAsDataURL(file);
      } else if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const typedarray = new Uint8Array(reader.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            const page = await pdf.getPage(1);
            
            // Render PDF to a hidden canvas
            const viewport = page.getViewport({ scale: 2.0 }); // High res
            const pdfCanvas = document.createElement("canvas");
            const context = pdfCanvas.getContext("2d");
            if (!context) return;
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            
            await page.render({ canvasContext: context, canvas: pdfCanvas, viewport: viewport }).promise;
            
            // Convert to Fabric image
            const dataUrl = pdfCanvas.toDataURL("image/png");
            const img = await fabric.FabricImage.fromURL(dataUrl);
            
            if (!fabricRef.current) return;
            const canvas = fabricRef.current;
            const scale = Math.min(
              (canvas.width! * 0.8) / img.width!,
              (canvas.height! * 0.8) / img.height!
            );
            
            img.scale(scale);
            canvas.centerObject(img);
            canvas.add(img);
            canvas.sendObjectToBack(img);
            saveHistory();
          } catch (err) {
            console.error("Error loading PDF", err);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }

    // --- INFINITE DOT GRID ---
    canvas.on('after:render', function() {
      if (document.documentElement.getAttribute('data-show-grid') !== 'true') return;

      const ctx = canvas.contextContainer;
      const vpt = canvas.viewportTransform!;
      const zoom = canvas.getZoom();
      
      // Dynamic grid step calculation
      let step = 30; // Base step in canvas space
      let screenStep = step * zoom;
      
      // If zoomed out too much, increase step to avoid rendering millions of dots
      while (screenStep < 20) {
        step *= 2;
        screenStep = step * zoom;
      }
      
      // If zoomed in too much, decrease step to keep grid visible
      while (screenStep > 80) {
        step /= 2;
        screenStep = step * zoom;
      }
      
      const offsetX = vpt[4] % screenStep;
      const offsetY = vpt[5] % screenStep;
      
      ctx.save();
      ctx.beginPath();
      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'; 
      
      // Draw dots slightly out of bounds to ensure seamless panning
      for (let x = offsetX - screenStep; x < canvas.width! + screenStep; x += screenStep) {
        for (let y = offsetY - screenStep; y < canvas.height! + screenStep; y += screenStep) {
          ctx.moveTo(x, y);
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.restore();
    });

    // --- INFINITE CANVAS PAN/ZOOM & SHAPES ---
    canvas.on('mouse:wheel', function(opt) {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    let shapeObj: fabric.Object | null = null;
    let origX = 0, origY = 0;

    // Use a ref to access current mode inside event listeners without re-binding them
    const getMode = () => document.documentElement.getAttribute('data-draw-mode') || 'draw';
    const getColor = () => document.documentElement.getAttribute('data-draw-color') || '#C05621';
    const getSize = () => parseInt(document.documentElement.getAttribute('data-draw-size') || '4');

    canvas.on('mouse:down', function(opt) {
      const evt = opt.e as MouseEvent;
      const currentMode = getMode();
      // Middle click, Alt, or 'pan' mode for panning
      if (evt.button === 1 || evt.altKey || currentMode === "pan") {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.defaultCursor = 'grabbing';
        return;
      }

      // Shapes Logic
      if (["rect", "circle", "line"].includes(currentMode)) {
        const pointer = canvas.getScenePoint(evt);
        origX = pointer.x;
        origY = pointer.y;
        const currentColor = getColor();
        const currentSize = getSize();

        if (currentMode === "rect") {
          shapeObj = new fabric.Rect({ left: origX, top: origY, width: 0, height: 0, fill: 'transparent', stroke: currentColor, strokeWidth: currentSize, objectCaching: false });
        } else if (currentMode === "circle") {
          shapeObj = new fabric.Circle({ left: origX, top: origY, radius: 0, fill: 'transparent', stroke: currentColor, strokeWidth: currentSize, objectCaching: false });
        } else if (currentMode === "line") {
          shapeObj = new fabric.Line([origX, origY, origX, origY], { stroke: currentColor, strokeWidth: currentSize });
        }
        
        if (shapeObj) {
          canvas.add(shapeObj);
        }
      }
    });

    canvas.on('mouse:move', function(opt) {
      const evt = opt.e as MouseEvent;
      if (isPanning) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosX;
          vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll();
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
        return;
      }

      if (shapeObj) {
        const pointer = canvas.getScenePoint(evt);
        const currentMode = getMode();
        if (currentMode === "rect") {
          shapeObj.set({ width: Math.abs(pointer.x - origX), height: Math.abs(pointer.y - origY) });
          shapeObj.set({ left: Math.min(pointer.x, origX), top: Math.min(pointer.y, origY) });
        } else if (currentMode === "circle") {
          const radius = Math.max(Math.abs(pointer.x - origX), Math.abs(pointer.y - origY)) / 2;
          shapeObj.set({ radius: radius });
          shapeObj.set({ left: Math.min(pointer.x, origX), top: Math.min(pointer.y, origY) });
        } else if (currentMode === "line") {
          (shapeObj as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
        }
        canvas.requestRenderAll();
      }
    });

    const handleMouseUp = () => {
      if (isPanning) {
        canvas.setViewportTransform(canvas.viewportTransform!);
        isPanning = false;
        canvas.defaultCursor = getMode() === 'draw' ? 'crosshair' : 'default';
        if (getMode() === 'select') canvas.selection = true;
      }

      if (shapeObj) {
        shapeObj.setCoords();
        shapeObj = null;
        saveHistory(); // Save after drawing a shape
      }
    };

    canvas.on('mouse:up', handleMouseUp);
    window.addEventListener('mouseup', handleMouseUp);

    // Handle History Events (Debounced slightly by checking isHistoryUpdate)
    canvas.on('object:modified', saveHistory);
    canvas.on('path:created', saveHistory); // Fired when freehand drawing finishes

    // Selection handlers
    canvas.on('selection:created', () => setHasSelection(true));
    canvas.on('selection:updated', () => setHasSelection(true));
    canvas.on('selection:cleared', () => setHasSelection(false));

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        canvas.renderAll();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [file]); // Only re-init if file changes

  // Update DOM attributes so Fabric event listeners can read current state without recreating canvas
  useEffect(() => {
    document.documentElement.setAttribute('data-draw-mode', mode);
    document.documentElement.setAttribute('data-draw-color', color);
    document.documentElement.setAttribute('data-draw-size', size.toString());
    document.documentElement.setAttribute('data-show-grid', showGrid ? 'true' : 'false');

    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    canvas.isDrawingMode = (mode === "draw");
    canvas.selection = (mode === "select");
    
    if (mode === "draw" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = size;
    }
    
    if (mode === "pan") {
      canvas.defaultCursor = 'grab';
    } else if (["rect", "circle", "line"].includes(mode)) {
      canvas.defaultCursor = 'crosshair';
    } else {
      canvas.defaultCursor = mode === "draw" ? 'crosshair' : 'default';
    }
    
    // Deselect objects when going out of select mode
    if (mode !== "select") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [mode, color, size, showGrid]);

  // Re-render when theme changes to update grid color
  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.requestRenderAll();
    }
  }, [resolvedTheme]);

  const handleDeleteSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObjects = fabricRef.current.getActiveObjects();
    if (activeObjects.length) {
      fabricRef.current.discardActiveObject();
      activeObjects.forEach((obj) => fabricRef.current?.remove(obj));
      saveHistory(); // Save state after delete
    }
  }, [saveHistory]);

  const handleClear = useCallback(() => {
    if (!fabricRef.current) return;
    const bg = fabricRef.current.backgroundImage; 
    fabricRef.current.clear();
    if (bg) {
      fabricRef.current.backgroundImage = bg;
    }
    fabricRef.current.renderAll();
    saveHistory(); // Save state after clear
  }, [saveHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      
      const key = e.key.toLowerCase();

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        handleRedo();
        e.preventDefault();
        return;
      }

      // Tools
      if (key === 'v') setMode("select");
      if (key === 'p') setMode("draw");
      if (key === 'r') setMode("rect");
      if (key === 'c') setMode("circle");
      if (key === 'l') setMode("line");
      if (key === 'h') setMode("pan");

      // Delete
      if (e.key === "Backspace" || e.key === "Delete") {
        handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleDeleteSelected]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-transparent">
      <Toolbar 
        mode={mode} setMode={setMode} 
        color={color} setColor={setColor}
        size={size} setSize={setSize}
        onClear={handleClear}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={hasSelection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
      />
      <div className="absolute inset-0 z-10">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
