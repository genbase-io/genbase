// node-details-panel.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { getBlockIcon, getBlockColors } from './code-node';
import { useInfraChartState } from '@/lib/store';

const NodeDetailsPanel: React.FC = () => {
  const { selectedNodeData, setSelectedNodeData } = useInfraChartState();
  
  if (!selectedNodeData) return null;
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  
  const colors = getBlockColors(selectedNodeData.blockType);
  
  return (
    <Card className="w-96 max-h-screen  shadow-md h-full" 
>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          {getBlockIcon(selectedNodeData.blockType)}
          <CardTitle className="text-base font-medium">{selectedNodeData.label}</CardTitle>
          <Badge className={colors.badge}>
            {selectedNodeData.blockType}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedNodeData(null)}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="p-4 pt-2">
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Address:</span>
                <div className="flex items-center space-x-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded">{selectedNodeData.address}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(selectedNodeData.address, 'Address')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {selectedNodeData.resourceType && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <span className="text-sm">{selectedNodeData.resourceType}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">File:</span>
                <span className="text-sm">{selectedNodeData.fileName}</span>
              </div>
              
              {selectedNodeData.groupPath && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Group:</span>
                  <span className="text-sm">{selectedNodeData.groupPath}</span>
                </div>
              )}
            </div>

            {/* Configuration in two-column layout */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium">Configuration</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(selectedNodeData.config, null, 2), 'Configuration')}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy All
                </Button>
              </div>
              
              {Object.keys(selectedNodeData.config).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedNodeData.config).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-5 gap-2 py-2 border-b border-muted last:border-b-0">
                      <div className="col-span-2">
                        <span className="text-sm font-medium text-muted-foreground break-all">
                          {key}
                        </span>
                      </div>
                      <div className="col-span-3">
                        {typeof value === 'object' ? (
                          <div className="space-y-1">
                            <pre className="text-xs bg-muted/50 p-2 rounded border overflow-auto max-h-20 whitespace-pre-wrap">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(JSON.stringify(value, null, 2), key)}
                              className="text-xs h-6"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm break-all">
                              {String(value)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(String(value), key)}
                              className="h-6 w-6 ml-2 flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No configuration properties available
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NodeDetailsPanel;