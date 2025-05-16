"use client";
import { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentProject } from "@/lib/store";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function ChatPanel() {
  const { currentProjectId } = useCurrentProject();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Add welcome message when component mounts
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        content: "👋 Hello! I'm your infrastructure assistant. How can I help you today? You can ask me about the current infrastructure, how to use Terraform, or how to generate configurations.",
        role: "assistant",
        timestamp: new Date()
      }
    ]);
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      content: inputMessage,
      role: "user",
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    
    try {
      // In a real app, this would call an API endpoint to get the assistant's response
      // For demo purposes, we'll simulate a response
      await simulateAssistantResponse(userMessage.content);
    } catch (error) {
      console.error("Error getting assistant response:", error);
      
      // Add error message
      setMessages((prev) => [...prev, {
        id: `msg-${Date.now()}-error`,
        content: "Sorry, I'm having trouble responding right now. Please try again later.",
        role: "assistant",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      
      // Focus input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
  
  // Simulate assistant response with delay
  const simulateAssistantResponse = async (userMessage: string) => {
    // Wait a moment to simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let responseContent = "";
    
    // Generate contextual responses based on input
    if (userMessage.toLowerCase().includes("terraform") || userMessage.toLowerCase().includes("tofu")) {
      responseContent = "OpenTofu/Terraform is an infrastructure as code tool that lets you build, change, and version infrastructure safely and efficiently. It can help you manage service providers as well as custom in-house solutions.";
    } else if (userMessage.toLowerCase().includes("vpc") || userMessage.toLowerCase().includes("network")) {
      responseContent = "VPCs (Virtual Private Clouds) provide isolated network environments. In Terraform, you can define them with the `aws_vpc` resource or similar for other cloud providers.";
    } else if (userMessage.toLowerCase().includes("variable") || userMessage.toLowerCase().includes("var")) {
      responseContent = "Terraform variables let you customize your infrastructure. You can add them in the Variables tab on the right sidebar. Use `var.name` syntax to reference them in your Terraform files.";
    } else if (userMessage.toLowerCase().includes("plan") || userMessage.toLowerCase().includes("apply")) {
      responseContent = "The plan operation shows what changes Terraform will make to your infrastructure. The apply operation actually makes those changes. You can run both from the action buttons at the bottom of the main panel.";
    } else if (userMessage.toLowerCase().includes("workspace")) {
      responseContent = "Workspaces let you manage multiple environments (like dev, staging, production) with the same Terraform configuration. You can select or create a workspace from the dropdown at the bottom of the main panel.";
    } else {
      responseContent = "I understand you're asking about infrastructure. Could you provide more details or ask a more specific question about your Terraform configuration?";
    }
    
    // Add current context if available
    if (currentProjectId) {
      responseContent += `\n\nYou're currently in the "${currentProjectId}" project.`;
    }
    
    // Add assistant response
    setMessages((prev) => [...prev, {
      id: `msg-${Date.now()}-assistant`,
      content: responseContent,
      role: "assistant",
      timestamp: new Date()
    }]);
  };
  
  // Format message timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Clear chat messages
  const handleClearChat = () => {
    setMessages([{
      id: "welcome-new",
      content: "Chat cleared. How can I help you with your infrastructure?",
      role: "assistant",
      timestamp: new Date()
    }]);
  };
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b flex-shrink-0 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium">Chat Assistant</h3>
          <p className="text-xs text-muted-foreground">
            Ask questions about your infrastructure
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={handleClearChat}
          title="Clear chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`
                  flex-1 max-w-[85%] p-3 rounded-lg
                  ${message.role === "user" 
                    ? "bg-primary text-primary-foreground ml-12" 
                    : "bg-muted mr-12"
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  {message.role === "assistant" && (
                    <Avatar className="h-6 w-6">
                      <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="text-sm whitespace-pre-line">{message.content}</div>
                    <div 
                      className={`
                        text-xs 
                        ${message.role === "user" 
                          ? "text-primary-foreground/60 text-right" 
                          : "text-muted-foreground"
                        }
                      `}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-6 w-6">
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex-1 max-w-[85%] p-3 rounded-lg bg-muted mr-12">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask a question..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !inputMessage.trim()}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}