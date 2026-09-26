export interface ChatEntry {
  id: string
  timestamp: number
  role: 'user' | 'assistant'
  type: 'feedback' | 'message'
  isCorrect?: boolean
  content: string
}

export interface Feedback {
  isCorrect: boolean
  suggestion: string
}

export function isFeedbackShape(obj: unknown): obj is Feedback {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Feedback).suggestion === 'string' &&
    typeof (obj as Feedback).isCorrect === 'boolean'
  )
}
