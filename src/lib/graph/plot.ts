import { parse, type MathNode } from 'mathjs'

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'log',
  'log10',
  'exp',
  'abs',
  'sign',
  'floor',
  'ceil',
  'round',
  'min',
  'max',
])

const CONSTANTS = new Set(['pi', 'e', 'PI', 'E'])

export type PreparedPlot = {
  axis: string
  sliders: string[]
  sample: (axisValue: number, sliders: Record<string, number>) => number
}

function normalize(input: string): string {
  let source = input.trim()
  if (!source) throw new Error('Enter an expression')
  if (source.length > 180) throw new Error('That expression is too long')
  source = source.replace(/^y\s*=\s*/i, '')
  source = source.replace(/^f\s*\(\s*[a-zA-Z]\s*\)\s*=\s*/, '')
  source = source.replace(/\bln\s*\(/g, 'log(')
  source = source.replace(/(\d)\s*(?=[a-zA-Z(])/g, '$1*')
  source = source.replace(/\)\s*(?=[a-zA-Z0-9(])/g, ')*')
  return source
}

function assertPlottable(node: MathNode, symbols: Set<string>) {
  node.traverse((current) => {
    if (
      current.type === 'AssignmentNode' ||
      current.type === 'FunctionAssignmentNode' ||
      current.type === 'AccessorNode' ||
      current.type === 'BlockNode'
    ) {
      throw new Error('That expression cannot be graphed')
    }
    if (current.type === 'FunctionNode') {
      const call = current as MathNode & { fn?: { name?: string } }
      const name = call.fn?.name
      if (!name || !FUNCTIONS.has(name)) throw new Error(`Cannot use ${name || 'that function'}`)
    }
    if (current.type === 'SymbolNode') {
      const symbol = current as MathNode & { name: string }
      if (!CONSTANTS.has(symbol.name)) symbols.add(symbol.name)
    }
  })
}

export function preparePlot(input: string): PreparedPlot {
  const symbols = new Set<string>()
  const node = parse(normalize(input))
  assertPlottable(node, symbols)
  const axis = symbols.has('x') ? 'x' : symbols.has('t') ? 't' : ([...symbols].sort()[0] ?? 'x')
  const sliders = [...symbols].filter((name) => name !== axis).sort()
  const compiled = node.compile()
  return {
    axis,
    sliders,
    sample: (axisValue, values) => {
      const result = compiled.evaluate({ ...values, [axis]: axisValue })
      const numeric = typeof result === 'number' ? result : Number(result)
      if (!Number.isFinite(numeric)) throw new Error('Not a number')
      return numeric
    },
  }
}

export function prepareSlope(input: string): {
  sliders: string[]
  at: (x: number, y: number, sliders: Record<string, number>) => number
} | null {
  const match = input.trim().match(/^(?:dy\/dx|y')\s*=\s*(.+)$/i)
  if (!match) return null
  const field = preparePlot(match[1])
  return {
    sliders: field.sliders.filter((name) => name !== 'y'),
    at: (x, y, sliders) => field.sample(x, { ...sliders, y }),
  }
}

export function sampleCurve(
  plot: PreparedPlot,
  sliders: Record<string, number>,
  min: number,
  max: number,
  steps: number,
): ([number, number] | null)[] {
  const points: ([number, number] | null)[] = []
  const step = (max - min) / Math.max(1, steps)
  const jump = Math.max(40, Math.abs(max - min) * 8)
  let previous: number | null = null
  for (let i = 0; i <= steps; i += 1) {
    const x = min + i * step
    try {
      const y = plot.sample(x, sliders)
      if (previous !== null && Math.abs(y - previous) > jump) points.push(null)
      points.push([x, y])
      previous = y
    } catch {
      points.push(null)
      previous = null
    }
  }
  return points
}

export function firstExpression(text: string | null | undefined): string {
  if (!text) return 'x^2'
  for (const line of text.split('\n')) {
    const candidate = line.trim().replace(/^\$\$?|\$\$?$/g, '')
    if (!candidate) continue
    try {
      preparePlot(candidate)
      return candidate
    } catch {
      /* try the next line */
    }
  }
  return 'x^2'
}
