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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit, Key, Settings2 } from "lucide-react";

import apiClient, { Variable } from "@/lib/api";
import { useCurrentProject, useWorkspace } from "@/lib/store";

// Terraform Variable Form Component
function TerraformVariableDialog({ 
  open, 
  onClose, 
  variable, 
  workspace 
}: { 
  open: boolean; 
  onClose: () => void; 
  variable?: Variable; 
  workspace: string; 
}) {
  const { currentProjectId } = useCurrentProject();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("string");
  const [isSecret, setIsSecret] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or variable changes
  useEffect(() => {
    if (open) {
      setName(variable?.name || "");
      // Don't populate sensitive values for editing
      setValue(variable?.is_secret ? "" : (
        typeof variable?.value === 'object' 
          ? JSON.stringify(variable.value, null, 2) 
          : variable?.value?.toString() || ""
      ));
      setType(variable?.type || "string");
      setIsSecret(variable?.is_secret || false);
      setDescription(variable?.description || "");
    }
  }, [open, variable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId) return;

    // For editing sensitive variables, require a value to be entered
    if (variable?.is_secret && !value.trim()) {
      toast.error("Please enter a new value for this sensitive variable");
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse the value based on type
      let parsedValue: any = value;
      if (type === "number") {
        parsedValue = Number(value);
        if (isNaN(parsedValue)) {
          toast.error("Invalid number format");
          return;
        }
      } else if (type === "boolean") {
        parsedValue = value.toLowerCase() === "true";
      } else if (type === "list" || type === "map") {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          toast.error(`Invalid JSON format for ${type}`);
          return;
        }
      }

      await apiClient.createOrUpdateVariable(currentProjectId, {
        name,
        value: parsedValue,
        workspace,
        is_secret: isSecret,
        description: description || undefined
      });

      toast.success(`Terraform variable "${name}" ${variable ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (error) {
      console.error("Error saving terraform variable:", error);
      toast.error("Failed to save terraform variable");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {variable ? "Edit" : "Add"} Terraform Variable
          </DialogTitle>
          <DialogDescription>
            {variable ? `Update "${variable.name}"` : "Add a new terraform variable"} in workspace "{workspace}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tf-name">Name</Label>
            <Input
              id="tf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vpc_cidr"
              disabled={!!variable || isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tf-value">
              Value {variable?.is_secret && "(enter new value)"}
            </Label>
            <Input
              id="tf-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={variable?.is_secret ? "Enter new sensitive value" : "10.0.0.0/16"}
              type={isSecret ? "password" : "text"}
              required
            />
            {(type === "list" || type === "map") && (
              <p className="text-xs text-muted-foreground">Enter valid JSON</p>
            )}
            {variable?.is_secret && (
              <p className="text-xs text-amber-600">
                Sensitive values are never displayed. Enter a new value to update.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tf-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
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
            <Label htmlFor="tf-description">Description (optional)</Label>
            <Input
              id="tf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="CIDR block for VPC"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              id="tf-secret" 
              checked={isSecret}
              onCheckedChange={setIsSecret}
            />
            <Label htmlFor="tf-secret">Sensitive value</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (variable ? "Update" : "Add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Environment Variable Form Component
function EnvironmentVariableDialog({ 
  open, 
  onClose, 
  variable, 
  workspace 
}: { 
  open: boolean; 
  onClose: () => void; 
  variable?: Variable; 
  workspace: string; 
}) {
  const { currentProjectId } = useCurrentProject();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or variable changes
  useEffect(() => {
    if (open) {
      setName(variable?.name || "");
      // Never populate environment variable values (they're always sensitive)
      setValue("");
    }
  }, [open, variable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId) return;

    // Validate environment variable name
    if (!name.match(/^[A-Z_][A-Z0-9_]*$/)) {
      toast.error("Environment variable names should be uppercase with underscores (e.g., AWS_REGION)");
      return;
    }

    // Require a value for environment variables
    if (!value.trim()) {
      toast.error("Please enter a value for this environment variable");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.createOrUpdateEnvVariable(currentProjectId, {
        name,
        value,
        workspace
      });

      toast.success(`Environment variable "${name}" ${variable ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (error) {
      console.error("Error saving environment variable:", error);
      toast.error("Failed to save environment variable");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {variable ? "Edit" : "Add"} Environment Variable
          </DialogTitle>
          <DialogDescription>
            {variable ? `Update "${variable.name}"` : "Add a new environment variable"} in workspace "{workspace}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="env-name">Name</Label>
            <Input
              id="env-name"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="AWS_REGION"
              disabled={!!variable || isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use uppercase letters and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="env-value">
              Value {variable && "(enter new value)"}
            </Label>
            <Input
              id="env-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={variable ? "Enter new value" : "us-west-2"}
              type="password"
              required
            />
            <p className="text-xs text-amber-600">
              Environment variables are always sensitive and never displayed after creation.
            </p>
          </div>


          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (variable ? "Update" : "Add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main Variable Settings Component
export function VariableSettings() {
  const { currentProjectId } = useCurrentProject();
  const { currentWorkspace } = useWorkspace();
  
  // State
  const [terraformVariables, setTerraformVariables] = useState<Variable[]>([]);
  const [environmentVariables, setEnvironmentVariables] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("terraform");
  
  // Dialog states
  const [tfDialogOpen, setTfDialogOpen] = useState(false);
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [editingTfVariable, setEditingTfVariable] = useState<Variable | undefined>();
  const [editingEnvVariable, setEditingEnvVariable] = useState<Variable | undefined>();

  // Fetch variables
  const fetchVariables = async () => {
    if (!currentProjectId) return;

    setIsLoading(true);
    try {
      const [tfVars, envVars] = await Promise.all([
        apiClient.listVariables(currentProjectId, currentWorkspace),
        apiClient.listEnvVariables(currentProjectId, currentWorkspace)
      ]);
      
      setTerraformVariables(tfVars);
      setEnvironmentVariables(envVars);
    } catch (error) {
      console.error("Failed to fetch variables:", error);
      toast.error("Failed to load variables");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when project/workspace changes
  useEffect(() => {
    fetchVariables();
  }, [currentProjectId, currentWorkspace]);

  // Delete handlers
  const handleDeleteTfVariable = async (variable: Variable) => {
    if (!currentProjectId || !confirm(`Delete terraform variable "${variable.name}"?`)) return;

    try {
      await apiClient.deleteVariable(currentProjectId, variable.name, currentWorkspace);
      toast.success(`Terraform variable "${variable.name}" deleted`);
      fetchVariables();
    } catch (error) {
      console.error("Error deleting terraform variable:", error);
      toast.error("Failed to delete terraform variable");
    }
  };

  const handleDeleteEnvVariable = async (variable: Variable) => {
    if (!currentProjectId || !confirm(`Delete environment variable "${variable.name}"?`)) return;

    try {
      await apiClient.deleteEnvVariable(currentProjectId, variable.name, currentWorkspace);
      toast.success(`Environment variable "${variable.name}" deleted`);
      fetchVariables();
    } catch (error) {
      console.error("Error deleting environment variable:", error);
      toast.error("Failed to delete environment variable");
    }
  };

  // Dialog handlers
  const handleTfDialogClose = () => {
    setTfDialogOpen(false);
    setEditingTfVariable(undefined);
    fetchVariables();
  };

  const handleEnvDialogClose = () => {
    setEnvDialogOpen(false);
    setEditingEnvVariable(undefined);
    fetchVariables();
  };

  // Render variable table
  const renderVariableTable = (variables: Variable[], isEnvironment = false) => {
    if (variables.length === 0) {
      return (
        <div className="text-center py-8">
          <Alert className="max-w-md mx-auto">
            <AlertTitle>No {isEnvironment ? 'environment' : 'terraform'} variables</AlertTitle>
            <AlertDescription>
              This workspace doesn't have any {isEnvironment ? 'environment' : 'terraform'} variables yet.
            </AlertDescription>
          </Alert>
          <Button 
            className="mt-4"
            onClick={() => isEnvironment ? setEnvDialogOpen(true) : setTfDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {isEnvironment ? 'Environment' : 'Terraform'} Variable
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={() => isEnvironment ? setEnvDialogOpen(true) : setTfDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {isEnvironment ? 'Environment' : 'Terraform'} Variable
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
              {!isEnvironment && <TableHead>Type</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((variable) => (
              <TableRow key={variable.name}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    {!isEnvironment && variable.is_secret && (
                      <Key className="h-4 w-4 text-amber-500" />
                    )}
                    {isEnvironment && (
                      <Settings2 className="h-4 w-4 text-green-500" />
                    )}
                    <span>{variable.name}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {isEnvironment || (!isEnvironment && variable.is_secret) ? (
                    <span className="text-muted-foreground italic">
                      ••••••••••••••••
                    </span>
                  ) : typeof variable.value === 'object' ? (
                    JSON.stringify(variable.value)
                  ) : (
                    String(variable.value)
                  )}
                </TableCell>
                {!isEnvironment && <TableCell>{variable.type}</TableCell>}
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (isEnvironment) {
                          setEditingEnvVariable(variable);
                          setEnvDialogOpen(true);
                        } else {
                          setEditingTfVariable(variable);
                          setTfDialogOpen(true);
                        }
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => 
                        isEnvironment 
                          ? handleDeleteEnvVariable(variable)
                          : handleDeleteTfVariable(variable)
                      }
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
    );
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
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <h3 className="text-lg font-semibold mb-2">Variables</h3>
        <p className="text-sm text-muted-foreground">
          Managing variables for workspace: <strong>{currentWorkspace}</strong>
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4 grid w-[calc(100%-2rem)] grid-cols-2">
            <TabsTrigger value="terraform">
              Terraform ({terraformVariables.length})
            </TabsTrigger>
            <TabsTrigger value="environment">
              Environment ({environmentVariables.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="terraform" className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Loading variables...</p>
              </div>
            ) : (
              renderVariableTable(terraformVariables, false)
            )}
          </TabsContent>
          
          <TabsContent value="environment" className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Loading environment variables...</p>
              </div>
            ) : (
              renderVariableTable(environmentVariables, true)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <TerraformVariableDialog
        open={tfDialogOpen}
        onClose={handleTfDialogClose}
        variable={editingTfVariable}
        workspace={currentWorkspace}
      />

      <EnvironmentVariableDialog
        open={envDialogOpen}
        onClose={handleEnvDialogClose}
        variable={editingEnvVariable}
        workspace={currentWorkspace}
      />
    </div>
  );
}