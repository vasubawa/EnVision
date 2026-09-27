/**
 * Bounded algebra checks. Walks an expression tree and uses exact fractions.
 * Never evaluates arbitrary code.
 */

import { reviewUnits } from './units.ts'

const MAX_LENGTH = 160
const MAX_NODES = 80

class Rat {
  readonly n: bigint
  readonly d: bigint

  constructor(n: bigint, d: bigint = BigInt(1)) {
    if (d === BigInt(0)) throw new Error('Division by zero')
    if (d < BigInt(0)) {
      n = -n
      d = -d
    }
    const g = gcd(n < BigInt(0) ? -n : n, d)
    this.n = n / g
    this.d = d / g
  }

  add(other: Rat, sign = BigInt(1)): Rat {
    return new Rat(this.n * other.d + sign * other.n * this.d, this.d * other.d)
  }

  mul(other: Rat): Rat {
    return new Rat(this.n * other.n, this.d * other.d)
  }

  div(other: Rat): Rat {
    return new Rat(this.n * other.d, this.d * other.n)
  }

  eq(other: Rat): boolean {
    return this.n === other.n && this.d === other.d
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== BigInt(0)) {
    const t = b
    b = a % b
    a = t
  }
  return a === BigInt(0) ? BigInt(1) : a
}

type Node =
  | { type: 'num'; value: Rat }
  | { type: 'name'; id: string }
  | { type: 'unary'; op: '+' | '-'; arg: Node }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }

function parseNumber(raw: string): Rat {
  const text = raw.trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('Unsupported number')
  const negative = text.startsWith('-')
  const body = negative ? text.slice(1) : text
  const [whole, frac = ''] = body.split('.')
  const digits = `${whole}${frac}`
  const scale = BigInt(10) ** BigInt(frac.length)
  const value = new Rat(BigInt(digits || '0'), scale)
  return negative ? new Rat(-value.n, value.d) : value
}

function tokenize(source: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if ('+-*/^()'.includes(ch)) {
      tokens.push(ch)
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1
      tokens.push(source.slice(i, j))
      i = j
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1
      while (j < source.length && /[A-Za-z0-9]/.test(source[j])) j += 1
      tokens.push(source.slice(i, j))
      i = j
      continue
    }
    throw new Error('Unsupported math syntax')
  }
  return tokens
}

function parseExpression(source: string): Node {
  const tokens = tokenize(source)
  let index = 0
  let nodes = 0

  const peek = () => tokens[index]
  const eat = (expected?: string) => {
    const token = tokens[index]
    if (expected && token !== expected) throw new Error('Unsupported math syntax')
    index += 1
    return token
  }
  const node = (value: Node): Node => {
    nodes += 1
    if (nodes > MAX_NODES) throw new Error('Expression too complex')
    return value
  }

  const parseExpr = (): Node => parseAdd()

  const parseAdd = (): Node => {
    let left = parseMul()
    while (peek() === '+' || peek() === '-') {
      const op = eat() as '+' | '-'
      left = node({ type: 'binary', op, left, right: parseMul() })
    }
    return left
  }

  const parseMul = (): Node => {
    let left = parsePow()
    while (peek() === '*' || peek() === '/') {
      const op = eat() as '*' | '/'
      left = node({ type: 'binary', op, left, right: parsePow() })
    }
    return left
  }

  const parsePow = (): Node => {
    const left = parseUnary()
    if (peek() !== '^') return left
    eat('^')
    return node({ type: 'binary', op: '^', left, right: parseUnary() })
  }

  const parseUnary = (): Node => {
    if (peek() === '+' || peek() === '-') {
      const op = eat() as '+' | '-'
      return node({ type: 'unary', op, arg: parseUnary() })
    }
    return parsePrimary()
  }

  const parsePrimary = (): Node => {
    const token = peek()
    if (!token) throw new Error('Expression too long or empty')
    if (token === '(') {
      eat('(')
      const inner = parseExpr()
      eat(')')
      return inner
    }
    if (/^-?\d/.test(token) || token.includes('.')) {
      eat()
      return node({ type: 'num', value: parseNumber(token) })
    }
    if (/^[A-Za-z]/.test(token)) {
      eat()
      return node({ type: 'name', id: token })
    }
    throw new Error('Unsupported math syntax')
  }

  const tree = parseExpr()
  if (index !== tokens.length) throw new Error('Unsupported math syntax')
  return tree
}

function trim(poly: Rat[]): Rat[] {
  const next = poly.slice()
  while (next.length > 1 && next[next.length - 1].n === BigInt(0)) next.pop()
  if (
    next.length > 5 ||
    next.some((c) => {
      const limit = BigInt(10) ** BigInt(12)
      const n = c.n < BigInt(0) ? -c.n : c.n
      return n > limit || c.d > limit
    })
  ) {
    throw new Error('Calculation out of bounds')
  }
  return next
}

