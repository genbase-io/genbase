"use client";

import { useState, useEffect } from "react";
import { useChat, useCurrentProject, useModelSelection } from "../../../lib/store";
import apiClient, { ChatSession } from "../../../lib/api";
import { Button } from "../../ui/button";
import { Trash2, PlusCircle, ArrowLeft, Star, StarIcon } from "lucide-react";
import { ScrollArea } from "../../ui/scroll-area";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { Badge } from "../../ui/badge";

export function ChatPanel() {
  const { currentProjectId } = useCurrentProject();
  const { selectedModel } = useModelSelection();
  const {
    currentChatSessionId,
    setCurrentChatSessionId,
    chatSessions,
    setChatSessions,
    showChatSessionList,
    setShowChatSessionList,
  } = useChat();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      loadChatSessions();
    } else {
      setChatSessions([]);
      setCurrentChatSessionId(null);
      setMessages([]);
      setShowChatSessionList(true);
    }
  }, [currentProjectId, setChatSessions, setCurrentChatSessionId, setShowChatSessionList]);

  useEffect(() => {
    if (currentProjectId && currentChatSessionId) {
      loadChatMessages();
      setShowChatSessionList(false);
    } else {
      setMessages([]);
    }
  }, [currentProjectId, currentChatSessionId, setShowChatSessionList]);

  const loadChatSessions = async () => {
    if (!currentProjectId) return;
    
    setIsLoading(true);
    try {
      const sessions = await apiClient.listChatSessions(currentProjectId);
      
      const mainSession = {
        session_id: "main",
        session_number: 0,
        title: "Main Session",
        project_id: currentProjectId,
        message_count: 0,
        last_message_at: null,
        infrastructure_path: null,
        worktree_exists: true,
        is_main_branch: true
      };
      
      setChatSessions([mainSession, ...sessions]);
      
      if (sessions.length === 0) {
        setShowChatSessionList(true);
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatMessages = async () => {
    if (!currentProjectId || !currentChatSessionId) return;
    
    setIsLoading(true);
    try {
      const fetchedMessages = await apiClient.getChatMessages(
        currentProjectId,
        currentChatSessionId
      );
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createChatSession = async () => {
    if (!currentProjectId) return;
    
    setIsCreatingSession(true);
    try {
      const newSession = await apiClient.createChatSession(
        currentProjectId,
        `Chat Session ${chatSessions.filter(s => s.session_id !== "main").length + 1}`
      );
      setChatSessions([...chatSessions, newSession]);
      setCurrentChatSessionId(newSession.session_id);
      setShowChatSessionList(false);
    } catch (error) {
      console.error("Failed to create chat session:", error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const deleteChatSession = async (sessionIdToDelete: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!currentProjectId) return;
    
    if (sessionIdToDelete === "main") {
      return;
    }
    
    try {
      await apiClient.deleteChatSession(currentProjectId, sessionIdToDelete);
      const updatedSessions = chatSessions.filter((s) => s.session_id !== sessionIdToDelete);
      setChatSessions(updatedSessions);
      
      if (currentChatSessionId === sessionIdToDelete) {
        setCurrentChatSessionId(null);
        setShowChatSessionList(true);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat session:", error);
    }
  };

  const sendMessage = async (messageContent: string) => {
    if (!currentProjectId || !currentChatSessionId || !messageContent.trim()) return;
    
    setIsSendingMessage(true);
    const userMessageContent = messageContent;

    let tempUserMessage = null; 

    try {
      tempUserMessage = {
        id: Date.now(), 
        role: "user",
        content: userMessageContent,
        created_at: new Date().toISOString(),
      };
      setMessages(prevMessages => [...prevMessages, tempUserMessage]);

      await apiClient.sendAgentMessage(
        currentProjectId,
        currentChatSessionId,
        userMessageContent,
        selectedModel
      );

      setTimeout(() => {
        loadChatMessages();
      }, 500); 
    } catch (error) {
      console.error("Failed to send message:", error);
      if (tempUserMessage) {
        setMessages(prevMessages => prevMessages.filter(m => m.id !== tempUserMessage.id));
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUISubmit = async (toolCallId: string, data: any) => {
    if (!currentProjectId || !currentChatSessionId) return;
    
    setIsSendingMessage(true);
    
    try {
      await apiClient.sendAgentMessage(
        currentProjectId,
        currentChatSessionId,
        JSON.stringify({ success: true, form_data: data, message: "UI submitted successfully" }),
        selectedModel, // Use selected model
        undefined, // temperature
        toolCallId,
        "render_form"
      );

      setTimeout(() => {
        loadChatMessages();
      }, 500);
    } catch (error) {
      console.error("Failed to submit UI data:", error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const isMainBranch = currentChatSessionId === "main";
  const activeSessionTitle = chatSessions.find(s => s.session_id === currentChatSessionId)?.title ||
                           (currentChatSessionId ? `Chat ${currentChatSessionId.split('/').pop()}` : "Chat");

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {showChatSessionList || !currentChatSessionId ? (
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b flex justify-between items-center flex-shrink-0">
            <h2 className="text-lg font-semibold">Chat Sessions</h2>
            <Button 
              onClick={createChatSession} 
              disabled={isCreatingSession || !currentProjectId}
              size="sm" 
            >
              {isCreatingSession ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              New Session
            </Button>
          </div>
          
          <div className="flex-1 min-h-0">
            {isLoading && chatSessions.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <span className="ml-2">Loading sessions...</span>
              </div>
            ) : !currentProjectId ? (
               <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full">
                  <p>Please select a project to start chatting.</p>
                </div>
            ) : chatSessions.length <= 1 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full">
                <p className="mb-4">No development sessions found. Main session is available above.</p>
                <Button onClick={createChatSession} disabled={isCreatingSession}>
                  Create your first development session
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {chatSessions.map((session: ChatSession) => {
                    const isMainSession = session.session_id === "main";
                    
                    return (
                      <div
                        key={session.session_id}
                        onClick={() => {
                          setCurrentChatSessionId(session.session_id);
                          setShowChatSessionList(false);
                        }}
                        className={`px-3 py-1 rounded-md cursor-pointer flex justify-between items-center group hover:bg-accent ${currentChatSessionId === session.session_id ? 'bg-muted' : ''}`}
                      >
                        <div className="overflow-hidden flex-grow">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">
                              {session.title || `Chat Session ${session.session_number}`}
                            </div>
                            {isMainSession && (
                              <Badge className="text-lg rounded-full w-6 h-6 p-0 flex items-center justify-center">
                                <StarIcon className="w-4 h-4" fill="currentColor" />
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {session.last_message_at ? new Date(session.last_message_at).toLocaleDateString() : 'No messages'}
                          </span>
                        </div>
                        
                        {!isMainSession && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                            onClick={(e) => deleteChatSession(session.session_id, e)}
                            aria-label="Delete session"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      ) : (
        // FIXED: CSS Grid layout for precise space distribution
        <div className="h-full grid" style={{ gridTemplateRows: 'auto auto 1fr auto' }}>
          {/* Header - auto height */}
          <header className="px-4 py-3 border-b flex items-center justify-between bg-card z-10">
            <div className="flex items-center">
              <Button 
                onClick={() => {
                  setCurrentChatSessionId(null);
                  setShowChatSessionList(true);
                }}
                variant="ghost" 
                size="icon"
                className="mr-2"
                aria-label="Back to sessions"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">
                  {activeSessionTitle}
                </h2>
                
                {isMainBranch && (
                  <Badge className="text-lg rounded-full w-6 h-6 p-0 flex items-center justify-center">
                    <StarIcon className="w-4 h-4" fill="currentColor" />
                  </Badge>
                )}
              </div>
            </div>
          </header>
          
          {/* Info banner - auto height */}
          {isMainBranch ? (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b text-sm text-blue-700 dark:text-blue-300">
              Ask questions about your infrastructure, get insights, and explore configurations
            </div>
          ) : (
            <div></div>
          )}
          
          {/* Messages area - 1fr takes ALL remaining space */}
          <div className="min-h-0 overflow-hidden">
            {isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <span className="ml-2">Loading messages...</span>
              </div>
            ) : (
              <ChatMessages 
                messages={messages} 
                isLoading={isLoading}
                onUISubmit={handleUISubmit}
                sessionId={currentChatSessionId}
              />
            )}
          </div>
          
          {/* Input area - auto height */}
          <div className="border-t bg-card">
            <ChatInput 
              onSendMessage={sendMessage}
              isSending={isSendingMessage}
              isDisabled={isLoading}
              sessionId={currentChatSessionId}
            />
          </div>
        </div>
      )}
    </div>
  );
}