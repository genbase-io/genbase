// hierarchy-utils.ts - Enhanced to handle comparison mode with deleted blocks
import { Node } from 'reactflow';
import { CodeBlock } from '@/lib/api';

export interface CodeNodeData {
  label: string;
  blockType: string;
  resourceType?: string;
  address: string;
  config: Record<string, any>;
  groupPath: string;
  fileName: string;
  fullPath: string;
}

export interface FileGroup {
  path: string;
  blocks: CodeBlock[];
}

export interface HierarchyNode {
  name: string;
  fullPath: string;
  children: Map<string, HierarchyNode>;
  blocks: CodeBlock[];
  isFile: boolean;
}

// Constants for layout calculation
export const LAYOUT = {
  PADDING: 40,                 
  BLOCK_WIDTH: 200,
  BLOCK_HEIGHT: 120,
  BLOCK_SPACING: 40,           
  BLOCKS_PER_ROW: 3,           
  MIN_GROUP_WIDTH: 300,        
  MIN_GROUP_HEIGHT: 180,       
  GROUP_SPACING: 80,           
  ROOT_BLOCK_SPACING: 50,      
  TITLE_HEIGHT: 50,            
  INITIAL_X: 80,               
  INITIAL_Y: 80                
};

// Create hierarchical structure from file paths - ENHANCED FOR COMPARISON
export const buildHierarchy = (fileGroups: FileGroup[]): HierarchyNode => {
  const root: HierarchyNode = {
    name: 'root',
    fullPath: '',
    children: new Map(),
    blocks: [],
    isFile: false
  };

  // Separate root blocks from grouped blocks
  const rootBlocks: CodeBlock[] = [];
  const groupedBlocks = new Map<string, CodeBlock[]>();

  fileGroups.forEach(({ path, blocks }) => {
    if (path === '') {
      // These are root level blocks
      rootBlocks.push(...blocks);
    } else {
      // These are grouped blocks
      if (!groupedBlocks.has(path)) {
        groupedBlocks.set(path, []);
      }
      groupedBlocks.get(path)!.push(...blocks);
    }
  });

  // Add root blocks directly to root
  root.blocks = rootBlocks;

  // Create group nodes for non-root paths
  groupedBlocks.forEach((blocks, path) => {
    const parts = path.split('/').filter(part => part.length > 0); // Filter empty parts
    let current = root;

    // Navigate through the hierarchy, creating nodes as needed
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');
      
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: currentPath,
          children: new Map(),
          blocks: [],
          isFile: false
        });
      }
      
      current = current.children.get(part)!;
      
      // If this is the last part, add all blocks for this group
      if (isLastPart) {
        current.blocks = blocks;
      }
    }
  });

  return root;
};

// Calculate content size for blocks in a grid
const calculateBlockGridSize = (blockCount: number): { width: number, height: number } => {
  if (blockCount === 0) return { width: 0, height: 0 };
  
  const rows = Math.ceil(blockCount / LAYOUT.BLOCKS_PER_ROW);
  const cols = Math.min(blockCount, LAYOUT.BLOCKS_PER_ROW);
  
  const width = cols * LAYOUT.BLOCK_WIDTH + (cols - 1) * LAYOUT.BLOCK_SPACING;
  const height = rows * LAYOUT.BLOCK_HEIGHT + (rows - 1) * LAYOUT.BLOCK_SPACING;
  
  return { width, height };
};

// Calculate total size for a group (including padding)
const calculateGroupSize = (node: HierarchyNode): { width: number, height: number } => {
  let contentSize = { width: 0, height: 0 };

  if (node.blocks.length > 0) {
    // Calculate size for blocks in this group
    contentSize = calculateBlockGridSize(node.blocks.length);
  }

  if (node.children.size > 0) {
    // Calculate size for child groups arranged horizontally
    let totalWidth = 0;
    let maxHeight = 0;
    let isFirst = true;

    for (const child of node.children.values()) {
      const childSize = calculateGroupSize(child);
      if (!isFirst) totalWidth += LAYOUT.GROUP_SPACING;
      totalWidth += childSize.width;
      maxHeight = Math.max(maxHeight, childSize.height);
      isFirst = false;
    }

    // Combine block size and child group size
    if (node.blocks.length > 0 && node.children.size > 0) {
      // If we have both blocks and children, arrange them vertically
      contentSize.width = Math.max(contentSize.width, totalWidth);
      contentSize.height += maxHeight + LAYOUT.GROUP_SPACING;
    } else if (node.children.size > 0) {
      // Only children
      contentSize = { width: totalWidth, height: maxHeight };
    }
  }

  const width = Math.max(
    LAYOUT.MIN_GROUP_WIDTH,
    contentSize.width + 2 * LAYOUT.PADDING
  );
  
  const height = Math.max(
    LAYOUT.MIN_GROUP_HEIGHT,
    contentSize.height + 2 * LAYOUT.PADDING + LAYOUT.TITLE_HEIGHT
  );

  return { width, height };
};

