import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

import { useCurrentProject, useInfraChartState, useChat } from '@/lib/store';
import apiClient, { CodeBlock, ParsedCode } from '@/lib/api';

import {
  Search,
  FileCode,
  RefreshCw,
  Info,
  GitBranch
} from 'lucide-react';

import CodeNode from './code-node';
import InfoPanel from './info-panel';
import NodeDetailsPanelWithComparison from './node-details-panel';
import { 
  buildHierarchy, 
  calculateLayout, 
  FileGroup, 
  CodeNodeData,
  LAYOUT
} from './hierarchy-utils';
import { createEdgesFromDependencies } from './dependency-utils';
import { compareCodeBetweenBranches, BranchComparison, hasChanges, getChangeColor } from './comparison-utils';

const nodeTypes: NodeTypes = {
  code: CodeNode,
};

function InfraChartContent() {
  const { currentProjectId } = useCurrentProject();
  const { selectedNodeData, setShowInfoPanel, setInfoPanelPosition } = useInfraChartState();
  const { currentChatSessionId } = useChat();
  
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

  // Handle node changes (selection only, dragging is disabled)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Parse code data and create layout with edges - FIXED VERSION
  const parseCodeData = useCallback((codeData: ParsedCode, mainBranchData?: ParsedCode, comparison?: BranchComparison) => {
    let allBlocks: CodeBlock[] = [];
    let allDependencies: any[] = [];
    
    if (comparison && mainBranchData) {
      // COMPARISON MODE: Union of all blocks from both branches
      
      // 1. Get all blocks from compare branch (current codeData)
      Object.values(codeData.blocks).forEach(blockArray => {
        if (Array.isArray(blockArray)) {
          allBlocks.push(...blockArray);
        }
      });
      
      // 2. Add deleted blocks from main branch that don't exist in compare branch
      for (const [blockKey, blockComparison] of comparison.blockComparisons) {
        if (blockComparison.changeType === 'deleted') {
          // Only add if not already in allBlocks
          const existsInCurrent = allBlocks.some(block => 
            (block.address || `${block._metadata.block_type}.${block.name}`) === blockKey
          );
          if (!existsInCurrent) {
            allBlocks.push(blockComparison.block);
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
      // NORMAL MODE: Just current branch blocks
      Object.values(codeData.blocks).forEach(blockArray => {
        if (Array.isArray(blockArray)) {
          allBlocks.push(...blockArray);
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

  // Fetch code data for the project - UPDATED
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

  // Enable comparison mode - UPDATED
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

  const handleRefresh = () => {
    fetchCodeData(true);
  };

  // Show info panel near the button
  const handleShowInfo = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setInfoPanelPosition({
      x: rect.right, 
      y: rect.top
    });
    setShowInfoPanel(true);
  };

  // Search handling
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };
  
  const focusNode = (nodeId: string) => {
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
  };

  // Get current branch name for display
  const getCurrentBranch = () => {
    if (currentChatSessionId && currentChatSessionId !== 'main') {
      return currentChatSessionId;
    }
    return 'main';
  };

  // Get comparison status for display
  const getComparisonStatus = () => {
    if (branchComparison) {
      const { summary } = branchComparison;
      return `${summary.created} created, ${summary.modified} modified, ${summary.deleted} deleted`;
    }
    return null;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error loading code</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (loading && !codeData) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading project code...</p>
          {loadingComparison && (
            <p className="mt-1 text-xs text-muted-foreground">Loading comparison data...</p>
          )}
        </div>
      </div>
    );
  }

  const hasBlocks = codeData && Object.values(codeData.blocks).some(blockArray => blockArray && blockArray.length > 0);

  if (!hasBlocks && !loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-secondary/20 border-2 border-dashed border-secondary">
        <div className="text-center p-6 max-w-md">
          <FileCode className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <div className="text-lg font-semibold mb-2">No Code Found</div>
          <p className="text-muted-foreground mb-4">
            There are no Terraform/OpenTofu files in this project branch yet. 
            Add some .tf files to see them visualized here.
          </p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex">
      {/* Main Flow Chart */}
      <div className={`flex-1 ${selectedNodeData ? 'border-r' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={3}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          nodesConnectable={false}
          elementsSelectable={true}
          nodesFocusable={true}
          edgesFocusable={false}
          nodeDragThreshold={1}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          panOnScroll={true}
          panOnScrollSpeed={0.8}
          zoomOnScroll={true}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          onNodeClick={(event, node) => {
            // Debug log for node clicks
            console.log('ReactFlow node clicked:', node.id, node.data);
            if (node.type === 'code') {
              event.stopPropagation();
            }
          }}
        >
          <Background gap={20} size={1} />
          
          <Controls 
            showInteractive={false}
            position="bottom-right"
            style={{ background: 'white', border: '1px solid #ddd' }}
          />
          
          <MiniMap 
            nodeStrokeColor="#aaa"
            nodeColor={(node) => {
              if (node.type === 'group') return '#f0f0f0';
              // Color nodes based on change type in comparison mode
              if (branchComparison && node.data?.changeType) {
                return getChangeColor(node.data.changeType);
              }
              return '#fff';
            }}
            nodeBorderRadius={8}
            position="bottom-left"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd',
            }}
            zoomable
            pannable
          />
          
          {/* Top control panel */}
          <Panel position="top-left" className="bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-3 z-10">
            <div className="flex items-center space-x-3">
              {/* Current branch indicator */}
              {/* <div className="flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {getCurrentBranch()}
                </Badge>
              </div> */}
              
              {/* Comparison status */}
              {/* {branchComparison && (
                <div className="text-xs text-muted-foreground">
                  {getComparisonStatus()}
                </div>
              )} */}
              
              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search blocks..."
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
              
              {/* Dependencies toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showDependencies ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDependencies(!showDependencies)}
                      className="flex items-center space-x-1"
                    >
                      <span className="text-xs">
                        Dependencies
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showDependencies ? 'Hide' : 'Show'} dependency connections
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Refresh */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleRefresh}
                      disabled={loading || loadingComparison}
                    >
                      <RefreshCw className={`h-4 w-4 ${(loading || loadingComparison) ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Info */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleShowInfo}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>About This View</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Panel>
          
          {/* Search results panel */}
          {searchResults.length > 0 && (
            <Panel position="bottom-right" className="bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-3 max-w-xs max-h-60 overflow-auto z-10" style={{ bottom: '120px' }}>
              <div className="text-sm font-medium mb-2">
                Found {searchResults.length} results
              </div>
              <div className="space-y-2">
                {searchResults.map((result, index) => {
                  const data = result.data as CodeNodeData;
                  const changeType = (data as any).changeType;
                  return (
                    <Button 
                      key={`search-result-${index}-${result.id}`}
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start text-xs h-auto p-2"
                      onClick={() => focusNode(result.id)}
                    >
                      <div className="flex items-center w-full">
                        <span className="truncate flex-1 text-left">{data.label}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <Badge variant="outline" className="text-xs">
                            {data.blockType}
                          </Badge>
                          {changeType && hasChanges(changeType) && (
                            <div 
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: getChangeColor(changeType) }}
                            />
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Info Panel */}
          <InfoPanel />
        </ReactFlow>
      </div>
      
      {/* Right sidebar for node details */}
      {selectedNodeData && (
        <div className="w-96 h-full flex-shrink-0">
          <NodeDetailsPanelWithComparison branchComparison={branchComparison || undefined} />
        </div>
      )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export function InfraChart() {
  return (
    <ReactFlowProvider>
      <InfraChartContent />
    </ReactFlowProvider>
  );
}