"""
Service for managing OpenTofu workspaces within projects
"""
import os
import subprocess
from pathlib import Path
from typing import Any, List, Dict, Optional, Tuple

from ..logger import logger
from .project_service import ProjectService


class WorkspaceService:
    """
    Service for managing OpenTofu workspaces
    
    All workspace operations are performed at the project root level.
    """
    
    DEFAULT_WORKSPACE = "default"
    
    @staticmethod
    def _run_workspace_command(cmd: list, project_id: str) -> Tuple[int, str, str]:
        """Run a workspace command at the project root and return exit code, stdout, and stderr"""
        # Always run workspace commands at the project root
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        logger.debug(f"Running workspace command: {' '.join(cmd)} in {infra_path}")
        
        process = subprocess.Popen(
            cmd,
            cwd=str(infra_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate()
        exit_code = process.returncode
        
        if exit_code != 0:
            logger.warning(f"Workspace command failed with exit code {exit_code}: {stderr}")
        
        return exit_code, stdout, stderr
    
    @staticmethod
    def list_workspaces(project_id: str) -> List[Dict[str, Any]]:
        """List all workspaces in a project"""
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Check if terraform is initialized
        terraform_dir = infra_path / ".terraform"
        if not terraform_dir.exists():
            # Run init first
            init_cmd = ["tofu", "init"]
            exit_code, _, stderr = WorkspaceService._run_workspace_command(init_cmd, project_id)
            if exit_code != 0:
                raise ValueError(f"Failed to initialize Terraform: {stderr}")
        
        # Get workspaces
        workspace_cmd = ["tofu", "workspace", "list"]
        exit_code, stdout, stderr = WorkspaceService._run_workspace_command(workspace_cmd, project_id)
        
        if exit_code != 0:
            raise ValueError(f"Failed to list workspaces: {stderr}")
        
        # Parse workspace output
        # Typical output format:
        #   default
        # * dev
        #   prod
        workspaces = []
        current_workspace = None
        
        for line in stdout.strip().split("\n"):
            is_current = line.startswith("*")
            workspace_name = line.strip("* ").strip()
            
            if workspace_name:
                workspace_info = {
                    "name": workspace_name,
                    "is_current": is_current
                }
                workspaces.append(workspace_info)
                
                if is_current:
                    current_workspace = workspace_name
        
        # If somehow we don't have a current workspace marked, assume default
        if not current_workspace and workspaces:
            for workspace in workspaces:
                if workspace["name"] == WorkspaceService.DEFAULT_WORKSPACE:
                    workspace["is_current"] = True
                    break
        
        return workspaces
    
    @staticmethod
    def get_current_workspace(project_id: str) -> str:
        """Get the current workspace name for a project"""
        try:
            workspaces = WorkspaceService.list_workspaces(project_id)
            
            for workspace in workspaces:
                if workspace.get("is_current", False):
                    return workspace["name"]
                    
            # If no current workspace found, assume default
            return WorkspaceService.DEFAULT_WORKSPACE
        except Exception as e:
            logger.error(f"Error getting current workspace: {str(e)}")
            # Fallback to default workspace
            return WorkspaceService.DEFAULT_WORKSPACE
    
    @staticmethod
    def create_workspace(project_id: str, workspace_name: str) -> Dict[str, Any]:
        """Create a new workspace at the project level"""
        # Validate workspace name
        if not workspace_name or "/" in workspace_name or workspace_name in [".", ".."]:
            raise ValueError(f"Invalid workspace name: {workspace_name}")
        
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Check if terraform is initialized
        terraform_dir = infra_path / ".terraform"
        if not terraform_dir.exists():
            # Run init first
            init_cmd = ["tofu", "init"]
            exit_code, _, stderr = WorkspaceService._run_workspace_command(init_cmd, project_id)
            if exit_code != 0:
                raise ValueError(f"Failed to initialize Terraform: {stderr}")
        
        # Check if workspace already exists
        workspaces = WorkspaceService.list_workspaces(project_id)
        for ws in workspaces:
            if ws["name"] == workspace_name:
                return {
                    "success": True,
                    "name": workspace_name,
                    "is_current": ws.get("is_current", False),
                    "already_exists": True
                }
        
        # Create the workspace
        create_cmd = ["tofu", "workspace", "new", workspace_name]
        exit_code, stdout, stderr = WorkspaceService._run_workspace_command(create_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": f"Failed to create workspace: {stderr}"
            }
        
        return {
            "success": True,
            "name": workspace_name,
            "is_current": True,  # New workspace becomes the current one
            "already_exists": False
        }
    
    @staticmethod
    def select_workspace(project_id: str, workspace_name: str) -> Dict[str, Any]:
        """
        Select (switch to) a workspace at the project level
        
        Returns a dict with success status and workspace information.
        """
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            return {
                "success": False,
                "error": f"Infrastructure path does not exist for project: {project_id}"
            }
        
        # Check if workspace exists
        workspaces = WorkspaceService.list_workspaces(project_id)
        workspace_exists = False
        
        for ws in workspaces:
            if ws["name"] == workspace_name:
                workspace_exists = True
                # If it's already current, return early
                if ws.get("is_current", False):
                    return {
                        "success": True,
                        "name": workspace_name,
                        "is_current": True,
                        "already_selected": True
                    }
                break
        
        # Create workspace if it doesn't exist
        if not workspace_exists:
            # For default workspace, it should already exist, so this is an error
            if workspace_name == WorkspaceService.DEFAULT_WORKSPACE:
                return {
                    "success": False,
                    "error": f"Default workspace not found. Terraform may not be initialized."
                }
            
            # Create the workspace
            create_result = WorkspaceService.create_workspace(project_id, workspace_name)
            if not create_result.get("success", False):
                return create_result
                
            return {
                "success": True,
                "name": workspace_name,
                "is_current": True,
                "already_selected": False
            }
        
        # Select the workspace
        select_cmd = ["tofu", "workspace", "select", workspace_name]
        exit_code, stdout, stderr = WorkspaceService._run_workspace_command(select_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": f"Failed to select workspace: {stderr}"
            }
        
        return {
            "success": True,
            "name": workspace_name,
            "is_current": True,
            "already_selected": False
        }
    
    @staticmethod
    def delete_workspace(project_id: str, workspace_name: str) -> Dict[str, Any]:
        """Delete a workspace at the project level"""
        # Cannot delete default workspace
        if workspace_name == WorkspaceService.DEFAULT_WORKSPACE:
            return {
                "success": False,
                "error": "Cannot delete the default workspace"
            }
        
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            return {
                "success": False,
                "error": f"Infrastructure path does not exist for project: {project_id}"
            }
        
        # Check if workspace exists and is not current
        workspaces = WorkspaceService.list_workspaces(project_id)
        workspace_exists = False
        is_current = False
        
        for ws in workspaces:
            if ws["name"] == workspace_name:
                workspace_exists = True
                is_current = ws.get("is_current", False)
                break
        
        if not workspace_exists:
            return {
                "success": True,
                "already_deleted": True
            }
        
        # Cannot delete current workspace, switch to default first
        if is_current:
            # Switch to default
            select_cmd = ["tofu", "workspace", "select", WorkspaceService.DEFAULT_WORKSPACE]
            exit_code, stdout, stderr = WorkspaceService._run_workspace_command(select_cmd, project_id)
            
            if exit_code != 0:
                return {
                    "success": False,
                    "error": f"Failed to switch from workspace before deletion: {stderr}"
                }
        
        # Delete the workspace
        delete_cmd = ["tofu", "workspace", "delete", workspace_name]
        exit_code, stdout, stderr = WorkspaceService._run_workspace_command(delete_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": f"Failed to delete workspace: {stderr}"
            }
        
        return {
            "success": True,
            "already_deleted": False
        }