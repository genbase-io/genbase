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

import { useCurrentProject, useInfraChartState } from '@/lib/store';
import apiClient, { CodeBlock, ParsedCode } from '@/lib/api';

import {
  Search,
  FileCode,
  RefreshCw,
  Info,
} from 'lucide-react';

import CodeNode from './code-node';
import InfoPanel from './info-panel';
import NodeDetailsPanel from './node-details-panel';
import { 
  buildHierarchy, 
  calculateLayout, 
  FileGroup, 
  CodeNodeData,
  LAYOUT
} from './hierarchy-utils';

const nodeTypes: NodeTypes = {
  code: CodeNode,
};

function InfraChartContent() {
  const { currentProjectId } = useCurrentProject();
  const { selectedNodeData, setShowInfoPanel, setInfoPanelPosition } = useInfraChartState();
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [codeData, setCodeData] = useState<ParsedCode | null>(null);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Node[]>([]);
  
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

  // Parse code data and create layout with subflows
  const parseCodeData = useCallback((codeData: ParsedCode) => {
    const blocks: CodeBlock[] = [];
    
    // Collect all blocks from different types
    Object.values(codeData.blocks).forEach(blockArray => {
      if (Array.isArray(blockArray)) {
        blocks.push(...blockArray);
      }
    });

    // Group blocks by their group_path only (not by individual files)
    const fileGroups: FileGroup[] = [];
    const groupPathMap = new Map<string, CodeBlock[]>();

    blocks.forEach(block => {
      const groupPath = block._metadata.group_path || '';
      
      if (!groupPathMap.has(groupPath)) {
        groupPathMap.set(groupPath, []);
      }
      groupPathMap.get(groupPath)!.push(block);
    });

    groupPathMap.forEach((blocks, path) => {
      fileGroups.push({ path, blocks });
    });

    // Build hierarchy and calculate layout with subflows
    const hierarchy = buildHierarchy(fileGroups);
    const { nodes: layoutNodes } = calculateLayout(hierarchy);

    return { nodes: layoutNodes, edges: [] };
  }, []);

  // Fetch code data for the project
  const fetchCodeData = useCallback(async (refresh = false) => {
    if (!currentProjectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const code = await apiClient.parseProjectCode(currentProjectId, 'main');
      setCodeData(code);
      
      // Parse code and update nodes/edges with subflow layout
      const { nodes: layoutNodes, edges: parsedEdges } = parseCodeData(code);
      setNodes(layoutNodes);
      setEdges(parsedEdges);
      
      // Auto-fit view if we have nodes
      if (layoutNodes.length > 0) {
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
      }
    } catch (err) {
      console.error("Failed to fetch code:", err);
      setError("Failed to load project code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, parseCodeData, reactFlowInstance]);

  // Fetch code data when project changes
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
          nodesDraggable={false} // Disable dragging to maintain hierarchy
          panOnScroll={true}
          panOnScrollSpeed={0.8}
          zoomOnScroll={true}
          zoomOnDoubleClick={false}
        >
          <Background  gap={20} size={1} />
          <Controls 
            showInteractive={false}
            position="bottom-right"
            style={{ background: 'white', border: '1px solid #ddd' }}
          />
          <MiniMap 
            nodeStrokeColor="#aaa"
            nodeColor={(node) => {
              if (node.type === 'group') return '#f0f0f0';
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
              
              {/* Refresh */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleRefresh}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
            <Panel position="top-right" className="bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-3 max-w-xs max-h-60 overflow-auto z-10">
              <div className="text-sm font-medium mb-2">
                Found {searchResults.length} results
              </div>
              <div className="space-y-2">
                {searchResults.map((result, index) => {
                  const data = result.data as CodeNodeData;
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
                        <Badge variant="outline" className="ml-2 text-xs">
                          {data.blockType}
                        </Badge>
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
          <NodeDetailsPanel />
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