const OCR_TIMEOUT_MS = 45_000

async function blobToJpeg(source: Blob): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, 1600 / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read that image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Vision first, so formulas and structures survive. Tesseract is the fallback. */
export async function readProblemImage(
  source: Blob,
  workspaceId: string,
): Promise<{ text: string; rough: boolean }> {
  try {
    const image = await blobToJpeg(source)
    const response = await fetch('/api/transcribe-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, image }),
    })
    const body = (await response.json().catch(() => null)) as { transcription?: string } | null
    const transcription = body?.transcription?.trim()
    if (response.ok && transcription) return { text: transcription, rough: false }
  } catch {
    /* plain-text fallback below */
  }

  const text = await readPrintedImage(source)
  if (!text) throw new Error('Could not read that page. Type the problem in the box.')
  return { text, rough: true }
}

/** Read printed text from a pasted screenshot. Handwriting stays on the vision model. */
export async function readPrintedImage(source: Blob): Promise<string> {
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    workerBlobURL: false,
  })
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Reading the image took too long.')), OCR_TIMEOUT_MS)
  })
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      user_defined_dpi: '150',
    })
    const result = await Promise.race([worker.recognize(source), timeout])
    return result.data.text.replace(/\s+\n/g, '\n').trim()
  } finally {
    await worker.terminate().catch(() => undefined)
  }
}
