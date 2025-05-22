// info-panel.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Server, Database, FileOutput, Settings, Code, BoxIcon as Module, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInfraChartState } from '@/lib/store';

const InfoPanel: React.FC = () => {
  const { showInfoPanel, setShowInfoPanel, infoPanelPosition } = useInfraChartState();

  if (!showInfoPanel) return null;

  // Position the panel near the info button but not too close to edge
  const panelStyle = {
    position: 'absolute' as const,
    left: `${infoPanelPosition.x + 10}px`,
    top: `${infoPanelPosition.y + 10}px`,
    zIndex: 1000,
  };

  return (
    <div style={panelStyle}>
      <Card className="w-80 shadow-lg border-primary/20">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">About This View</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowInfoPanel(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-3 text-sm pb-4">
          <div>
            <h4 className="font-medium mb-1">Visual Hierarchy</h4>
            <ul className="text-muted-foreground space-y-1 list-disc pl-5">
              <li><span className="text-purple-600">Purple dashed</span> = directories</li>
              <li>Blocks positioned within directories</li>
              <li><span className="text-blue-500">Arrows</span> = dependencies between blocks</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Dependencies</h4>
            <ul className="text-muted-foreground space-y-1 list-disc pl-5">
              <li><span className="text-blue-500">Solid lines</span> = resource/module references</li>
              <li><span className="text-amber-500">Dashed lines</span> = variable/local references</li>
              <li>Click Dependencies button to toggle visibility</li>
              <li>Edge labels show referenced attributes</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Interaction</h4>
            <ul className="text-muted-foreground space-y-1 list-disc pl-5">
              <li>Click "View Details" to see configuration</li>
              <li>Search to find specific blocks</li>
              <li>Drag to pan, scroll to zoom</li>
              <li>Click dependencies toggle to show/hide connections</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Block Types</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center"><Server className="h-3 w-3 mr-1" />Resources</div>
              <div className="flex items-center"><Database className="h-3 w-3 mr-1" />Data Sources</div>
              <div className="flex items-center"><Module className="h-3 w-3 mr-1" />Modules</div>
              <div className="flex items-center"><FileOutput className="h-3 w-3 mr-1" />Outputs</div>
              <div className="flex items-center"><Settings className="h-3 w-3 mr-1" />Variables</div>
              <div className="flex items-center"><Code className="h-3 w-3 mr-1" />Others</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Dependency Types</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center">
                <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
                <span>Resource ↔ Resource</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0.5 bg-purple-500 mr-2"></div>
                <span>Module dependencies</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
                <span>Data source references</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0.5 bg-amber-500 border-dashed border-t border-amber-500 mr-2"></div>
                <span>Variable references</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0.5 bg-orange-500 border-dashed border-t border-orange-500 mr-2"></div>
                <span>Local value references</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InfoPanel;