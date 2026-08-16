'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="font-serif text-2xl font-medium">Something went wrong</h1>
      <p className="text-foreground/60 max-w-sm text-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="bg-foreground text-background hover:bg-foreground/90 rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
