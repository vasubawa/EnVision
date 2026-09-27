export interface ChatEntry {
  id: string
  timestamp: number
  role: 'user' | 'assistant'
  type: 'feedback' | 'message'
  isCorrect?: boolean | null
  judgement?: Judgement
  content: string
}

export type Judgement = 'correct' | 'progress' | 'mistake'

export interface Feedback {
  isCorrect: boolean | null
  judgement: Judgement
  suggestion: string
}

export function isFeedbackShape(
  obj: unknown,
): obj is { suggestion: string; isCorrect?: boolean; judgement?: string } {
  if (typeof obj !== 'object' || obj === null) return false
  const record = obj as { suggestion?: unknown; isCorrect?: unknown; judgement?: unknown }
  if (typeof record.suggestion !== 'string') return false
  return (
    record.judgement === 'correct' ||
    record.judgement === 'progress' ||
    record.judgement === 'mistake' ||
    typeof record.isCorrect === 'boolean'
  )
}

export function normalizeFeedback(obj: {
  suggestion: string
  isCorrect?: boolean
  judgement?: string
}): Feedback {
  const suggestion = obj.suggestion
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const judgement: Judgement =
    obj.judgement === 'correct' || obj.judgement === 'progress' || obj.judgement === 'mistake'
      ? obj.judgement
      : obj.isCorrect
        ? 'correct'
        : 'mistake'
  return {
    suggestion,
    judgement,
    isCorrect: judgement === 'correct' ? true : judgement === 'mistake' ? false : null,
  }
}
