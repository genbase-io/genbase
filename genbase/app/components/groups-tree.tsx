// components/groups-tree.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  Plus,
  Play,
  RotateCw
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import apiClient, { Group } from "@/lib/api";
import { useCurrentProject, useSelectedGroup } from "@/lib/store";

interface TreeItem {
  id: string;
  name: string;
  path: string;
  level: number;
  isGroup: boolean;
  hasChildren: boolean;
  isOpen: boolean;
}

export default function GroupsTree() {
  const { currentProjectId } = useCurrentProject();
  const { selectedGroupPath, setSelectedGroupPath, setSelectedGroupDetails } = useSelectedGroup();
  
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog state
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParentPath, setNewGroupParentPath] = useState("");
  
  // Fetch groups on component mount or when project changes
  useEffect(() => {
    if (currentProjectId) {
      fetchGroups();
    }
  }, [currentProjectId]);
  
  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return treeItems;
    
    const lowerQuery = searchQuery.toLowerCase();
    return treeItems.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      item.path.toLowerCase().includes(lowerQuery)
    );
  }, [treeItems, searchQuery]);
  
  const fetchGroups = async () => {
    if (!currentProjectId) return;
    
    try {
      setIsLoading(true);
      const groups = await apiClient.listGroups(currentProjectId);
      
      // Build the tree structure
      const items: TreeItem[] = [];
      
      // Add root infrastructure item
      items.push({
        id: "root",
        name: "infrastructure",
        path: "",
        level: 0,
        isGroup: true,
        hasChildren: groups.length > 0,
        isOpen: true,
      });
      
      // Process all other groups
      for (const group of groups) {
        items.push({
          id: group.path,
          name: group.name,
          path: group.path,
          level: (group.path.match(/\//g) || []).length + 1,
          isGroup: true,
          hasChildren: false, // Will update this as we process
          isOpen: expandedGroups.has(group.path),
        });
        
        // Update parent's hasChildren property
        if (group.parent_path !== null) {
          const parentIndex = items.findIndex(i => i.path === group.parent_path);
          if (parentIndex !== -1) {
            items[parentIndex].hasChildren = true;
          }
        }
      }
      
      setTreeItems(items);
      
      // If we have a selected group, ensure its details are loaded
      if (selectedGroupPath !== null) {
        loadGroupDetails(selectedGroupPath);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      toast.error("Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadGroupDetails = async (groupPath: string) => {
    if (!currentProjectId) return;
    
    try {
      const groupDetails = await apiClient.getGroup(currentProjectId, groupPath);
      setSelectedGroupDetails(groupDetails);
    } catch (error) {
      console.error("Failed to load group details:", error);
      toast.error("Failed to load group details");
    }
  };
  
  const handleToggleExpand = (path: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
    
    // Update the isOpen state in the tree items
    setTreeItems(prev => 
      prev.map(item => 
        item.path === path 
          ? { ...item, isOpen: !item.isOpen } 
          : item
      )
    );
  };
  
  const handleGroupSelect = async (item: TreeItem) => {
    // Use the Zustand store to set the selected group
    setSelectedGroupPath(item.path);
    await loadGroupDetails(item.path);
  };
  
  const handleCreateGroup = async () => {
    if (!currentProjectId || !newGroupName.trim()) return;
    
    try {
      setIsLoading(true);
      const group = await apiClient.createGroup(
        currentProjectId,
        newGroupName.trim(),
        newGroupParentPath
      );
      
      toast.success(`Group "${newGroupName}" created successfully`);
      setNewGroupName("");
      setShowNewGroupDialog(false);
      
      // Refresh groups
      await fetchGroups();
      
      // Expand the parent group if it exists
      if (newGroupParentPath) {
        setExpandedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(newGroupParentPath);
          return newSet;
        });
      }
      
      // Select the newly created group
      setSelectedGroupPath(group.path);
      setSelectedGroupDetails(group);
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderTreeItem = (item: TreeItem) => {
    const isSelected = selectedGroupPath === item.path;
    
    return (
      <ContextMenu key={item.id}>
        <ContextMenuTrigger>
          <div
            className={`
              flex items-center py-1 px-2 cursor-pointer text-sm
              ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}
            `}
            style={{ paddingLeft: `${item.level * 12 + 8}px` }}
            onClick={() => handleGroupSelect(item)}
          >
            {item.hasChildren ? (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 mr-1 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpand(item.path);
                }}
              >
                <ChevronRight 
                  className={`h-4 w-4 transition-transform ${expandedGroups.has(item.path) ? 'rotate-90' : ''}`} 
                />
              </Button>
            ) : (
              <div className="w-6"></div>
            )}
            
            <Folder className="h-4 w-4 mr-2 text-blue-500" />
            <span>{item.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem 
            onClick={() => {
              setNewGroupParentPath(item.path);
              setShowNewGroupDialog(true);
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Add Subgroup
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={async () => {
              await handleGroupSelect(item);
            }}
          >
            <Play className="mr-2 h-4 w-4" />
            Plan Infrastructure
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };
  
  const isItemVisible = (item: TreeItem): boolean => {
    if (item.level === 0) return true; // Root is always visible
    
    // For other items, check if their parent is expanded
    const pathParts = item.path.split('/');
    pathParts.pop(); // Remove the last part to get the parent path
    const parentPath = pathParts.join('/');
    
    return expandedGroups.has(parentPath);
  };

  return (
    <div className="w-60 border-r flex flex-col h-full bg-background overflow-hidden">
      <div className="p-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Groups</h3>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => fetchGroups()}
            disabled={isLoading}
            title="Refresh groups"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="relative">
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <ChevronRight className="h-4 w-4 rotate-45" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        {isLoading && treeItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-sm text-muted-foreground">Loading groups...</div>
          </div>
        ) : (
          <div className="py-2">
            {filteredItems
              .filter(item => isItemVisible(item))
              .map(item => renderTreeItem(item))
            }
            
            {filteredItems.length === 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No groups found
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t flex-shrink-0">
        <Button 
          size="sm" 
          className="w-full"
          onClick={() => {
            setNewGroupParentPath("");
            setShowNewGroupDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>
      
      {/* Create Group Dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              {newGroupParentPath 
                ? `Create a new group under "${newGroupParentPath}"`
                : "Create a new group at the root level"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="networking"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setNewGroupName("");
                setShowNewGroupDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}