"use client";

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
  MarkerType,
  Panel,
  useReactFlow,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useCurrentProject, useWorkspace } from '@/lib/store';
import apiClient, { StateResult } from '@/lib/api';

import {
  Server,
  Plus,
  Minus,
  Search,
  FileText,
  RefreshCw,
  Info,
  ChevronRight
} from 'lucide-react';

// Type for our custom resource node data
interface ResourceNodeData {
  label: string;
  resourceType: string;
  isDataSource: boolean;
  address: string;
  properties: Record<string, any>;
  displayProperties: Record<string, string>;
  dependencies: string[];
}

// Resource node component
const ResourceNode: React.FC<NodeProps<ResourceNodeData>> = ({ data, selected }) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <div className={`relative ${selected ? 'ring-2 ring-primary rounded-md' : ''}`}>
      <Card className={`w-52 shadow-md ${data.isDataSource ? 'border-dashed border-blue-400' : ''}`}>
        <CardHeader className="p-2 pb-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <div>
                <CardTitle className="text-xs font-medium truncate" title={data.label || ''}>
                  {data.label}
                </CardTitle>
                <div className="text-xs text-muted-foreground truncate">
                  {data.resourceType}
                </div>
              </div>
            </div>
            {data.isDataSource && (
              <Badge className="text-xs bg-blue-100 text-blue-800">Data</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {data.displayProperties && Object.keys(data.displayProperties).length > 0 && (
            <div className="space-y-1">
              {Object.entries(data.displayProperties).slice(0, 2).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs overflow-hidden">
                  <span className="font-medium text-muted-foreground">{key}:</span>
                  <span className="truncate max-w-[120px]" title={value}>
                    {value}
                  </span>
                </div>
              ))}
              {Object.keys(data.displayProperties).length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-6 mt-1"
                  onClick={() => setShowDetails(true)}
                >
                  <Info className="h-3 w-3 mr-1" /> More details
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection handles */}
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <Handle type="source" position={Position.Right} className="w-2 h-2" />

      {/* Resource details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Server className="h-5 w-5 mr-2" />
              <span>{data.label}</span>
              <Badge className="ml-2">{data.resourceType}</Badge>
            </DialogTitle>
            <DialogDescription>
              Resource details and properties
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh]">
              <Accordion type="single" collapsible defaultValue="properties">
                <AccordionItem value="properties">
                  <AccordionTrigger>Properties</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Object.entries(data.properties || {}).map(([key, value]) => (
                        <div key={key} className="flex flex-col border-b border-muted pb-2">
                          <span className="font-medium text-sm">{key}</span>
                          <span className="text-sm text-muted-foreground break-all whitespace-pre-wrap">
                            {typeof value === 'object' 
                              ? JSON.stringify(value, null, 2) 
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {data.dependencies && data.dependencies.length > 0 && (
                  <AccordionItem value="dependencies">
                    <AccordionTrigger>Dependencies</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {data.dependencies.map((dep, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <ChevronRight className="h-4 w-4 mr-2 text-primary" />
                            {dep}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </ScrollArea>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Define custom node types - only resource nodes now
const nodeTypes: NodeTypes = {
  resource: ResourceNode,
};

// Helper function to get displayable properties
const getDisplayProperties = (resource: any): Record<string, string> => {
  const properties: Record<string, string> = {};
  
  // Add common properties based on resource type
  if (resource.type?.toLowerCase().includes('vpc')) {
    if (resource.values?.cidr_block) properties['CIDR'] = resource.values.cidr_block;
    if (resource.values?.id) properties['ID'] = resource.values.id;
  } 
  else if (resource.type?.toLowerCase().includes('subnet')) {
    if (resource.values?.cidr_block) properties['CIDR'] = resource.values.cidr_block;
    if (resource.values?.availability_zone) properties['AZ'] = resource.values.availability_zone;
  }
  else if (resource.type?.toLowerCase().includes('instance')) {
    if (resource.values?.instance_type) properties['Type'] = resource.values.instance_type;
    if (resource.values?.availability_zone) properties['AZ'] = resource.values.availability_zone;
    if (resource.values?.private_ip) properties['Private IP'] = resource.values.private_ip;
  }
  
  // Add name tag if available
  if (resource.values?.tags?.Name) {
    properties['Name'] = resource.values.tags.Name;
  }
  
  return properties;
};

// Wrap the component with ReactFlowProvider
import { ReactFlowProvider } from 'reactflow';

export function InfraChart() {
  return (
    <ReactFlowProvider>
      <InfraChartContent />
    </ReactFlowProvider>
  );
}

function InfraChartContent() {
  const { currentProjectId } = useCurrentProject();
  const { currentWorkspace } = useWorkspace();
  
  const [nodes, setNodes] = useState<Node<ResourceNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stateData, setStateData] = useState<StateResult | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showInfoDialog, setShowInfoDialog] = useState<boolean>(false);
  
  const reactFlowInstance = useReactFlow();

  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Node<ResourceNodeData>[]>([]);

  // Handle node changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Parse state and create nodes and edges
  const parseState = useCallback((stateData: StateResult | null) => {
    const resources = stateData?.state?.values?.root_module?.resources || [];
    const parsedNodes: Node<ResourceNodeData>[] = [];
    const parsedEdges: Edge[] = [];
    const resourceMap = new Map();

    // Create nodes for all resources
    resources.forEach((resource, index) => {
      const isDataSource = resource.mode === 'data';
      const nodeId = resource.address;
      
      // Store resources by address for creating edges later
      resourceMap.set(nodeId, resource);
      
      // Create node with grid layout
      const nodesPerRow = 4;
      const nodeSpacing = 260;
      const rowSpacing = 160;
      
      parsedNodes.push({
        id: nodeId,
        type: 'resource',
        position: { 
          x: 50 + (index % nodesPerRow) * nodeSpacing, 
          y: 50 + Math.floor(index / nodesPerRow) * rowSpacing 
        },
        data: {
          label: resource.name || resource.address.split('.').pop() || '',
          resourceType: resource.type || 'unknown',
          isDataSource,
          address: resource.address,
          properties: resource.values || {},
          displayProperties: getDisplayProperties(resource),
          dependencies: resource.depends_on || [],
        },
      });
    });

    // Create edges based on dependencies
    resources.forEach((resource) => {
      const sourceId = resource.address;
      const dependencies = resource.depends_on || [];
      
      dependencies.forEach((targetId) => {
        if (resourceMap.has(targetId)) {
          parsedEdges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            type: 'step',
            animated: true,
            style: { stroke: '#64748b' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
            },
          });
        }
      });
    });

    return { nodes: parsedNodes, edges: parsedEdges };
  }, []);

  // Fetch state data for the project (not group-specific)
  const fetchStateData = useCallback(async (refresh = false) => {
    if (!currentProjectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch state for the current project and workspace
      const state = await apiClient.getState(
        currentProjectId,
        currentWorkspace,
        refresh
      );
      
      setStateData(state);
      
      // Parse state and update nodes/edges
      const { nodes: parsedNodes, edges: parsedEdges } = parseState(state);
      setNodes(parsedNodes);
      setEdges(parsedEdges);
      
      // Auto-layout if we have nodes
      if (parsedNodes.length > 0) {
        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({
              padding: 0.2,
            });
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to fetch state:", err);
      setError("Failed to load infrastructure state data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, currentWorkspace, parseState, reactFlowInstance]);

  // Fetch state data when project or workspace changes
  useEffect(() => {
    fetchStateData();
  }, [currentProjectId, currentWorkspace]);

  // Handle zoom in/out
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.2, 2));
    reactFlowInstance?.zoomTo(zoomLevel + 0.2);
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.2, 0.1));
    reactFlowInstance?.zoomTo(zoomLevel - 0.2);
  };

  const handleRefresh = () => {
    fetchStateData(true);
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
      const data = node.data as ResourceNodeData;
      return (
        data.label.toLowerCase().includes(query.toLowerCase()) ||
        data.resourceType.toLowerCase().includes(query.toLowerCase()) ||
        data.address.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setSearchResults(results);
  };
  
  const focusNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(node.position.x, node.position.y, { 
        zoom: 1.5,
        duration: 800,
      });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error loading infrastructure</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (loading && !stateData) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading infrastructure...</p>
        </div>
      </div>
    );
  }

  const hasResources = stateData?.state?.values?.root_module?.resources?.length > 0;

  if (!hasResources && !loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-secondary/20 border-2 border-dashed border-secondary">
        <div className="text-center p-6 max-w-md">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <div className="text-lg font-semibold mb-2">No Infrastructure Resources</div>
          <p className="text-muted-foreground mb-4">
            There are no infrastructure resources in this project yet. 
            Run a plan and apply to create resources.
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
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesConnectable={false}
        elementsSelectable={true}
        nodesFocusable={true}
        edgesFocusable={false}
        nodeDragThreshold={1}
        defaultEdgeOptions={{
          style: { strokeWidth: 2 },
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: '#64748b',
          },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#aaa" gap={16} />
        <Controls showInteractive={false} />
        <MiniMap 
          nodeStrokeColor="#aaa"
          nodeColor="#fff"
          nodeBorderRadius={8}
        />
        
        <Panel position="top-left" className="bg-background border rounded-md shadow-sm p-2">
          <div className="flex items-center space-x-2">
            <div className="relative w-56">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 2}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
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
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setShowInfoDialog(true)}
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
          <Panel position="top-right" className="bg-background border rounded-md shadow-sm p-2 max-w-xs max-h-60 overflow-auto">
            <div className="text-sm font-medium mb-2">
              Found {searchResults.length} results
            </div>
            <div className="space-y-1">
              {searchResults.map((result) => {
                const data = result.data as ResourceNodeData;
                return (
                  <Button 
                    key={result.id}
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-xs h-8"
                    onClick={() => focusNode(result.id)}
                  >
                    <Server className="h-4 w-4 mr-2" />
                    <span className="ml-2 truncate">{data.label}</span>
                  </Button>
                );
              })}
            </div>
          </Panel>
        )}
      </ReactFlow>
      
      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Infrastructure Diagram</DialogTitle>
            <DialogDescription>
              This view visualizes your project infrastructure resources and their relationships.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">Resources</h4>
              <p className="text-sm text-muted-foreground">
                Each box represents a resource from your Terraform/OpenTofu state in the current project and workspace.
                Arrows show dependencies between resources.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">Interaction</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Click a resource to select it</li>
                <li>Click "More details" to see resource properties</li>
                <li>Drag resources to reposition them</li>
                <li>Use mouse wheel or buttons to zoom</li>
                <li>Use search to find specific resources</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowInfoDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}