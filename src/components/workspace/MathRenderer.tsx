import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  content: string
  className?: string
}

// Prose words that signal the end of a math run (LLM sometimes writes bare LaTeX without $)
const PROSE_WORDS = new Set([
  'to',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'do',
  'does',
  'did',
  'that',
  'which',
  'where',
  'when',
  'if',
  'then',
  'so',
  'but',
  'for',
  'in',
  'of',
  'the',
  'a',
  'an',
  'on',
  'at',
  'by',
  'from',
  'with',
  'not',
  'can',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'this',
  'these',
  'those',
  'it',
  'we',
  'you',
  'they',
  'he',
  'she',
  'as',
  'such',
  'since',
  'because',
  'while',
  'although',
  'however',
  'therefore',
  'thus',
  'consider',
  'use',
  'using',
  'let',
  'note',
  'recall',
  'find',
  'compute',
  'evaluate',
  'parameterize',
  'simplify',
  'expand',
  'integrate',
  'differentiate',
])

// Regex: LaTeX command OR math structural chars
const LATEX_CHAR_RE = /\\[a-zA-Z]+|[{}^_]/

/**
 * Detects LaTeX commands that appear outside $...$ delimiters (bare LaTeX)
 * and wraps them in $...$, so KaTeX can render them.
 */
function wrapBareLatex(text: string): string {
  // Step 1 — protect already-delimited spans with placeholders
  const spans: string[] = []
  const protected_ = text.replace(/\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]*?\$/g, (m) => {
    spans.push(m)
    return `\x00${spans.length - 1}\x00`
  })

  // Quick exit: no bare LaTeX commands present
  if (!/\\[a-zA-Z]/.test(protected_)) {
    return spans.reduce((s, span, i) => s.replace(`\x00${i}\x00`, span), protected_)
  }

  // Step 2 — token-based state machine
  const tokens = protected_.split(/(\s+)/)
  const out: string[] = []
  let mathBuf: string[] = []
  let inMath = false

  const flushMath = (...extra: string[]) => {
    if (mathBuf.length) {
      // Find trailing spaces
      const trailingSpaces: string[] = []
      while (mathBuf.length && /^\s+$/.test(mathBuf[mathBuf.length - 1])) {
        trailingSpaces.unshift(mathBuf.pop()!)
      }

      const expr = mathBuf.join('').trim()
      if (
        expr &&
        (/\\[a-zA-Z]/.test(expr) ||
          /[{}^_]/.test(expr) ||
          (/[=+\-*/]/.test(expr) && /[xyz]/.test(expr)))
      ) {
        out.push(`$${expr}$`)
      } else {
        out.push(...mathBuf)
      }
      out.push(...trailingSpaces)
      mathBuf = []
    }
    out.push(...extra)
    inMath = false
  }

  for (const tok of tokens) {
    // Whitespace: buffer if in math, emit otherwise
    if (/^\s+$/.test(tok)) {
      if (inMath) mathBuf.push(tok)
      else out.push(tok)
      continue
    }

    // Protected placeholder: always ends any math run
    if (tok.includes('\x00')) {
      if (inMath) flushMath(tok)
      else out.push(tok)
      continue
    }

    const hasLatex = LATEX_CHAR_RE.test(tok)
    const isProseWord = /^[a-zA-Z]+$/.test(tok) && PROSE_WORDS.has(tok.toLowerCase())
    const isPunct = /^[.!?;:]/.test(tok)

    if (hasLatex) {
      if (!inMath) {
        // Try to absorb preceding context: "y =", "f(x) =", "dS =", etc.
        const stolen: string[] = []
        let k = out.length - 1
        let stolen_non_ws = 0
        while (k >= 0 && stolen_non_ws < 5) {
          const prev = out[k]
          if (/^\s+$/.test(prev)) {
            stolen.unshift(prev)
            k--
            continue
          }
          // Steal: single-letter variables, digits, operators, parens, equals, commas, dots
          if (/^[a-zA-Z0-9=+\-*/()[\]|.,]$/.test(prev) || /^[a-zA-Z]{1,3}$/.test(prev)) {
            stolen.unshift(prev)
            k--
            stolen_non_ws++
          } else break
        }
        if (stolen.length && stolen_non_ws > 0) out.splice(out.length - stolen.length)
        mathBuf.push(...stolen)
        inMath = true
      }
      mathBuf.push(tok)
    } else if (inMath) {
      if (isProseWord || isPunct) {
        // Trim trailing whitespace from mathBuf before flushing
        while (mathBuf.length && /^\s+$/.test(mathBuf[mathBuf.length - 1])) {
          out.push(mathBuf.pop()!)
        }
        flushMath(tok)
      } else {
        mathBuf.push(tok)
      }
    } else {
      out.push(tok)
    }
  }

  if (inMath) flushMath()

  // Step 3 — restore protected spans
  let result = out.join('')
  spans.forEach((span, i) => {
    result = result.replace(`\x00${i}\x00`, span)
  })
  return result
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  let preprocessed = wrapBareLatex(content)

  preprocessed = preprocessed.replace(/\\(i*nt|oint)([^\s\\])/g, '\\$1 $2')

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {preprocessed}
      </ReactMarkdown>
    </div>
  )
}
