'use client'

import { useWorkspaceStore } from '@/store/useWorkspaceStore'

export function PrintedProblemChip() {
  const printedRead = useWorkspaceStore((state) => state.printedRead)
  const setPrintedRead = useWorkspaceStore((state) => state.setPrintedRead)
  if (!printedRead) return null

  return (
    <form
      className="border-border bg-card absolute top-3 left-3 z-30 w-[min(100%-1.5rem,360px)] rounded-2xl border p-3 shadow-lg"
      aria-label="Printed problem"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Problem on the page</p>
        <button
          type="button"
          className="text-foreground/60 text-xs"
          onClick={() => setPrintedRead(null)}
        >
          Dismiss
        </button>
      </div>
      {printedRead.status === 'reading' ? (
        <p className="text-foreground/70 text-sm">Reading formulas and structures…</p>
      ) : null}
      {printedRead.status === 'failed' ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {printedRead.error ?? 'Could not read that image. Type the problem below.'}
        </p>
      ) : null}
      {printedRead.status !== 'reading' ? (
        <textarea
          value={printedRead.text}
          aria-label="Correct the printed problem"
          rows={4}
          className="border-border bg-background w-full rounded-lg border px-2 py-1.5 text-sm"
          onChange={(event) => setPrintedRead({ status: 'ready', text: event.target.value })}
        />
      ) : null}
      <p className="text-foreground/50 mt-2 text-[11px]">
        {printedRead.rough
          ? 'Plain-text guess only. Correct the notation before you rely on it.'
          : 'Checked against the image. Handwriting you add later is read separately.'}
      </p>
    </form>
  )
}
