// code-node.tsx
"use client";

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Server,
  Database,
  Settings,
  FileOutput,
  Code,
  GitBranch,
  Info,
  BoxIcon as Module
} from 'lucide-react';
import { CodeNodeData } from './hierarchy-utils';
import { useInfraChartState } from '@/lib/store';

// Get icon for different block types
export const getBlockIcon = (blockType: string) => {
  switch (blockType) {
    case 'resource':
      return <Server className="h-4 w-4" />;
    case 'data':
      return <Database className="h-4 w-4" />;
    case 'module':
      return <Module className="h-4 w-4" />;
    case 'output':
      return <FileOutput className="h-4 w-4" />;
    case 'variable':
      return <Settings className="h-4 w-4" />;
    case 'provider':
      return <GitBranch className="h-4 w-4" />;
    default:
      return <Code className="h-4 w-4" />;
  }
};

// Get color scheme for different block types
export const getBlockColors = (blockType: string) => {
  switch (blockType) {
    case 'resource':
      return {
        border: 'border-blue-500',
        bg: 'bg-blue-50',
        badge: 'bg-blue-100 text-blue-800',
        hover: 'hover:bg-blue-100'
      };
    case 'data':
      return {
        border: 'border-green-500',
        bg: 'bg-green-50',
        badge: 'bg-green-100 text-green-800',
        hover: 'hover:bg-green-100'
      };
    case 'module':
      return {
        border: 'border-purple-500',
        bg: 'bg-purple-50',
        badge: 'bg-purple-100 text-purple-800',
        hover: 'hover:bg-purple-100'
      };
    case 'output':
      return {
        border: 'border-orange-500',
        bg: 'bg-orange-50',
        badge: 'bg-orange-100 text-orange-800',
        hover: 'hover:bg-orange-100'
      };
    case 'variable':
      return {
        border: 'border-yellow-500',
        bg: 'bg-yellow-50',
        badge: 'bg-yellow-100 text-yellow-800',
        hover: 'hover:bg-yellow-100'
      };
    case 'provider':
      return {
        border: 'border-gray-500',
        bg: 'bg-gray-50',
        badge: 'bg-gray-100 text-gray-800',
        hover: 'hover:bg-gray-100'
      };
    default:
      return {
        border: 'border-slate-500',
        bg: 'bg-slate-50',
        badge: 'bg-slate-100 text-slate-800',
        hover: 'hover:bg-slate-100'
      };
  }
};

// Code node component - simplified with no configuration displayed in the node
export const CodeNode: React.FC<NodeProps<CodeNodeData>> = ({ id, data, selected }) => {
  const { setSelectedNodeData } = useInfraChartState();
  const colors = getBlockColors(data.blockType);

  const handleShowDetails = () => {
    setSelectedNodeData(data);
  };

  return (
    <div className={`relative ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
      <Card className={`w-48 shadow-md transition-all duration-200 p-0 ${colors.border} ${colors.bg} ${colors.hover}`}>
        <CardHeader className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getBlockIcon(data.blockType)}
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold truncate" title={data.label}>
                  {data.label}
                </CardTitle>
                {data.resourceType && (
                  <div className="text-xs text-muted-foreground truncate">
                    {data.resourceType}
                  </div>
                )}
              </div>
            </div>
            <Badge variant="secondary" className={`text-xs flex-shrink-0 ml-2 ${colors.badge}`}>
              {data.blockType}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-3 pt-0">
          <div className="">
            
            {/* Action button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7"
              onClick={handleShowDetails}
            >
              <Info className="h-3 w-3 mr-1" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 border-2 border-muted-foreground bg-background" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 border-2 border-muted-foreground bg-background" 
      />
    </div>
  );
};

export default CodeNode;