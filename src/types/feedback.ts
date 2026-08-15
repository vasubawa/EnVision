export interface ChatEntry {
  id: string
  timestamp: number
  role: 'user' | 'assistant'
  type: 'feedback' | 'message' // feedback = automated socratic check, message = free-form chat
  isCorrect?: boolean // Only applicable if type === 'feedback'
  content: string // The markdown content / suggestion
}
