"use client";

import { useState, useEffect } from "react";
import { useChat, useCurrentProject } from "../../lib/store";
import apiClient, { ChatSession } from "../../lib/api";
import { Button } from "../ui/button";
import { Trash2, PlusCircle, ArrowLeft } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function ChatPanel() {
  const { currentProjectId } = useCurrentProject();
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
      setChatSessions(sessions);
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
        `Chat Session ${chatSessions.length + 1}`
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
        userMessageContent
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

  const activeSessionTitle = chatSessions.find(s => s.session_id === currentChatSessionId)?.title ||
                           (currentChatSessionId ? `Chat ${currentChatSessionId.split('/').pop()}` : "Chat");

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-card text-card-foreground">
      {showChatSessionList || !currentChatSessionId ? (
        <div className="flex flex-col h-full min-h-0">
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
            ) : chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full">
                <p className="mb-4">No chat sessions found for this project.</p>
                <Button onClick={createChatSession} disabled={isCreatingSession}>
                  Create your first session
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {chatSessions.map((session: ChatSession) => (
                    <div
                      key={session.session_id}
                      onClick={() => {
                        setCurrentChatSessionId(session.session_id);
                        setShowChatSessionList(false);
                      }}
                      className={`p-3 rounded-md cursor-pointer flex justify-between items-center group hover:bg-accent ${currentChatSessionId === session.session_id ? 'bg-muted' : ''}`}
                    >
                      <div className="overflow-hidden flex-grow">
                        <div className="font-medium truncate">
                          {session.title || `Chat Session ${session.session_number}`}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center space-x-2">
                          <span>{session.message_count} messages</span>
                          {session.last_message_at && (
                            <>
                              <span>·</span>
                              <span>{new Date(session.last_message_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                        onClick={(e) => deleteChatSession(session.session_id, e)}
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
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
              <h2 className="text-lg font-semibold truncate">
                {activeSessionTitle}
              </h2>
            </div>
          </div>
          
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center flex-1 p-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
               <span className="ml-2">Loading messages...</span>
            </div>
          ) : (
            <>
              <ChatMessages 
                messages={messages} 
                isLoading={isLoading} 
              />
              
              <ChatInput 
                onSendMessage={sendMessage}
                isSending={isSendingMessage}
                isDisabled={isLoading}
                sessionId={currentChatSessionId}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}