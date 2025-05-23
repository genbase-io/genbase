// dependency-utils.tsx - Fixed to properly show/hide edges based on dependencies toggle
import { Node, Edge, MarkerType } from 'reactflow';
import { Dependency } from '@/lib/api';
import { BranchComparison, getDependencyChangeType, getDependencyChangeColor } from './comparison-utils';

// Edge configuration
export const EDGE_CONFIG = {
  COLORS: {
    resource_to_resource: '#3b82f6', // Blue
    module_dependency: '#8b5cf6',    // Purple  
    datasource_dependency: '#22c55e', // Green
    variable_reference: '#f59e0b',    // Amber
    local_reference: '#f97316',      // Orange
    default: '#6b7280',              // Gray
    // Comparison colors
    added: '#22c55e',                // Green for added dependencies
    removed: '#ef4444',              // Red for removed dependencies
  },
  STYLES: {
    variable_reference: { strokeDasharray: '5,5' },
    local_reference: { strokeDasharray: '5,5' },
    added: { strokeDasharray: '3,3' }, // Dashed for added dependencies
    removed: { strokeDasharray: '8,4', opacity: 0.6 }, // Different dash for removed
    default: {}
  }
};

// Get edge color based on dependency type and comparison status
export const getEdgeColor = (
  dependencyType: string, 
  changeType?: 'added' | 'removed' | 'unchanged',
  isFromMain?: boolean
): string => {
  // If in comparison mode, prioritize change colors
  if (changeType === 'added') {
    return EDGE_CONFIG.COLORS.added;
  }
  if (changeType === 'removed' || isFromMain) {
    return EDGE_CONFIG.COLORS.removed;
  }
  
  // Otherwise use dependency type color
  return EDGE_CONFIG.COLORS[dependencyType as keyof typeof EDGE_CONFIG.COLORS] || EDGE_CONFIG.COLORS.default;
};

// Get edge style based on dependency type and comparison status
export const getEdgeStyle = (
  dependencyType: string,
  changeType?: 'added' | 'removed' | 'unchanged',
  isFromMain?: boolean
) => {
  // If in comparison mode, prioritize change styles
  if (changeType === 'added') {
    return EDGE_CONFIG.STYLES.added;
  }
  if (changeType === 'removed' || isFromMain) {
    return EDGE_CONFIG.STYLES.removed;
  }
  
  // Otherwise use dependency type style
  return EDGE_CONFIG.STYLES[dependencyType as keyof typeof EDGE_CONFIG.STYLES] || EDGE_CONFIG.STYLES.default;
};

interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface HandleInfo {
  id: string;
  position: { x: number; y: number };
  side: 'top' | 'right' | 'bottom' | 'left';
}

// Get node bounds including parent offset
const getNodeBounds = (node: Node, allNodes: Node[]): NodeBounds => {
  let x = node.position.x;
  let y = node.position.y;
  
  // Add parent offset if node is inside a group
  if (node.parentId) {
    const parent = allNodes.find(n => n.id === node.parentId);
    if (parent) {
      x += parent.position.x;
      y += parent.position.y;
    }
  }
  
  const width = 192; // Block width
  const height = 120; // Block height
  
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2
  };
};

// Get all handle positions for a node (4 handles - one per side)
const getNodeHandles = (bounds: NodeBounds): HandleInfo[] => {
  const handles: HandleInfo[] = [];
  const { x, y, width, height } = bounds;
  
  // One handle per side at the center of each edge
  handles.push(
    { id: 'handle-top', position: { x: x + width / 2, y }, side: 'top' },
    { id: 'handle-right', position: { x: x + width, y: y + height / 2 }, side: 'right' },
    { id: 'handle-bottom', position: { x: x + width / 2, y: y + height }, side: 'bottom' },
    { id: 'handle-left', position: { x, y: y + height / 2 }, side: 'left' }
  );
  
  return handles;
};