function addPoly(a: Rat[], b: Rat[], sign = BigInt(1)): Rat[] {
  const length = Math.max(a.length, b.length)
  const out: Rat[] = []
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? new Rat(BigInt(0))
    const right = b[i] ?? new Rat(BigInt(0))
    out.push(left.add(right, sign))
  }
  return trim(out)
}

function mulPoly(a: Rat[], b: Rat[]): Rat[] {
  const out = Array.from({ length: a.length + b.length - 1 }, () => new Rat(BigInt(0)))
  a.forEach((x, i) => {
    b.forEach((y, j) => {
      out[i + j] = out[i + j].add(x.mul(y))
    })
  })
  return trim(out)
}

function variablesIn(tree: Node, found = new Set<string>()): Set<string> {
  if (tree.type === 'name') found.add(tree.id)
  if (tree.type === 'unary') variablesIn(tree.arg, found)
  if (tree.type === 'binary') {
    variablesIn(tree.left, found)
    variablesIn(tree.right, found)
  }
  return found
}

function evalPoly(tree: Node): Rat[] {
  if (tree.type === 'num') return trim([tree.value])
  if (tree.type === 'name') return [new Rat(BigInt(0)), new Rat(BigInt(1))]
  if (tree.type === 'unary') {
    const inner = evalPoly(tree.arg)
    return tree.op === '-' ? inner.map((c) => new Rat(-c.n, c.d)) : inner
  }
  const left = evalPoly(tree.left)
  const right = evalPoly(tree.right)
  if (tree.op === '+') return addPoly(left, right)
  if (tree.op === '-') return addPoly(left, right, BigInt(-1))
  if (tree.op === '*') return mulPoly(left, right)
  if (tree.op === '/' && right.length === 1 && right[0].n !== BigInt(0)) {
    return trim(left.map((c) => c.div(right[0])))
  }
  if (
    tree.op === '^' &&
    right.length === 1 &&
    right[0].d === BigInt(1) &&
    right[0].n >= BigInt(0) &&
    right[0].n <= BigInt(4)
  ) {
    let result = [new Rat(BigInt(1))]
    for (let i = BigInt(0); i < right[0].n; i += BigInt(1)) result = mulPoly(result, left)
    return result
  }
  throw new Error('Unsupported math syntax')
}

function prepare(expression: string): { source: string; tree: Node } {
  const source = expression.trim().replaceAll('**', '^')
  if (!source || source.length > MAX_LENGTH) throw new Error('Expression too long or empty')
  const tree = parseExpression(source)
  const variables = variablesIn(tree)
  if (variables.size > 1 || [...variables].some((name) => name.length !== 1)) {
    throw new Error('Only one variable is supported')
  }
  return { source, tree }
}

export function polynomial(expression: string): Rat[] {
  const { tree } = prepare(expression)
  return evalPoly(tree)
}

function samePoly(a: Rat[], b: Rat[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value.eq(b[index]))
}

export function equivalent(left: string, right: string): boolean {
  const a = left.trim()
  const b = right.trim()
  if (Math.max(a.length, b.length) > MAX_LENGTH) throw new Error('Expression too long')
  const names = new Set<string>()
  for (const side of [a, b]) {
    const probe = side.replaceAll('=', '-').replaceAll('**', '^')
    for (const name of variablesIn(parseExpression(probe))) names.add(name)
  }
  if (names.size > 1) throw new Error('Different variables')

  if (!a.includes('=') && !b.includes('=')) {
    return samePoly(polynomial(a), polynomial(b))
  }
  if (a.split('=').length !== 2 || b.split('=').length !== 2) {
    throw new Error('Use two equations or two expressions')
  }

  const coefficients = (equation: string) => {
    const [lhs, rhs] = equation.split('=')
    const poly = polynomial(`(${lhs})-(${rhs})`)
    if (poly.length > 2) throw new Error('Only linear equation steps supported')
    return poly
  }
  const leftCoeffs = coefficients(a)
  const rightCoeffs = coefficients(b)
  if (leftCoeffs.length === 1 && rightCoeffs.length === 1) {
    return (leftCoeffs[0].n === BigInt(0)) === (rightCoeffs[0].n === BigInt(0))
  }
  if (leftCoeffs.length !== rightCoeffs.length) return false
  return leftCoeffs[0].mul(rightCoeffs[1]).eq(rightCoeffs[0].mul(leftCoeffs[1]))
}

