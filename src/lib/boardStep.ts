import { stripThinking } from './models.ts'

export type Box = { left: number; top: number; width: number; height: number }
export type Point = { x: number; y: number }

function jsonStep(raw: string): string | null {
  const stripped = stripThinking(raw)
    .replace(/```json|```/gi, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(stripped.slice(start, end + 1))
    if (!parsed || typeof parsed !== 'object' || !('step' in parsed)) return null
    const step = parsed.step
    return typeof step === 'string' && step.trim() ? step.trim() : null
  } catch {
    return null
  }
}

function plainLine(raw: string): string | null {
  const stripped = stripThinking(raw)
    .replace(/```json|```/gi, '')
    .trim()
  const lines = stripped
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('{') && !line.startsWith('}'))
  const math = [...lines].reverse().find((line) => line.length < 400 && /[=\\^_$]/.test(line))
  const line = math ?? lines.at(-1)
  if (!line || line.length > 400) return null
  return line
}

export function readStep(raw: string): string | null {
  return jsonStep(raw) ?? plainLine(raw)
}

export function replyStep(content: string, reasoning = ''): string | null {
  return jsonStep(content) ?? jsonStep(reasoning) ?? plainLine(content) ?? plainLine(reasoning)
}

export function katexSource(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('$$') && text.endsWith('$$')) text = text.slice(2, -2).trim()
  else if (text.startsWith('$') && text.endsWith('$')) text = text.slice(1, -1).trim()
  return text
}

export function shouldTypeset(source: string): boolean {
  if (/\\[a-zA-Z]/.test(source)) return true
  const words = source.split(/\s+/).filter((word) => /[A-Za-z]{4,}/.test(word))
  return words.length === 0 && /[=^_{}]/.test(source)
}

/** Center the step under the part of the problem that is on screen. */
export function anchorUnder(box: Box, view: Box): Point {
  const overlapLeft = Math.max(box.left, view.left)
  const overlapRight = Math.min(box.left + box.width, view.left + view.width)
  const overlapTop = Math.max(box.top, view.top)
  const overlapBottom = Math.min(box.top + box.height, view.top + view.height)
  const visible = overlapRight - overlapLeft > 8 && overlapBottom - overlapTop > 8
  const left = visible ? overlapLeft : box.left
  const right = visible ? overlapRight : box.left + box.width
  const bottom = visible ? overlapBottom : box.top + box.height
  return { x: (left + right) / 2, y: bottom + 28 }
}
