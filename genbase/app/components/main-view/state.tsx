// Fixed version of StateDetail.tsx - Removing all group references

"use client";
import { useState } from "react";
import { StateResult } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  RefreshCw, 
  Info, 
  Download, 
  Copy, 
  Server, 
  Eye, 
  EyeOff, 
  Search,
  AlertTriangle
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface StateDetailProps {
  stateData: StateResult;
  isRefreshing: boolean;
  onRefresh: () => void;
  workspace: string;
}

// Helper function to safely render values
const renderValue = (value: any) => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
};

export function StateDetail({
  stateData,
  isRefreshing,
  onRefresh,
  workspace
}: StateDetailProps) {
  const [activeStateTab, setActiveStateTab] = useState("summary");
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");
  const [outputSearchQuery, setOutputSearchQuery] = useState("");
  const [revealedValues, setRevealedValues] = useState<Record<string, boolean>>({});
  
  // Extract data from state
  const resourceCount = stateData?.summary?.resource_count || 0;
  const resourceTypes = stateData?.summary?.resource_types || [];
  const outputsFromSummary = stateData?.summary?.outputs || [];
  
  // Extract resources from the OpenTofu state format
  const resources = stateData?.state?.values?.root_module?.resources || [];
  
  // Extract outputs in the actual format
  const outputsData = stateData?.state?.values?.outputs || {};
  const outputs = Object.entries(outputsData || {}).map(([name, details]: [string, any]) => ({
    name,
    value: details.value,
    type: details.type,
    sensitive: details.sensitive || false
  }));
  
  // Filter resources based on search
  const filteredResources = resources.filter(resource => 
    resourceSearchQuery === "" || 
    resource.type?.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
    resource.name?.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
    resource.address?.toLowerCase().includes(resourceSearchQuery.toLowerCase())
  );
  
  // Filter outputs based on search
  const filteredOutputs = outputs.filter(output => 
    outputSearchQuery === "" || 
    output.name.toLowerCase().includes(outputSearchQuery.toLowerCase())
  );
  
  // Group resources by type
  const resourcesByType = filteredResources.reduce((acc, resource) => {
    const type = resource.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(resource);
    return acc;
  }, {});
  
  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };
  
  const downloadState = () => {
    const stateJson = JSON.stringify(stateData.state, null, 2);
    const blob = new Blob([stateJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terraform-state-${workspace}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("State file downloaded");
  };
  
  const toggleValueVisibility = (outputName: string) => {
    setRevealedValues(prev => ({
      ...prev,
      [outputName]: !prev[outputName]
    }));
  };
  
  // Format output value based on type and sensitivity
  const formatOutputValue = (output) => {
    if (output.sensitive && !revealedValues[output.name]) {
      return "••••••••••••";
    }
    
    if (output.value === null || output.value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }
    
    if (typeof output.value === 'object') {
      return JSON.stringify(output.value);
    }
    
    if (typeof output.value === 'boolean') {
      return output.value ? 'true' : 'false';
    }
    
    return String(output.value);
  };
  
  // Format type for display
  const formatType = (type) => {
    if (typeof type === 'string') {
      return type;
    }
    
    if (Array.isArray(type)) {
      // Handle tuple types like ["tuple", ["string", "string"]]
      if (type[0] === "tuple") {
        return `tuple(${type[1].join(", ")})`;
      }
      // Handle map types like ["map", "string"]
      if (type[0] === "map") {
        return `map(${type[1]})`;
      }
      // Handle object types
      if (type[0] === "object") {
        return "object(...)";
      }
      
      return JSON.stringify(type);
    }
    
    return JSON.stringify(type);
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
        <div>
          <CardTitle>Infrastructure State</CardTitle>
          <CardDescription>
            Current infrastructure state in workspace <Badge variant="outline">{workspace}</Badge>
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant={resourceCount > 0 ? "default" : "outline"} 
            className={resourceCount > 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
          >
            {resourceCount} {resourceCount === 1 ? "Resource" : "Resources"}
          </Badge>
          
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">About OpenTofu State</h4>
                <p className="text-sm text-muted-foreground">
                  This state file is a snapshot of your infrastructure. It maps resources to their real-world 
                  representations and tracks metadata like dependencies.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </CardHeader>
      
      <Tabs value={activeStateTab} onValueChange={setActiveStateTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 grid w-[calc(100%-2rem)] grid-cols-4 mb-4 flex-shrink-0">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
          <TabsTrigger value="raw">Raw State</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden">
          <TabsContent value="summary" className="h-full m-0 overflow-hidden">
            {/* Summary View - Using ScrollArea for all content */}
            <ScrollArea className="h-full px-4">
              <div className="space-y-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Resources</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{resourceCount}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Resource Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{resourceTypes.length}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Outputs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{outputs.length}</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Resource Types */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Resource Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {resourceTypes.length > 0 ? (
                        resourceTypes.map((type, index) => (
                          <Badge key={index} variant="secondary">
                            {type}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No resource types found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Quick Resource View */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Resource Summary</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveStateTab("resources")}
                    >
                      View Details
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {resources.length > 0 ? (
                        <div className="space-y-1">
                          {resources.slice(0, 5).map((resource, index) => (
                            <div key={index} className="flex items-center justify-between py-1 border-b">
                              <div className="flex items-center">
                                <Server className="h-4 w-4 mr-2 text-primary" />
                                <span className="font-medium">{resource.address}</span>
                              </div>
                              <Badge>{resource.type}</Badge>
                            </div>
                          ))}
                          {resources.length > 5 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-muted-foreground"
                              onClick={() => setActiveStateTab("resources")}
                            >
                              View {resources.length - 5} more resources
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No resources found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Quick Outputs View */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Output Summary</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveStateTab("outputs")}
                    >
                      View All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {outputs.length > 0 ? (
                        <div className="space-y-1">
                          {outputs.slice(0, 5).map((output, index) => (
                            <div key={index} className="flex items-center justify-between py-1 border-b">
                              <div className="flex items-center space-x-2">
                                {output.sensitive && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                <span className="font-medium">{output.name}</span>
                              </div>
                              <div className="truncate max-w-xs text-sm text-muted-foreground">
                                {output.sensitive ? "••••••••••" : (
                                  typeof output.value === 'object' 
                                    ? '[Object]' 
                                    : String(output.value).substring(0, 30) + (String(output.value).length > 30 ? '...' : '')
                                )}
                              </div>
                            </div>
                          ))}
                          {outputs.length > 5 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-muted-foreground"
                              onClick={() => setActiveStateTab("outputs")}
                            >
                              View {outputs.length - 5} more outputs
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No outputs defined</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="resources" className="h-full m-0 flex flex-col overflow-hidden">
            {/* Resources View - Search is fixed at top with scrollable content below */}
            <div className="px-4 pb-4 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={resourceSearchQuery}
                  onChange={(e) => setResourceSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 pb-4">
                {Object.keys(resourcesByType).length > 0 ? (
                  Object.entries(resourcesByType).map(([type, typeResources]: [string, any]) => (
                    <Card key={type}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                          <Badge variant="outline" className="mr-2">{typeResources.length}</Badge>
                          {type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Resource</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Provider</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {typeResources.map((resource, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{resource.address}</TableCell>
                                  <TableCell>{resource.mode}</TableCell>
                                  <TableCell>{resource.provider_name?.split('/').pop() || "default"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        {resourceSearchQuery ? (
                          <p>No resources matching "{resourceSearchQuery}"</p>
                        ) : (
                          <p>No resources found in the current state</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="outputs" className="h-full m-0 flex flex-col overflow-hidden">
            {/* Outputs View - Search is fixed at top with scrollable content below */}
            <div className="px-4 pb-4 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search outputs..."
                  value={outputSearchQuery}
                  onChange={(e) => setOutputSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 pb-4">
                {outputs.length > 0 ? (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOutputs.map((output, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium flex items-center space-x-2">
                              {output.sensitive && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                              <span>{output.name}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{formatType(output.type)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate font-mono text-sm">
                              {formatOutputValue(output)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                {output.sensitive && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => toggleValueVisibility(output.name)}
                                    title={revealedValues[output.name] ? "Hide value" : "Show value"}
                                  >
                                    {revealedValues[output.name] ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => copyToClipboard(
                                    typeof output.value === 'object' 
                                      ? JSON.stringify(output.value) 
                                      : String(output.value),
                                    `Copied ${output.name} to clipboard`
                                  )}
                                  title="Copy value"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {filteredOutputs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8">
                              {outputSearchQuery ? (
                                <div className="text-muted-foreground">
                                  No outputs matching "{outputSearchQuery}"
                                </div>
                              ) : (
                                <div className="text-muted-foreground">
                                  No outputs defined
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Alert className="mt-4">
                    <AlertTitle>No outputs defined</AlertTitle>
                    <AlertDescription>
                      Add output blocks to your OpenTofu/Terraform configuration to see values here.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="raw" className="h-full m-0">
            {/* Raw State View */}
            <div className="h-full flex flex-col mx-4">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <div className="flex justify-between">
                    <CardTitle className="text-sm font-medium">Raw State File</CardTitle>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(
                          JSON.stringify(stateData.state, null, 2), 
                          "State copied to clipboard"
                        )}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadState}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <pre className="bg-secondary p-4 rounded-md whitespace-pre overflow-auto text-sm font-mono">
                      {JSON.stringify(stateData.state, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
      
      <CardFooter className="border-t pt-2 flex-shrink-0">
        <div className="flex justify-between items-center w-full">
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleString()}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh State'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}