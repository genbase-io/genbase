"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Play, 
  Trash2, 
  ChevronDown, 
  RotateCw, 
  Folder, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
  MoreVertical,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import apiClient, { StateResult, PlanResult, ApplyResult } from "@/lib/api";
import { useCurrentProject, useWorkspace, useOperationStatus } from "@/lib/store";
import React from "react";
import { StateDetail } from "./state";
import { PlanDetail } from "./plan";
import { InfraChart } from "./chart/infra-chart";

export function GroupDetail() {
  const { currentProjectId } = useCurrentProject();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { operationStatus, setOperationStatus } = useOperationStatus();
  
  const [activeTab, setActiveTab] = useState("state");
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [stateData, setStateData] = useState<StateResult | null>(null);
  const [planData, setPlanData] = useState<PlanResult | null>(null);
  const [applyData, setApplyData] = useState<ApplyResult | null>(null);
  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [refreshingState, setRefreshingState] = useState(false);
  const [confirmDestroyDialog, setConfirmDestroyDialog] = useState(false);
  
  // State for overlay panel visibility
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  
  useEffect(() => {
    if (currentProjectId) {
      fetchWorkspaces();
      fetchState();
    }
  }, [currentProjectId, currentWorkspace]);
  
  // Reset data when selected project changes
  useEffect(() => {
    if (currentProjectId) {
      setPlanData(null);
      setApplyData(null);
      setOperationStatus({ type: null, status: 'idle' });
    }
  }, [currentProjectId]);
  
  const fetchWorkspaces = async () => {
    if (!currentProjectId) return;
    
    try {
      const workspaceData = await apiClient.listWorkspaces(currentProjectId);
      setWorkspaces(workspaceData.map(w => w.name));
      
      // If current workspace doesn't exist in the list, switch to default
      if (!workspaceData.some(w => w.name === currentWorkspace)) {
        setCurrentWorkspace("default");
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      toast.error("Failed to load workspaces");
    }
  };
  
  const fetchState = async (refresh = false) => {
    if (!currentProjectId) return;
    
    try {
      setRefreshingState(true);
      const state = await apiClient.getState(currentProjectId, currentWorkspace, refresh);
      setStateData(state);
      setRefreshingState(false);
      
      if (refresh) {
        toast.success("State refreshed successfully");
      }
    } catch (error) {
      console.error("Failed to fetch state:", error);
      toast.error("Failed to load state");
      setStateData(null);
      setRefreshingState(false);
    }
  };
  
  const runPlan = async () => {
    if (!currentProjectId) return;
    
    try {
      setOperationStatus({ type: 'plan', status: 'loading' });
      setPlanData(null); // Clear existing plan data
      
      // Open detail panel and switch to plan tab to see progress
      setShowDetailPanel(true);
      setActiveTab("plan");
      
      const plan = await apiClient.planInfrastructure(currentProjectId, currentWorkspace);
      setPlanData(plan);
      
      // Set operation status based on plan results
      let status: 'success' | 'idle' = 'success';
      let message = `Plan completed with `;
      
      const { add, change, destroy } = plan.summary;
      if (add > 0) message += `${add} to add`;
      if (change > 0) message += `${add > 0 ? ', ' : ''}${change} to change`;
      if (destroy > 0) message += `${add > 0 || change > 0 ? ', ' : ''}${destroy} to destroy`;
      if (add === 0 && change === 0 && destroy === 0) {
        message = 'No changes detected in plan';
        status = 'idle';
      }
      
      setOperationStatus({ 
        type: 'plan', 
        status,
        message
      });
      
      toast.success("Plan completed successfully");
    } catch (error) {
      console.error("Failed to run plan:", error);
      toast.error("Failed to run plan");
      setOperationStatus({ type: 'plan', status: 'error', message: 'Plan failed' });
    }
  };
  
  const runApply = async (autoApprove = false) => {
    if (!currentProjectId) return;
    
    // If we haven't run a plan and not using auto-approve, prompt the user
    if (!planData && !autoApprove) {
      toast.warning("Please run a plan first, or use auto-approve");
      return;
    }
    
    try {
      setOperationStatus({ type: 'apply', status: 'loading' });
      setApplyData(null); // Clear existing apply data
      
      // Open the detail panel if it's not already open
      setShowDetailPanel(true);
      
      const apply = await apiClient.applyInfrastructure(currentProjectId, currentWorkspace);
      setApplyData(apply);
      
      // Refresh state after apply
      await fetchState(true);
      
      setActiveTab("state"); // Switch back to state tab
      
      setOperationStatus({ 
        type: 'apply', 
        status: 'success',
        message: "Apply completed successfully"
      });
      
      toast.success("Infrastructure applied successfully");
    } catch (error) {
      console.error("Failed to apply changes:", error);
      toast.error("Failed to apply changes");
      setOperationStatus({ type: 'apply', status: 'error', message: 'Apply failed' });
    }
  };
  
  const runDestroy = async () => {
    if (!currentProjectId) return;
    
    setConfirmDestroyDialog(false);
    
    try {
      setOperationStatus({ type: 'destroy', status: 'loading' });
      
      // Open the detail panel if it's not already open
      setShowDetailPanel(true);
      
      const destroy = await apiClient.destroyInfrastructure(currentProjectId, currentWorkspace);
      
      // Refresh state after destroy
      await fetchState(true);
      
      setActiveTab("state"); // Switch back to state tab
      setPlanData(null); // Clear plan data since it's no longer valid
      
      setOperationStatus({ 
        type: 'destroy', 
        status: 'success',
        message: "Infrastructure destroyed successfully"
      });
      
      toast.success("Infrastructure destroyed successfully");
    } catch (error) {
      console.error("Failed to destroy infrastructure:", error);
      toast.error("Failed to destroy infrastructure");
      setOperationStatus({ type: 'destroy', status: 'error', message: 'Destroy failed' });
    }
  };
  
  const createWorkspace = async () => {
    if (!currentProjectId || !newWorkspaceName.trim()) return;
    
    try {
      const workspace = await apiClient.createWorkspace(
        currentProjectId,
        newWorkspaceName.trim()
      );
      
      toast.success(`Workspace "${newWorkspaceName}" created successfully`);
      setNewWorkspaceName("");
      setShowNewWorkspaceDialog(false);
      
      // Refresh workspaces
      await fetchWorkspaces();
      
      // Switch to the new workspace
      setCurrentWorkspace(newWorkspaceName.trim());
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Failed to create workspace");
    }
  };
  
  // Render operation status indicator
  const renderOperationStatus = () => {
    if (operationStatus.status === 'idle' || !operationStatus.type) return null;
    
    let color = '';
    let icon: React.ReactNode = null;
    let title = '';
    
    switch (operationStatus.status) {
      case 'loading':
        color = 'text-blue-600 bg-blue-50 border-blue-200';
        icon = <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
        title = `${operationStatus.type.charAt(0).toUpperCase() + operationStatus.type.slice(1)} in progress...`;
        break;
      case 'success':
        color = 'text-green-600 bg-green-50 border-green-200';
        icon = <CheckCircle className="h-4 w-4 mr-2" />;
        title = operationStatus.message || 'Operation completed';
        break;
      case 'error':
        color = 'text-red-600 bg-red-50 border-red-200';
        icon = <XCircle className="h-4 w-4 mr-2" />;
        title = operationStatus.message || 'Operation failed';
        break;
    }
    
    return (
      <div className={`p-2 mb-4 rounded border flex items-center ${color}`}>
        {icon}
        <span>{title}</span>
      </div>
    );
  };
  
  // When no project is selected
  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <Folder className="h-16 w-16 mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-medium mb-2">No Project Selected</h3>
        <p>Select a project from the dropdown to manage infrastructure</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Main content area - Infrastructure Flow Chart */}
      <div className="flex-1 overflow-hidden">
        <InfraChart />
      </div>
      
      {/* The overlay panel for state/plan details */}
      {showDetailPanel && (
        <div className="absolute inset-0 bottom-[60px] bg-background/95 backdrop-blur-sm z-10 p-4 flex flex-col overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-medium">Project: {currentProjectId}</h2>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowDetailPanel(false)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Operation Status */}
          {renderOperationStatus()}
          
          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList>
                <TabsTrigger value="state">State</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="state" className="h-full m-0">
                  {stateData ? (
                    <StateDetail 
                      stateData={stateData}
                      isRefreshing={refreshingState}
                      onRefresh={() => fetchState(true)}
                      workspace={currentWorkspace}
                    />
                  ) : (
                    <Alert>
                      <AlertTitle>No state found</AlertTitle>
                      <AlertDescription>
                        {"This project doesn't have any infrastructure state yet. Run a plan and apply to create resources."}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
                
                <TabsContent value="plan" className="h-full m-0">
                  <PlanDetail
                    planData={planData}
                    isPlanLoading={operationStatus.type === 'plan' && operationStatus.status === 'loading'}
                    onRunPlan={runPlan}
                    onApplyPlan={() => runApply(false)}
                    workspace={currentWorkspace}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      )}
      
      {/* Fixed action buttons at the bottom */}
      <div className="h-[60px] p-4 border-t flex justify-between items-center flex-shrink-0 bg-card/60 backdrop-blur-sm z-20">
        <div className="flex items-center space-x-3">
          {/* Workspace selector moved to bottom left */}
          <Select
            value={currentWorkspace}
            onValueChange={(value) => {
              if (value === "_new_workspace") {
                setShowNewWorkspaceDialog(true);
              } else {
                setCurrentWorkspace(value);
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map(workspace => (
                <SelectItem key={workspace} value={workspace}>
                  {workspace}
                </SelectItem>
              ))}
              <SelectItem value="_new_workspace">
                <span className="text-primary">+ New Workspace</span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {/* New workspace button */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowNewWorkspaceDialog(true)}
            title="Create new workspace"
          >
            <Plus className="h-4 w-4" />
          </Button>
          
          {/* Destroy button in dropdown menu for safety */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                className="text-red-500 hover:text-red-600 focus:text-red-600 hover:bg-red-50 focus:bg-red-50 cursor-pointer"
                onClick={() => setConfirmDestroyDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Destroy Infrastructure
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Button to toggle details panel */}
          <Button
            variant={showDetailPanel ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDetailPanel(!showDetailPanel)}
          >
            {showDetailPanel ? "Hide Details" : "Show Details"}
          </Button>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="default"
            onClick={runPlan}
            disabled={operationStatus.status === 'loading'}
          >
            <Play className="h-4 w-4 mr-2" />
            Run Plan
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                disabled={operationStatus.status === 'loading'}
              >
                Apply
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => runApply(false)} className="cursor-pointer">
                Apply Plan
                <span className="ml-2 text-xs text-muted-foreground">(requires plan)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runApply(true)} className="cursor-pointer">
                Apply with Auto-Approve
                <span className="ml-2 text-xs text-muted-foreground">(skips plan)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* New Workspace Dialog */}
      <Dialog open={showNewWorkspaceDialog} onOpenChange={setShowNewWorkspaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace for this project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="dev"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setNewWorkspaceName("");
                setShowNewWorkspaceDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={createWorkspace}
              disabled={!newWorkspaceName.trim() || operationStatus.status === 'loading'}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirm Destroy Dialog */}
      <Dialog open={confirmDestroyDialog} onOpenChange={setConfirmDestroyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Destroy</DialogTitle>
            <DialogDescription>
              This action will destroy all resources in the current workspace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to destroy all resources in:
                <div className="mt-2 font-medium">
                  Project: {currentProjectId}
                  <br />
                  Workspace: {currentWorkspace}
                </div>
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDestroyDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={runDestroy}
            >
              Yes, Destroy All Resources
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}