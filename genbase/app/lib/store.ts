// store.ts - Updated for Plate UI
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, ChatSession } from './api';
import { CodeNodeData } from '../components/main-view/chart/hierarchy-utils';

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
  
  // Current branch for viewing code
  currentBranch: string;
  setCurrentBranch: (branch: string) => void;
  
  // Current operation status
  operationStatus: {
    type: 'plan' | 'apply' | 'destroy' | null;
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  };
  setOperationStatus: (status: AppState['operationStatus']) => void;
  
  // Chat state
  currentChatSessionId: string | null;
  setCurrentChatSessionId: (sessionId: string | null) => void;
  
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  
  // UI state for chat
  showChatSessionList: boolean;
  setShowChatSessionList: (show: boolean) => void;
  
  // Chat editor content per session (now stores Plate value as JSON string)
  chatEditorContent: Record<string, string>;
  setChatEditorContent: (sessionId: string, content: string) => void;
  clearChatEditorContent: (sessionId: string) => void;
  
  // InfraChart state for selected node
  selectedNodeData: CodeNodeData | null;
  setSelectedNodeData: (data: CodeNodeData | null) => void;
  
  // InfoPanel state
  showInfoPanel: boolean;
  setShowInfoPanel: (show: boolean) => void;
  infoPanelPosition: { x: number; y: number };
  setInfoPanelPosition: (position: { x: number; y: number }) => void;
  
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
      currentBranch: 'main',
      operationStatus: { type: null, status: 'idle' },
      
      // Chat state
      currentChatSessionId: null,
      chatSessions: [],
      showChatSessionList: false,
      chatEditorContent: {},
      
      // InfraChart state
      selectedNodeData: null,
      showInfoPanel: false,
      infoPanelPosition: { x: 0, y: 0 },
      
      // Actions
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
      setSelectedGroupPath: (groupPath) => set({ selectedGroupPath: groupPath }),
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setCurrentBranch: (branch) => set({ currentBranch: branch }),
      setOperationStatus: (status) => set({ operationStatus: status }),
      
      // Chat actions
      setCurrentChatSessionId: (sessionId) => set({ currentChatSessionId: sessionId }),
      setChatSessions: (sessions) => set({ chatSessions: sessions }),
      setShowChatSessionList: (show) => set({ showChatSessionList: show }),
      setChatEditorContent: (sessionId, content) => 
        set((state) => ({
          chatEditorContent: { ...state.chatEditorContent, [sessionId]: content }
        })),
      clearChatEditorContent: (sessionId) =>
        set((state) => {
          const { [sessionId]: _, ...rest } = state.chatEditorContent;
          return { chatEditorContent: rest };
        }),
      
      // InfraChart actions
      setSelectedNodeData: (data) => set({ selectedNodeData: data }),
      setShowInfoPanel: (show) => set({ showInfoPanel: show }),
      setInfoPanelPosition: (position) => set({ infoPanelPosition: position }),
      
      // Reset to initial state
      resetState: () => set({
        selectedGroupPath: null,
        currentWorkspace: 'default',
        currentBranch: 'main',
        operationStatus: { type: null, status: 'idle' },
        currentChatSessionId: null,
        chatSessions: [],
        showChatSessionList: false,
        chatEditorContent: {},
        selectedNodeData: null,
        showInfoPanel: false,
        infoPanelPosition: { x: 0, y: 0 },
      }),
    }),
    {
      name: 'genbase-storage',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentWorkspace: state.currentWorkspace,
        currentBranch: state.currentBranch,
        currentChatSessionId: state.currentChatSessionId,
        chatEditorContent: state.chatEditorContent,
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

export const useCurrentBranch = () => {
  const currentBranch = useAppStore(state => state.currentBranch);
  const setCurrentBranch = useAppStore(state => state.setCurrentBranch);
  
  return { currentBranch, setCurrentBranch };
};

export const useOperationStatus = () => {
  const operationStatus = useAppStore(state => state.operationStatus);
  const setOperationStatus = useAppStore(state => state.setOperationStatus);
  
  return { operationStatus, setOperationStatus };
};

export const useInfraChartState = () => {
  const selectedNodeData = useAppStore(state => state.selectedNodeData);
  const setSelectedNodeData = useAppStore(state => state.setSelectedNodeData);
  const showInfoPanel = useAppStore(state => state.showInfoPanel);
  const setShowInfoPanel = useAppStore(state => state.setShowInfoPanel);
  const infoPanelPosition = useAppStore(state => state.infoPanelPosition);
  const setInfoPanelPosition = useAppStore(state => state.setInfoPanelPosition);
  
  return {
    selectedNodeData,
    setSelectedNodeData,
    showInfoPanel,
    setShowInfoPanel,
    infoPanelPosition,
    setInfoPanelPosition
  };
};

export const useChat = () => {
  const currentChatSessionId = useAppStore(state => state.currentChatSessionId);
  const setCurrentChatSessionId = useAppStore(state => state.setCurrentChatSessionId);
  const chatSessions = useAppStore(state => state.chatSessions);
  const setChatSessions = useAppStore(state => state.setChatSessions);
  const showChatSessionList = useAppStore(state => state.showChatSessionList);
  const setShowChatSessionList = useAppStore(state => state.setShowChatSessionList);
  
  return {
    currentChatSessionId,
    setCurrentChatSessionId,
    chatSessions,
    setChatSessions,
    showChatSessionList,
    setShowChatSessionList,
  };
};

// Simple hook for Plate UI content management
export const useChatEditorContent = (sessionId: string | null) => {
  const chatEditorContent = useAppStore(state => state.chatEditorContent);
  const setChatEditorContent = useAppStore(state => state.setChatEditorContent);
  const clearChatEditorContent = useAppStore(state => state.clearChatEditorContent);
  
  if (!sessionId) return { 
    content: '', 
    setContent: () => {}, 
    clearContent: () => {}, 
    appendContent: () => {} 
  };
  
  // Helper to extract text from Plate value
  const extractText = (value: any[]): string => {
    return value.map(node => {
      if (node.text !== undefined) {
        return node.text;
      }
      if (node.children) {
        return extractText(node.children);
      }
      return '';
    }).join('');
  };
  
  return {
    content: chatEditorContent[sessionId] || '',
    setContent: (content: string) => setChatEditorContent(sessionId, content),
    clearContent: () => clearChatEditorContent(sessionId),
    
    // Simple appendContent - just appends text to current paragraph
    appendContent: (newText: string) => {
      console.log('Appending content:', newText);
      const currentContent = chatEditorContent[sessionId] || '';
      
      let updatedValue;
      
      if (currentContent && currentContent.trim() !== '' && currentContent !== '[]') {
        try {
          const currentValue = JSON.parse(currentContent);
          const existingText = extractText(currentValue);
          
          // Simple logic: just append to existing text with a space
          const combinedText = existingText.trim() 
            ? `${existingText} ${newText}` 
            : newText;
            
          updatedValue = [{ type: 'p', children: [{ text: combinedText }] }];
        } catch {
          // If parsing fails, create new content
          updatedValue = [{ type: 'p', children: [{ text: newText }] }];
        }
      } else {
        // Empty content, just create new paragraph
        updatedValue = [{ type: 'p', children: [{ text: newText }] }];
      }
      
      setChatEditorContent(sessionId, JSON.stringify(updatedValue));
    }
  };
};