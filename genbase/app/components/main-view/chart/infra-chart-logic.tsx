// genbase/app/components/main-view/chart/infra-chart-logic.ts
// Complete business logic for InfraChart component
import { useCallback, useState, useEffect } from 'react';
import { Node, Edge, useReactFlow } from 'reactflow';
import { useCurrentProject, useInfraChartState, useChat } from '@/lib/store';
import apiClient, { CodeBlock, ParsedCode } from '@/lib/api';
import { 
  buildHierarchy, 
  calculateLayout, 
  FileGroup, 
  CodeNodeData,
  LAYOUT
} from './hierarchy-utils';
import { createEdgesFromDependencies } from './dependency-utils';
import { compareCodeBetweenBranches, BranchComparison, hasChanges, getChangeColor } from './comparison-utils';

export const useInfraChartLogic = () => {
  const { currentProjectId } = useCurrentProject();
  const { selectedNodeData, setShowInfoPanel, setInfoPanelPosition } = useInfraChartState();
  const { currentChatSessionId } = useChat();
  
  // Core state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [codeData, setCodeData] = useState<ParsedCode | null>(null);
  const [mainBranchData, setMainBranchData] = useState<ParsedCode | null>(null);
  
  // Comparison state
  const [branchComparison, setBranchComparison] = useState<BranchComparison | null>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Node[]>([]);
  
  // Dependencies toggle
  const [showDependencies, setShowDependencies] = useState<boolean>(true);
  
  const reactFlowInstance = useReactFlow();

  // Parse code data and create layout with edges - COMPLETE IMPLEMENTATION
  const parseCodeData = useCallback((codeData: ParsedCode, mainBranchData?: ParsedCode, comparison?: BranchComparison) => {
    let allBlocks: CodeBlock[] = [];
    let allDependencies: any[] = [];
    
    if (comparison && mainBranchData) {
      // COMPARISON MODE: Union of all blocks from both branches
      
      // 1. Get all blocks from compare branch (current codeData), filtering terraform blocks
      Object.values(codeData.blocks).forEach(blockArray => {
        if (Array.isArray(blockArray)) {
          const filteredBlocks = blockArray.filter(block => 
            block._metadata.block_type !== 'terraform'
          );
          allBlocks.push(...filteredBlocks);
        }
      });
      
      // 2. Add deleted blocks from main branch that don't exist in compare branch
      for (const [blockKey, blockComparison] of comparison.blockComparisons) {
        if (blockComparison.changeType === 'deleted') {
          // Filter out terraform blocks and only add if not already in allBlocks
          if (blockComparison.block._metadata.block_type !== 'terraform') {
            const existsInCurrent = allBlocks.some(block => 
              (block.address || `${block._metadata.block_type}.${block.name}`) === blockKey
            );
            if (!existsInCurrent) {
              allBlocks.push(blockComparison.block);
            }
          }
        }
      }
      
      // 3. Combine dependencies from both branches
      allDependencies = [...(codeData.dependencies || [])];
      
      // Add dependencies from main branch that are not in compare branch
      if (mainBranchData.dependencies) {
        mainBranchData.dependencies.forEach(mainDep => {
          const existsInCurrent = allDependencies.some(dep => 
            dep.from === mainDep.from && dep.to === mainDep.to && dep.type === mainDep.type
          );
          if (!existsInCurrent) {
            // Mark this dependency as potentially removed
            allDependencies.push({
              ...mainDep,
              _isFromMain: true
            });
          }
        });
      }
      
    } else {
      // NORMAL MODE: Just current branch blocks, filtering terraform blocks
      Object.values(codeData.blocks).forEach(blockArray => {
        if (Array.isArray(blockArray)) {
          const filteredBlocks = blockArray.filter(block => 
            block._metadata.block_type !== 'terraform'
          );
          allBlocks.push(...filteredBlocks);
        }
      });
      allDependencies = codeData.dependencies || [];
    }

    // Group blocks by their group_path only (not by individual files)
    const fileGroups: FileGroup[] = [];
    const groupPathMap = new Map<string, CodeBlock[]>();

    allBlocks.forEach(block => {
      const groupPath = block._metadata.group_path || '';
      
      if (!groupPathMap.has(groupPath)) {
        groupPathMap.set(groupPath, []);
      }
      groupPathMap.get(groupPath)!.push(block);
    });

    groupPathMap.forEach((blocks, path) => {
      fileGroups.push({ path, blocks });
    });

    // Build hierarchy and calculate layout
    const hierarchy = buildHierarchy(fileGroups);
    const { nodes: layoutNodes } = calculateLayout(hierarchy);

    // If comparison mode, update nodes with comparison data
    let finalNodes = layoutNodes;
    if (comparison) {
      finalNodes = layoutNodes.map(node => {
        if (node.type === 'code') {
          const nodeAddress = node.data.address;
          const blockComparison = comparison.blockComparisons.get(nodeAddress);
          return {
            ...node,
            data: {
              ...node.data,
              changeType: blockComparison?.changeType || 'unchanged'
            }
          };
        }
        return node;
      });
    }

    // Create edges from combined dependencies with comparison context
    const dependencyEdges = createEdgesFromDependencies(
      allDependencies, 
      finalNodes,
      showDependencies,
      comparison
    );

    return { nodes: finalNodes, edges: dependencyEdges };
  }, [showDependencies]);

  // Fetch code data for the project - COMPLETE IMPLEMENTATION
  const fetchCodeData = useCallback(async (refresh = false) => {
    if (!currentProjectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Determine which branch to load
      let branch = 'main';
      if (currentChatSessionId && currentChatSessionId !== 'main') {
        branch = currentChatSessionId;
      }
      
      const code = await apiClient.parseProjectCode(currentProjectId, branch);
      setCodeData(code);
      
      // If we have a chat session selected (not main), enable comparison mode
      if (currentChatSessionId && currentChatSessionId !== 'main') {
        await enableComparisonMode(code);
      } else {
        // Normal mode - clear comparison data
        setBranchComparison(null);
        setMainBranchData(null);
        const { nodes: layoutNodes, edges: parsedEdges } = parseCodeData(code);
        setNodes(layoutNodes);
        setEdges(parsedEdges);
      }
      
      // Auto-fit view if we have nodes
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({
            padding: 0.15,
            includeHiddenNodes: false,
            minZoom: 0.1,
            maxZoom: 1.5,
          });
        }
      }, 200);
    } catch (err) {
      console.error("Failed to fetch code:", err);
      setError("Failed to load project code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, currentChatSessionId, parseCodeData, reactFlowInstance]);

  // Enable comparison mode - COMPLETE IMPLEMENTATION
  const enableComparisonMode = useCallback(async (currentCode: ParsedCode) => {
    if (!currentProjectId) return;
    
    try {
      setLoadingComparison(true);
      
      // Fetch main branch code for comparison
      const mainCode = await apiClient.parseProjectCode(currentProjectId, 'main');
      setMainBranchData(mainCode);
      
      // Compare the branches
      const comparison = compareCodeBetweenBranches(mainCode, currentCode);
      setBranchComparison(comparison);
      
      // Parse code with comparison data using the fixed logic
      const { nodes: layoutNodes, edges: parsedEdges } = parseCodeData(currentCode, mainCode, comparison);
      setNodes(layoutNodes);
      setEdges(parsedEdges);
      
    } catch (err) {
      console.error("Failed to enable comparison mode:", err);
      // Fall back to normal mode
      const { nodes: layoutNodes, edges: parsedEdges } = parseCodeData(currentCode);
      setNodes(layoutNodes);
      setEdges(parsedEdges);
    } finally {
      setLoadingComparison(false);
    }
  }, [currentProjectId, parseCodeData]);

  // Re-create edges when dependencies toggle changes
  useEffect(() => {
    if (codeData) {
      const { edges: newEdges } = parseCodeData(codeData, mainBranchData || undefined, branchComparison || undefined);
      setEdges(newEdges);
    }
  }, [showDependencies, codeData, mainBranchData, branchComparison, parseCodeData]);

  // Fetch code data when project or chat session changes
  useEffect(() => {
    fetchCodeData();
  }, [fetchCodeData]);

  // Handle refresh action
  const handleRefresh = useCallback(() => {
    fetchCodeData(true);
  }, [fetchCodeData]);

  // Show info panel near the button
  const handleShowInfo = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setInfoPanelPosition({
      x: rect.right, 
      y: rect.top
    });
    setShowInfoPanel(true);
  }, [setInfoPanelPosition, setShowInfoPanel]);

  // Search handling - COMPLETE IMPLEMENTATION
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    const results = nodes.filter(node => {
      if (node.type !== 'code') return false;
      const data = node.data as CodeNodeData;
      return (
        data.label.toLowerCase().includes(query.toLowerCase()) ||
        data.blockType.toLowerCase().includes(query.toLowerCase()) ||
        data.address?.toLowerCase().includes(query.toLowerCase()) ||
        data.groupPath.toLowerCase().includes(query.toLowerCase()) ||
        (data.resourceType && data.resourceType.toLowerCase().includes(query.toLowerCase()))
      );
    });
    
    setSearchResults(results);
  }, [nodes]);
  
  // Focus on a specific node - COMPLETE IMPLEMENTATION
  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && reactFlowInstance) {
      // Calculate absolute position for nodes inside groups
      let absoluteX = node.position.x;
      let absoluteY = node.position.y;
      
      // If node has a parent, add parent's position to get absolute coordinates
      if (node.parentId) {
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
          absoluteX += parentNode.position.x;
          absoluteY += parentNode.position.y;
        }
      }
      
      // Focus on the absolute position with some offset for better visibility
      reactFlowInstance.setCenter(
        absoluteX + LAYOUT.BLOCK_WIDTH / 2, 
        absoluteY + LAYOUT.BLOCK_HEIGHT / 2, 
        { 
          zoom: 1.2,
          duration: 800,
        }
      );
      
      // Also select the node to make it more visible
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === nodeId
      })));
    }
  }, [nodes, reactFlowInstance, setNodes]);

  // Get current branch name for display
  const getCurrentBranch = useCallback(() => {
    if (currentChatSessionId && currentChatSessionId !== 'main') {
      return currentChatSessionId;
    }
    return 'main';
  }, [currentChatSessionId]);

  // Get comparison status for display
  const getComparisonStatus = useCallback(() => {
    if (branchComparison) {
      const { summary } = branchComparison;
      return `${summary.created} created, ${summary.modified} modified, ${summary.deleted} deleted`;
    }
    return null;
  }, [branchComparison]);

  // Check if we have blocks to display
  const hasBlocks = codeData && Object.values(codeData.blocks).some(blockArray => 
    blockArray && blockArray.length > 0 && 
    blockArray.some(block => block._metadata.block_type !== 'terraform')
  );

  // Clear search when query is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Clear search results when nodes change
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = nodes.filter(node => {
        if (node.type !== 'code') return false;
        const data = node.data as CodeNodeData;
        return (
          data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          data.blockType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          data.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          data.groupPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (data.resourceType && data.resourceType.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });
      setSearchResults(results);
    }
  }, [nodes, searchQuery]);

  // Utility function to check if in comparison mode
  const isComparisonMode = useCallback(() => {
    return currentChatSessionId && currentChatSessionId !== 'main' && branchComparison !== null;
  }, [currentChatSessionId, branchComparison]);

  // Get statistics about the current view
  const getViewStats = useCallback(() => {
    const codeNodes = nodes.filter(n => n.type === 'code');
    const groupNodes = nodes.filter(n => n.type === 'group');
    
    const blocksByType = codeNodes.reduce((acc, node) => {
      const blockType = (node.data as CodeNodeData).blockType;
      acc[blockType] = (acc[blockType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBlocks: codeNodes.length,
      totalGroups: groupNodes.length,
      totalEdges: edges.length,
      blocksByType,
      hasComparison: isComparisonMode(),
      currentBranch: getCurrentBranch()
    };
  }, [nodes, edges, isComparisonMode, getCurrentBranch]);

  // Export all state and functions needed by the UI component
  return {
    // Core State
    nodes,
    setNodes,
    edges,
    setEdges,
    loading,
    error,
    codeData,
    mainBranchData,
    branchComparison,
    loadingComparison,
    
    // Search State
    searchQuery,
    searchResults,
    
    // UI State
    showDependencies,
    setShowDependencies,
    selectedNodeData,
    
    // Actions
    handleRefresh,
    handleShowInfo,
    handleSearch,
    focusNode,
    
    // Utility Functions
    getCurrentBranch,
    getComparisonStatus,
    isComparisonMode,
    getViewStats,
    
    // Computed Values
    hasBlocks,
    
    // Additional Getters
    isLoading: loading,
    hasError: !!error,
    hasSearchResults: searchResults.length > 0,
    isEmpty: !hasBlocks && !loading,
    
    // React Flow Instance (for advanced usage)
    reactFlowInstance
  };
};