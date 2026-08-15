export const VISION_TRANSCRIBE_PROMPT = `You are an expert math image transcriber. Describe exactly what is written on this whiteboard canvas: equations, steps, notation, any scratch work. The user is drawing with a mouse/finger, so handwriting can be very messy.

Common misreadings to correct for:
- A small squiggle, loop, or extra stroke positioned just above and to the right of a variable or number (superscript height) is almost always an exponent, not a stray mark or multiplication dot. Example: a messy "x" followed by a tiny loop at superscript height must be transcribed as "x^2", never dropped or read as just "x".
- "x" drawn quickly can look like "b" or "v" — use the surrounding equation and any typed problem statement to decide which variable actually makes sense.
- A stray horizontal line through a shape is often a fraction bar, not a minus sign — check whether there's a numerator above and a denominator below it.
- "6" vs "b", and "1" vs "l", are frequently confused in fast handwriting — use context (is it multiplying a variable? is it a standalone constant?) to disambiguate.
- Never silently drop a superscript, subscript, or small mark you're unsure about — describe what you see (e.g. "possible exponent, unclear value") rather than omitting it.

Pay close attention to typed problem statements at the top to infer the correct variables meant. Output structured text only — no interpretation of correctness, no commentary.

Return ONLY valid JSON: {"transcription": "string"}. No markdown, no extra text outside the JSON.`

export function extractTranscription(
  rawContent: string,
  stripThinking: (t: string) => string,
): string {
  const cleaned = stripThinking(rawContent)

  const tryParse = (text: string): string | null => {
    try {
      const obj = JSON.parse(text)
      if (typeof obj?.transcription === 'string')
        return obj.transcription.trim()
    } catch {
      /* not valid JSON, try next stage */
    }
    return null
  }

  return (
    tryParse(cleaned) ??
    tryParse(cleaned.replace(/```json|```/g, '').trim()) ??
    tryParse(cleaned.match(/\{[\s\S]*\}/)?.[0] ?? '') ??
    cleaned
  )
}