// Calculate distance between two points
const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Check if edge crosses any nodes (obstacle detection)
const edgeCrossesNodes = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  allNodes: Node[],
  excludeIds: string[]
): boolean => {
  for (const node of allNodes) {
    if (excludeIds.includes(node.id) || node.type === 'group') continue;
    
    const bounds = getNodeBounds(node, allNodes);
    
    // Expand bounds slightly for collision detection
    const margin = 10;
    const expandedBounds = {
      x: bounds.x - margin,
      y: bounds.y - margin,
      width: bounds.width + 2 * margin,
      height: bounds.height + 2 * margin
    };
    
    // Check if line intersects with expanded node bounds
    if (lineIntersectsRect(start, end, expandedBounds)) {
      return true;
    }
  }
  return false;
};

// Check if a line intersects with a rectangle
const lineIntersectsRect = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean => {
  // Simple bounding box check first
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  
  return !(maxX < rect.x || minX > rect.x + rect.width || 
           maxY < rect.y || minY > rect.y + rect.height);
};

// Find the optimal handle pair with the shortest, clearest path
const findOptimalHandles = (
  sourceBounds: NodeBounds,
  targetBounds: NodeBounds,
  allNodes: Node[],
  sourceNodeId: string,
  targetNodeId: string
): { sourceHandle: string; targetHandle: string } => {
  const sourceHandles = getNodeHandles(sourceBounds);
  const targetHandles = getNodeHandles(targetBounds);
  
  let bestCombination = {
    sourceHandle: 'handle-right',
    targetHandle: 'handle-left',
    score: Infinity
  };
  
  // Try all combinations of source and target handles
  for (const sourceHandle of sourceHandles) {
    for (const targetHandle of targetHandles) {
      // Calculate distance
      const dist = distance(sourceHandle.position, targetHandle.position);
      
      // Check for obstacles
      const hasObstacles = edgeCrossesNodes(
        sourceHandle.position,
        targetHandle.position,
        allNodes,
        [sourceNodeId, targetNodeId]
      );
      
      // Calculate score (lower is better)
      let score = dist;
      
      // Heavily penalize paths that cross nodes
      if (hasObstacles) {
        score += 10000;
      }
      
      // Prefer opposite-side connections when possible
      if (
        (sourceHandle.side === 'right' && targetHandle.side === 'left') ||
        (sourceHandle.side === 'left' && targetHandle.side === 'right') ||
        (sourceHandle.side === 'bottom' && targetHandle.side === 'top') ||
        (sourceHandle.side === 'top' && targetHandle.side === 'bottom')
      ) {
        score -= 200; // Strong preference for opposite sides
      }
      
      // Update best combination if this is better
      if (score < bestCombination.score) {
        bestCombination = {
          sourceHandle: sourceHandle.id,
          targetHandle: targetHandle.id,
          score
        };
      }
    }
  }
  
  return {
    sourceHandle: bestCombination.sourceHandle,
    targetHandle: bestCombination.targetHandle
  };
};

