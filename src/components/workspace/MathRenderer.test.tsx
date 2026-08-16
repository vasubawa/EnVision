import { render } from '@testing-library/react'
import { MathRenderer } from './MathRenderer'
import React from 'react'

describe('MathRenderer', () => {
  it('protects inline code and fenced code from math delimiter conversion and curly quote normalization', () => {
    const { container } = render(
      <MathRenderer content={'Here is code: `\\( x “y” \\)` and ```\n\\[ a “b” \\]\n```'} />,
    )
    expect(container.textContent).toContain('\\( x “y” \\)')
    expect(container.textContent).toContain('\\[ a “b” \\]')
  })

  it('normalizes curly quotes inside math expressions', () => {
    const { container } = render(
      <MathRenderer content={'Math: $x = “y”$ and bare LaTeX: x = “y”'} />,
    )
    // The bare LaTeX x = "y" should be wrapped and normalized
    expect(container.textContent).toContain('x = "y"')
  })
})
