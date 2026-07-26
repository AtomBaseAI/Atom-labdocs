import { create } from "zustand";

export type AppMode = "public" | "admin";

type AppState = {
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // Public navigation (synced with URL search params)
  selectedCourseId: string | null;
  selectedLabId: string | null;
  selectedModuleId: string | null;
  selectCourse: (id: string | null) => void;
  selectLab: (id: string | null) => void;
  selectModule: (id: string | null) => void;
  // Initialize all three at once (no cascading resets)
  initPublicNav: (courseId: string | null, labId: string | null, moduleId: string | null) => void;

  // Admin navigation (not URL-synced)
  adminCourseId: string | null;
  adminLabId: string | null;
  adminModuleId: string | null;
  setAdminCourse: (id: string | null) => void;
  setAdminLab: (id: string | null) => void;
  setAdminModule: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  mode: "public",
  setMode: (mode) => set({ mode }),

  selectedCourseId: null,
  selectedLabId: null,
  selectedModuleId: null,
  selectCourse: (selectedCourseId) =>
    set({ selectedCourseId, selectedLabId: null, selectedModuleId: null }),
  selectLab: (selectedLabId) => set({ selectedLabId, selectedModuleId: null }),
  selectModule: (selectedModuleId) => set({ selectedModuleId }),
  initPublicNav: (selectedCourseId, selectedLabId, selectedModuleId) =>
    set({ selectedCourseId, selectedLabId, selectedModuleId }),

  adminCourseId: null,
  adminLabId: null,
  adminModuleId: null,
  setAdminCourse: (adminCourseId) =>
    set({ adminCourseId, adminLabId: null, adminModuleId: null }),
  setAdminLab: (adminLabId) => set({ adminLabId, adminModuleId: null }),
  setAdminModule: (adminModuleId) => set({ adminModuleId }),
}));
