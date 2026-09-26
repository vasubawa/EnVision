import { create } from 'zustand'
import { ChatEntry } from '@/types/feedback'

interface WorkspaceState {
  file: File | null
  setFile: (file: File | null) => void

  chatHistory: ChatEntry[]
  addChatEntry: (entry: ChatEntry) => void
  setChatHistory: (entries: ChatEntry[]) => void
  clearChat: () => void

  ocrText: string | null
  setOcrText: (text: string | null) => void

  getCanvasImage: (() => string | null) | null
  setGetCanvasImage: (fn: (() => string | null) | null) => void
  getCanvasJson: (() => string | null) | null
  setGetCanvasJson: (fn: (() => string | null) | null) => void

  lastCanvasUpdate: number
  setLastCanvasUpdate: (timestamp: number) => void

  canvasTranscription: string | null
  setCanvasTranscription: (text: string | null) => void

  lastTranscribedCanvasUpdate: number
  setLastTranscribedCanvasUpdate: (timestamp: number) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  file: null,
  setFile: (file) => set({ file }),

  chatHistory: [],
  addChatEntry: (entry) => set((state) => ({ chatHistory: [...state.chatHistory, entry] })),
  setChatHistory: (entries) => set({ chatHistory: entries }),
  clearChat: () => set({ chatHistory: [] }),

  ocrText: null,
  setOcrText: (text) => set({ ocrText: text }),

  getCanvasImage: null,
  setGetCanvasImage: (fn) => set({ getCanvasImage: fn }),
  getCanvasJson: null,
  setGetCanvasJson: (fn) => set({ getCanvasJson: fn }),

  lastCanvasUpdate: 0,
  setLastCanvasUpdate: (timestamp) => set({ lastCanvasUpdate: timestamp }),

  canvasTranscription: null,
  setCanvasTranscription: (text) => set({ canvasTranscription: text }),

  lastTranscribedCanvasUpdate: 0,
  setLastTranscribedCanvasUpdate: (timestamp) => set({ lastTranscribedCanvasUpdate: timestamp }),
}))
