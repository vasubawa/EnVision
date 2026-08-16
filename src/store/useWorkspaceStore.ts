import { create } from 'zustand'
import { ChatEntry } from '@/types/feedback'

interface WorkspaceState {
  file: File | null
  setFile: (file: File | null) => void

  // File queued to be sent as the first chat message when entering a workspace
  pendingFileForChat: File | null
  setPendingFileForChat: (file: File | null) => void

  // Base64 image data URL queued from in-workspace uploads (toolbar/camera) to be sent to chat
  queuedImageForChat: string | null
  setQueuedImageForChat: (dataUrl: string | null) => void

  // Hybrid Feed
  chatHistory: ChatEntry[]
  addChatEntry: (entry: ChatEntry) => void
  setChatHistory: (entries: ChatEntry[]) => void
  clearChat: () => void

  // Canvas Image Capture
  getCanvasImage: (() => string | null) | null
  setGetCanvasImage: (fn: (() => string | null) | null) => void
  getCanvasJson: (() => string | null) | null
  setGetCanvasJson: (fn: (() => string | null) | null) => void

  lastCanvasUpdate: number
  setLastCanvasUpdate: (timestamp: number) => void

  // Auto-Check Settings
  isAutoCheckEnabled: boolean
  setIsAutoCheckEnabled: (enabled: boolean) => void
  autoCheckDelay: number
  setAutoCheckDelay: (delay: number) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  file: null,
  setFile: (file) => set({ file }),

  pendingFileForChat: null,
  setPendingFileForChat: (file) => set({ pendingFileForChat: file }),

  queuedImageForChat: null,
  setQueuedImageForChat: (dataUrl) => set({ queuedImageForChat: dataUrl }),

  chatHistory: [],
  addChatEntry: (entry) => set((state) => ({ chatHistory: [...state.chatHistory, entry] })),
  setChatHistory: (entries) => set({ chatHistory: entries }),
  clearChat: () => set({ chatHistory: [] }),

  getCanvasImage: null,
  setGetCanvasImage: (fn) => set({ getCanvasImage: fn }),
  getCanvasJson: null,
  setGetCanvasJson: (fn) => set({ getCanvasJson: fn }),

  lastCanvasUpdate: 0,
  setLastCanvasUpdate: (timestamp) => set({ lastCanvasUpdate: timestamp }),

  isAutoCheckEnabled: false,
  setIsAutoCheckEnabled: (enabled) => set({ isAutoCheckEnabled: enabled }),
  autoCheckDelay: 5000,
  setAutoCheckDelay: (delay) => set({ autoCheckDelay: delay }),
}))
