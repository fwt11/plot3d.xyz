import { create } from 'zustand';
import type { AnnotationTool } from '@/utils/annotations';

interface AnnotationToolStore {
  activeTool: AnnotationTool;
  selectedId: string | null;
  isDrawing: boolean;
  editingId: string | null;
  setActiveTool: (tool: AnnotationTool) => void;
  setSelectedId: (id: string | null) => void;
  setIsDrawing: (drawing: boolean) => void;
  setEditingId: (id: string | null) => void;
  clear: () => void;
}

export const useAnnotationToolStore = create<AnnotationToolStore>()((set) => ({
  activeTool: 'select',
  selectedId: null,
  isDrawing: false,
  editingId: null,
  setActiveTool: (tool) =>
    set((s) => ({
      activeTool: tool,
      selectedId: tool === 'select' ? s.selectedId : null,
      isDrawing: false,
      editingId: null,
    })),
  setSelectedId: (id) => set({ selectedId: id, editingId: null }),
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  setEditingId: (id) => set({ editingId: id }),
  clear: () => set({ activeTool: 'select', selectedId: null, isDrawing: false, editingId: null }),
}));
