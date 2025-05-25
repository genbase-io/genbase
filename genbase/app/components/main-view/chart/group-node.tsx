// Updated genbase/app/components/main-view/chart/group-node.tsx
"use client";

import React, { useState } from 'react';
import { NodeProps } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Plus, Folder } from 'lucide-react';
import { useChatEditorContent, useChat } from '@/lib/store';
import { GroupNodeData } from './hierarchy-utils';
import { toast } from 'sonner';

// Group node component with label and plus button for mentions
export const GroupNode: React.FC<NodeProps<GroupNodeData>> = ({ id, data }) => {
  const { currentChatSessionId } = useChat();
  const { appendContent } = useChatEditorContent(currentChatSessionId);
  const [isHovered, setIsHovered] = useState(false);

  // Generate the group mention reference with dots instead of slashes
  const generateGroupReference = () => {
    // Replace slashes with dots for consistency with other mention formats
    const normalizedPath = data.groupPath.replace(/\//g, '.');
    return `@group.${normalizedPath}`;
  };

  // Handle adding group reference to chat
  const handleAddToChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentChatSessionId) {
      toast.error('Please open a chat session first');
      return;
    }
    
    const reference = generateGroupReference();
    appendContent(reference);
    toast.success(`Added ${reference} to chat`);
  };

  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Group label at top-left */}
      <div className="absolute -top-1 left-2 z-20 flex items-center space-x-2">
        <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-purple-200 flex items-center space-x-1">
          <Folder className="h-3 w-3 text-purple-600" />
          <span className="text-xs font-medium text-purple-700">
            {data.label}
          </span>
        </div>
        
        {/* Plus button for adding group mention to chat - only show on hover */}
        {isHovered && (
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6 rounded-full shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleAddToChat}
            title={`Add ${generateGroupReference()} to chat`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default GroupNode;