# ===== BACKEND CHANGES =====

# 1. Update genbase/server/src/services/variable_service.py
"""
Service for managing Terraform variables and Environment variables using JSON format and .env files
"""
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from ..logger import logger
from .project_service import ProjectService
from .workspace_service import WorkspaceService

# Add python-dotenv import (need to add this dependency)
try:
    from dotenv import set_key, unset_key, dotenv_values
except ImportError:
    logger.error("python-dotenv not installed. Run: pip install python-dotenv")
    raise

class VariableService:
    """
    Service for managing Terraform variables using JSON format and Environment variables using .env files
    
    Variables are managed per workspace only. No common/default variables.
    All variable files are stored at the project root with workspace prefixes.
    """
    
    @staticmethod
    def _get_variable_file_names(workspace: str) -> Tuple[str, str]:
        """Get variable file names for a specific workspace"""
        # All workspaces use workspace-prefixed file names
        return f"{workspace}.terraform.tfvars.json", f"{workspace}.secrets.auto.tfvars.json"
    
    @staticmethod
    def _get_env_file_name(workspace: str) -> str:
        """Get environment file name for a specific workspace"""
        return f"{workspace}.env"
    
    @staticmethod
    def get_variable_files(project_id: str, workspace: str) -> Tuple[Path, Path]:
        """Get paths to variable files for a project and workspace"""
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
    def get_env_file_path(project_id: str, workspace: str) -> Path:
        """Get path to environment file for a project and workspace"""
        infra_path = ProjectService.get_infrastructure_path(project_id)
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure directory not found for project: {project_id}")
        
        env_filename = VariableService._get_env_file_name(workspace)
        return infra_path / env_filename
    
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
    def _ensure_env_file_exists(file_path: Path) -> bool:
        """Ensure environment file exists with proper permissions"""
        try:
            if not file_path.exists():
                # Create parent directory if it doesn't exist
                file_path.parent.mkdir(parents=True, exist_ok=True)
                # Create the file with restricted permissions
                file_path.touch(mode=0o600, exist_ok=False)
            return True
        except Exception as e:
            logger.error(f"Error creating env file {file_path}: {str(e)}")
            return False
    
    @staticmethod
    def list_variables(project_id: str, workspace: str) -> List[Dict[str, Any]]:
        """List all variables in a project for a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for listing variables")
            
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
                "workspace": workspace,
                "variable_type": "terraform"
            })
        
        # Add secret variables
        for name, value in secret_vars.items():
            var_type = VariableService._infer_type(value)
            result.append({
                "name": name,
                "value": value,
                "type": var_type,
                "is_secret": True,
                "workspace": workspace,
                "variable_type": "terraform"
            })
        
        return result
    
    @staticmethod
    def list_env_variables(project_id: str, workspace: str) -> List[Dict[str, Any]]:
        """List all environment variables in a project for a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for listing environment variables")
        
        env_file_path = VariableService.get_env_file_path(project_id, workspace)
        
        # Load environment variables from file
        if not env_file_path.exists():
            return []
        
        try:
            env_vars = dotenv_values(str(env_file_path))
            result = []
            
            for name, value in env_vars.items():
                if name and value is not None:  # Skip empty names or None values
                    result.append({
                        "name": name,
                        "value": value,
                        "workspace": workspace,
                        "variable_type": "environment"
                    })
            
            return result
        except Exception as e:
            logger.error(f"Error reading env file {env_file_path}: {str(e)}")
            return []
    
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
    def get_variable(project_id: str, variable_name: str, workspace: str) -> Optional[Dict[str, Any]]:
        """Get a specific variable from a workspace"""
        if not workspace:
            raise ValueError("Workspace is required for getting variable")
            
        variables = VariableService.list_variables(project_id, workspace)
        
        for var in variables:
            if var["name"] == variable_name:
                return var
                
        return None
    
    @staticmethod
    def get_env_variable(project_id: str, variable_name: str, workspace: str) -> Optional[Dict[str, Any]]:
        """Get a specific environment variable from a workspace"""
        if not workspace:
            raise ValueError("Workspace is required for getting environment variable")
            
        env_variables = VariableService.list_env_variables(project_id, workspace)
        
        for var in env_variables:
            if var["name"] == variable_name:
                return var
                
        return None
    
    @staticmethod
    def create_or_update_variable(
        project_id: str, 
        name: str, 
        value: Any, 
        workspace: str,
        is_secret: bool = False,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update a variable in a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for creating/updating variables")
            
        # Get paths to variable files
        tfvars_path, secret_tfvars_path = VariableService.get_variable_files(project_id, workspace)
        
        # If this is a secret variable, we need to check if it exists in regular vars and remove it
        if is_secret:
            regular_vars = VariableService._load_json_file(tfvars_path)
            if name in regular_vars:
                del regular_vars[name]
                VariableService._write_json_file(tfvars_path, regular_vars)
        else:
            # If this is a regular variable, check if it exists in secret vars and remove it
            secret_vars = VariableService._load_json_file(secret_tfvars_path)
            if name in secret_vars:
                del secret_vars[name]
                VariableService._write_json_file(secret_tfvars_path, secret_vars)
        
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
            "workspace": workspace,
            "variable_type": "terraform"
        }
    
    @staticmethod
    def create_or_update_env_variable(
        project_id: str, 
        name: str, 
        value: str, 
        workspace: str
    ) -> Dict[str, Any]:
        """Create or update an environment variable in a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for creating/updating environment variables")
        
        if not name or not name.replace('_', '').isalnum():
            raise ValueError(f"Invalid environment variable name: {name}")
        
        env_file_path = VariableService.get_env_file_path(project_id, workspace)
        
        # Ensure the env file exists
        if not VariableService._ensure_env_file_exists(env_file_path):
            raise ValueError(f"Failed to create environment file")
        
        try:
            # Use python-dotenv to set the variable
            success = set_key(str(env_file_path), name, value)
            
            if not success:
                raise ValueError(f"Failed to set environment variable")
            
            return {
                "name": name,
                "value": value,
                "workspace": workspace,
                "variable_type": "environment"
            }
        except Exception as e:
            logger.error(f"Error setting environment variable {name}: {str(e)}")
            raise ValueError(f"Failed to set environment variable: {str(e)}")
    
    @staticmethod
    def delete_variable(project_id: str, variable_name: str, workspace: str) -> bool:
        """Delete a variable from a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for deleting variables")
            
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
    def delete_env_variable(project_id: str, variable_name: str, workspace: str) -> bool:
        """Delete an environment variable from a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for deleting environment variables")
        
        # Check if variable exists
        variable = VariableService.get_env_variable(project_id, variable_name, workspace)
        if not variable:
            raise ValueError(f"Environment variable not found: {variable_name}")
        
        env_file_path = VariableService.get_env_file_path(project_id, workspace)
        
        if not env_file_path.exists():
            return True  # Already doesn't exist
        
        try:
            # Use python-dotenv to unset the variable
            success, _ = unset_key(str(env_file_path), variable_name)
            return bool(success)
        except Exception as e:
            logger.error(f"Error deleting environment variable {variable_name}: {str(e)}")
            return False

    @staticmethod
    def get_var_file_paths_for_command(project_id: str, workspace: str) -> List[str]:
        """Get variable file paths to use in OpenTofu commands for a specific workspace"""
        if not workspace:
            raise ValueError("Workspace is required for getting var file paths")
            
        result = []
        
        # Get variable files for the specified workspace
        tfvars_path, secret_tfvars_path = VariableService.get_variable_files(project_id, workspace)
        
        # Check if workspace variable files exist and add them
        if tfvars_path.exists():
            result.append(f"-var-file={tfvars_path.name}")
        
        if secret_tfvars_path.exists():
            # Secrets should be loaded automatically because of the .auto. in the filename,
            # but we explicitly include them for clarity
            result.append(f"-var-file={secret_tfvars_path.name}")
        
        return result
    
    @staticmethod
    def load_env_variables_for_command(project_id: str, workspace: str) -> Dict[str, str]:
        """Load environment variables for a workspace to use in command execution"""
        if not workspace:
            return {}
        
        env_file_path = VariableService.get_env_file_path(project_id, workspace)
        
        if not env_file_path.exists():
            return {}
        
        try:
            env_vars = dotenv_values(str(env_file_path))
            # Filter out None values and ensure all values are strings
            return {k: str(v) for k, v in env_vars.items() if k and v is not None}
        except Exception as e:
            logger.error(f"Error loading environment variables from {env_file_path}: {str(e)}")
            return {}
    
    @staticmethod
    def get_env_for_subprocess(project_id: str, workspace: str, base_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """
        Get environment variables for subprocess execution
        
        Args:
            project_id: The project identifier
            workspace: The workspace name
            base_env: Base environment to merge with (defaults to os.environ.copy())
            
        Returns:
            Dictionary of environment variables ready for subprocess use
            
        Example:
            env = VariableService.get_env_for_subprocess("myproject", "dev")
            subprocess.run(["tofu", "plan"], env=env, cwd=infra_path)
        """


        if base_env is None:
            import os
            env = os.environ.copy()
        else:
            env = base_env.copy()
        
        # Load and merge workspace-specific environment variables
        workspace_env = VariableService.load_env_variables_for_command(project_id, workspace)
        env.update(workspace_env)
        
        logger.debug(f"Loaded {len(workspace_env)} environment variables for workspace '{workspace}' in project '{project_id}'")
        
        return env