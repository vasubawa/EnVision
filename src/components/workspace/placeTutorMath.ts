import * as fabric from 'fabric'
import { anchorUnder, katexSource, type Box } from '@/lib/boardStep'
import { rasterizeLine, type LinePicture } from './typesetLine'

const INK = '#C05621'

for (const key of ['name', 'tutorSource']) {
  if (!fabric.FabricObject.customProperties.includes(key)) {
    fabric.FabricObject.customProperties.push(key)
  }
}

function viewOf(canvas: fabric.Canvas): Box {
  const zoom = canvas.getZoom() || 1
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  return {
    left: -vpt[4] / zoom,
    top: -vpt[5] / zoom,
    width: (canvas.width || 1) / zoom,
    height: (canvas.height || 1) / zoom,
  }
}

function boundsOf(objects: fabric.FabricObject[]): Box | null {
  if (objects.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const object of objects) {
    object.setCoords()
    const box = object.getBoundingRect()
    left = Math.min(left, box.left)
    top = Math.min(top, box.top)
    right = Math.max(right, box.left + box.width)
    bottom = Math.max(bottom, box.top + box.height)
  }
  if (!Number.isFinite(left)) return null
  return { left, top, width: right - left, height: bottom - top }
}

export function stepPoint(board: fabric.Canvas): { x: number; y: number } {
  const view = viewOf(board)
  const objects = board
    .getObjects()
    .filter(
      (object) => object.get('name') !== 'tutor-step' && object.get('name') !== 'tutor-step-edit',
    )
  const image = [...objects].reverse().find((object) => object instanceof fabric.FabricImage)
  const box = boundsOf(image ? [image] : objects)
  if (!box) return { x: view.left + view.width / 2, y: view.top + view.height / 2 }
  return anchorUnder(box, view)
}

function placeAt(
  board: fabric.Canvas,
  object: fabric.FabricObject,
  point: { x: number; y: number },
) {
  object.setXY(new fabric.Point(point.x, point.y), 'center', 'top')
  board.add(object)
  board.setActiveObject(object)
  board.requestRenderAll()
}

export async function addTutorStep(
  board: fabric.Canvas,
  raw: string,
  point = stepPoint(board),
): Promise<fabric.FabricObject | null> {
  const source = katexSource(raw)
  if (!source) return null
  board.getObjects().forEach((object) => {
    const name = object.get('name')
    if (name === 'tutor-step' || name === 'tutor-step-edit') board.remove(object)
  })
  if (document.fonts?.ready) await document.fonts.ready

  const scale = 1 / (board.getZoom() || 1)
  let picture: LinePicture | null = null
  try {
    picture = await rasterizeLine(source, 28)
  } catch {
    picture = null
  }
  if (picture) {
    const image = await fabric.FabricImage.fromURL(picture.dataUrl)
    const targetWidth = picture.width * scale
    if (image.width) image.scale(targetWidth / image.width)
    image.set({
      originX: 'center',
      originY: 'top',
      selectable: true,
      evented: true,
      hasControls: false,
      lockRotation: true,
      hoverCursor: 'move',
      objectCaching: false,
    })
    image.set('name', 'tutor-step')
    image.set('tutorSource', source)
    placeAt(board, image, point)
    return image
  }

  const text = new fabric.IText(source, {
    originX: 'center',
    originY: 'top',
    fill: INK,
    fontSize: 22 * scale,
    fontFamily: 'Georgia, serif',
    editable: true,
    hasControls: false,
    lockRotation: true,
    hoverCursor: 'text',
  })
  text.set('name', 'tutor-step')
  text.set('tutorSource', source)
  placeAt(board, text, point)
  return text
}
