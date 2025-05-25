// node-details-panel-with-comparison.tsx - Fixed with proper internal scrolling
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  X, 
  Copy, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  FolderOpen,
  GitBranch,
  Link2,
  Eye,
  ExternalLink,
  Plus,
  Minus,
  GitCompare
} from 'lucide-react';
import { toast } from 'sonner';
import { getBlockIcon, getBlockColors } from './code-node';
import { useInfraChartState } from '@/lib/store';
import { useReactFlow } from 'reactflow';
import { 
  BranchComparison, 
  CodeBlockComparison, 
  getChangeLabel, 
  getChangeColor,
  hasChanges 
} from './comparison-utils';

interface NodeDetailsPanelWithComparisonProps {
  branchComparison?: BranchComparison;
}

const useDependencies = (nodeData) => {
  const reactFlowInstance = useReactFlow();
  
  return useMemo(() => {
    if (!reactFlowInstance) return { incoming: [], outgoing: [] };
    
    const edges = reactFlowInstance.getEdges();
    const nodes = reactFlowInstance.getNodes();
    
    const incoming = edges
      .filter(edge => edge.target === nodeData.address)
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return {
          from: edge.source,
          type: edge.data?.dependencyType || 'unknown',
          label: edge.label || '',
          sourceNode: sourceNode?.data
        };
      });
    
    const outgoing = edges
      .filter(edge => edge.source === nodeData.address)
      .map(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        return {
          to: edge.target,
          type: edge.data?.dependencyType || 'unknown',
          label: edge.label || '',
          targetNode: targetNode?.data
        };
      });
    
    return { incoming, outgoing };
  }, [reactFlowInstance, nodeData.address]);
};