// Create edges from dependencies with advanced routing and comparison support
export const createEdgesFromDependencies = (
  dependencies: Dependency[],
  allNodes: Node[],
  showDependencies: boolean = true,
  comparison?: BranchComparison
): Edge[] => {
  console.log('createEdgesFromDependencies called:', {
    dependenciesCount: dependencies?.length || 0,
    nodesCount: allNodes?.length || 0,
    showDependencies,
    hasComparison: !!comparison
  });

  // Early return if dependencies are disabled
  if (!showDependencies) {
    console.log('Dependencies disabled, returning empty edges array');
    return [];
  }
  
  // Defensive checks
  if (!Array.isArray(dependencies)) {
    console.log('Dependencies is not an array:', dependencies);
    return [];
  }
  if (!Array.isArray(allNodes)) {
    console.log('AllNodes is not an array:', allNodes);
    return [];
  }
  
  if (dependencies.length === 0) {
    console.log('No dependencies found');
    return [];
  }
  
  const edges: Edge[] = [];
  const nodeMap = new Map(allNodes.filter(node => node && node.id).map(node => [node.id, node]));
  
  console.log('Processing dependencies:', {
    dependenciesCount: dependencies.length,
    nodeMapSize: nodeMap.size,
    sampleDependency: dependencies[0]
  });
  
  // Process dependencies and create edges
  dependencies.forEach((dep, index) => {
    // Defensive checks for dependency object
    if (!dep || !dep.from || !dep.to) {
      console.log('Invalid dependency at index', index, dep);
      return;
    }
    
    const sourceNode = nodeMap.get(dep.from);
    const targetNode = nodeMap.get(dep.to);
    
    if (!sourceNode) {
      console.log('Source node not found:', dep.from);
      return;
    }
    
    if (!targetNode) {
      console.log('Target node not found:', dep.to);
      return;
    }
    
    // Only create edge if both nodes exist in our layout
    if (sourceNode && targetNode) {
      // Determine if this dependency was added/removed in comparison mode
      const changeType = comparison ? getDependencyChangeType(dep, comparison) : 'unchanged';
      const isFromMain = (dep as any)._isFromMain || false;
      
      const edgeColor = getEdgeColor(dep.type || 'default', changeType, isFromMain);
      const edgeStyle = getEdgeStyle(dep.type || 'default', changeType, isFromMain);
      
      // Get node bounds
      const sourceBounds = getNodeBounds(sourceNode, allNodes);
      const targetBounds = getNodeBounds(targetNode, allNodes);
      
      // Find optimal handles
      const { sourceHandle, targetHandle } = findOptimalHandles(
        sourceBounds,
        targetBounds,
        allNodes,
        dep.from,
        dep.to
      );
      
      // Create edge label (safely)
      let label = '';
      if (dep.target_attribute && typeof dep.target_attribute === 'string') {
        label = dep.target_attribute;
      } else if (dep.target_output && typeof dep.target_output === 'string') {
        label = dep.target_output;
      }
      
      // Add change indicator to label in comparison mode
      if (comparison && changeType !== 'unchanged') {
        const changeLabel = changeType === 'added' ? '+ ' : changeType === 'removed' ? '- ' : '';
        label = changeLabel + (label || dep.type || 'dependency');
      }
      
      // Create edge with all required properties
      const edge: Edge = {
        id: `edge-${index}-${dep.from}-${dep.to}`,
        source: dep.from,
        target: dep.to,
        sourceHandle: sourceHandle || undefined,
        targetHandle: targetHandle || undefined,
        type: 'smoothstep',
        animated: changeType === 'added', // Animate new dependencies
        style: {
          stroke: edgeColor,
          strokeWidth: changeType === 'added' ? 3 : 2, // Thicker for new dependencies
          ...(edgeStyle || {}),
        },
        label: label || undefined,
        labelStyle: label ? {
          fontSize: 10,
          fill: edgeColor,
          fontWeight: changeType !== 'unchanged' ? 600 : 500,
        } : undefined,
        labelBgStyle: label ? {
          fill: 'white',
          fillOpacity: 0.9,
          padding: '2px 4px',
          borderRadius: 2,
          border: `1px solid ${edgeColor}20`,
        } : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: changeType === 'added' ? 25 : 20,
          height: changeType === 'added' ? 25 : 20,
        },
        data: {
          dependencyType: dep.type || 'default',
          changeType,
          isFromMain,
          from: dep.from,
          to: dep.to,
          ...dep,
        },
      };
      
      edges.push(edge);
      console.log('Created edge:', edge.id, 'from', dep.from, 'to', dep.to);
    }
  });
  
  console.log('Final edges created:', edges.length);
  return edges;
};

// Export dependency type information for UI
export const DEPENDENCY_TYPES = [
  { type: 'resource_to_resource', label: 'Resources', color: EDGE_CONFIG.COLORS.resource_to_resource, dashed: false },
  { type: 'module_dependency', label: 'Modules', color: EDGE_CONFIG.COLORS.module_dependency, dashed: false },
  { type: 'datasource_dependency', label: 'Data Sources', color: EDGE_CONFIG.COLORS.datasource_dependency, dashed: false },
  { type: 'variable_reference', label: 'Variables', color: EDGE_CONFIG.COLORS.variable_reference, dashed: true },
  { type: 'local_reference', label: 'Locals', color: EDGE_CONFIG.COLORS.local_reference, dashed: true },
];

// Export comparison-specific types
export const COMPARISON_TYPES = [
  { type: 'added', label: 'Added Dependencies', color: EDGE_CONFIG.COLORS.added, dashed: true },
  { type: 'removed', label: 'Removed Dependencies', color: EDGE_CONFIG.COLORS.removed, dashed: true },
];