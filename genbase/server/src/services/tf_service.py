"""
Service for executing TF CLI commands
"""
import json
import subprocess
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

from ..logger import logger
from .project_service import ProjectService
from .variable_service import VariableService
from .workspace_service import WorkspaceService


class TofuService:
    """
    Service for executing TF CLI commands
    
    All Terraform commands are executed at the project root level.
    """
    
    @staticmethod
    def _run_command(cmd: list, project_id: str) -> Tuple[int, str, str]:
        """Run a command at the project root and return exit code, stdout, and stderr"""
        # Always run commands at the project infrastructure root
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        logger.debug(f"Running command: {' '.join(cmd)} in {infra_path}")
        
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
            logger.warning(f"Command failed with exit code {exit_code}: {stderr}")
        
        return exit_code, stdout, stderr
    
    @staticmethod
    def run_plan(project_id: str, workspace: Optional[str] = None) -> Dict[str, Any]:
        """Run tf plan at the project root"""
        # Default to default workspace if not specified
        if workspace is None:
            workspace = WorkspaceService.DEFAULT_WORKSPACE
            
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Check if tf files exist in the directory
        tf_files = list(infra_path.glob("*.tf"))
        if not tf_files:
            logger.warning(f"No TF files found in project root for {project_id}")
        
        # Initialize if needed
        init_needed = not (infra_path / ".terraform").exists()
        if init_needed:
            logger.info(f"Running init in project {project_id}")
            init_cmd = ["tofu", "init"]
            exit_code, stdout, stderr = TofuService._run_command(init_cmd, project_id)
            if exit_code != 0:
                return {
                    "success": False,
                    "error": stderr,
                    "init_output": stdout
                }
        
        # Switch to the requested workspace if needed
        workspace_result = WorkspaceService.select_workspace(project_id, workspace)
        if not workspace_result.get("success", False):
            return {
                "success": False,
                "error": f"Failed to select workspace: {workspace}",
                "details": workspace_result.get("error", "")
            }
        
        # Get variable files for the command (now centralized)
        var_file_args = VariableService.get_var_file_paths_for_command(project_id, workspace)
        
        # Run tf plan with JSON output
        plan_file = infra_path / f"{workspace}_plan.tfplan"
        json_file = infra_path / f"{workspace}_plan.json"
        
        # Create plan file with workspace-specific variables
        plan_cmd = ["tofu", "plan", f"-out={plan_file.name}"] + var_file_args
        exit_code, plan_stdout, plan_stderr = TofuService._run_command(plan_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": plan_stderr,
                "output": plan_stdout
            }
        
        # Convert plan to JSON
        json_cmd = ["tofu", "show", "-json", plan_file.name]
        exit_code, json_stdout, json_stderr = TofuService._run_command(json_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": json_stderr,
                "output": json_stdout
            }
        
        # Save the JSON output to file
        try:
            with open(json_file, "w") as f:
                f.write(json_stdout)
        except Exception as e:
            logger.error(f"Failed to write plan JSON: {str(e)}")
        
        # Parse the JSON output
        try:
            plan_data = json.loads(json_stdout)
            return {
                "success": True,
                "plan": plan_data,
                "summary": TofuService._extract_plan_summary(plan_data),
                "workspace": workspace
            }
        except json.JSONDecodeError:
            logger.error("Failed to parse plan JSON output")
            return {
                "success": False,
                "error": "Failed to parse plan JSON output",
                "raw_output": json_stdout
            }
    
    @staticmethod
    def _extract_plan_summary(plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract summary information from plan data"""
        summary = {
            "add": 0,
            "change": 0,
            "destroy": 0
        }
        
        # Extract resource changes
        resource_changes = plan_data.get("resource_changes", [])
        for change in resource_changes:
            actions = change.get("change", {}).get("actions", [])
            if "create" in actions:
                summary["add"] += 1
            elif "update" in actions:
                summary["change"] += 1
            elif "delete" in actions:
                summary["destroy"] += 1
        
        return summary
    
    @staticmethod
    def run_apply(project_id: str, workspace: Optional[str] = None) -> Dict[str, Any]:
        """Apply the latest plan at the project root"""
        # Default to default workspace if not specified
        if workspace is None:
            workspace = WorkspaceService.DEFAULT_WORKSPACE
            
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Switch to the requested workspace if needed
        workspace_result = WorkspaceService.select_workspace(project_id, workspace)
        if not workspace_result.get("success", False):
            return {
                "success": False,
                "error": f"Failed to select workspace: {workspace}",
                "details": workspace_result.get("error", "")
            }
        
        # Check if plan file exists
        plan_file = infra_path / f"{workspace}_plan.tfplan"
        if not plan_file.exists():
            return {
                "success": False,
                "error": f"No plan file found for workspace {workspace}. Run plan first."
            }
        
        # Run tf apply
        apply_cmd = ["tofu", "apply", "-auto-approve", plan_file.name]
        exit_code, stdout, stderr = TofuService._run_command(apply_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": stderr,
                "output": stdout
            }
        
        # Try to parse state after apply
        try:
            state = TofuService.get_state(project_id, workspace=workspace, refresh=False)
            return {
                "success": True,
                "output": stdout,
                "state_summary": state.get("summary", {}),
                "workspace": workspace
            }
        except Exception as e:
            logger.error(f"Failed to get state after apply: {str(e)}")
            return {
                "success": True,
                "output": stdout,
                "workspace": workspace
            }
    
    @staticmethod
    def run_destroy(project_id: str, workspace: Optional[str] = None) -> Dict[str, Any]:
        """Destroy resources defined at the project root"""
        # Default to default workspace if not specified
        if workspace is None:
            workspace = WorkspaceService.DEFAULT_WORKSPACE
            
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Switch to the requested workspace if needed
        workspace_result = WorkspaceService.select_workspace(project_id, workspace)
        if not workspace_result.get("success", False):
            return {
                "success": False,
                "error": f"Failed to select workspace: {workspace}",
                "details": workspace_result.get("error", "")
            }
        
        # Get variable files for the command (now centralized)
        var_file_args = VariableService.get_var_file_paths_for_command(project_id, workspace)
        
        # Run tf destroy with workspace-specific variables
        destroy_cmd = ["tofu", "destroy", "-auto-approve"] + var_file_args
        exit_code, stdout, stderr = TofuService._run_command(destroy_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": stderr,
                "output": stdout
            }
        
        return {
            "success": True,
            "output": stdout,
            "workspace": workspace
        }
    
    @staticmethod
    def get_state(project_id: str, workspace: Optional[str] = None, refresh: bool = False) -> Dict[str, Any]:
        """Get the current state at the project root"""
        # Default to default workspace if not specified
        if workspace is None:
            workspace = WorkspaceService.DEFAULT_WORKSPACE
            
        # Get the infrastructure root path
        infra_path = ProjectService.get_infrastructure_path(project_id)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure path does not exist for project: {project_id}")
        
        # Switch to the requested workspace if needed
        workspace_result = WorkspaceService.select_workspace(project_id, workspace)
        if not workspace_result.get("success", False):
            return {
                "success": False,
                "error": f"Failed to select workspace: {workspace}",
                "details": workspace_result.get("error", "")
            }
            
        # Build the command
        state_cmd = ["tofu", "show", "-json"]
        
        # Add refresh flag if needed
        if refresh:
            # First do a refresh with workspace-specific variables
            var_file_args = VariableService.get_var_file_paths_for_command(project_id, workspace)
            refresh_cmd = ["tofu", "refresh"] + var_file_args
            exit_code, stdout, stderr = TofuService._run_command(refresh_cmd, project_id)
            if exit_code != 0:
                return {
                    "success": False,
                    "error": stderr,
                    "output": stdout
                }
        
        # Run the state command
        exit_code, stdout, stderr = TofuService._run_command(state_cmd, project_id)
        
        if exit_code != 0:
            return {
                "success": False,
                "error": stderr,
                "output": stdout
            }
        
        # Parse the JSON output
        try:
            state_data = json.loads(stdout)
            return {
                "success": True,
                "state": state_data,
                "summary": TofuService._extract_state_summary(state_data),
                "workspace": workspace
            }
        except json.JSONDecodeError:
            logger.error("Failed to parse state JSON output")
            return {
                "success": False,
                "error": "Failed to parse state JSON output",
                "raw_output": stdout
            }
    
    @staticmethod
    def _extract_state_summary(state_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract summary information from state data"""
        summary = {
            "resource_count": 0,
            "resource_types": set(),
            "outputs": []
        }
        
        # Get resources
        resources = state_data.get("values", {}).get("root_module", {}).get("resources", [])
        summary["resource_count"] = len(resources)
        
        # Extract resource types
        for resource in resources:
            summary["resource_types"].add(resource.get("type", "unknown"))
        
        # Convert set to list for JSON serialization
        summary["resource_types"] = list(summary["resource_types"])
        
        # Get outputs
        outputs = state_data.get("values", {}).get("outputs", {})
        for name, output in outputs.items():
            summary["outputs"].append({
                "name": name,
                "type": output.get("type", "unknown")
            })
        
        return summary