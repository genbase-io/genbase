"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../../ui/button";
import { Send, Server, Database, FileOutput, Settings, Code, BoxIcon as Module, Folder } from "lucide-react";
import { useChatEditorContent, useCurrentProject, useModelSelection } from "../../../lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import apiClient from "../../../lib/api";
import Config from "@/lib/config";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isSending: boolean;
  isDisabled: boolean;
  sessionId?: string | null;
}

interface MentionItem {
  key: string;
  address: string;
  name: string;
  blockType: string;
  resourceType?: string;
}

interface SlashCommand {
  key: string;
  title: string;
  description: string;
  command: string;
  keywords?: string[];
}


  // Helper function to generate standardized address format
  export const generateStandardizedAddress = (blockType: string, block: any): string => {
    switch (blockType) {
      case 'resource':
        return `resource.${block.type || 'unknown'}.${block.name || 'unnamed'}`;
      case 'variable':
        return `variable.${block.name || 'unnamed'}`;
      case 'locals':
        return `locals.${block.name || 'unnamed'}`;
      case 'module':
        return `module.${block.name || 'unnamed'}`;
      case 'data':
        return `data.${block.type || 'unknown'}.${block.name || 'unnamed'}`;
      case 'output':
        return `output.${block.name || 'unnamed'}`;
      case 'provider':
        return `provider.${block.name || 'unnamed'}`;
      default:
        return `${blockType}.${block.name || 'unnamed'}`;
    }
  };


// Update the getBlockIcon function to include group support
export  const getBlockIcon = (blockType: string) => {
  switch (blockType) {
    case 'resource':
      return <Server className="h-3 w-3 text-blue-500" />;
    case 'data':
      return <Database className="h-3 w-3 text-green-500" />;
    case 'module':
      return <Module className="h-3 w-3 text-purple-500" />;
    case 'output':
      return <FileOutput className="h-3 w-3 text-orange-500" />;
    case 'variable':
      return <Settings className="h-3 w-3 text-yellow-500" />;
    case 'locals':
      return <Settings className="h-3 w-3 text-amber-500" />;
    case 'provider':
      return <Code className="h-3 w-3 text-gray-500" />;
    case 'group':
      return <Folder className="h-3 w-3 text-purple-500" />;
    default:
      return <Code className="h-3 w-3 text-gray-500" />;
  }
};

// Update the getMentionHighlightClass function to include group support
export const getMentionHighlightClass = (blockType: string) => {
  const baseClasses = 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium border mx-0.5';
  switch (blockType) {
    case 'resource':
      return `${baseClasses} bg-blue-100 text-blue-800 border-blue-200`;
    case 'data':
      return `${baseClasses} bg-green-100 text-green-800 border-green-200`;
    case 'module':
      return `${baseClasses} bg-purple-100 text-purple-800 border-purple-200`;
    case 'output':
      return `${baseClasses} bg-orange-100 text-orange-800 border-orange-200`;
    case 'variable':
      return `${baseClasses} bg-yellow-100 text-yellow-800 border-yellow-200`;
    case 'locals':
      return `${baseClasses} bg-amber-100 text-amber-800 border-amber-200`;
    case 'provider':
      return `${baseClasses} bg-gray-100 text-gray-800 border-gray-200`;
    case 'group':
      return `${baseClasses} bg-purple-100 text-purple-800 border-purple-200`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 border-gray-200`;
  }
};


export function ChatInput({ onSendMessage, isSending, isDisabled, sessionId }: ChatInputProps) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [filteredMentions, setFilteredMentions] = useState<MentionItem[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [slashQuery, setSlashQuery] = useState('');
  const { content, setContent, clearContent } = useChatEditorContent(sessionId);
  const { currentProjectId } = useCurrentProject();
  const { selectedModel, setSelectedModel, availableModels, setAvailableModels } = useModelSelection();
  const isUpdatingFromExternal = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  // Load available models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await apiClient.getAvailableModels(); // Set to true for provider endpoint check
        setAvailableModels(models);
        
        // If current selected model is not in available models, set to first available
        if (models.length > 0 && !models.includes(selectedModel)) {
          setSelectedModel(models[0]);
        }
      } catch (error) {
        console.error('Failed to load available models:', error);
      }
    };

    loadModels();
  }, [setAvailableModels, selectedModel, setSelectedModel]);

  // Slash commands
  const slashCommands: SlashCommand[] = [
    { 
      key: 'plan', 
      title: 'Plan Infrastructure', 
      description: 'Generate or update infrastructure plan',
      command: '/plan',
      keywords: ['plan', 'infrastructure', 'terraform', 'generate']
    },
    ...(Config.main_branch !== sessionId ? [{
      key: 'merge', 
      title: 'Merge Changes', 
      description: 'Merge pending infrastructure changes',
      command: '/merge',
      keywords: ['merge', 'apply', 'changes', 'deploy']
    }] : [])
  ];

  // Filtered slash commands based on query
  const filteredSlashCommands = slashCommands.filter(cmd => {
    const searchText = `${cmd.title} ${cmd.description} ${cmd.command} ${cmd.keywords?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(slashQuery.toLowerCase());
  });




  // Filter mentions based on query
  useEffect(() => {
    if (!mentionQuery) {
      setFilteredMentions(mentionItems.slice(0, 8));
    } else {
      const filtered = mentionItems
        .filter(item => {
          const name = item.name || '';
          const address = item.address || '';
          const blockType = item.blockType || '';
          const resourceType = item.resourceType || '';
          
          return (
            name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            address.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            blockType.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            resourceType.toLowerCase().includes(mentionQuery.toLowerCase())
          );
        })
        .slice(0, 8);
      setFilteredMentions(filtered);
    }
    setSelectedMentionIndex(0);
  }, [mentionQuery, mentionItems]);

  // Reset slash selection when results change
  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashQuery]);

  // Get plain text content from editor
  const getPlainTextContent = useCallback(() => {
    if (!editorRef.current) return '';
    
    let text = '';
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeName === 'BR') {
        text += '\n';
      } else if (node.nodeName === 'DIV' && node !== editorRef.current) {
        // Add newline before div content (except the root editor div)
        if (text && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    }

    return text;
  }, []);

