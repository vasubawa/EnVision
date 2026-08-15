'use client'

const BACKGROUND_FORMULAS = [
  {
    text: '∇ · E = ρ/ε₀\n∇ × E = −∂B/∂t\n∇ · B = 0\n∇ × B = μ₀J + μ₀ε₀(∂E/∂t)',
    pos: 'top-[5%] left-[4%]',
    size: 'text-xl sm:text-2xl',
    rot: 'rotate-[-4deg]',
  },
  {
    text: 'iℏ(∂Ψ/∂t) = ĤΨ\nĤ = −(ℏ²/2m)∇² + V(r,t)',
    pos: 'top-[65%] right-[5%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[3deg]',
  },
  {
    text: 'X(f) = ∫ x(t) e^(−i2πft) dt\nx(t) = ∫ X(f) e^(i2πft) df',
    pos: 'top-[15%] right-[6%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[6deg]',
  },
  {
    text: 'ρ(∂u/∂t + u · ∇u) = −∇p + ∇ · τ + ρg',
    pos: 'bottom-[18%] left-[5%]',
    size: 'text-xl sm:text-2xl',
    rot: 'rotate-[-5deg]',
  },
  {
    text: 'H(X) = −∑ P(x) log₂ P(x)',
    pos: 'top-[30%] left-[8%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[-2deg]',
  },
  {
    text: 'f(x) = (1/σ√2π) e^[−½((x−μ)/σ)²]',
    pos: 'bottom-[35%] right-[8%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[-4deg]',
  },
  {
    text: '∂L/∂q − (d/dt)(∂L/∂q̇) = 0\nL = T − V',
    pos: 'top-[42%] right-[10%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[5deg]',
  },
  {
    text: 'f(x) = ∑ [fⁿ(a)/n!] (x − a)ⁿ\neˣ = 1 + x + x²/2! + x³/3! + ...',
    pos: 'bottom-[25%] left-[12%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[7deg]',
  },
  {
    text: 'P(A|B) = [P(B|A) P(A)] / P(B)',
    pos: 'top-[50%] left-[3%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[2deg]',
  },
  {
    text: 'dS = δQ / T\nΔS_universe ≥ 0',
    pos: 'bottom-[10%] left-[28%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[-3deg]',
  },
  {
    text: 'A v = λ v\ndet(A − λI) = 0',
    pos: 'top-[80%] left-[45%]',
    size: 'text-lg sm:text-xl',
    rot: 'rotate-[4deg]',
  },
  {
    text: 'e^(iπ) + 1 = 0',
    pos: 'bottom-[52%] right-[12%]',
    size: 'text-2xl sm:text-3xl',
    rot: 'rotate-[8deg]',
  },
]

export function BackgroundMath() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {BACKGROUND_FORMULAS.map(({ text, pos, size, rot }, i) => (
        <div key={i} className={`absolute ${pos} ${rot}`}>
          <span
            className={`text-foreground block font-serif italic ${size} leading-tight whitespace-pre-wrap opacity-[0.25] dark:opacity-[0.12]`}
          >
            {text}
          </span>
        </div>
      ))}
    </div>
  )
}
