import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import 'katex/contrib/mhchem'
import rehypeKatex from 'rehype-katex'

interface MathRendererProps {
  content: string
  className?: string
}

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

const LATEX_CHAR_RE = /\\[a-zA-Z]+|[{}^_]/

function wrapBareLatex(text: string): string {
  const spans: string[] = []
  const protected_ = text.replace(/\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]*?\$/g, (m) => {
    spans.push(m)
    return `\x00${spans.length - 1}\x00`
  })

  if (!/\\[a-zA-Z]/.test(protected_)) {
    return spans.reduce((s, span, i) => s.replace(`\x00${i}\x00`, span), protected_)
  }

  const tokens = protected_.split(/(\s+)/)
  const out: string[] = []
  let mathBuf: string[] = []
  let inMath = false

  const flushMath = (...extra: string[]) => {
    if (mathBuf.length) {
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
    if (/^\s+$/.test(tok)) {
      if (inMath) mathBuf.push(tok)
      else out.push(tok)
      continue
    }

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

  let result = out.join('')
  spans.forEach((span, i) => {
    result = result.replace(`\x00${i}\x00`, span)
  })
  return result
}

export const MathRenderer: React.FC<MathRendererProps> = React.memo(function MathRenderer({
  content,
  className = '',
}) {
  let preprocessed = content

  const codeSpans: string[] = []
  preprocessed = preprocessed.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
    codeSpans.push(m)
    return `\x01${codeSpans.length - 1}\x01`
  })

  preprocessed = preprocessed
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')

  preprocessed = wrapBareLatex(preprocessed)

  preprocessed = preprocessed.replace(/\\(i*nt|oint)([^\s\\])/g, '\\$1 $2')

  preprocessed = preprocessed.replace(/\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]*?\$/g, (math) =>
    math.replace(/[“”]/g, '"'),
  )

  codeSpans.forEach((span, i) => {
    preprocessed = preprocessed.replace(`\x01${i}\x01`, span)
  })

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {preprocessed}
      </ReactMarkdown>
    </div>
  )
})
