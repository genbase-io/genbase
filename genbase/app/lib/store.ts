// lib/store.ts - Updated Global state management using Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project } from './api';

interface AppState {
  // Current project
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;
  
  // Selected group (for file navigation only)
  selectedGroupPath: string | null;
  setSelectedGroupPath: (groupPath: string | null) => void;
  
  // Active workspace (now project-wide)
  currentWorkspace: string;
  setCurrentWorkspace: (workspace: string) => void;
  
  // Current operation status
  operationStatus: {
    type: 'plan' | 'apply' | 'destroy' | null;
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  };
  setOperationStatus: (status: AppState['operationStatus']) => void;
  
  // Reset state (for logout, etc.)
  resetState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Default state
      currentProjectId: 'default',
      selectedGroupPath: null,
      currentWorkspace: 'default',
      operationStatus: { type: null, status: 'idle' },
      
      // Actions
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
      setSelectedGroupPath: (groupPath) => set({ selectedGroupPath: groupPath }),
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setOperationStatus: (status) => set({ operationStatus: status }),
      
      // Reset to initial state
      resetState: () => set({
        selectedGroupPath: null,
        currentWorkspace: 'default',
        operationStatus: { type: null, status: 'idle' },
      }),
    }),
    {
      name: 'genbase-storage',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);

// Helper hooks for specific state slices
export const useCurrentProject = () => {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const setCurrentProjectId = useAppStore(state => state.setCurrentProjectId);
  
  return { currentProjectId, setCurrentProjectId };
};

export const useSelectedGroup = () => {
  const selectedGroupPath = useAppStore(state => state.selectedGroupPath);
  const setSelectedGroupPath = useAppStore(state => state.setSelectedGroupPath);
  
  return { 
    selectedGroupPath, 
    setSelectedGroupPath 
  };
};

export const useWorkspace = () => {
  const currentWorkspace = useAppStore(state => state.currentWorkspace);
  const setCurrentWorkspace = useAppStore(state => state.setCurrentWorkspace);
  
  return { currentWorkspace, setCurrentWorkspace };
};

export const useOperationStatus = () => {
  const operationStatus = useAppStore(state => state.operationStatus);
  const setOperationStatus = useAppStore(state => state.setOperationStatus);
  
  return { operationStatus, setOperationStatus };
};