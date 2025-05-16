"use client";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Settings } from "lucide-react";
import { toast } from "sonner";

import { GroupDetail } from "@/components/main-view/group-detail";
import { VariableSettings } from "@/components/variable-settings";
import { ChatPanel } from "@/components/chat-panel";

import apiClient from "@/lib/api";
import { useCurrentProject } from "@/lib/store";

export default function DashboardPage() {
  const { currentProjectId } = useCurrentProject();
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [rightSidebarTab, setRightSidebarTab] = useState("chat");
  
  // Check if the current project exists when the component mounts
  useEffect(() => {
    if (currentProjectId) {
      verifyProject();
    }
  }, [currentProjectId]);
  
  const verifyProject = async () => {
    try {
      setIsLoadingProject(true);
      await apiClient.getProject(currentProjectId!);
    } catch (error) {
      console.error("Failed to verify project:", error);
      toast.error(`Project "${currentProjectId}" not found. Please select another project.`);
    } finally {
      setIsLoadingProject(false);
    }
  };
  
  // Show loading state if verifying project
  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }
  
  return (
    // The parent container maintains full height and prevents overflow
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area - Fixed height with internal scrolling */}
      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        {/* Infrastructure management UI */}
        <div className="flex-1 h-full overflow-hidden">
          <GroupDetail />
        </div>
        
        {/* Right Sidebar - Fixed height with internal scrolling */}
        <div className="w-80 border-l h-full flex flex-col overflow-hidden">
          <Tabs 
            value={rightSidebarTab} 
            onValueChange={setRightSidebarTab}
            className="h-full flex flex-col"
          >
            <TabsList className="mx-4 mt-4 grid w-[calc(100%-2rem)] grid-cols-2 flex-shrink-0">
              <TabsTrigger value="chat">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 overflow-hidden pt-4">
              <ChatPanel />
            </TabsContent>
            
            <TabsContent value="settings" className="flex-1 overflow-hidden pt-4">
              <VariableSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}