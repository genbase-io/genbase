// comparison-utils.ts - Enhanced utility for comparing infrastructure code between branches
import { CodeBlock, ParsedCode, Dependency } from '@/lib/api';

export type ChangeType = 'created' | 'modified' | 'deleted' | 'unchanged';

export interface CodeBlockComparison {
  block: CodeBlock;
  changeType: ChangeType;
  // For modified blocks, store what changed
  configChanges?: {
    added: Record<string, any>;
    removed: Record<string, any>;
    modified: Record<string, { old: any; new: any }>;
  };
  dependencyChanges?: {
    added: Dependency[];
    removed: Dependency[];
  };
}

export interface BranchComparison {
  baseBranch: string;
  compareBranch: string;
  blockComparisons: Map<string, CodeBlockComparison>;
  // Global dependency changes across all blocks
  globalDependencyChanges: {
    added: Dependency[];
    removed: Dependency[];
    modified: Array<{
      old: Dependency;
      new: Dependency;
    }>;
  };
  // Summary statistics
  summary: {
    created: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
}

// Helper function to create a unique key for a block
function getBlockKey(block: CodeBlock): string {
  return block.address || `${block._metadata.block_type}.${block.name}`;
}

// Helper function to normalize dependencies for comparison
function normalizeDependencies(dependencies: Dependency[]): Map<string, Dependency> {
  const normalized = new Map<string, Dependency>();
  dependencies.forEach(dep => {
    const key = `${dep.from}->${dep.to}:${dep.type}`;
    normalized.set(key, dep);
  });
  return normalized;
}

// Deep comparison of configuration objects
function compareConfigurations(oldConfig: any, newConfig: any) {
  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};
  const modified: Record<string, { old: any; new: any }> = {};

  // Find all keys from both configs
  const allKeys = new Set([
    ...Object.keys(oldConfig || {}),
    ...Object.keys(newConfig || {})
  ]);

  for (const key of allKeys) {
    const oldValue = oldConfig?.[key];
    const newValue = newConfig?.[key];

    if (oldValue === undefined && newValue !== undefined) {
      added[key] = newValue;
    } else if (oldValue !== undefined && newValue === undefined) {
      removed[key] = oldValue;
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      modified[key] = { old: oldValue, new: newValue };
    }
  }

  return { added, removed, modified };
}

// Compare dependencies between two blocks
function compareDependencies(
  oldDeps: Dependency[], 
  newDeps: Dependency[], 
  blockAddress: string
): { added: Dependency[]; removed: Dependency[]; } {
  // Filter dependencies for this specific block
  const oldBlockDeps = oldDeps.filter(dep => dep.from === blockAddress || dep.to === blockAddress);
  const newBlockDeps = newDeps.filter(dep => dep.from === blockAddress || dep.to === blockAddress);

  const oldDepMap = normalizeDependencies(oldBlockDeps);
  const newDepMap = normalizeDependencies(newBlockDeps);

  const added: Dependency[] = [];
  const removed: Dependency[] = [];

  // Find added dependencies
  for (const [key, dep] of newDepMap) {
    if (!oldDepMap.has(key)) {
      added.push(dep);
    }
  }

  // Find removed dependencies
  for (const [key, dep] of oldDepMap) {
    if (!newDepMap.has(key)) {
      removed.push(dep);
    }
  }

  return { added, removed };
}

// Compare global dependencies between branches
function compareGlobalDependencies(
  baseDeps: Dependency[],
  compareDeps: Dependency[]
): {
  added: Dependency[];
  removed: Dependency[];
  modified: Array<{ old: Dependency; new: Dependency }>;
} {
  const baseDepMap = normalizeDependencies(baseDeps);
  const compareDepMap = normalizeDependencies(compareDeps);

  const added: Dependency[] = [];
  const removed: Dependency[] = [];
  const modified: Array<{ old: Dependency; new: Dependency }> = [];

  // Find added dependencies
  for (const [key, dep] of compareDepMap) {
    if (!baseDepMap.has(key)) {
      added.push(dep);
    }
  }

  // Find removed dependencies
  for (const [key, dep] of baseDepMap) {
    if (!compareDepMap.has(key)) {
      removed.push(dep);
    }
  }

  // Find modified dependencies (for now, we don't track modifications as dependencies are relatively simple)
  // This could be extended in the future to track changes in dependency metadata

  return { added, removed, modified };
}

