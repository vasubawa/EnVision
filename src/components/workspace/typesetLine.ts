import katex from 'katex'
import 'katex/contrib/mhchem'
import { domToPng } from 'modern-screenshot'

const INK = '#C05621'

export type LinePicture = { dataUrl: string; width: number; height: number }

export async function rasterizeLine(source: string, fontSize: number): Promise<LinePicture | null> {
  if (typeof document === 'undefined') return null
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '0'
  host.style.top = '0'
  host.style.color = INK
  host.style.background = 'transparent'
  host.style.fontSize = `${fontSize}px`
  document.body.appendChild(host)
  try {
    katex.render(source, host, { throwOnError: false, displayMode: false })
    if (host.querySelector('.katex-error')) return null
    const target = host.querySelector('.katex')
    if (!(target instanceof HTMLElement)) return null
    const box = target.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return null
    const dataUrl = await domToPng(target, { scale: 2, backgroundColor: null })
    return { dataUrl, width: box.width, height: box.height }
  } finally {
    host.remove()
  }
}
