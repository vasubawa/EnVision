import { Type, type FunctionDeclaration } from '@google/genai'
import { SUBJECT_GUIDANCE } from '@/lib/prompts'
import type { LearningPreferences } from '@/store/useWorkspaceStore'

export const LIVE_MODELS = [
  'gemini-3.8-live',
  'gemini-2.5-flash-native-audio-latest',
  'gemini-3.1-flash-live-preview',
] as const

export function liveModelLabel(model: string): string {
  if (model === LIVE_MODELS[0]) return 'Live'
  if (model === LIVE_MODELS[1]) return 'Live backup'
  return 'Live spare'
}

export const LIVE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'check_math',
    description:
      'Check whether two algebra expressions or linear equations are equivalent before saying work is correct. Use explicit * and ^.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        left: { type: Type.STRING, description: 'Left expression or equation.' },
        right: { type: Type.STRING, description: 'Right expression or equation.' },
      },
      required: ['left', 'right'],
    },
  },
  {
    name: 'highlight_work',
    description:
      'Recolor the student strokes they selected, or their latest strokes, while you talk about them. Does not delete ink.',
  },
]

export function tutorInstruction(preferences: LearningPreferences, problemText: string): string {
  const lines = [
    'You are EnVision, a patient Socratic tutor beside a student whiteboard.',
    'Speak one or two short sentences, then wait. Ask one question at a time.',
    'Guide first. Do not dump a worked solution.',
    'A canvas image arrives only after the pen has rested. Do not speak merely because an image arrived.',
    'Before you call an arithmetic or one-variable linear step correct, call check_math and obey the result. Do not use that tool on chemical formulas, differential equations, circuits, or code.',
    SUBJECT_GUIDANCE,
    'When you refer to specific work, call highlight_work. Never claim you erased or replaced student ink.',
    'Say math in plain words.',
  ]
  if (preferences.oneStep) {
    lines.push('Give only the immediate next question or micro-step.')
  }
  if (preferences.shortReplies) {
    lines.push('Keep each reply to one sentence when you can.')
  }
  if (problemText.trim()) {
    lines.push(`Printed problem text, which the student may have corrected:\n${problemText.trim()}`)
  }
  return lines.join('\n')
}