const ConfigChangeRow: React.FC<{
  configKey: string;
  change: { old?: any; new?: any; type: 'added' | 'removed' | 'modified' };
}> = ({ configKey, change }) => {
  const renderValue = (value: any, isOld = false) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic text-xs">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? "default" : "secondary"} className="text-xs">
          {value ? 'true' : 'false'}
        </Badge>
      );
    }
    
    if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value);
      const truncated = jsonStr.length > 30 ? jsonStr.substring(0, 30) + '...' : jsonStr;
      return (
        <span className="font-mono text-xs text-muted-foreground break-words" title={jsonStr}>
          {truncated}
        </span>
      );
    }
    
    const strValue = String(value);
    const displayValue = strValue.length > 35 ? strValue.substring(0, 35) + '...' : strValue;
    
    return (
      <span 
        className={`text-xs break-words ${isOld ? 'line-through text-red-600' : ''}`} 
        title={strValue}
      >
        {displayValue}
      </span>
    );
  };

  return (
    <TableRow>
      <TableCell className="font-medium py-2 align-top w-24">
        <div className="flex items-center space-x-1">
          {change.type === 'added' && <Plus className="h-3 w-3 text-green-600 flex-shrink-0" />}
          {change.type === 'removed' && <Minus className="h-3 w-3 text-red-600 flex-shrink-0" />}
          {change.type === 'modified' && <GitCompare className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
          <span className="text-xs break-words">{configKey}</span>
        </div>
      </TableCell>
      <TableCell className="py-2 align-top">
        <div className="max-w-48">
          {change.type === 'added' && (
            <div className="flex items-start space-x-1">
              <Plus className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">{renderValue(change.new)}</div>
            </div>
          )}
          {change.type === 'removed' && (
            <div className="flex items-start space-x-1">
              <Minus className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">{renderValue(change.old, true)}</div>
            </div>
          )}
          {change.type === 'modified' && (
            <div className="space-y-1">
              <div className="flex items-start space-x-1">
                <Minus className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">{renderValue(change.old, true)}</div>
              </div>
              <div className="flex items-start space-x-1">
                <Plus className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">{renderValue(change.new)}</div>
              </div>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2 align-top w-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => {
            const valueToCopy = change.type === 'removed' ? change.old : change.new;
            navigator.clipboard.writeText(
              typeof valueToCopy === 'object' 
                ? JSON.stringify(valueToCopy, null, 2) 
                : String(valueToCopy)
            );
            toast.success(`Copied ${configKey} to clipboard`);
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const NodeDetailsPanelWithComparison: React.FC<NodeDetailsPanelWithComparisonProps> = ({ 
  branchComparison 
}) => {
  const { selectedNodeData, setSelectedNodeData } = useInfraChartState();
  const { incoming, outgoing } = useDependencies(selectedNodeData);
  const reactFlowInstance = useReactFlow();
  
  if (!selectedNodeData) return null;
  
  const nodeComparison = branchComparison?.blockComparisons.get(selectedNodeData.address);
  const hasChange = nodeComparison && hasChanges(nodeComparison.changeType);
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  
  const colors = getBlockColors(selectedNodeData.blockType);
  
  const focusOnNode = (nodeId: string) => {
    if (reactFlowInstance) {
      const node = reactFlowInstance.getNode(nodeId);
      if (node) {
        reactFlowInstance.setCenter(
          node.position.x + 100, 
          node.position.y + 60, 
          { zoom: 1.2, duration: 800 }
        );
        
        const newSelectedNode = reactFlowInstance.getNodes().find(n => n.id === nodeId);
        if (newSelectedNode && newSelectedNode.data) {
          setSelectedNodeData(newSelectedNode.data);
        }
      }
    }
  };
  
  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic text-xs">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? "default" : "secondary"} className="text-xs">
          {value ? 'true' : 'false'}
        </Badge>
      );
    }
    
    if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value);
      const truncated = jsonStr.length > 60 ? jsonStr.substring(0, 60) + '...' : jsonStr;
      return (
        <span className="font-mono text-xs text-muted-foreground break-words" title={jsonStr}>
          {truncated}
        </span>
      );
    }
    
    const strValue = String(value);
    return (
      <span className="text-xs break-words" title={strValue}>
        {strValue.length > 40 ? strValue.substring(0, 40) + '...' : strValue}
      </span>
    );
  };
  
  const getTypeColor = (depType: string) => {
    const colors = {
      'resource_to_resource': 'bg-blue-100 text-blue-800',
      'module_dependency': 'bg-purple-100 text-purple-800',
      'datasource_dependency': 'bg-green-100 text-green-800',
      'variable_reference': 'bg-amber-100 text-amber-800',
      'local_reference': 'bg-orange-100 text-orange-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    return colors[depType] || colors.default;
  };
  
  const configChanges = [];
  if (nodeComparison?.configChanges) {
    const { added, removed, modified } = nodeComparison.configChanges;
    
    Object.entries(added).forEach(([key, value]) => {
      configChanges.push({ key, change: { new: value, type: 'added' as const } });
    });
    
    Object.entries(removed).forEach(([key, value]) => {
      configChanges.push({ key, change: { old: value, type: 'removed' as const } });
    });
    
    Object.entries(modified).forEach(([key, { old, new: newValue }]) => {
      configChanges.push({ key, change: { old, new: newValue, type: 'modified' as const } });
    });
  }
  
  const totalDependencies = incoming.length + outgoing.length;
  const configEntries = Object.entries(selectedNodeData.config);
  
  return (
    <div className="w-96 h-full flex flex-col border-l border-border bg-background">
      {/* Fixed Header - no longer full screen height issues */}
      <div className={`border-l-4 p-4 bg-card flex-shrink-0`} style={{ borderLeftColor: colors.border.replace('border-', '') }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {getBlockIcon(selectedNodeData.blockType)}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate" title={selectedNodeData.label}>
                {selectedNodeData.label}
              </h2>
              <code className="text-xs text-muted-foreground">{selectedNodeData.address}</code>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedNodeData(null)}
            className="h-8 w-8 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge className={colors.badge}>
            {selectedNodeData.blockType}
          </Badge>
          {selectedNodeData.resourceType && (
            <Badge variant="outline">
              {selectedNodeData.resourceType}
            </Badge>
          )}
          {hasChange && nodeComparison && (
            <Badge 
              style={{ backgroundColor: getChangeColor(nodeComparison.changeType), color: 'white' }}
            >
              {getChangeLabel(nodeComparison.changeType)}
            </Badge>
          )}
          {totalDependencies > 0 && (
            <Badge variant="secondary">
              <Link2 className="h-3 w-3 mr-1" />
              {totalDependencies} dependencies
            </Badge>
          )}
        </div>
      </div>
      
      {/* Scrollable Content - Now properly contained */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Dependencies */}
            {totalDependencies > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <GitBranch className="h-4 w-4 mr-2" />
                  Dependencies
                  <Badge variant="outline" className="ml-2 text-xs">
                    {totalDependencies}
                  </Badge>
                </h3>
                
                {/* Dependency changes */}
                {nodeComparison?.dependencyChanges && (
                  <div className="mb-4 p-3 bg-amber-50 rounded-md border">
                    <h4 className="text-xs font-medium text-amber-800 mb-2">Dependency Changes</h4>
                    {nodeComparison.dependencyChanges.added.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-green-600 font-medium">
                          +{nodeComparison.dependencyChanges.added.length} Added:
                        </span>
                        {nodeComparison.dependencyChanges.added.map((dep, idx) => (
                          <div key={idx} className="text-xs text-green-700 ml-2">
                            {dep.from} → {dep.to}
                          </div>
                        ))}
                      </div>
                    )}
                    {nodeComparison.dependencyChanges.removed.length > 0 && (
                      <div>
                        <span className="text-xs text-red-600 font-medium">
                          -{nodeComparison.dependencyChanges.removed.length} Removed:
                        </span>
                        {nodeComparison.dependencyChanges.removed.map((dep, idx) => (
                          <div key={idx} className="text-xs text-red-700 ml-2 line-through">
                            {dep.from} → {dep.to}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {incoming.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Depends on ({incoming.length})
                    </h4>
                    <div className="space-y-1">
                      {incoming.map((dep, index) => {
                        const nodeData = dep.sourceNode;
                        const isClickable = !!nodeData;
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                {isClickable ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => focusOnNode(dep.from)}
                                    className="text-xs font-medium p-0 h-auto hover:text-primary max-w-full text-left"
                                  >
                                    <span className="truncate block max-w-32">
                                      {nodeData.label || dep.from}
                                    </span>
                                    <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                                  </Button>
                                ) : (
                                  <span className="text-xs font-medium truncate block max-w-32">{dep.from}</span>
                                )}
                                {dep.label && (
                                  <p className="text-xs text-muted-foreground truncate max-w-32">via {dep.label}</p>
                                )}
                              </div>
                            </div>
                            <Badge className={`text-xs ${getTypeColor(dep.type)} flex-shrink-0 ml-1`}>
                              {dep.type.replace(/_/g, ' ').substring(0, 8)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {outgoing.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Referenced by ({outgoing.length})
                    </h4>
                    <div className="space-y-1">
                      {outgoing.map((dep, index) => {
                        const nodeData = dep.targetNode;
                        const isClickable = !!nodeData;
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <ArrowLeft className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                {isClickable ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => focusOnNode(dep.to)}
                                    className="text-xs font-medium p-0 h-auto hover:text-primary max-w-full text-left"
                                  >
                                    <span className="truncate block max-w-32">
                                      {nodeData.label || dep.to}
                                    </span>
                                    <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                                  </Button>
                                ) : (
                                  <span className="text-xs font-medium truncate block max-w-32">{dep.to}</span>
                                )}
                                {dep.label && (
                                  <p className="text-xs text-muted-foreground truncate max-w-32">via {dep.label}</p>
                                )}
                              </div>
                            </div>
                            <Badge className={`text-xs ${getTypeColor(dep.type)} flex-shrink-0 ml-1`}>
                              {dep.type.replace(/_/g, ' ').substring(0, 8)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Configuration Changes (if comparing) */}
            {hasChange && configChanges.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium flex items-center">
                    <GitCompare className="h-4 w-4 mr-2" />
                    Configuration Changes
                    <Badge variant="outline" className="ml-2 text-xs">
                      {configChanges.length} {configChanges.length === 1 ? 'change' : 'changes'}
                    </Badge>
                  </h3>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24 text-xs">Property</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configChanges.map(({ key, change }) => (
                        <ConfigChangeRow key={key} configKey={key} change={change} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            {/* Current Configuration Table */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  Current Configuration
                  <Badge variant="outline" className="ml-2 text-xs">
                    {configEntries.length} {configEntries.length === 1 ? 'property' : 'properties'}
                  </Badge>
                </h3>
                {configEntries.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(selectedNodeData.config, null, 2), 'Configuration')}
                    className="text-xs h-6 px-2"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy All
                  </Button>
                )}
              </div>
              
              {configEntries.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24 text-xs">Key</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configEntries.map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium py-2 align-top w-24">
                            <span className="text-xs break-words">{key}</span>
                          </TableCell>
                          <TableCell className="py-2 align-top">
                            <div className="text-xs max-w-48 break-words">
                              {formatValue(value)}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 align-top w-8">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => copyToClipboard(
                                typeof value === 'object' 
                                  ? JSON.stringify(value, null, 2) 
                                  : String(value), 
                                key
                              )}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-8 border rounded-lg bg-muted/20">
                  No configuration properties available
                </p>
              )}
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default NodeDetailsPanelWithComparison;