"""
Updated ProjectService with native Git worktree integration
"""
import os
import shutil
from pathlib import Path
from typing import Any, List, Dict, Optional

from ..config import config
from ..logger import logger


class ProjectService:
    """Service for managing TF projects with native Git worktree integration"""
    
    @staticmethod
    def get_project_path(project_id: str) -> Path:
        """Get the path to a project directory"""
        base_dir = Path(config.BASE_DIR)
        return base_dir / "projects" / project_id
    
    @staticmethod
    def get_infrastructure_path(project_id: str, branch: str = "main") -> Path:
        """
        Get the path to a project's infrastructure directory for a specific branch
        
        Args:
            project_id: The project identifier
            branch: The branch name (defaults to "main")
            
        Returns:
            Path to infrastructure directory (main branch or worktree)
        """
        # Import here to avoid circular imports
        from .git_service import GitService
        return GitService.get_infrastructure_path(project_id, branch)
    
    @staticmethod
    def get_modules_path(project_id: str, branch: str = "main") -> Path:
        """
        Get the path to a project's modules directory for a specific branch
        
        Args:
            project_id: The project identifier
            branch: The branch name (defaults to "main")
            
        Returns:
            Path to modules directory (main branch or worktree)
        """
        # Import here to avoid circular imports
        from .git_service import GitService
        return GitService.get_modules_path(project_id, branch)
    
    @staticmethod
    def get_worktree_root_path(project_id: str, branch: str) -> Optional[Path]:
        """
        Get the root path of a worktree for a specific branch
        
        Args:
            project_id: The project identifier
            branch: The branch name
            
        Returns:
            Path to worktree root, or None if doesn't exist
        """
        # Import here to avoid circular imports
        from .git_service import GitService
        return GitService.get_worktree_root_path(project_id, branch)
    
    @staticmethod
    def list_projects() -> List[Dict]:
        """List all projects"""
        base_dir = Path(config.BASE_DIR)
        projects_dir = base_dir / "projects"
        
        if not projects_dir.exists():
            logger.warning(f"Projects directory not found: {projects_dir}")
            return []
        
        projects = []
        for item in projects_dir.iterdir():
            if item.is_dir():
                # Check if it has an infrastructure directory (on main branch)
                infra_dir = ProjectService.get_infrastructure_path(item.name, "main")
                if infra_dir.exists() and infra_dir.is_dir():
                    projects.append({
                        "id": item.name,
                        "path": str(item),
                        "infrastructure_path": str(infra_dir)
                    })
        
        return projects
    
    @staticmethod
    def get_project(project_id: str, branch: str = "main") -> Optional[Dict]:
        """
        Get project details for a specific branch
        
        Args:
            project_id: The project identifier
            branch: The branch name (defaults to "main")
            
        Returns:
            Project information dictionary or None if not found
        """
        project_path = ProjectService.get_project_path(project_id)
        infra_path = ProjectService.get_infrastructure_path(project_id, branch)
        
        if not infra_path.exists() or not infra_path.is_dir():
            return None
        
        # Get some basic statistics for the specified branch
        group_count = 0
        file_count = 0
        
        try:
            for root, dirs, files in os.walk(infra_path):
                rel_path = Path(root).relative_to(infra_path)
                if str(rel_path) != ".":
                    group_count += 1
                file_count += len([f for f in files if not f.startswith('.')])
        except Exception as e:
            logger.warning(f"Error calculating project stats: {str(e)}")
            group_count = 0
            file_count = 0
        
        # Get worktree information if not main branch
        worktree_info = {}
        if branch != "main":
            worktree_root = ProjectService.get_worktree_root_path(project_id, branch)
            if worktree_root:
                worktree_info = {
                    "worktree_root": str(worktree_root),
                    "is_worktree": True
                }
        
        return {
            "id": project_id,
            "branch": branch,
            "path": str(project_path),
            "infrastructure_path": str(infra_path),
            "group_count": group_count,
            "file_count": file_count,
            **worktree_info
        }
    
    @staticmethod
    def create_project(project_id: str) -> Dict:
        """Create a new project with Git initialization"""
        # Import here to avoid circular imports
        from .git_service import GitService
        
        project_path = ProjectService.get_project_path(project_id)
        
        # Check if project directory already exists
        if project_path.exists():
            raise ValueError(f"Project directory already exists: {project_path}")
        
        try:
            # Create project directory
            project_path.mkdir(parents=True, exist_ok=False)
            
            # Initialize Git repository (this will create infrastructure and modules directories)
            git_result = GitService.init_repository(project_id)
            if not git_result.get("success", False):
                # Clean up on failure
                if project_path.exists():
                    shutil.rmtree(project_path)
                raise ValueError(f"Failed to initialize Git repository: {git_result.get('error', 'Unknown error')}")
            
            logger.info(f"Created new project: {project_id}")
            
            # Return the project details
            return {
                "id": project_id,
                "branch": "main",
                "path": str(project_path),
                "infrastructure_path": str(ProjectService.get_infrastructure_path(project_id, "main")),
                "group_count": 0,
                "file_count": 2,  # main.tf and terraform.tfvars.json
                "git_initialized": True
            }
            
        except Exception as e:
            # Clean up on failure
            if project_path.exists():
                shutil.rmtree(project_path)
            logger.error(f"Failed to create project {project_id}: {str(e)}")
            raise
    
    @staticmethod
    def project_exists(project_id: str) -> bool:
        """Check if a project exists"""
        return ProjectService.get_project(project_id) is not None
    
    @staticmethod
    def get_project_branches(project_id: str) -> List[Dict[str, Any]]:
        """
        Get all branches for a project with their infrastructure paths
        
        Args:
            project_id: The project identifier
            
        Returns:
            List of branch information dictionaries
        """
        # Import here to avoid circular imports
        from .git_service import GitService
        return GitService.list_all_branches(project_id)
    
    # Legacy method for backward compatibility
    @staticmethod
    def get_infrastructure_path_legacy(project_id: str) -> Path:
        """
        Legacy method - use get_infrastructure_path with default branch instead
        
        This method exists for backward compatibility with existing code
        """
        return ProjectService.get_infrastructure_path(project_id, "main")