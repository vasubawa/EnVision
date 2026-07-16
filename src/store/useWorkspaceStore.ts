import { create } from "zustand";
import { ChatEntry } from "@/types/feedback";

interface WorkspaceState {
  file: File | null;
  setFile: (file: File | null) => void;

  // Hybrid Feed
  chatHistory: ChatEntry[];
  addChatEntry: (entry: ChatEntry) => void;
  clearChat: () => void;

  // Canvas Image Capture
  getCanvasImage: (() => string | null) | null;
  setGetCanvasImage: (fn: (() => string | null) | null) => void;

  lastCanvasUpdate: number;
  setLastCanvasUpdate: (timestamp: number) => void;

  // Auto-Check Settings
  isAutoCheckEnabled: boolean;
  setIsAutoCheckEnabled: (enabled: boolean) => void;
  autoCheckDelay: number;
  setAutoCheckDelay: (delay: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  file: null,
  setFile: (file) => set({ file }),

  chatHistory: [],
  addChatEntry: (entry) => set((state) => ({ chatHistory: [...state.chatHistory, entry] })),
  clearChat: () => set({ chatHistory: [] }),

  getCanvasImage: null,
  setGetCanvasImage: (fn) => set({ getCanvasImage: fn }),

  lastCanvasUpdate: 0,
  setLastCanvasUpdate: (timestamp) => set({ lastCanvasUpdate: timestamp }),

  isAutoCheckEnabled: false,
  setIsAutoCheckEnabled: (enabled) => set({ isAutoCheckEnabled: enabled }),
  autoCheckDelay: 5000,
  setAutoCheckDelay: (delay) => set({ autoCheckDelay: delay }),
}));
