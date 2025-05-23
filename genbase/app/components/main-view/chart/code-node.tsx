"use client";

import React, { useState, useEffect } from 'react';
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
  BoxIcon as Module,
  MessageSquare,
  Plus
} from 'lucide-react';
import { CodeNodeData } from './hierarchy-utils';
import { useInfraChartState, useChatEditorContent, useChat } from '@/lib/store';
import { ChangeType, getChangeColor, hasChanges } from './comparison-utils';
import { getProviderLogo } from '@/lib/provider-icons';
import { toast } from 'sonner';

// Extended CodeNodeData to include comparison information
export interface ExtendedCodeNodeData extends CodeNodeData {
  changeType?: ChangeType;
}

// Get fallback icon for different block types when provider icon is not available
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

// Change indicator dot component
const ChangeIndicator: React.FC<{ changeType?: ChangeType }> = ({ changeType }) => {
  if (!changeType || changeType === 'unchanged') {
    return null;
  }

  const color = getChangeColor(changeType);
  const size = 'h-6 w-6';
  
  return (
    <div 
      className={`${size} rounded-full absolute -top-2 -right-2 border-2 border-white z-10`}
      style={{ backgroundColor: color }}
      title={`${changeType.charAt(0).toUpperCase() + changeType.slice(1)} resource`}
    />
  );
};

// Provider Icon component with loading state and fallback
const ProviderIcon: React.FC<{ block: any; fallbackIcon: React.ReactNode }> = ({ 
  block, 
  fallbackIcon 
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProviderLogo = async () => {
      try {
        const logo = await getProviderLogo(block);
        if (isMounted) {
          setLogoUrl(logo);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    // Only try to load provider logos for resources and data sources
    if (block._metadata?.block_type === 'resource' || block._metadata?.block_type === 'data') {
      loadProviderLogo();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [block]);

  // Show fallback icon while loading or if no logo found
  if (loading || error || !logoUrl) {
    return <>{fallbackIcon}</>;
  }
  return (
    <img 
      src={logoUrl} 
      alt="Provider logo" 
      className="h-4 w-4 object-contain"
      onError={() => setError(true)}
    />
  );
};

// Code node component with provider icons and 4 connection handles
export const CodeNode: React.FC<NodeProps<ExtendedCodeNodeData>> = ({ id, data, selected }) => {
  const { setSelectedNodeData } = useInfraChartState();
  const { currentChatSessionId } = useChat();
  const { appendContent } = useChatEditorContent(currentChatSessionId);
  const [isHovered, setIsHovered] = useState(false);
  
  const colors = getBlockColors(data.blockType);
  const showChanges = data.changeType && hasChanges(data.changeType);

  // Apply different styling based on change type
  let nodeStyle = `w-48 shadow-md transition-all duration-200 p-0 ${colors.border} ${colors.bg} ${colors.hover} cursor-pointer relative`;
  
  // Add special styling for deleted nodes
  if (data.changeType === 'deleted') {
    nodeStyle += ' opacity-60 border-dashed';
  }

  // Generate the reference string for this block
  const generateBlockReference = () => {
    const blockType = data.blockType;
    if(blockType === 'resource') {
      return `@${data.resourceType}.${data.label}`;
    } else {
      return `@${blockType}.${data.label}`;
    }
  };


// Handle adding reference to chat
const handleAddToChat = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (!currentChatSessionId) {
    toast.error('Please open a chat session first');
    return;
  }
  
  const reference = generateBlockReference();
  appendContent(reference);
};


  // The entire card is now clickable to show details
  const handleShowDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Node clicked:', data.address); // Debug log
    setSelectedNodeData(data);
  };

  // Create block object for provider icon lookup
  const blockForIcon = {
    ...data,
    _metadata: {
      block_type: data.blockType,
      group_path: data.groupPath,
      file_name: data.fileName
    },
    config: data.config,
    type: data.resourceType,
    name: data.label
  };

  return (
    <div 
      className={`relative ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card 
        className={nodeStyle}
        onClick={handleShowDetails}
        onMouseDown={(e) => e.stopPropagation()} // Prevent drag behavior
        style={{ 
          pointerEvents: 'all', // Ensure the card can receive pointer events
          userSelect: 'none' // Prevent text selection
        }}
      >
        <CardHeader className="p-3 relative">
          {/* Change indicator dot */}
          <ChangeIndicator changeType={data.changeType} />
          
          {/* Chat reference button - only show on hover */}
          {isHovered && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute -top-2 -left-2 h-6 w-6 rounded-full shadow-md bg-primary text-primary-foreground hover:bg-primary/90 z-20"
              onClick={handleAddToChat}
              title={`Add ${generateBlockReference()} to chat`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          
          <Badge variant="secondary" className={`text-xs flex-shrink-0 ${colors.badge}`}>
            {data.blockType}
          </Badge>
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <ProviderIcon 
                block={blockForIcon}
                fallbackIcon={getBlockIcon(data.blockType)}
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold truncate" title={data.label}>
                  {data.label}
                </CardTitle>
                {data.resourceType && (
                  <div className="text-xs text-muted-foreground truncate" title={data.resourceType}>
                    {data.resourceType}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 4 connection handles - both source and target on each side */}
      
      {/* Top handle - target */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="handle-top"
        className="w-3 h-3 border-2 border-muted-foreground bg-background"
        style={{ pointerEvents: 'none' }} // Handles shouldn't interfere with clicking
      />
      
      {/* Right handle - target */}
      <Handle 
        type="target" 
        position={Position.Right} 
        id="handle-right"
        className="w-3 h-3 border-2 border-muted-foreground bg-background"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Bottom handle - source */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="handle-bottom"
        className="w-3 h-3 border-2 border-muted-foreground bg-background"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Left handle - source */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id="handle-left"
        className="w-3 h-3 border-2 border-muted-foreground bg-background"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};


export default CodeNode;