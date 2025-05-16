"""
Service for managing groups (directories) within TF projects
"""
import os
from pathlib import Path
from typing import List, Dict, Optional

from ..logger import logger
from .project_service import ProjectService


class GroupService:
    """
    Service for managing groups within TF projects
    
    Note: Groups are just organizational directories for Terraform files.
    They don't represent independent Terraform execution contexts.
    All Terraform operations are performed at the project root level.
    """
    
    # Directories to ignore when listing groups
    IGNORED_DIRECTORIES = [
        ".terraform",
        ".git",
        "__pycache__",
        "node_modules",
        ".vscode",
        ".idea",
        "terraform.tfstate.d",
    ]
    
    @staticmethod
    def get_group_path(project_id: str, group_path: str) -> Path:
        """Get the absolute path to a group directory"""
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        # If group_path is empty, return the infrastructure directory
        if not group_path:
            return infra_path
        
        # Normalize path to avoid directory traversal
        norm_path = os.path.normpath(group_path)
        if norm_path.startswith("..") or norm_path.startswith("/"):
            raise ValueError(f"Invalid group path: {group_path}")
        
        return infra_path / norm_path
    
    @staticmethod
    def list_groups(project_id: str) -> List[Dict]:
        """
        List all groups in a project
        
        Groups are just organizational directories and don't affect
        Terraform execution context.
        """
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            logger.warning(f"Infrastructure directory not found for project: {project_id}")
            return []
        
        groups = []
        for root, dirs, files in os.walk(infra_path):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in GroupService.IGNORED_DIRECTORIES]
            
            root_path = Path(root)
            
            # Skip the infrastructure root itself
            if root_path == infra_path:
                continue
            
            # Get path relative to infrastructure dir
            rel_path = root_path.relative_to(infra_path)
            
            # Get parent path (empty string if direct child of infrastructure)
            parent_path = str(rel_path.parent) if rel_path.parent != Path(".") else ""
            
            # Count only non-hidden files
            visible_files = [f for f in files if not f.startswith('.')]
            
            groups.append({
                "name": rel_path.name,
                "path": str(rel_path),
                "parent_path": parent_path,
                "file_count": len(visible_files)
            })
        
        return groups
    
    @staticmethod
    def get_group(project_id: str, group_path: str) -> Optional[Dict]:
        """
        Get group details
        
        Groups are just organizational directories. All Terraform
        operations happen at the project level.
        """
        try:
            path = GroupService.get_group_path(project_id, group_path)
            infra_path = ProjectService.get_infrastructure_path(project_id)
            
            if not path.exists() or not path.is_dir():
                return None
            
            # Check if this is an ignored directory
            if path.name in GroupService.IGNORED_DIRECTORIES:
                return None
                
            # Count files in this group (exclude hidden files)
            files = [f for f in path.iterdir() if f.is_file() and not f.name.startswith('.')]
            tf_files = [f for f in files if f.suffix == ".tf"]
            
            # If it's the infrastructure root, special case
            if path == infra_path:
                return {
                    "name": "infrastructure",
                    "path": "",
                    "parent_path": None,
                    "is_root": True,
                    "file_count": len(files),
                    "tf_file_count": len(tf_files),
                    "files": [f.name for f in files]
                }
                
            # For normal groups
            rel_path = path.relative_to(infra_path)
            parent_path = str(rel_path.parent) if rel_path.parent != Path(".") else ""
            
            return {
                "name": path.name,
                "path": group_path,
                "parent_path": parent_path,
                "is_root": False,
                "file_count": len(files),
                "tf_file_count": len(tf_files),
                "files": [f.name for f in files]
            }
        except ValueError as e:
            logger.error(f"Error getting group: {str(e)}")
            return None

    @staticmethod
    def create_group(project_id: str, name: str, parent_path: str = "") -> Dict:
        """
        Create a new group (directory) for organizing Terraform files
        
        Note: This just creates a directory for organization purposes.
        All Terraform operations will still be performed at the project root.
        """
        # Validate group name
        if not name or "/" in name or name in [".", ".."]:
            raise ValueError(f"Invalid group name: {name}")
            
        # Prevent reserved keywords
        if name.lower() == "operations":
            raise ValueError("Cannot create a group named 'operations' as it is a reserved keyword")
            
        # Check if this is an ignored directory name
        if name in GroupService.IGNORED_DIRECTORIES:
            raise ValueError(f"Cannot create a group with reserved name: {name}")
        
        # Get parent directory
        parent_dir = GroupService.get_group_path(project_id, parent_path)
        
        # Check if parent exists
        if not parent_dir.exists() or not parent_dir.is_dir():
            raise ValueError(f"Parent path does not exist: {parent_path}")
        
        # Create the new group
        new_group_path = parent_dir / name
        
        # Check if it already exists
        if new_group_path.exists():
            raise ValueError(f"Group already exists: {name}")
        
        # Create the directory
        new_group_path.mkdir(parents=False, exist_ok=False)
        logger.info(f"Created group '{name}' in project '{project_id}', parent path: '{parent_path}'")
        
        # Calculate the relative path from infrastructure
        infra_path = ProjectService.get_infrastructure_path(project_id)
        rel_path = new_group_path.relative_to(infra_path)
        
        return {
            "name": name,
            "path": str(rel_path),
            "parent_path": parent_path,
            "is_root": False,
            "file_count": 0
        }