// Updated chat-messages.tsx - Add clickable mentions that focus nodes in chart
"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Sparkles, User, Hammer, ChevronDown, ChevronUp, X, Server, Database, FileOutput, Settings, Code, BoxIcon as Module } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ChatMessage } from "../../lib/api";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
// Import syntax highlighter
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useCurrentProject, useInfraChartState } from "../../lib/store";
import apiClient from "../../lib/api";


import 'katex/dist/katex.min.css'
import { getMentionHighlightClass } from "./chat-input";

interface MentionItem {
  key: string;
  address: string;
  name: string;
  blockType: string;
  resourceType?: string;
}

export function ChatMessages({ messages, isLoading }: { 
  messages: ChatMessage[]; 
  isLoading: boolean; 
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const { currentProjectId } = useCurrentProject();
  const { setSelectedNodeData } = useInfraChartState();

  // Load infrastructure blocks for mention highlighting
  useEffect(() => {
    const loadMentionItems = async () => {
      if (!currentProjectId) return;
      
      try {
        const codeData = await apiClient.parseProjectCode(currentProjectId, 'main');
        const items: MentionItem[] = [];
        
        Object.entries(codeData.blocks).forEach(([blockType, blocks]) => {
          if (Array.isArray(blocks)) {
            blocks.forEach((block) => {
              const name = block.name || 'unnamed';
              const address = block.address || `${blockType}.${name}`;
              
              items.push({
                key: address,
                address: address,
                name: name,
                blockType: blockType || 'unknown',
                resourceType: block.type || undefined,
              });
            });
          }
        });
        
        setMentionItems(items);
      } catch (error) {
        console.error('Failed to load mention items:', error);
      }
    };

    loadMentionItems();
  }, [currentProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle mention click - show details
  const handleMentionClick = (mentionAddress: string) => {
    const mentionItem = mentionItems.find(item => item.address === mentionAddress);
    if (mentionItem) {
      // Convert mention item to CodeNodeData format for the details panel
      const nodeData = {
        label: mentionItem.name,
        blockType: mentionItem.blockType,
        resourceType: mentionItem.resourceType,
        address: mentionItem.address,
        config: {}, // We don't have config here, but it's required
        groupPath: '', // We don't have this info
        fileName: '', // We don't have this info
        fullPath: ''
      };
      
      setSelectedNodeData(nodeData);
      
    }
  };

  // Process content to highlight mentions and make them clickable
  const processContentWithMentions = (content: string) => {
    if (!content || mentionItems.length === 0) return content;

    // Find all mentions in the content
    const mentionRegex = /@([a-zA-Z0-9._-]+(?:\.[a-zA-Z0-9._-]+)*)/g;
    
    return content.replace(mentionRegex, (match, mentionAddress) => {
      const mentionItem = mentionItems.find(item => item.address === mentionAddress);
      
      if (mentionItem) {
        const highlightClass = getMentionHighlightClass(mentionItem.blockType);
        // Use data attribute instead of onclick - add mention-clickable class for event delegation
        return `<span class="${highlightClass} cursor-pointer hover:opacity-80 transition-opacity mention-clickable" data-mention-address="${mentionAddress}">@${mentionAddress}</span>`;
      }
      
      // If no matching item found, use default styling (but not clickable)
      const defaultClass = getMentionHighlightClass('unknown');
      return `<span class="${defaultClass}">@${mentionAddress}</span>`;
    });
  };

  // Set up event delegation for mention clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('mention-clickable')) {
        const mentionAddress = target.getAttribute('data-mention-address');
        if (mentionAddress) {
          handleMentionClick(mentionAddress);
        }
      }
    };

    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [mentionItems, setSelectedNodeData]);

  const validMessages = messages.filter(msg => msg.content?.trim());
  

  const formatToolOutput = (content: string) => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      return (
        <pre className="p-3 rounded-md overflow-auto max-h-96">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (e) {
      // Not valid JSON, render as markdown with mention highlighting
      const processedContent = processContentWithMentions(content);
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Add syntax highlighting for code blocks
            code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children: React.ReactNode } & Record<string, unknown>) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // Ensure images render properly
            img({node, ...props}) {
              return <img style={{maxWidth: '100%'}} {...props} />;
            },
            table: ({node, ...props}) => (
              <table className="w-full border-1 text-sm" {...props} />
            ),
            th: ({node, ...props}) => (
              <th className="border-b bg-muted px-4 py-1 text-left font-medium" {...props} />
            ),
            td: ({node, ...props}) => (
              <td className="border-b p-2 align-middle [&:has([role=checkbox])]:pr-0" {...props} />
            ),
          }}
        >
          {processedContent}
        </ReactMarkdown>
      );
    }
  };

  const toggleToolOutput = (messageId: string) => {
    setExpandedTools(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  return (
    <div className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="py-4">
          {validMessages.length === 0 && !isLoading ? (
            <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground min-h-32">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            validMessages.map((message) => {
              const messageId = `${message.created_at}-${message.id}`;
              const processedContent = processContentWithMentions(message.content);
              
              return (
                <div 
                  key={messageId} 
                  className={"px-4 py-2 hover:bg-muted/30 transition-colors"+ (message.role === 'user'? " bg-muted/50" : "")}
                >
                  <div className="flex items-start gap-3 max-w-4xl mx-auto">
                    <div className="flex-1 space-y-1">
                      {message.role !== 'tool' && (
                        <div className="flex items-center">
                          <span className="font-medium text-xs">
                            {message.role === 'user' 
                              ? 'You' 
                              : 'Agent'}
                          </span>
                        </div>
                      )}
                      
                      <div className="text-sm">
                        {message.role === 'tool' ? (
                          <div className="flex items-center gap-2 rounded-2xl border-neutral-200 border-2 p-1 mr-8">
                            <Hammer size={16} className="text-amber-500" />
                            <span className="font-medium">
                              {(message.name || 'Tool').split('_').map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                              ).join(' ')}
                            </span>
                            <div className="flex-1" /> 
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                  View Output
                                </Button>
                              </PopoverTrigger>

                              <PopoverContent className="w-80 max-h-96 overflow-auto">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm">Tool Output</h4>
                                    <PopoverClose asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </PopoverClose>
                                  </div>
                                  <div className="prose prose-sm max-w-none">
                                    {formatToolOutput(message.content)}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        ) : (
                          <div className="prose prose-sm">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                // Add syntax highlighting for code blocks
                                code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children: React.ReactNode } & Record<string, unknown>) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return !inline && match ? (
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{
                                          padding: '0', // Remove padding
                                          margin: '0'
                                        }}
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                  ) : (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                // Ensure images render properly
                                img({node, ...props}) {
                                  return <img style={{maxWidth: '100%'}} {...props} />;
                                },
                                table: ({node, ...props}) => (
                                  <table className="w-full border-1 text-sm" {...props} />
                                ),
                                th: ({node, ...props}) => (
                                  <th className="border-b bg-muted px-4 py-1 text-left font-medium" {...props} />
                                ),
                                td: ({node, ...props}) => (
                                  <td className="border-b p-2 align-middle [&:has([role=checkbox])]:pr-0" {...props} />
                                ),
                              }}
                            >
                              {processedContent}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}