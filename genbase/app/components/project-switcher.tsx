"use client"
import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import apiClient, { Project } from "@/lib/api";
import { useCurrentProject, useAppStore } from "@/lib/store";

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  
  const { currentProjectId, setCurrentProjectId } = useCurrentProject();
  const resetState = useAppStore((state) => state.resetState);
  
  const router = useRouter();

  const selectedProject = projects.find(p => p.id === currentProjectId) || null;

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const projectsList = await apiClient.listProjects();
      setProjects(projectsList);
      
      // If we don't have a current project selected but have projects, select the first one
      if (!currentProjectId && projectsList.length > 0) {
        setCurrentProjectId(projectsList[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const selectProject = (project: Project) => {
    if (project.id === currentProjectId) {
      setOpen(false);
      return;
    }
    
    // Reset state before changing projects
    resetState();
    setCurrentProjectId(project.id);
    setOpen(false);
    
    // Refresh the page when changing projects
    router.push(`/dashboard`);
  };

  const createProject = async (name: string) => {
    try {
      setIsLoading(true);
      const newProject = await apiClient.createProject(name);
      
      toast.success(`Project "${name}" created successfully`);
      
      // Close the dialog and refresh projects
      setDialogOpen(false);
      setNewProjectName("");
      
      // Refresh the projects list
      await fetchProjects();
      
      // Switch to the new project
      resetState();
      setCurrentProjectId(newProject.id);
      router.push(`/dashboard`);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a project"
            className="w-56 justify-between"
            disabled={isLoading}
          >
            {isLoading ? "Loading projects..." : (selectedProject?.id || "Select project...")}
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search project..." />
              <CommandEmpty>No project found.</CommandEmpty>
              <CommandGroup heading="Projects">
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => selectProject(project)}
                    className="text-sm"
                  >
                    {project.id}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        currentProjectId === project.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Add a new project to manage your infrastructure.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newProjectName.trim()) {
              createProject(newProjectName.trim());
            }
          }}>
            <div className="space-y-4 py-2 pb-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project ID</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="networking-infra" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newProjectName.trim() || isLoading}>
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}