// Create React Flow nodes with proper parent-child relationships - ENHANCED FOR COMPARISON
export const calculateLayout = (hierarchy: HierarchyNode): { nodes: Node[] } => {
  const nodes: Node[] = [];
  let nodeCounter = 0;

  // Generate unique ID for nodes
  const generateId = () => `node-${++nodeCounter}`;

  // Helper function to position blocks in a grid
  const positionBlocks = (
    blocks: CodeBlock[], 
    idGenerator: () => string,
    parentId: string | null, 
    startPosition: { x: number, y: number }
  ) => {
    blocks.forEach((block, index) => {
      const row = Math.floor(index / LAYOUT.BLOCKS_PER_ROW);
      const col = index % LAYOUT.BLOCKS_PER_ROW;
      
      const blockX = startPosition.x + col * (LAYOUT.BLOCK_WIDTH + LAYOUT.BLOCK_SPACING);
      const blockY = startPosition.y + row * (LAYOUT.BLOCK_HEIGHT + LAYOUT.BLOCK_SPACING);
      
      // Use address as ID if available, otherwise generate one
      const nodeId = block.address || idGenerator();
      
      // Determine node style based on block metadata
      let nodeStyle: any = {
        pointerEvents: 'all',
        zIndex: parentId ? 10 : 5, // Nodes inside groups have higher z-index
      };

      // Check if this is a deleted block (from comparison mode)
      if ((block as any)._isDeleted) {
        nodeStyle.opacity = 0.6;
        nodeStyle.border = '2px dashed #ef4444';
      }
      
      nodes.push({
        id: nodeId,
        type: 'code',
        position: { x: blockX, y: blockY },
        data: {
          label: block.name || nodeId.split('.').pop() || '',
          blockType: block._metadata.block_type,
          resourceType: block.type,
          address: block.address,
          config: block.config || {},
          groupPath: block._metadata.group_path,
          fileName: block._metadata.file_name,
          fullPath: block._metadata.group_path || 'root'
        },
        parentId,
        draggable: false,
        selectable: true,
        focusable: true,
        style: nodeStyle,
        // Remove extent restriction to allow proper interaction
        extent: undefined,
      });
    });
  };

  // Process nodes
  const processNode = (
    node: HierarchyNode, 
    parentId: string | null = null, 
    position: { x: number, y: number } = { x: LAYOUT.INITIAL_X, y: LAYOUT.INITIAL_Y }
  ): string | null => {
    
    // Handle root node specially
    if (node.fullPath === '') {
      let currentX = position.x;
      
      // Position root-level blocks first (they float freely)
      if (node.blocks.length > 0) {
        positionBlocks(node.blocks, generateId, null, { x: currentX, y: position.y });
        
        // Calculate space taken by root blocks
        const rootBlocksSize = calculateBlockGridSize(node.blocks.length);
        currentX += rootBlocksSize.width + LAYOUT.ROOT_BLOCK_SPACING;
      }
      
      // Then position child groups
      for (const child of node.children.values()) {
        const childId = processNode(child, null, { x: currentX, y: position.y });
        if (childId) {
          const childSize = calculateGroupSize(child);
          currentX += childSize.width + LAYOUT.GROUP_SPACING;
        }
      }
      
      return null;
    }

    // For non-root nodes, create a group
    const nodeId = generateId();
    const size = calculateGroupSize(node);

    // Create group node with proper configuration
    nodes.push({
      id: nodeId,
      type: 'group',
      position,
      data: { label: `📁 ${node.name}` },
      style: {
        width: size.width,
        height: size.height,
        backgroundColor: 'rgba(147, 51, 234, 0.05)', // Light purple
        border: '2px dashed rgb(147, 51, 234)', // Purple dashed border
        borderRadius: '8px',
        pointerEvents: 'all', // Ensure group can receive events
        zIndex: 1, // Groups have lower z-index than their children
      },
      parentId,
      draggable: false,
      selectable: false, // Groups themselves aren't selectable
      focusable: false,
    });

    let contentY = LAYOUT.PADDING + LAYOUT.TITLE_HEIGHT;

    // Position blocks in this group first
    if (node.blocks.length > 0) {
      positionBlocks(node.blocks, generateId, nodeId, { 
        x: LAYOUT.PADDING, 
        y: contentY 
      });
      
      // Update Y position for child groups
      const blocksSize = calculateBlockGridSize(node.blocks.length);
      contentY += blocksSize.height + LAYOUT.GROUP_SPACING;
    }

    // Position child groups
    let childX = LAYOUT.PADDING;
    for (const child of node.children.values()) {
      processNode(child, nodeId, { x: childX, y: contentY });
      const childSize = calculateGroupSize(child);
      childX += childSize.width + LAYOUT.GROUP_SPACING;
    }

    return nodeId;
  };

  // Start processing from the root
  processNode(hierarchy);

  return { nodes };
};

// Helper function to merge blocks from different sources for comparison
export const mergeBlocksForComparison = (
  compareBlocks: CodeBlock[],
  deletedBlocks: CodeBlock[]
): CodeBlock[] => {
  const allBlocks = [...compareBlocks];
  
  // Add deleted blocks with special marking
  deletedBlocks.forEach(deletedBlock => {
    // Check if this block already exists in compareBlocks
    const existsInCompare = compareBlocks.some(block => 
      (block.address || `${block._metadata.block_type}.${block.name}`) === 
      (deletedBlock.address || `${deletedBlock._metadata.block_type}.${deletedBlock.name}`)
    );
    
    if (!existsInCompare) {
      // Mark as deleted and add to the list
      allBlocks.push({
        ...deletedBlock,
        _isDeleted: true
      } as any);
    }
  });
  
  return allBlocks;
};

// Helper function to sort blocks for consistent layout
export const sortBlocksForLayout = (blocks: CodeBlock[]): CodeBlock[] => {
  return blocks.sort((a, b) => {
    // Sort by block type first
    const typeOrder = ['provider', 'terraform', 'variable', 'locals', 'data', 'resource', 'module', 'output'];
    const aTypeIndex = typeOrder.indexOf(a._metadata.block_type);
    const bTypeIndex = typeOrder.indexOf(b._metadata.block_type);
    
    if (aTypeIndex !== bTypeIndex) {
      return aTypeIndex - bTypeIndex;
    }
    
    // Then sort by name
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.localeCompare(bName);
  });
};

// Export enhanced hierarchy utilities
export default {
  buildHierarchy,
  calculateLayout,
  mergeBlocksForComparison,
  sortBlocksForLayout,
  LAYOUT
};