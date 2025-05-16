"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Eye, EyeOff, Edit, Key } from "lucide-react";

import apiClient, { Variable } from "@/lib/api";
import { useCurrentProject, useWorkspace } from "@/lib/store";

interface VariableFormProps {
  variable?: Variable;
  onSubmit: (variable: any) => void;
  onCancel: () => void;
  currentWorkspace: string;
}

function VariableForm({ variable, onSubmit, onCancel, currentWorkspace }: VariableFormProps) {
  const [name, setName] = useState(variable?.name || "");
  const [value, setValue] = useState<string>(
    typeof variable?.value === 'object' 
      ? JSON.stringify(variable.value, null, 2) 
      : variable?.value?.toString() || ""
  );
  const [isSecret, setIsSecret] = useState(variable?.is_secret || false);
  const [type, setType] = useState<string>(variable?.type || "string");
  const [workspace, setWorkspace] = useState(variable?.workspace || "");
  const [description, setDescription] = useState(variable?.description || "");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse the value based on selected type
    let parsedValue: any = value;
    try {
      if (type === "number") {
        parsedValue = Number(value);
      } else if (type === "boolean") {
        parsedValue = value.toLowerCase() === "true";
      } else if (type === "list" || type === "map") {
        parsedValue = JSON.parse(value);
      }
    } catch (error) {
      toast.error(`Invalid format for type ${type}`);
      return;
    }
    
    onSubmit({
      ...(variable ? { id: variable.name } : {}),
      name,
      value: parsedValue,
      is_secret: isSecret,
      type,
      workspace: workspace || undefined,
      description: description || undefined
    });
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {variable ? "Edit Variable" : "Add Variable"}
        </DialogTitle>
        <DialogDescription>
          {variable 
            ? `Update the variable "${variable.name}"`
            : "Add a new Terraform variable"
          }
        </DialogDescription>
      </DialogHeader>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="vpc_cidr"
              required
              disabled={!!variable} // Can't change name when editing
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input 
              id="value" 
              value={value} 
              onChange={(e) => setValue(e.target.value)}
              placeholder="10.0.0.0/16"
              required
              type={isSecret && !value.includes("\n") ? "password" : "text"}
            />
            {type === "list" || type === "map" ? (
              <p className="text-sm text-muted-foreground">
                Enter valid JSON for {type} type
              </p>
            ) : null}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={type} 
              onValueChange={(value) => setType(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="map">Map</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="CIDR block for the VPC"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace (optional)</Label>
            <Select 
              value={workspace || "_default"} 
              onValueChange={(value) => setWorkspace(value === "_default" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Default (all workspaces)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">Default (all workspaces)</SelectItem>
                <SelectItem value="default">default</SelectItem>
                {currentWorkspace !== "default" && (
                  <SelectItem value={currentWorkspace}>{currentWorkspace}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch 
              id="secret" 
              checked={isSecret}
              onCheckedChange={setIsSecret}
            />
            <Label htmlFor="secret" className="cursor-pointer">Sensitive value (secret)</Label>
          </div>
        </div>
        
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {variable ? "Update" : "Add"} Variable
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function VariableSettings() {
  const { currentProjectId } = useCurrentProject();
  const { currentWorkspace } = useWorkspace();
  
  const [variables, setVariables] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [addVariableDialog, setAddVariableDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  
  // Fetch variables when project or workspace filter changes
  useEffect(() => {
    if (currentProjectId) {
      fetchVariables();
    }
  }, [currentProjectId, selectedWorkspace]);
  
  const fetchVariables = async () => {
    if (!currentProjectId) return;
    
    try {
      setIsLoading(true);
      const variablesData = await apiClient.listVariables(
        currentProjectId,
        selectedWorkspace || undefined
      );
      
      setVariables(variablesData);
    } catch (error) {
      console.error("Failed to fetch variables:", error);
      toast.error("Failed to load variables");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddVariable = async (newVar: Omit<Variable, "name"> & { name: string }) => {
    if (!currentProjectId) return;
    
    try {
      setIsLoading(true);
      
      await apiClient.createOrUpdateVariable(currentProjectId, {
        name: newVar.name,
        value: newVar.value,
        is_secret: newVar.is_secret,
        description: newVar.description,
        workspace: newVar.workspace === "" ? undefined : newVar.workspace,
      });
      
      toast.success(`Variable "${newVar.name}" created successfully`);
      setAddVariableDialog(false);
      
      // Refresh variables
      await fetchVariables();
    } catch (error) {
      console.error("Failed to create variable:", error);
      toast.error("Failed to create variable");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditVariable = async (updatedVar: Variable) => {
    if (!currentProjectId) return;
    
    try {
      setIsLoading(true);
      
      await apiClient.createOrUpdateVariable(currentProjectId, {
        name: updatedVar.name,
        value: updatedVar.value,
        is_secret: updatedVar.is_secret,
        description: updatedVar.description,
        workspace: updatedVar.workspace === "" ? undefined : updatedVar.workspace,
      });
      
      toast.success(`Variable "${updatedVar.name}" updated successfully`);
      setEditingVariable(null);
      
      // Refresh variables
      await fetchVariables();
    } catch (error) {
      console.error("Failed to update variable:", error);
      toast.error("Failed to update variable");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteVariable = async (variable: Variable) => {
    if (!currentProjectId) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete variable "${variable.name}"?`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      await apiClient.deleteVariable(
        currentProjectId,
        variable.name,
        variable.workspace
      );
      
      toast.success(`Variable "${variable.name}" deleted successfully`);
      
      // Refresh variables
      await fetchVariables();
    } catch (error) {
      console.error("Failed to delete variable:", error);
      toast.error("Failed to delete variable");
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!currentProjectId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Select a project to manage variables
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b flex-shrink-0">
        <h3 className="text-lg font-semibold mb-4">Variables</h3>
        
        <div className="flex justify-between items-center mb-4">
          <Select
            value={selectedWorkspace ? selectedWorkspace : "_all"}
            onValueChange={(value) => setSelectedWorkspace(value === "_all" ? null : value)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All workspaces</SelectItem>
              <SelectItem value="default">default</SelectItem>
              {currentWorkspace !== "default" && (
                <SelectItem value={currentWorkspace}>{currentWorkspace}</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowSecrets(!showSecrets)}
          >
            {showSecrets ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Secrets
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Secrets
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {isLoading && variables.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading variables...</p>
          </div>
        ) : variables.length > 0 ? (
          <div className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable, index) => (
                  <TableRow key={`${variable.name}-${variable.workspace || "default"}-${index}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {variable.is_secret && <Key className="h-4 w-4 text-amber-500" />}
                        <span>{variable.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {variable.is_secret && !showSecrets 
                        ? "••••••••••••••••" 
                        : typeof variable.value === 'object' 
                          ? JSON.stringify(variable.value)
                          : String(variable.value)
                      }
                    </TableCell>
                    <TableCell>{variable.type}</TableCell>
                    <TableCell>{variable.workspace || "default"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setEditingVariable(variable)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteVariable(variable)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Alert className="mt-4">
            <AlertTitle>No variables</AlertTitle>
            <AlertDescription>
              This project doesn't have any variables yet. Add a variable to get started.
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <div className="p-4 border-t flex-shrink-0">
        <Button 
          className="w-full"
          onClick={() => setAddVariableDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>
      
      {/* Add Variable Dialog */}
      <Dialog open={addVariableDialog} onOpenChange={setAddVariableDialog}>
        <DialogContent>
          <VariableForm 
            onSubmit={handleAddVariable}
            onCancel={() => setAddVariableDialog(false)}
            currentWorkspace={currentWorkspace}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Variable Dialog */}
      {editingVariable && (
        <Dialog open={!!editingVariable} onOpenChange={(open) => !open && setEditingVariable(null)}>
          <DialogContent>
            <VariableForm 
              variable={editingVariable}
              onSubmit={handleEditVariable}
              onCancel={() => setEditingVariable(null)}
              currentWorkspace={currentWorkspace}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}