function normalizeMath(raw: string): string {
  let text = raw.trim()
  text = text.replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, '')
  text = text.replace(/\\left|\\right/g, '')
  text = text.replace(/\\(?:times|cdot)/g, '*')
  text = text.replace(/\\div/g, '/')
  text = text.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
  text = text.replace(/[{}]/g, '')
  text = text.replace(/\s+/g, '')
  text = text.replace(/(\d)(?=[A-Za-z(])/g, '$1*')
  text = text.replace(/([A-Za-z)])(?=\d)/g, '$1*')
  text = text.replace(/([A-Za-z)])(?=\()/g, '$1*')
  return text
}

function equationsIn(text: string): string[] {
  const chunks = text.split(/[\n;]+/)
  const found: string[] = []
  for (const chunk of chunks) {
    const stripped = chunk.replace(/\$\$?|\\\(|\\\)/g, ' ')
    const match = stripped.match(/([^:=\n]{1,80})=(?!=)([^:=\n]{1,80})/)
    if (!match) continue
    const equation = `${normalizeMath(match[1])}=${normalizeMath(match[2])}`
    if (equation.length > 2 && equation.length <= MAX_LENGTH) found.push(equation)
  }
  return [...new Set(found)]
}

export type AlgebraReview = { detail: string; rejects: boolean }

const CHEMICAL_WORK =
  /→|->|⇌|<=>|\b(?:Br|Cl|OH|COOH|Ph|Et|Me)\b|\bC\d+H|\bCH\d|\bH\d+O|\b[A-Z][a-z]?\d/

/** Algebra checks stay off reaction schemes and formulas. Numerical arithmetic still counts. */
export function reviewAlgebra(text: string): AlgebraReview | null {
  if (CHEMICAL_WORK.test(text)) return null
  const equations = equationsIn(text)
  const readable: string[] = []
  const rejections: string[] = []

  for (const equation of equations) {
    const [left, right] = equation.split('=')
    try {
      polynomial(left)
      polynomial(right)
    } catch {
      continue
    }
    readable.push(equation)
    try {
      const names = variablesIn(parseExpression(left.replaceAll('**', '^')))
      variablesIn(parseExpression(right.replaceAll('**', '^')), names)
      if (names.size === 0 && !equivalent(left, right)) {
        rejections.push(`${left} = ${right}`)
      }
    } catch {
      /* a single unsolved equation is not an identity */
    }
  }

  const variableSteps = readable.filter((equation) => /[A-Za-z]/.test(equation))
  if (variableSteps.length >= 2) {
    const [first, ...rest] = variableSteps
    for (const step of rest) {
      try {
        if (!equivalent(first, step)) rejections.push(`${step} does not match ${first}`)
      } catch {
        /* quadratic and multi-variable steps stay with the model */
      }
    }
  }

  if (rejections.length > 0) {
    return {
      rejects: true,
      detail: `Local algebra check rejects: ${rejections.join('; ')}.`,
    }
  }
  if (readable.length === 0) return null
  const checkedAClaim =
    rejections.length > 0 ||
    readable.some((equation) => !/[A-Za-z]/.test(equation.split('=')[0] ?? '')) ||
    variableSteps.length >= 2
  if (!checkedAClaim) return null
  return {
    rejects: false,
    detail: 'Local algebra check agrees with the equalities it could read.',
  }
}

export function applyAlgebraVerdict<T extends { isCorrect: boolean | null; suggestion: string }>(
  result: T,
  transcription: string,
): T {
  const review = reviewAlgebra(transcription)
  if (!review?.rejects || !result.isCorrect) return result
  return {
    ...result,
    isCorrect: false,
    suggestion: `${review.detail} ${result.suggestion}`,
  }
}

export function applyBoardChecks<
  T extends {
    isCorrect: boolean | null
    judgement: 'correct' | 'progress' | 'mistake'
    suggestion: string
  },
>(result: T, transcription: string): T {
  const algebra = reviewAlgebra(transcription)
  const checked = algebra?.rejects
    ? {
        ...result,
        judgement: 'mistake' as const,
        isCorrect: false as const,
        suggestion: `${algebra.detail} ${result.suggestion}`,
      }
    : result
  const units = reviewUnits(transcription)
  if (!units) return checked
  return {
    ...checked,
    judgement: 'mistake',
    isCorrect: false,
    suggestion: `${units.detail} ${checked.suggestion}`,
  }
}

export function algebraPromptNote(text: string | null | undefined): string {
  if (!text?.trim()) return ''
  const review = reviewAlgebra(text)
  if (!review) return ''
  return `\n\n${review.detail} If the check rejects a step, treat that step as incorrect. Do not call a rejected step correct.`
}
