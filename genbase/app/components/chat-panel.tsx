"use client";
import { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User, Loader2, X, Plus, MessageSquare, ChevronLeft, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentProject, useChat } from "@/lib/store";
import apiClient, { ChatSession, ChatMessage } from "@/lib/api";
import { toast } from "sonner";

export function ChatPanel() {
  const { currentProjectId } = useCurrentProject();
  const { 
    currentChatSessionId, 
    setCurrentChatSessionId,
    chatSessions,
    setChatSessions,
    showChatSessionList,
    setShowChatSessionList 
  } = useChat();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Load chat sessions when component mounts or project changes
  useEffect(() => {
    if (currentProjectId) {
      loadChatSessions();
    }
  }, [currentProjectId]);

  // Load messages when session changes
  useEffect(() => {
    if (currentChatSessionId && currentProjectId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [currentChatSessionId, currentProjectId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatSessions = async () => {
    if (!currentProjectId) return;
    
    try {
      setIsLoadingSessions(true);
      const sessions = await apiClient.listChatSessions(currentProjectId);
      setChatSessions(sessions);
      
      // If no current session is selected and we have sessions, select the first one
      if (!currentChatSessionId && sessions.length > 0) {
        setCurrentChatSessionId(sessions[0].id);
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
      toast.error("Failed to load chat sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadMessages = async () => {
    if (!currentProjectId || !currentChatSessionId) return;
    
    try {
      const sessionMessages = await apiClient.getChatMessages(currentProjectId, currentChatSessionId);
      setMessages(sessionMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const createNewSession = async (title?: string) => {
    if (!currentProjectId) return;
    
    try {
      setIsCreatingSession(true);
      const newSession = await apiClient.createChatSession(currentProjectId, title);
      
      // Reload sessions to get the updated list
      await loadChatSessions();
      
      // Switch to the new session
      setCurrentChatSessionId(newSession.id);
      setShowChatSessionList(false);
      
      toast.success("New chat session created");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create new session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!currentProjectId) return;
    
    try {
      await apiClient.deleteChatSession(currentProjectId, sessionId);
      
      // Reload sessions
      await loadChatSessions();
      
      // If we deleted the current session, clear it
      if (currentChatSessionId === sessionId) {
        setCurrentChatSessionId(null);
        setMessages([]);
      }
      
      toast.success("Chat session deleted");
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    }
  };
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!inputMessage.trim() || !currentProjectId) return;
    
    // If no session is selected, create one first
    if (!currentChatSessionId) {
      await createNewSession();
      // After creating session, the useEffect will load it and we can try sending again
      return;
    }
    
    const userMessageContent = inputMessage;
    setInputMessage("");
    setIsLoading(true);
    
    // Add user message optimistically
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessageContent,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);
    
    try {
      // Send message to backend
      const response = await apiClient.sendChatMessage(currentProjectId, currentChatSessionId, userMessageContent);
      
      // Reload all messages to get the complete conversation including assistant response
      await loadMessages();
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
      
      // Focus input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
  
  // Format message timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCurrentSession = () => {
    return chatSessions.find(session => session.id === currentChatSessionId);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  // If showing session list
  if (showChatSessionList) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b flex-shrink-0 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowChatSessionList(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-medium">Chat Sessions</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => createNewSession()}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-3">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex flex-col items-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
              </div>
            </div>
          ) : chatSessions.length > 0 ? (
            <div className="space-y-2">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg cursor-pointer border
                    ${session.id === currentChatSessionId
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted/50 border-transparent'
                    }
                  `}
                  onClick={() => {
                    setCurrentChatSessionId(session.id);
                    setShowChatSessionList(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {session.title || `Chat ${session.id.slice(-8)}`}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {session.branch}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {session.message_count} messages
                      </span>
                    </div>
                    {session.last_activity && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Last active: {new Date(session.last_activity).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToDelete(session.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No chat sessions yet</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => createNewSession()}
                  disabled={isCreatingSession}
                >
                  Create your first chat
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Chat Session</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this chat session? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteSession}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b flex-shrink-0 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium">
            {getCurrentSession()?.title || 'Chat Assistant'}
          </h3>
          {getCurrentSession() && (
            <Badge variant="outline" className="text-xs">
              {getCurrentSession()?.branch}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setShowChatSessionList(true)}
            title="View all chats"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => createNewSession()}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </DropdownMenuItem>
              {currentChatSessionId && (
                <DropdownMenuItem 
                  onClick={() => {
                    setSessionToDelete(currentChatSessionId);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Chat
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-3 py-2">
        {currentChatSessionId ? (
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback><Bot className="h-6 w-6" /></AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  👋 Hello! I'm your infrastructure assistant. How can I help you today? 
                  You can ask me about the current infrastructure, how to use Terraform, or how to generate configurations.
                </p>
              </div>
            )}
            
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
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No chat session selected. Create a new one to get started.
              </p>
              <Button onClick={() => createNewSession()} disabled={isCreatingSession}>
                {isCreatingSession ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Start New Chat
              </Button>
            </div>
          </div>
        )}
      </ScrollArea>
      
      <div className="p-3 border-t flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={currentChatSessionId ? "Ask a question..." : "Create a chat session to start messaging"}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading || !currentProjectId || (!currentChatSessionId && !chatSessions.length)}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !inputMessage.trim() || !currentProjectId}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSession}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}