useEffect(() => {
  const loadMentionItems = async () => {
    if (!currentProjectId) return;
    
    try {
      // Use the current sessionId for branch, fallback to 'main'
      const branch = sessionId || 'main';
      const codeData = await apiClient.parseProjectCode(currentProjectId, branch);
      const items: MentionItem[] = [];
      
      // Track unique group paths for group mentions
      const groupPaths = new Set<string>();
      
      Object.entries(codeData.blocks).forEach(([blockType, blocks]) => {
        // Filter out terraform blocks from mentions
        if (blockType === 'terraform') return;
        
        if (Array.isArray(blocks)) {
          blocks.forEach((block) => {
            const name = block.name || 'unnamed';
            // Use the standardized address format directly from the block, or generate it
            const address = block.address || generateStandardizedAddress(blockType, block);
            
            // Add block mention
            items.push({
              key: address,
              address: address,
              name: name,
              blockType: blockType || 'unknown',
              resourceType: block.type || undefined,
            });
            
            // Collect group paths for group mentions
            if (block._metadata.group_path) {
              groupPaths.add(block._metadata.group_path);
            }
          });
        }
      });
      
      // Add group mentions with normalized paths (dots instead of slashes)
      groupPaths.forEach(groupPath => {
        const groupName = groupPath.split('/').pop() || groupPath;
        // Replace slashes with dots for consistency
        const normalizedPath = groupPath.replace(/\//g, '.');
        const groupAddress = `group.${normalizedPath}`;
        
        items.push({
          key: groupAddress,
          address: groupAddress,
          name: groupName,
          blockType: 'group',
          resourceType: undefined,
        });
      });
      
      setMentionItems(items);
    } catch (error) {
      console.error('Failed to load mention items:', error);
    }
  };

  loadMentionItems();
}, [currentProjectId, sessionId]);

// Update the mention regex pattern to handle the normalized paths
const createHighlightedHTML = useCallback((text: string) => {
  if (!text) return '';
  
  // Split by lines to handle multi-line content
  const lines = text.split('\n');
  const htmlLines = lines.map(line => {
    if (!line) return '<br>';
    
    // Updated regex to match group mentions with dots
    // This pattern matches: @word.word.word (any number of segments)
    const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9._-]*(?:\.[a-zA-Z0-9._-]+)*)/g;
    let highlightedLine = line;
    const matches = Array.from(line.matchAll(mentionRegex));
    
    // Process matches in reverse order to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const mentionAddress = match[1];
      const mentionItem = mentionItems.find(item => item.address === mentionAddress);
      
      if (mentionItem) {
        const highlightClass = getMentionHighlightClass(mentionItem.blockType);
        const mentionHTML = `<span class="${highlightClass}" contenteditable="false" data-mention="${mentionAddress}">@${mentionAddress}</span>`;
        
        highlightedLine = highlightedLine.slice(0, match.index) + 
                         mentionHTML + 
                         highlightedLine.slice(match.index! + match[0].length);
      }
    }
    
    return highlightedLine;
  });
  
  return htmlLines.join('<div></div>');
}, [mentionItems]);

  // Close all menus
  const closeAllMenus = () => {
    setShowSlashMenu(false);
    setShowMentionMenu(false);
    setMentionQuery('');
    setSlashQuery('');
    setSelectedMentionIndex(0);
    setSelectedSlashIndex(0);
  };

  // Handle content changes
  const handleInput = useCallback(() => {
    if (isUpdatingFromExternal.current || isComposing.current) return;

    const plainText = getPlainTextContent();
    setIsEmpty(!plainText.trim());
    
    // Store content
    if (sessionId) {
      setContent(plainText);
    }
    
    // Handle slash commands
    const lastSlashIndex = plainText.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const beforeSlash = plainText.slice(0, lastSlashIndex);
      const afterSlash = plainText.slice(lastSlashIndex + 1);
      
      const isValidSlash = beforeSlash === '' || beforeSlash.endsWith(' ') || beforeSlash.endsWith('\n');
      
      if (isValidSlash && !afterSlash.includes(' ') && !afterSlash.includes('\n')) {
        setSlashQuery(afterSlash);
        setShowSlashMenu(true);
        setShowMentionMenu(false);
      } else {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
    }
    
    // Handle mentions
    const lastAtIndex = plainText.lastIndexOf('@');
    if (lastAtIndex !== -1 && !showSlashMenu) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterAt = plainText.slice(lastAtIndex + 1);
      
      const isValidMention = beforeAt === '' || beforeAt.endsWith(' ') || beforeAt.endsWith('\n');
      const isIncompleteMention = !afterAt.includes(' ') && !afterAt.includes('\n');
      const isExistingMention = mentionItems.some(item => item.address === afterAt);
      
      if (isValidMention && isIncompleteMention && !isExistingMention) {
        setMentionQuery(afterAt);
        setShowMentionMenu(true);
        setShowSlashMenu(false);
      } else {
        setShowMentionMenu(false);
      }
    } else if (!showSlashMenu) {
      setShowMentionMenu(false);
    }
    
    // If no special characters, close all menus
    if (!plainText.includes('/') && !plainText.includes('@')) {
      closeAllMenus();
    }
  }, [sessionId, setContent, showSlashMenu, mentionItems, getPlainTextContent]);

  // Sync external content changes
  useEffect(() => {
    if (sessionId && content !== undefined && editorRef.current) {
      const currentPlainText = getPlainTextContent();
      
      if (content !== currentPlainText) {
        isUpdatingFromExternal.current = true;
        
        if (content === '') {
          editorRef.current.innerHTML = '';
          setIsEmpty(true);
        } else {
          const highlightedHTML = createHighlightedHTML(content);
          editorRef.current.innerHTML = highlightedHTML;
          setIsEmpty(!content.trim());
        }
        
        setTimeout(() => {
          isUpdatingFromExternal.current = false;
        }, 10);
      }
    }
  }, [sessionId, content, getPlainTextContent, createHighlightedHTML]);

  // Clear content when session is null
  useEffect(() => {
    if (!sessionId && editorRef.current) {
      editorRef.current.innerHTML = '';
      setIsEmpty(true);
      closeAllMenus();
    }
  }, [sessionId]);

  // Handle slash command selection
  const handleSlashCommand = (command: string) => {
    closeAllMenus();
    onSendMessage(command.trim());
    
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setIsEmpty(true);
    
    if (sessionId) {
      clearContent();
    }
    
    setTimeout(() => {
      editorRef.current?.focus();
    }, 10);
  };

  // Handle mention selection
  const handleMentionSelect = (mention: MentionItem) => {
    if (!editorRef.current) return;
    
    const plainText = getPlainTextContent();
    const atIndex = plainText.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const beforeAt = plainText.slice(0, atIndex);
      const newText = `${beforeAt}@${mention.address} `;
      
      // Update content with highlights
      const highlightedHTML = createHighlightedHTML(newText);
      editorRef.current.innerHTML = highlightedHTML;
      
      if (sessionId) {
        setContent(newText);
      }
      
      // Set cursor to end
      setTimeout(() => {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(editorRef.current!);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        editorRef.current?.focus();
      }, 10);
    }
    
    closeAllMenus();
  };

  const handleSend = useCallback(() => {
    if (isEmpty || isSending || isDisabled || !editorRef.current) return;
    
    const textContent = getPlainTextContent().trim();
    if (!textContent) return;

    closeAllMenus();
    onSendMessage(textContent);
    
    editorRef.current.innerHTML = '';
    setIsEmpty(true);
    
    if (sessionId) {
      clearContent();
    }
    
    setTimeout(() => {
      editorRef.current?.focus();
    }, 10);
  }, [isEmpty, isSending, isDisabled, onSendMessage, sessionId, clearContent, getPlainTextContent]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle mention menu navigation
    if (showMentionMenu && filteredMentions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredMentions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredMentions.length - 1
        );
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleMentionSelect(filteredMentions[selectedMentionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAllMenus();
        return;
      }
    }

    // Handle slash menu navigation
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSlashIndex(prev => 
          prev < filteredSlashCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSlashIndex(prev => 
          prev > 0 ? prev - 1 : filteredSlashCommands.length - 1
        );
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSlashCommand(filteredSlashCommands[selectedSlashIndex].command);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAllMenus();
        return;
      }
    }

    // Regular enter handling
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend, showSlashMenu, showMentionMenu, filteredMentions, filteredSlashCommands, selectedMentionIndex, selectedSlashIndex, handleMentionSelect, handleSlashCommand]);

  // Handle paste events to strip formatting
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    
    // Insert plain text at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Trigger input handling
    setTimeout(() => handleInput(), 0);
  }, [handleInput]);

  // Handle composition events (for IME input)
  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
    handleInput();
  };

  // Handle clicks outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeAllMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="border-t bg-card flex-shrink-0 relative" ref={containerRef}>
      {/* Slash Menu */}
      {showSlashMenu && filteredSlashCommands.length > 0 && (
        <div className="absolute bottom-full left-2 mb-2 bg-popover border rounded-md shadow-lg py-1 z-50 min-w-64">
          {filteredSlashCommands.map((cmd, index) => (
            <button
              key={cmd.key}
              className={`w-full text-left px-3 py-2 text-sm ${
                index === selectedSlashIndex 
                  ? 'bg-accent text-accent-foreground' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => handleSlashCommand(cmd.command)}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cmd.title}</span>
                  <span className="text-xs text-muted-foreground font-mono">{cmd.command}</span>
                </div>
                <p className="text-xs text-muted-foreground">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mention Menu */}
      {showMentionMenu && filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-2 mb-2 bg-popover border rounded-md shadow-lg py-1 z-50 min-w-80 max-h-48 overflow-y-auto">
          {filteredMentions.map((mention, index) => (
            <button
              key={mention.key}
              className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 ${
                index === selectedMentionIndex 
                  ? 'bg-accent text-accent-foreground' 
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => handleMentionSelect(mention)}
            >
              <div className="flex-shrink-0">
                {getBlockIcon(mention.blockType)}
              </div>
              
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="font-medium truncate block">{mention.name}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-2">
                  <span className="bg-muted px-1.5 py-0.5 rounded">{mention.blockType}</span>
                  {mention.resourceType && (
                    <span className="bg-muted px-1.5 py-0.5 rounded">{mention.resourceType}</span>
                  )}
                  <span className="font-mono">@{mention.address}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ContentEditable Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!isSending && !isDisabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className={`
            min-h-[52px] max-h-[200px] overflow-y-auto px-3 py-3 text-sm
            focus:outline-none focus:ring-0 border-0 bg-transparent
            ${isEmpty ? 'text-muted-foreground' : ''}
            ${(isSending || isDisabled) ? 'opacity-50 pointer-events-none' : ''}
          `}
          style={{
            lineHeight: '1.4',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
          data-placeholder="Type your message... (use / for commands, @ for infrastructure)"
        />
        
        {/* Placeholder when empty */}
        {isEmpty && (
          <div className="absolute inset-0 px-3 py-3 text-sm text-muted-foreground pointer-events-none">
            Type your message... (use / for commands, @ for infrastructure)
          </div>
        )}
      </div>
      
      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-0 border-border/50">
        <div className="flex items-center space-x-2">
          {/* Model Selector */}
   <Select value={selectedModel} onValueChange={setSelectedModel} >
  <SelectTrigger className="w-28 h-5 text-xs p-1 min-h-0 [&>span]:truncate [&>span]:block">
    <SelectValue placeholder="Model" />
  </SelectTrigger>
  <SelectContent >
    {availableModels.map((model) => (
      <SelectItem key={model} value={model} className="text-xs py-1">
        {model}
      </SelectItem>
    ))}
  </SelectContent>
</Select>


         
        </div>
        
        <Button 
          size="sm"
          disabled={isEmpty || isSending || isDisabled}
          onClick={handleSend}
          aria-label="Send message"
          className="h-7 px-3"
        >
          {isSending ? (
            <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          <span className="ml-1 text-xs">Send</span>
        </Button>
      </div>
      
      {/* Custom CSS for mention styling */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgb(156 163 175);
        }
        
        [contenteditable] [data-mention] {
          user-select: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}