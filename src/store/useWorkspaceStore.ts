import { create } from "zustand";

interface WorkspaceState {
  file: File | null;
  setFile: (file: File | null) => void;
  // We can add chat history, current PDF page, etc. here later
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  file: null,
  setFile: (file) => set({ file }),
}));
