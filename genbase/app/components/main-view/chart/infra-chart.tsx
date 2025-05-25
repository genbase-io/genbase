// Updated genbase/app/components/main-view/chart/infra-chart.tsx - Simplified UI Component
import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
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

import {
  Search,
  FileCode,
  RefreshCw,
  Info,
} from 'lucide-react';

import CodeNode from './code-node';
import GroupNode from './group-node';
import InfoPanel from './info-panel';
import NodeDetailsPanelWithComparison from './node-details-panel';
import { CodeNodeData, LAYOUT } from './hierarchy-utils';
import { hasChanges, getChangeColor } from './comparison-utils';
import { useInfraChartLogic } from './infra-chart-logic';

const nodeTypes: NodeTypes = {
  code: CodeNode,
  group: GroupNode,
};

function InfraChartContent() {
  const {
    // State
    nodes,
    setNodes,
    edges,
    setEdges,
    loading,
    error,
    branchComparison,
    loadingComparison,
    searchQuery,
    searchResults,
    showDependencies,
    setShowDependencies,
    
    // Actions
    handleRefresh,
    handleShowInfo,
    handleSearch,
    focusNode,
    
    // Computed values
    hasBlocks,
    selectedNodeData
  } = useInfraChartLogic();

  // Handle node changes (selection only, dragging is disabled)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error loading code</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button className="mt-4 w-24" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (loading && !hasBlocks) {
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