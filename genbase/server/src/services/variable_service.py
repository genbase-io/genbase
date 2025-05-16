"""
Service for managing Terraform variables using JSON format
"""
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from ..logger import logger
from .project_service import ProjectService
from .workspace_service import WorkspaceService

class VariableService:
    """
    Service for managing Terraform variables using JSON format
    
    Variables are managed at the project level, not at the group level.
    All variable files are stored at the project root.
    """
    
    # Base file names for variables (using .tfvars.json extension)
    BASE_TFVARS_FILE = "terraform.tfvars.json"
    BASE_SECRET_TFVARS_FILE = "secrets.auto.tfvars.json"
    
    @staticmethod
    def _get_variable_file_names(workspace: Optional[str] = None) -> Tuple[str, str]:
        """Get variable file names based on workspace"""
        if not workspace or workspace == WorkspaceService.DEFAULT_WORKSPACE:
            # Default workspace uses standard file names
            return VariableService.BASE_TFVARS_FILE, VariableService.BASE_SECRET_TFVARS_FILE
        else:
            # Other workspaces use workspace-prefixed file names
            return f"{workspace}.{VariableService.BASE_TFVARS_FILE}", f"{workspace}.{VariableService.BASE_SECRET_TFVARS_FILE}"
    
    @staticmethod
    def get_variable_files(project_id: str, workspace: Optional[str] = None) -> Tuple[Path, Path]:
        """Get paths to variable files for a project"""
        # Resolve workspace if not provided
        if workspace is None:
            workspace = WorkspaceService.get_current_workspace(project_id)
            
        # Get file names based on workspace
        tfvars_filename, secret_tfvars_filename = VariableService._get_variable_file_names(workspace)
        
        # Always use the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure directory not found for project: {project_id}")
        
        tfvars_path = infra_path / tfvars_filename
        secret_tfvars_path = infra_path / secret_tfvars_filename
        
        return tfvars_path, secret_tfvars_path
    
    @staticmethod
    def _load_json_file(file_path: Path) -> Dict[str, Any]:
        """Load JSON file content"""
        if not file_path.exists():
            return {}
        
        try:
            with open(file_path, 'r') as file:
                return json.load(file)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {file_path}: {str(e)}")
            return {}
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {str(e)}")
            return {}
    
    @staticmethod
    def _write_json_file(file_path: Path, variables: Dict[str, Any]) -> bool:
        """Write variables to JSON file"""
        try:
            # Create parent directory if it doesn't exist
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write the JSON file with nice formatting
            with open(file_path, 'w') as file:
                json.dump(variables, file, indent=2)
                
            return True
        except Exception as e:
            logger.error(f"Error writing JSON file {file_path}: {str(e)}")
            return False
    
    @staticmethod
    def list_variables(project_id: str, workspace: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all variables in a project for a specific workspace"""
        tfvars_path, secret_tfvars_path = VariableService.get_variable_files(project_id, workspace)
        
        # Load variables from files
        regular_vars = VariableService._load_json_file(tfvars_path)
        secret_vars = VariableService._load_json_file(secret_tfvars_path)
        
        # Combine and format the variables
        result = []
        
        # Add regular variables
        for name, value in regular_vars.items():
            var_type = VariableService._infer_type(value)
            result.append({
                "name": name,
                "value": value,
                "type": var_type,
                "is_secret": False,
                "workspace": workspace or WorkspaceService.DEFAULT_WORKSPACE
            })
        
        # Add secret variables
        for name, value in secret_vars.items():
            var_type = VariableService._infer_type(value)
            result.append({
                "name": name,
                "value": value,
                "type": var_type,
                "is_secret": True,
                "workspace": workspace or WorkspaceService.DEFAULT_WORKSPACE
            })
        
        return result
    
    @staticmethod
    def _infer_type(value: Any) -> str:
        """Infer variable type from value"""
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, (int, float)):
            return "number"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, list):
            return "list"
        elif isinstance(value, dict):
            return "map"
        else:
            return "string"
    
    @staticmethod
    def get_variable(project_id: str, variable_name: str, workspace: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get a specific variable"""
        variables = VariableService.list_variables(project_id, workspace)
        
        for var in variables:
            if var["name"] == variable_name:
                return var
                
        return None
    
    @staticmethod
    def create_or_update_variable(
        project_id: str, 
        name: str, 
        value: Any, 
        is_secret: bool = False,
        description: Optional[str] = None,
        workspace: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update a variable at the project level"""
        # Get paths to variable files
        tfvars_path, secret_tfvars_path = VariableService.get_variable_files(project_id, workspace)
        
        # Determine which file to use
        target_path = secret_tfvars_path if is_secret else tfvars_path
        
        # Load current variables
        current_vars = VariableService._load_json_file(target_path)
        
        # Update or add the variable
        current_vars[name] = value
        
        # Write back to file
        success = VariableService._write_json_file(target_path, current_vars)
        
        if not success:
            raise ValueError(f"Failed to write variable to file")
        
        # Infer the type
        var_type = VariableService._infer_type(value)
        
        return {
            "name": name,
            "value": value,
            "type": var_type,
            "is_secret": is_secret,
            "description": description,
            "workspace": workspace or WorkspaceService.DEFAULT_WORKSPACE
        }
    
    @staticmethod
    def delete_variable(project_id: str, variable_name: str, workspace: Optional[str] = None) -> bool:
        """Delete a variable at the project level"""
        # Check if variable exists
        variable = VariableService.get_variable(project_id, variable_name, workspace)
        if not variable:
            raise ValueError(f"Variable not found: {variable_name}")
        
        # Get paths to variable files
        tfvars_path, secret_tfvars_path = VariableService.get_variable_files(project_id, workspace)
        
        # Determine which file to use
        target_path = secret_tfvars_path if variable["is_secret"] else tfvars_path
        
        # Load current variables
        current_vars = VariableService._load_json_file(target_path)
        
        # Remove the variable
        if variable_name in current_vars:
            del current_vars[variable_name]
        
        # Write back to file
        return VariableService._write_json_file(target_path, current_vars)

    @staticmethod
    def get_var_file_paths_for_command(project_id: str, workspace: Optional[str] = None) -> List[str]:
        """Get variable file paths to use in OpenTofu commands"""
        # Get variable files for both default and specified workspace
        result = []
        
        # First get default workspace files (always include these)
        default_tfvars_path, default_secret_tfvars_path = VariableService.get_variable_files(
            project_id, WorkspaceService.DEFAULT_WORKSPACE
        )
        
        # Check if default variable files exist and add them
        if default_tfvars_path.exists():
            result.append(f"-var-file={default_tfvars_path.name}")
        
        if default_secret_tfvars_path.exists():
            # Secrets should be loaded automatically because of the .auto. in the filename,
            # but we explicitly include them for clarity
            result.append(f"-var-file={default_secret_tfvars_path.name}")
        
        # If a specific workspace is requested and it's not default, add those files too
        if workspace and workspace != WorkspaceService.DEFAULT_WORKSPACE:
            workspace_tfvars_path, workspace_secret_tfvars_path = VariableService.get_variable_files(
                project_id, workspace
            )
            
            if workspace_tfvars_path.exists():
                result.append(f"-var-file={workspace_tfvars_path.name}")
            
            if workspace_secret_tfvars_path.exists():
                result.append(f"-var-file={workspace_secret_tfvars_path.name}")
        
        return result