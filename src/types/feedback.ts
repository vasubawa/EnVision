export interface ChatEntry {
  id: string
  timestamp: number
  role: 'user' | 'assistant'
  type: 'feedback' | 'message' // feedback = automated socratic check, message = free-form chat
  isCorrect?: boolean // Only applicable if type === 'feedback'
  content: string // The markdown content / suggestion
}

// Shared shape expected from LLM JSON output in the analyze-work routes.
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
