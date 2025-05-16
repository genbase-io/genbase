// components/plan-detail.tsx
import { useState } from "react";
import { PlanResult } from "@/lib/api";
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
import { RefreshCw, ArrowRight, Download, Copy, AlertTriangle, Plus, Minus, RefreshCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface PlanDetailProps {
  planData: PlanResult | null;
  isPlanLoading: boolean;
  onRunPlan: () => void;
  onApplyPlan: () => void;
  workspace: string;
}

export function PlanDetail({
  planData,
  isPlanLoading,
  onRunPlan,
  onApplyPlan,
  workspace
}: PlanDetailProps) {
  const [activePlanTab, setActivePlanTab] = useState("summary");
  
  const hasChanges = planData && (
    planData.summary.add > 0 || 
    planData.summary.change > 0 || 
    planData.summary.destroy > 0
  );
  
  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };
  
  const downloadPlan = () => {
    if (!planData) return;
    
    const planJson = JSON.stringify(planData.plan, null, 2);
    const blob = new Blob([planJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terraform-plan-${workspace}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Plan file downloaded");
  };
  
  // Function to extract resources from the plan
  const extractResources = () => {
    if (!planData?.plan?.resource_changes) return [];
    
    return planData.plan.resource_changes.map(resource => ({
      address: resource.address,
      type: resource.type,
      name: resource.name,
      action: resource.change?.actions || [],
      provider: resource.provider_name
    }));
  };
  
  const resources = extractResources();
  
  // Group resources by action
  const resourcesByAction = {
    create: resources.filter(r => r.action.includes('create')),
    update: resources.filter(r => r.action.includes('update')),
    delete: resources.filter(r => r.action.includes('delete')),
    'no-op': resources.filter(r => r.action.includes('no-op') || r.action.length === 0),
  };
  
  // Extract resource types for the summary
  const resourceTypes = [...new Set(resources.map(r => r.type))];
  
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
        <div>
          <CardTitle>Infrastructure Plan</CardTitle>
          <CardDescription>
            Preview changes before applying in workspace <Badge variant="outline">{workspace}</Badge>
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <div className="flex space-x-2">
              {planData.summary.add > 0 && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  <Plus className="h-3 w-3 mr-1" />
                  {planData.summary.add} to add
                </Badge>
              )}
              {planData.summary.change > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                  <RefreshCcw className="h-3 w-3 mr-1" />
                  {planData.summary.change} to change
                </Badge>
              )}
              {planData.summary.destroy > 0 && (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                  <Minus className="h-3 w-3 mr-1" />
                  {planData.summary.destroy} to destroy
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      {isPlanLoading ? (
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
            <h3 className="text-lg font-medium mb-2">Running Infrastructure Plan</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              This may take a few moments as we analyze your infrastructure code and determine the changes that will be made.
            </p>
          </div>
        </div>
      ) : !planData ? (
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-4">
              <RefreshCw className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Plan Generated Yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Run a plan to see what changes would be made to your infrastructure. This is a safe operation that doesn't make any actual changes.
            </p>
            <Button onClick={onRunPlan}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Plan
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activePlanTab} onValueChange={setActivePlanTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 grid w-[calc(100%-2rem)] grid-cols-3 mb-4 flex-shrink-0">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="raw">Raw Plan</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="summary" className="h-full m-0">
                {/* Summary Tab */}
                <ScrollArea className="h-full px-4">
                  <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className={planData.summary.add > 0 ? "border-green-200" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <Plus className="h-4 w-4 mr-2 text-green-500" />
                            Resources to Add
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{planData.summary.add}</div>
                        </CardContent>
                      </Card>
                      
                      <Card className={planData.summary.change > 0 ? "border-yellow-200" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <RefreshCcw className="h-4 w-4 mr-2 text-yellow-500" />
                            Resources to Change
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{planData.summary.change}</div>
                        </CardContent>
                      </Card>
                      
                      <Card className={planData.summary.destroy > 0 ? "border-red-200" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <Minus className="h-4 w-4 mr-2 text-red-500" />
                            Resources to Destroy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{planData.summary.destroy}</div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Resource Types */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Affected Resource Types</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {resourceTypes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {resourceTypes.map((type: any, index) => (
                              <Badge key={index} variant="secondary">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No resource types affected</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Ready to Apply Alert */}
                    {hasChanges && (
                      <Alert className="bg-blue-50 text-blue-700 border-blue-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Ready to apply these changes?</AlertTitle>
                        <AlertDescription>
                          Review the plan carefully, then click "Apply Plan" to make these changes to your infrastructure.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {!hasChanges && planData && (
                      <Alert className="bg-green-50 text-green-700 border-green-200">
                        <AlertTitle>No changes required</AlertTitle>
                        <AlertDescription>
                          Your infrastructure is already up-to-date. No changes need to be applied.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="changes" className="h-full m-0">
                {/* Changes Tab */}
                <ScrollArea className="h-full px-4">
                  <div className="space-y-4 pb-4">
                    {/* Resources to Create */}
                    {resourcesByAction.create.length > 0 && (
                      <Card className="border-green-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <Plus className="h-4 w-4 mr-2 text-green-500" />
                            Resources to Create ({resourcesByAction.create.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Resource</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Provider</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resourcesByAction.create.map((resource, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{resource.address}</TableCell>
                                    <TableCell>{resource.type}</TableCell>
                                    <TableCell>{resource.provider}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Resources to Update */}
                    {resourcesByAction.update.length > 0 && (
                      <Card className="border-yellow-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <RefreshCcw className="h-4 w-4 mr-2 text-yellow-500" />
                            Resources to Update ({resourcesByAction.update.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Resource</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Provider</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resourcesByAction.update.map((resource, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{resource.address}</TableCell>
                                    <TableCell>{resource.type}</TableCell>
                                    <TableCell>{resource.provider}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Resources to Delete */}
                    {resourcesByAction.delete.length > 0 && (
                      <Card className="border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <Minus className="h-4 w-4 mr-2 text-red-500" />
                            Resources to Delete ({resourcesByAction.delete.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Resource</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Provider</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resourcesByAction.delete.map((resource, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{resource.address}</TableCell>
                                    <TableCell>{resource.type}</TableCell>
                                    <TableCell>{resource.provider}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Unchanged Resources */}
                    {resourcesByAction['no-op'].length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center">
                            Unchanged Resources ({resourcesByAction['no-op'].length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Resource</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Provider</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resourcesByAction['no-op'].map((resource, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{resource.address}</TableCell>
                                    <TableCell>{resource.type}</TableCell>
                                    <TableCell>{resource.provider}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {resources.length === 0 && (
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-center text-muted-foreground">No resource changes found in the plan</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="raw" className="h-full m-0">
                {/* Raw Plan Tab */}
                <div className="h-full flex flex-col px-4">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <div className="flex justify-between">
                        <CardTitle className="text-sm font-medium">Raw Plan Output</CardTitle>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(
                              JSON.stringify(planData.plan, null, 2), 
                              "Plan copied to clipboard"
                            )}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadPlan}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <pre className="bg-secondary p-4 rounded-md whitespace-pre text-sm font-mono">
                          {JSON.stringify(planData.plan, null, 2)}
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
              <Button
                variant="outline" 
                size="sm"
                onClick={onRunPlan}
                disabled={isPlanLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Plan Again
              </Button>
              
              {hasChanges && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onApplyPlan}
                  disabled={isPlanLoading}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Apply Plan
                </Button>
              )}
            </div>
          </CardFooter>
        </div>
      )}
    </Card>
  );
}