// Main function to compare two parsed code structures - ENHANCED VERSION
export function compareCodeBetweenBranches(
  baseCode: ParsedCode, // Usually 'main' branch
  compareCode: ParsedCode // The branch being compared
): BranchComparison {
  const blockComparisons = new Map<string, CodeBlockComparison>();
  
  // Flatten all blocks from both branches into maps for easy lookup
  const baseBlocks = new Map<string, CodeBlock>();
  const compareBlocks = new Map<string, CodeBlock>();

  // Process base branch blocks
  Object.values(baseCode.blocks).forEach(blockArray => {
    if (Array.isArray(blockArray)) {
      blockArray.forEach(block => {
        baseBlocks.set(getBlockKey(block), block);
      });
    }
  });

  // Process compare branch blocks
  Object.values(compareCode.blocks).forEach(blockArray => {
    if (Array.isArray(blockArray)) {
      blockArray.forEach(block => {
        compareBlocks.set(getBlockKey(block), block);
      });
    }
  });

  // Get all unique block keys
  const allBlockKeys = new Set([
    ...baseBlocks.keys(),
    ...compareBlocks.keys()
  ]);

  let created = 0, modified = 0, deleted = 0, unchanged = 0;

  // Compare each block
  for (const blockKey of allBlockKeys) {
    const baseBlock = baseBlocks.get(blockKey);
    const compareBlock = compareBlocks.get(blockKey);

    if (!baseBlock && compareBlock) {
      // Block was created
      blockComparisons.set(blockKey, {
        block: compareBlock,
        changeType: 'created'
      });
      created++;
    } else if (baseBlock && !compareBlock) {
      // Block was deleted
      blockComparisons.set(blockKey, {
        block: baseBlock,
        changeType: 'deleted'
      });
      deleted++;
    } else if (baseBlock && compareBlock) {
      // Block exists in both, check for modifications
      const configChanges = compareConfigurations(baseBlock.config, compareBlock.config);
      const dependencyChanges = compareDependencies(
        baseCode.dependencies || [],
        compareCode.dependencies || [],
        compareBlock.address
      );

      const hasConfigChanges = Object.keys(configChanges.added).length > 0 ||
                              Object.keys(configChanges.removed).length > 0 ||
                              Object.keys(configChanges.modified).length > 0;
      
      const hasDependencyChanges = dependencyChanges.added.length > 0 ||
                                  dependencyChanges.removed.length > 0;

      if (hasConfigChanges || hasDependencyChanges) {
        blockComparisons.set(blockKey, {
          block: compareBlock,
          changeType: 'modified',
          configChanges: hasConfigChanges ? configChanges : undefined,
          dependencyChanges: hasDependencyChanges ? dependencyChanges : undefined
        });
        modified++;
      } else {
        blockComparisons.set(blockKey, {
          block: compareBlock,
          changeType: 'unchanged'
        });
        unchanged++;
      }
    }
  }

  // Compare global dependencies
  const globalDependencyChanges = compareGlobalDependencies(
    baseCode.dependencies || [],
    compareCode.dependencies || []
  );

  return {
    baseBranch: baseCode.branch || 'main',
    compareBranch: compareCode.branch || 'unknown',
    blockComparisons,
    globalDependencyChanges,
    summary: { created, modified, deleted, unchanged }
  };
}

// Helper function to get change color for UI
export function getChangeColor(changeType: ChangeType): string {
  switch (changeType) {
    case 'created':
      return '#22c55e'; // green
    case 'modified':
      return '#eab308'; // yellow
    case 'deleted':
      return '#ef4444'; // red
    case 'unchanged':
    default:
      return 'transparent';
  }
}

// Helper function to get change label
export function getChangeLabel(changeType: ChangeType): string {
  switch (changeType) {
    case 'created':
      return 'Created';
    case 'modified':
      return 'Modified';
    case 'deleted':
      return 'Deleted';
    case 'unchanged':
    default:
      return '';
  }
}

// Helper function to check if a block has changes
export function hasChanges(changeType: ChangeType): boolean {
  return changeType !== 'unchanged';
}

// Helper function to get dependency change color
export function getDependencyChangeColor(isFromMain: boolean, comparison?: BranchComparison): string {
  if (!comparison) return '#6b7280'; // default gray
  
  if (isFromMain) {
    // This dependency exists in main but might be removed in compare branch
    return '#f87171'; // light red for potentially removed
  }
  
  return '#6b7280'; // default gray
}

// Helper function to check if a dependency was added or removed
export function getDependencyChangeType(
  dependency: Dependency, 
  comparison?: BranchComparison
): 'added' | 'removed' | 'unchanged' {
  if (!comparison) return 'unchanged';
  
  const depKey = `${dependency.from}->${dependency.to}:${dependency.type}`;
  
  // Check if this dependency was added
  const wasAdded = comparison.globalDependencyChanges.added.some(dep => 
    `${dep.from}->${dep.to}:${dep.type}` === depKey
  );
  
  if (wasAdded) return 'added';
  
  // Check if this dependency was removed
  const wasRemoved = comparison.globalDependencyChanges.removed.some(dep =>
    `${dep.from}->${dep.to}:${dep.type}` === depKey
  );
  
  if (wasRemoved) return 'removed';
  
  return 'unchanged';
}

// Export default comparison object
export default {
  compareCodeBetweenBranches,
  getChangeColor,
  getChangeLabel,
  hasChanges,
  getDependencyChangeColor,
  getDependencyChangeType
};