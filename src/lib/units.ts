type Dim = { L: number; M: number; T: number; N: number }

const D0: Dim = { L: 0, M: 0, T: 0, N: 0 }

function dim(partial: Partial<Dim>): Dim {
  return { ...D0, ...partial }
}

function sameDim(a: Dim, b: Dim): boolean {
  return a.L === b.L && a.M === b.M && a.T === b.T && a.N === b.N
}

function addDim(a: Dim, b: Dim, sign = 1): Dim {
  return { L: a.L + sign * b.L, M: a.M + sign * b.M, T: a.T + sign * b.T, N: a.N + sign * b.N }
}

const BASE: Record<string, { dim: Dim; scale: number }> = {
  m: { dim: dim({ L: 1 }), scale: 1 },
  km: { dim: dim({ L: 1 }), scale: 1000 },
  cm: { dim: dim({ L: 1 }), scale: 0.01 },
  mm: { dim: dim({ L: 1 }), scale: 0.001 },
  s: { dim: dim({ T: 1 }), scale: 1 },
  min: { dim: dim({ T: 1 }), scale: 60 },
  h: { dim: dim({ T: 1 }), scale: 3600 },
  hr: { dim: dim({ T: 1 }), scale: 3600 },
  kg: { dim: dim({ M: 1 }), scale: 1 },
  g: { dim: dim({ M: 1 }), scale: 0.001 },
  mol: { dim: dim({ N: 1 }), scale: 1 },
  newton: { dim: dim({ M: 1, L: 1, T: -2 }), scale: 1 },
  j: { dim: dim({ M: 1, L: 2, T: -2 }), scale: 1 },
  J: { dim: dim({ M: 1, L: 2, T: -2 }), scale: 1 },
  w: { dim: dim({ M: 1, L: 2, T: -3 }), scale: 1 },
  W: { dim: dim({ M: 1, L: 2, T: -3 }), scale: 1 },
  N: { dim: dim({ M: 1, L: 1, T: -2 }), scale: 1 },
}

type Unit = { dim: Dim; scale: number }

function powUnit(unit: Unit, exp: number): Unit {
  return {
    dim: { L: unit.dim.L * exp, M: unit.dim.M * exp, T: unit.dim.T * exp, N: unit.dim.N * exp },
    scale: unit.scale ** exp,
  }
}

function mulUnit(a: Unit, b: Unit): Unit {
  return { dim: addDim(a.dim, b.dim), scale: a.scale * b.scale }
}

function parseUnit(raw: string): Unit | null {
  const text = raw.trim().replace(/·/g, '*')
  if (text === 'n' || text === 'a' || text === 't' || text === 'v') return null
  if (!text || /[a-z]{2,}/.test(text.replace(/km|cm|mm|min|hr|mol|kg/g, ''))) {
    /* multi-letter leftovers that are not units */
  }
  const [top, bottom] = text.split('/')
  if (bottom === undefined) return product(top)
  const numerator = product(top)
  const denominator = product(bottom)
  if (!numerator || !denominator) return null
  return {
    dim: addDim(numerator.dim, denominator.dim, -1),
    scale: numerator.scale / denominator.scale,
  }
}

function product(raw: string): Unit | null {
  let acc: Unit = { dim: D0, scale: 1 }
  const pieces = raw.split('*').filter(Boolean)
  if (pieces.length === 0) return null
  for (const piece of pieces) {
    const match = piece.match(/^([A-Za-z]+)(?:\^(-?\d+))?$/)
    if (!match) return null
    const base = BASE[match[1]]
    if (!base) return null
    const exp = match[2] ? Number(match[2]) : 1
    acc = mulUnit(acc, powUnit(base, exp))
  }
  return acc
}

type Qty = { value: number; unit: Unit; label: string }

function quantitiesIn(expression: string): Qty[] {
  const found: Qty[] = []
  const pattern = /(-?\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z/*^0-9-]*)/g
  for (const match of expression.matchAll(pattern)) {
    const unit = parseUnit(match[2])
    if (!unit) continue
    found.push({ value: Number(match[1]), unit, label: `${match[1]} ${match[2]}` })
  }
  return found
}

function splitTerms(expression: string): string[] {
  const terms: string[] = []
  let current = ''
  let depth = 0
  for (const ch of expression) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if ((ch === '+' || ch === '-') && depth === 0 && current.trim()) {
      terms.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) terms.push(current)
  return terms
}

/** Flag unit mistakes in one written line. Symbolic work with no units is ignored. */
export function reviewUnits(text: string): { detail: string } | null {
  const problems: string[] = []
  for (const line of text.split('\n')) {
    const [left, right] = line.split('=')
    if (right) {
      const a = quantitiesIn(left)
      const b = quantitiesIn(right)
      if (a.length === 1 && b.length === 1 && !sameDim(a[0].unit.dim, b[0].unit.dim)) {
        problems.push(`${a[0].label} and ${b[0].label} are different kinds of quantity`)
      } else if (a.length === 1 && b.length === 1 && sameDim(a[0].unit.dim, b[0].unit.dim)) {
        const leftSi = a[0].value * a[0].unit.scale
        const rightSi = b[0].value * b[0].unit.scale
        const scale = Math.max(Math.abs(leftSi), Math.abs(rightSi), 1)
        if (Math.abs(leftSi - rightSi) / scale > 0.02) {
          problems.push(`${a[0].label} is not equal to ${b[0].label} once the units match`)
        }
      }
    }
    for (const termGroup of line.split('=')) {
      const terms = splitTerms(termGroup)
      const measured = terms.flatMap((term) => {
        const found = quantitiesIn(term)
        if (found.length !== 1) return []
        return found.map((qty) => ({ ...qty, term }))
      })
      if (measured.length < 2) continue
      const first = measured[0]
      for (const next of measured.slice(1)) {
        if (!sameDim(first.unit.dim, next.unit.dim)) {
          problems.push(`cannot add ${first.label} and ${next.label}`)
        } else if (
          Math.abs(first.unit.scale - next.unit.scale) /
            Math.max(first.unit.scale, next.unit.scale) >
          0.001
        ) {
          problems.push(`${first.label} and ${next.label} need the same unit before they are added`)
        }
      }
    }
  }
  if (problems.length === 0) return null
  return { detail: `Unit check: ${[...new Set(problems)].join('; ')}.` }
}
