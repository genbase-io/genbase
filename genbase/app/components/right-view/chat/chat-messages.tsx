"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "../../ui/scroll-area";
import { Hammer, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ChatMessage, FormData, FormField } from "../../../lib/api";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import { Form, FormControl, FormDescription, FormField as ShadcnFormField, FormItem, FormLabel, FormMessage } from "../../ui/form";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Switch } from "../../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import remarkGfm from 'remark-gfm'
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useCurrentProject, useInfraChartState } from "../../../lib/store";
import apiClient from "../../../lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import 'katex/dist/katex.min.css'
import { generateStandardizedAddress, getMentionHighlightClass } from "./chat-input";

interface MentionItem {
  key: string;
  address: string;
  name: string;
  blockType: string;
  resourceType?: string;
}

// Fixed form renderer with proper height constraints and scrolling
function InlineFormRenderer({ 
  formData, 
  toolCallId, 
  onSubmit
}: { 
  formData: FormData;
  toolCallId: string;
  onSubmit: (toolCallId: string, data: any) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build Zod schema dynamically
  const buildSchema = (fields: FormField[]) => {
    const schemaFields: Record<string, any> = {};
    
    fields.forEach(field => {
      let fieldSchema: any;
      
      switch (field.type) {
        case 'number':
          fieldSchema = z.coerce.number();
          if (field.validation?.min !== undefined) fieldSchema = fieldSchema.min(field.validation.min);
          if (field.validation?.max !== undefined) fieldSchema = fieldSchema.max(field.validation.max);
          break;
        case 'boolean':
          fieldSchema = z.boolean();
          break;
        case 'textarea':
        case 'text':
        case 'password':
        default:
          fieldSchema = z.string();
          if (field.validation?.minLength !== undefined) fieldSchema = fieldSchema.min(field.validation.minLength);
          if (field.validation?.maxLength !== undefined) fieldSchema = fieldSchema.max(field.validation.maxLength);
          if (field.validation?.pattern) fieldSchema = fieldSchema.regex(new RegExp(field.validation.pattern));
          break;
      }
      
      if (!field.required) {
        if (field.type === 'number') {
          fieldSchema = z.union([z.string().length(0), fieldSchema]).optional();
        } else {
          fieldSchema = fieldSchema.optional();
        }
      }
      
      schemaFields[field.name] = fieldSchema;
    });
    
    return z.object(schemaFields);
  };

  const schema = buildSchema(formData.fields);
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData.fields.reduce((acc, field) => {
      if (field.type === 'boolean') {
        acc[field.name] = String(field.defaultValue).toLowerCase() === 'true';
      } else if (field.type === 'number') {
        acc[field.name] = field.defaultValue ? Number(field.defaultValue) : (field.required ? 0 : '');
      } else {
        acc[field.name] = field.defaultValue || '';
      }
      return acc;
    }, {} as any)
  });

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const processedValues = { ...values };
      
      formData.fields.forEach(field => {
        if (field.type === 'number' && typeof processedValues[field.name] === 'string') {
          const numValue = Number(processedValues[field.name]);
          if (!isNaN(numValue)) {
            processedValues[field.name] = numValue;
          }
        }
      });
      
      onSubmit(toolCallId, processedValues);
    } catch (error) {
      console.error("Failed to submit form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    return (
      <ShadcnFormField
        key={field.name}
        control={form.control}
        name={field.name}
        render={({ field: formField }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs font-medium">{field.label}</FormLabel>
            <FormControl>
              {field.type === 'textarea' ? (
                <Textarea 
                  placeholder={field.description}
                  className="text-xs resize-none min-h-[60px]"
                  rows={2}
                  {...formField} 
                />
              ) : field.type === 'select' ? (
                <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder={field.description} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'boolean' ? (
                <div className="flex items-center space-x-2 py-1">
                  <Switch 
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">{field.description}</span>
                </div>
              ) : (
                <Input
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.description}
                  className="text-xs h-8"
                  {...formField}
                />
              )}
            </FormControl>
            {field.description && field.type !== 'boolean' && (
              <FormDescription className="text-xs text-muted-foreground/80">{field.description}</FormDescription>
            )}
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="mt-3 bg-card rounded-lg border shadow-sm">
      {/* Fixed header */}
      <div className="px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary/60"></div>
          <h4 className="font-medium text-sm">
            {formData.title}
          </h4>
        </div>
        {formData.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-4">
            {formData.description}
          </p>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col">
          {/* Scrollable form fields with constrained height */}
          <ScrollArea className="max-h-80 overflow-auto">
            <div className="p-3 space-y-2.5">
              {formData.fields.map(renderField)}
            </div>
          </ScrollArea>
          
          {/* Fixed footer */}
          <div className="px-3 py-2 border-t bg-muted/20 rounded-b-lg">
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                size="sm"
                className="h-7 px-3 text-xs"
              >
                {isSubmitting ? "Submitting..." : (formData.submitLabel || "Submit")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export function ChatMessages({ 
  messages, 
  isLoading, 
  onUISubmit,
  sessionId 
}: { 
  messages: ChatMessage[]; 
  isLoading: boolean;
  onUISubmit: (toolCallId: string, data: any) => void;
  sessionId?: string;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const { currentProjectId } = useCurrentProject();
  const { setSelectedNodeData } = useInfraChartState();

  useEffect(() => {
    const loadMentionItems = async () => {
      if (!currentProjectId) return;
      
      try {
        const codeData = await apiClient.parseProjectCode(currentProjectId, 'main');
        const items: MentionItem[] = [];
        
        const groupPaths = new Set<string>();
        
        Object.entries(codeData.blocks).forEach(([blockType, blocks]) => {
          if (blockType === 'terraform') return;
          
          if (Array.isArray(blocks)) {
            blocks.forEach((block) => {
              const name = block.name || 'unnamed';
              const address = block.address || generateStandardizedAddress(blockType, block);
              
              items.push({
                key: address,
                address: address,
                name: name,
                blockType: blockType || 'unknown',
                resourceType: block.type || undefined,
              });
              
              if (block._metadata.group_path) {
                groupPaths.add(block._metadata.group_path);
              }
            });
          }
        });
        
        groupPaths.forEach(groupPath => {
          const groupName = groupPath.split('/').pop() || groupPath;
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
  }, [currentProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMentionClick = (mentionAddress: string) => {
    const mentionItem = mentionItems.find(item => item.address === mentionAddress);
    if (mentionItem) {
      const nodeData = {
        label: mentionItem.name,
        blockType: mentionItem.blockType,
        resourceType: mentionItem.resourceType,
        address: mentionItem.address,
        config: {},
        groupPath: '',
        fileName: '',
        fullPath: ''
      };
      
      setSelectedNodeData(nodeData);
    }
  };

  const processContentWithMentions = (content: string) => {
    if (!content || mentionItems.length === 0) return content;

    const mentionRegex = /@([a-zA-Z0-9._-]+(?:\.[a-zA-Z0-9._-]+)*)/g;
    
    return content.replace(mentionRegex, (match, mentionAddress) => {
      const mentionItem = mentionItems.find(item => item.address === mentionAddress);
      
      if (mentionItem) {
        const highlightClass = getMentionHighlightClass(mentionItem.blockType);
        return `<span class="${highlightClass} cursor-pointer hover:opacity-80 transition-opacity mention-clickable" data-mention-address="${mentionAddress}">@${mentionAddress}</span>`;
      }
      
      const defaultClass = getMentionHighlightClass('unknown');
      return `<span class="${defaultClass}">@${mentionAddress}</span>`;
    });
  };

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
    return () => document.removeEventListener('click', handleClick);
  }, [mentionItems, setSelectedNodeData]);

  // Check if message should show UI elements (only for last assistant message with tool calls)
  const shouldShowUIElements = (message: ChatMessage, index: number) => {
    if (message.role !== 'assistant' || !message.tool_calls?.length) return false;
    
    const lastAssistantIndex = messages.map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.role === 'assistant')
      .pop()?.idx;
    
    return index === lastAssistantIndex;
  };

  // Get UI elements from tool calls
  const getUIElementsFromToolCalls = (message: ChatMessage) => {
    if (!message.tool_calls) return [];
    
    return message.tool_calls
      .filter(toolCall => toolCall.function.name === 'render_form')
      .map(toolCall => {
        try {
          return {
            toolCallId: toolCall.id,
            uiData: JSON.parse(toolCall.function.arguments)
          };
        } catch (error) {
          console.error('Failed to parse UI data:', error);
          return null;
        }
      })
      .filter(Boolean);
  };

  const validMessages = messages.filter(msg => msg.content?.trim() || msg.tool_calls?.length);

  const formatToolOutput = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return (
        <pre className="p-3 rounded-md overflow-auto max-h-96 text-xs">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (e) {
      const processedContent = processContentWithMentions(content);
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
          rehypePlugins={[rehypeRaw]}
          components={{
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

  return (
    <ScrollArea className="h-full">
      <div className="py-4">
        {validMessages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground min-h-32">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          validMessages.map((message, index) => {
            const messageId = `${message.created_at}-${message.id}`;
            const processedContent = message.content ? processContentWithMentions(message.content) : '';
            const uiElements = shouldShowUIElements(message, index) ? getUIElementsFromToolCalls(message) : [];
            
            return (
              <div 
                key={messageId} 
                className={"px-4 py-2 hover:bg-muted/30 transition-colors" + (message.role === 'user' ? " bg-muted/50" : "")}
              >
                <div className="flex items-start gap-3 max-w-4xl mx-auto">
                  <div className="flex-1 space-y-1 min-w-0">
                    {message.role !== 'tool' && (
                      <div className="flex items-center">
                        <span className="font-medium text-xs">
                          {message.role === 'user' ? 'You' : 'Agent'}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-sm">
                      {message.role === 'tool' ? (
                        // Hide tool result if it's complete_interaction
                        message.name === 'complete_interaction' ? (
                          <div></div>
                        ) : (
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
                                    {formatToolOutput(message.content || '')}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )
                      ) : (
                        <>
                          {message.content && (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children: React.ReactNode } & Record<string, unknown>) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{ padding: '0', margin: '0' }}
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
                          
                          {/* Render UI elements (forms) with proper height constraints */}
                          {uiElements.map((element) => (
                            <InlineFormRenderer
                              key={element.toolCallId}
                              formData={element.uiData}
                              toolCallId={element.toolCallId}
                              onSubmit={onUISubmit}
                            />
                          ))}
                        </>
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
  );
}