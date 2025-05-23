"""
Tools for working with Terraform files and blocks in a project.
These tools are used by AI agents to analyze and manipulate infrastructure code.
"""
import re
import hcl2
import json
import os.path
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import subprocess

from pydantic import BaseModel, Field

from src.services.tf_service import TofuService
from src.services.git_service import CommitResult, GitService

# Re-use code analysis utilities from the existing CodeService
from ..services.code_service import CodeService
from ..services.project_service import ProjectService
from ..logger import logger





class AgentTools:
    """
    Collection of tools for working with Terraform files and blocks.
    Used by AI agents to analyze and manipulate infrastructure code.
    """
    
    def __init__(self, project_id: str, branch: str):
        """
        Initialize the TerraformTools with project context
        
        Args:
            project_id: The project identifier
            branch: The branch to work with
        """
        self.project_id = project_id
        self.branch = branch
    
    def get_all_blocks_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all blocks in all Terraform files for a project.
        This includes block type, labels, and dependencies between blocks.
            
        Returns:
            Dictionary with file paths as keys and lists of block summaries as values,
            plus a "dependencies" key with a list of block dependencies
        """
        try:
            # Get infrastructure path for this branch
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            
            # Get all .tf files
            tf_files = CodeService.get_all_tf_files(self.project_id, self.branch)
            
            if not tf_files:
                return {
                    "success": True,
                    "message": f"No Terraform files found in project {self.project_id} on branch {self.branch}",
                    "files": {},
                    "dependencies": []
                }
            
            # Process each file and gather block summaries
            files_summary = {}
            all_parsed_content = {}  # Store full parsed content for dependency analysis
            
            for tf_file in tf_files:
                try:
                    # Get relative path for display
                    rel_path = tf_file.relative_to(infra_path)
                    
                    # Parse the file
                    parsed_content = CodeService._parse_tf_file(tf_file, infra_path)
                    
                    # Store full parsed content for dependency analysis
                    all_parsed_content[str(rel_path)] = parsed_content
                    
                    # Extract block summaries
                    file_blocks = []
                    
                    for block_type, blocks in parsed_content.items():
                        if block_type.startswith('_'):  # Skip metadata or error fields
                            continue
                            
                        for block in blocks:
                            if isinstance(block, dict):
                                # Create a minimal summary of the block
                                block_summary = {
                                    "type": block_type,
                                }
                                
                                # Add appropriate identifiers based on block type
                                if block_type == "resource":
                                    block_summary["resource_type"] = block.get("type", "")
                                    block_summary["resource_name"] = block.get("name", "")
                                    block_summary["address"] = f"{block.get('type', '')}.{block.get('name', '')}"
                                elif block_type == "data":
                                    block_summary["data_type"] = block.get("type", "")
                                    block_summary["data_name"] = block.get("name", "")
                                    block_summary["address"] = f"data.{block.get('type', '')}.{block.get('name', '')}"
                                elif block_type == "module":
                                    block_summary["module_name"] = block.get("name", "")
                                    block_summary["address"] = f"module.{block.get('name', '')}"
                                elif block_type == "variable":
                                    block_summary["variable_name"] = block.get("name", "")
                                    block_summary["address"] = f"var.{block.get('name', '')}"
                                elif block_type == "output":
                                    block_summary["output_name"] = block.get("name", "")
                                    block_summary["address"] = f"output.{block.get('name', '')}"
                                elif block_type == "locals":
                                    # For locals, extract the keys from the config
                                    local_names = []
                                    if "config" in block and isinstance(block["config"], dict):
                                        local_names = list(block["config"].keys())
                                    block_summary["local_names"] = ", ".join(local_names)
                                elif block_type == "provider":
                                    block_summary["provider_name"] = block.get("name", "")
                                    block_summary["address"] = f"provider.{block.get('name', '')}"
                                
                                # Add metadata about the block location
                                if "_metadata" in block:
                                    metadata = block.get("_metadata", {})
                                    block_summary["file_name"] = metadata.get("file_name", "")
                                    block_summary["group_path"] = metadata.get("group_path", "")
                                
                                file_blocks.append(block_summary)
                    
                    # Store blocks for this file
                    files_summary[str(rel_path)] = file_blocks
                    
                except Exception as e:
                    logger.error(f"Error processing file {tf_file}: {str(e)}")
                    files_summary[str(rel_path)] = [{"error": str(e)}]
            
            # Analyze dependencies between blocks
            # First, build combined content from all files
            combined_content = {
                "resource": [],
                "module": [],
                "data": [],
                "output": [],
                "variable": [],
                "locals": [],
                "provider": [],
                "terraform": []
            }
            
            for file_content in all_parsed_content.values():
                for block_type, blocks in file_content.items():
                    if block_type.startswith('_'):  # Skip metadata or error fields
                        continue
                    
                    if block_type not in combined_content:
                        combined_content[block_type] = []
                    
                    combined_content[block_type].extend(blocks)
            
            # Now analyze dependencies
            dependencies = CodeService._analyze_dependencies(combined_content)
            
            return {
                "success": True,
                "message": f"Successfully analyzed {len(tf_files)} Terraform files",
                "files": files_summary,
                "dependencies": dependencies
            }
            
        except Exception as e:
            logger.error(f"Error getting block summary: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


    # TOOL 1: Read/Discover Operations
    def tf_read(
        self, 
        file_path: str, 
        block_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Read blocks from a Terraform file - either list all blocks or get specific block content.
        
        Args:
            file_path: Path to the .tf file relative to infrastructure root
            block_address: Optional. If provided, gets content of specific block. 
                        If omitted, lists all blocks in the file.
            
        Returns:
            Dictionary with block information
            
        Examples:
            # List all blocks in a file
            tf_read("main.tf")
            
            # Get specific block content  
            tf_read("main.tf", "resource.aws_instance.web")
        """
        try:
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            abs_file_path = infra_path / file_path
            
            if not abs_file_path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {file_path}"
                }
            
            if not self._check_hcledit_available():
                return {
                    "success": False,
                    "error": "hcledit CLI tool is required. Install: go install github.com/minamijoyo/hcledit@latest"
                }
            
            if block_address:
                # Get specific block content
                result = subprocess.run(
                    ["hcledit", "block", "get", block_address, "-f", str(abs_file_path)],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    return {
                        "success": True,
                        "operation": "get_block",
                        "file_path": file_path,
                        "block_address": block_address,
                        "content": result.stdout.strip(),
                        "message": f"Retrieved block {block_address} from {file_path}"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Block {block_address} not found: {result.stderr}"
                    }
            else:
                # List all blocks
                result = subprocess.run(
                    ["hcledit", "block", "list", "-f", str(abs_file_path)],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    blocks = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
                    return {
                        "success": True,
                        "operation": "list_blocks",
                        "file_path": file_path,
                        "blocks": blocks,
                        "count": len(blocks),
                        "message": f"Found {len(blocks)} blocks in {file_path}"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to list blocks: {result.stderr}"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # TOOL 2: Write Operations (Create/Replace)
    def tf_write(
        self, 
        file_path: str, 
        block_content: str, 
        block_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Write block content to a file - either create new block or replace existing one.
        
        Args:
            file_path: Path to the .tf file relative to infrastructure root
            block_content: Complete HCL block content including headers
            block_address: Optional. If provided, replaces existing block. 
                        If omitted, appends as new block.
            
        Returns:
            Dictionary with write result and commit information
            
        Examples:
            # Create new block (append to file)
            tf_write("main.tf", 'resource "aws_s3_bucket" "logs" {\n  bucket = "my-logs"\n}')
            
            # Replace existing block
            tf_write("main.tf", 'resource "aws_instance" "web" {\n  instance_type = "t3.micro"\n}', "resource.aws_instance.web")
        """
        try:
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            abs_file_path = infra_path / file_path
            
            # Create file if it doesn't exist
            if not abs_file_path.exists():
                abs_file_path.parent.mkdir(parents=True, exist_ok=True)
                abs_file_path.touch()
            
            if not self._check_hcledit_available():
                return {
                    "success": False,
                    "error": "hcledit CLI tool is required"
                }
            
            # Backup original content
            with open(abs_file_path, 'r', encoding='utf-8') as file:
                original_content = file.read()
            
            try:
                if block_address:
                    # Replace existing block
                    # First verify it exists
                    check_result = subprocess.run(
                        ["hcledit", "block", "get", block_address, "-f", str(abs_file_path)],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if check_result.returncode != 0:
                        return {
                            "success": False,
                            "error": f"Block {block_address} not found in {file_path}"
                        }
                    
                    # Remove existing block
                    remove_result = subprocess.run(
                        ["hcledit", "block", "rm", block_address, "-f", str(abs_file_path), "-u"],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if remove_result.returncode != 0:
                        return {
                            "success": False,
                            "error": f"Failed to remove existing block: {remove_result.stderr}"
                        }
                    
                    operation = "replace_block"
                    message_action = f"Replace block {block_address}"
                else:
                    operation = "create_block"
                    message_action = "Create new block"
                
                # Add the new content
                with open(abs_file_path, 'r', encoding='utf-8') as file:
                    current_content = file.read()
                
                # Ensure proper spacing
                if current_content and not current_content.endswith('\n'):
                    current_content += '\n'
                
                if current_content.strip():  # Add spacing if file has content
                    current_content += '\n'
                
                current_content += block_content + '\n'
                
                with open(abs_file_path, 'w', encoding='utf-8') as file:
                    file.write(current_content)
                
                # Format the file
                self._hcl_format_file(abs_file_path)
                
                # Validate
                validation = self._validate_hcl_file(abs_file_path)
                if not validation["success"]:
                    # Restore original content
                    with open(abs_file_path, 'w', encoding='utf-8') as file:
                        file.write(original_content)
                    return {
                        "success": False,
                        "error": f"Content failed validation: {validation['error']}"
                    }
                
                # Auto-commit
                commit_result = self._auto_commit(
                    message=f"{message_action} in {file_path}"
                )
                
                return {
                    "success": True,
                    "operation": operation,
                    "file_path": file_path,
                    "block_address": block_address,
                    "content": block_content,
                    "commit_id": commit_result.commit_id if commit_result.success else None,
                    "message": f"Successfully wrote block to {file_path}"
                }
                
            except Exception as e:
                # Restore original content on error
                with open(abs_file_path, 'w', encoding='utf-8') as file:
                    file.write(original_content)
                raise e
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # TOOL 3: Modify Operations (Remove/Move/Nested)
    def tf_modify(
        self, 
        file_path: str, 
        operation: str, 
        block_address: str, 
        new_address: Optional[str] = None,
        nested_type: Optional[str] = None,
        nested_labels: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Modify existing blocks - remove, move/rename, or add nested blocks.
        
        Args:
            file_path: Path to the .tf file relative to infrastructure root
            operation: One of "remove", "move", or "add_nested"
            block_address: Address of the block to modify
            new_address: Required for "move" operation - new block address
            nested_type: Required for "add_nested" - type of nested block (e.g., "dynamic")
            nested_labels: Optional for "add_nested" - labels for nested block
            
        Returns:
            Dictionary with modification result and commit information
            
        Examples:
            # Remove a block
            tf_modify("main.tf", "remove", "resource.aws_instance.old")
            
            # Move/rename a block
            tf_modify("main.tf", "move", "resource.aws_instance.web", new_address="resource.aws_instance.web_server")
            
            # Add nested block
            tf_modify("main.tf", "add_nested", "resource.aws_instance.web", nested_type="dynamic", nested_labels=["ebs_block_device"])
        """
        try:
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            abs_file_path = infra_path / file_path
            
            if not abs_file_path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {file_path}"
                }
            
            if not self._check_hcledit_available():
                return {
                    "success": False,
                    "error": "hcledit CLI tool is required"
                }
            
            # Validate operation
            valid_operations = ["remove", "move", "add_nested"]
            if operation not in valid_operations:
                return {
                    "success": False,
                    "error": f"Invalid operation. Must be one of: {valid_operations}"
                }
            
            # Validate required parameters
            if operation == "move" and not new_address:
                return {
                    "success": False,
                    "error": "new_address is required for move operation"
                }
            
            if operation == "add_nested" and not nested_type:
                return {
                    "success": False,
                    "error": "nested_type is required for add_nested operation"
                }
            
            # Execute the operation
            if operation == "remove":
                # Verify block exists first
                check_result = subprocess.run(
                    ["hcledit", "block", "get", block_address, "-f", str(abs_file_path)],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if check_result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"Block {block_address} not found in {file_path}"
                    }
                
                # Remove the block
                result = subprocess.run(
                    ["hcledit", "block", "rm", block_address, "-f", str(abs_file_path), "-u"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"Failed to remove block: {result.stderr}"
                    }
                
                commit_message = f"Remove block {block_address} from {file_path}"
                success_message = f"Successfully removed block {block_address}"
                
            elif operation == "move":
                if not new_address:  # Additional validation
                    return {
                        "success": False,
                        "error": "new_address cannot be None for move operation"
                    }
                result = subprocess.run(
                    ["hcledit", "block", "mv", block_address, new_address, "-f", str(abs_file_path), "-u"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"Failed to move block: {result.stderr}"
                    }
                
                commit_message = f"Move block from {block_address} to {new_address} in {file_path}"
                success_message = f"Successfully moved block from {block_address} to {new_address}"
                
            elif operation == "add_nested":
                # Build command for nested block
                cmd = ["hcledit", "block", "append", block_address, nested_type]
                if nested_labels:
                    cmd.extend(nested_labels)
                cmd.extend(["-f", str(abs_file_path), "-u", "--newline"])
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"Failed to add nested block: {result.stderr}"
                    }
                
                nested_address = f"{block_address}.{nested_type}"
                if nested_labels:
                    nested_address += "." + ".".join(nested_labels)
                
                commit_message = f"Add nested block {nested_address} in {file_path}"
                success_message = f"Successfully added nested block {nested_type} to {block_address}"
            
            # Auto-commit
            commit_result = self._auto_commit(message=commit_message)
            
            return {
                "success": True,
                "operation": operation,
                "file_path": file_path,
                "block_address": block_address,
                "new_address": new_address,
                "nested_type": nested_type,
                "nested_labels": nested_labels,
                "commit_id": commit_result.commit_id if commit_result.success else None,
                "message": success_message
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # Helper functions (shared)
    def _check_hcledit_available(self) -> bool:
        """Check if hcledit CLI tool is available"""
        try:
            result = subprocess.run(
                ["hcledit", "version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except:
            return False

    def _hcl_format_file(self, file_path: Path) -> bool:
        """Format the HCL file using hcledit"""
        try:
            result = subprocess.run(
                ["hcledit", "fmt", "-f", str(file_path), "-u"],
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0
        except:
            return False

    def _validate_hcl_file(self, file_path: Path) -> Dict[str, Any]:
        """Validate HCL file syntax"""
        try:
            import hcl2
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            hcl2.api.loads(content)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": f"HCL validation failed: {str(e)}"}

    def delete_file(self, file_path: str) -> Dict[str, Any]:
        """
        Delete a Terraform file.
        
        Args:
            file_path: Path to the .tf file relative to infrastructure root
            
        Returns:
            Dictionary with success status
        """
        try:
            # Get infrastructure path for this branch
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            
            # Construct absolute path to the file
            abs_file_path = infra_path / file_path
            
            if not abs_file_path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {file_path}"
                }
            
            # Check if it's a .tf file
            if not abs_file_path.suffix == '.tf':
                return {
                    "success": False,
                    "error": f"File is not a Terraform (.tf) file: {file_path}"
                }
            
            # Delete the file
            abs_file_path.unlink()

            # Auto-commit the deletion
            commit_result = self._auto_commit(
                message=f"Delete file: {file_path}"
            )
            if not commit_result.success:
                return {
                    "success": False,
                    "error": f"Failed to auto-commit deletion: {commit_result.error}"
                }
            
            return {
                "success": True,
                "message": f"Successfully deleted file: {file_path}",
                "commit_id": commit_result.commit_id
            }
            
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def tf_validate(self) -> Dict[str, Any]:
        """
        Run terraform validate on the project.
            
        Returns:
            Dictionary with validation results
        """
        try:
            # Get infrastructure path for this branch
            infra_path = ProjectService.get_infrastructure_path(self.project_id, self.branch)
            
            if not infra_path.exists():
                return {
                    "success": False,
                    "error": f"Infrastructure path not found for project: {self.project_id}, branch: {self.branch}"
                }
            
            # Check if terraform is initialized
            terraform_dir = infra_path / ".terraform"
            if not terraform_dir.exists():
                # Run init first
                init_process = subprocess.run(
                    ["tofu", "init", "-no-color"],
                    cwd=str(infra_path),
                    capture_output=True,
                    text=True
                )
                
                if init_process.returncode != 0:
                    return {
                        "success": False,
                        "error": f"Terraform init failed: {init_process.stderr}"
                    }
            
            # Run validate
            validate_process = subprocess.run(
                ["tofu", "validate", "-json"],
                cwd=str(infra_path),
                capture_output=True,
                text=True
            )
            
            # Parse the output
            result = {
                "returncode": validate_process.returncode,
                "stdout": validate_process.stdout,
                "stderr": validate_process.stderr
            }
            
            # Try to parse JSON output
            try:
                if validate_process.stdout:
                    result["json"] = json.loads(validate_process.stdout)
                    result["success"] = result["json"].get("valid", False)
                    
                    # Extract diagnostics for better error reporting
                    if "diagnostics" in result["json"]:
                        result["diagnostics"] = result["json"]["diagnostics"]
                else:
                    result["success"] = (validate_process.returncode == 0)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                result["success"] = (validate_process.returncode == 0)
            
            return result
            
        except Exception as e:
            logger.error(f"Error running terraform validate: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }



    def check_branch_sync(self, target_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if the current branch is in sync with the target branch (defaults to main).
        
        Args:
            target_branch: Branch to compare against (defaults to main)
            
        Returns:
            Dictionary with sync status information
        """
        try:
            return GitService.check_branch_sync_status(
                project_id=self.project_id,
                branch_name=self.branch,
                target_branch=target_branch
            )
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def sync_with_main(self) -> Dict[str, Any]:
        """
        Sync the current branch with the target branch by merging target changes.
        
        Args:
            target_branch: Branch to sync with (defaults to main)
            
        Returns:
            Dictionary with sync operation results
        """
        try:
            # Perform the sync
            sync_result = GitService.sync_branch_with_target(
                project_id=self.project_id,
                branch_name=self.branch,
                target_branch='main'
            )
            
            if not sync_result.get("success", False):
                return sync_result
            
            # Auto-commit if changes were made
            if sync_result.get("action_taken") == "merge":
                commit_result = self._auto_commit(
                    message="Sync branch with 'main'"
                )
                sync_result["commit_id"] = commit_result.commit_id if commit_result.success else None
            
            return sync_result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


    def merge_changes(self) -> Dict[str, Any]:
        """
        Merge the current branch changes to the main branch.
        This will merge all committed changes from the current branch into main.
        
        Returns:
            Dictionary with merge result information
        """
        try:
            # Cannot merge main to itself
            if self.branch == "main":
                return {
                    "success": False,
                    "error": "Cannot merge main branch to itself"
                }
            
            # Use GitService to merge branch to main
            merge_result = GitService.merge_branch(
                project_id=self.project_id,
                source_branch=self.branch,
                target_branch="main"
            )
            
            if not merge_result.get("success", False):
                return {
                    "success": False,
                    "error": f"Failed to merge to main: {merge_result.get('error', 'Unknown error')}",
                    "details": merge_result
                }
            
            
            return {
                "success": True,
                "message": f"Successfully merged branch '{self.branch}' to main",
                "source_branch": self.branch,
                "target_branch": "main"
            }
            
        except Exception as e:
            logger.error(f"Error merging to main: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    def tf_plan(self, workspace: Optional[str] = None) -> Dict[str, Any]:
        """
        Run terraform plan in the current branch to preview infrastructure changes.
        
        Args:
            workspace: Optional workspace name (defaults to 'default')
            
        Returns:
            Dictionary with plan results including resource changes summary
        """
        try:
            # For non-main branches, we need to temporarily switch context
            # since TofuService expects to work with the main infrastructure path
            original_get_infra_path = ProjectService.get_infrastructure_path
            
            # Monkey patch to use our branch's infrastructure path
            def get_branch_infra_path(project_id: str, branch: str = "main"):
                return GitService.get_infrastructure_path(project_id, self.branch)
            
            ProjectService.get_infrastructure_path = get_branch_infra_path
            
            try:
                # Run terraform plan using TofuService
                plan_result = TofuService.run_plan(
                    project_id=self.project_id,
                    workspace=workspace
                )
                
                if not plan_result.get("success", False):
                    return {
                        "success": False,
                        "error": f"Terraform plan failed: {plan_result.get('error', 'Unknown error')}",
                        "details": plan_result
                    }
                
                # Extract useful information from the plan
                summary = plan_result.get("summary", {})
                plan_data = plan_result.get("plan", {})
                
                # Get resource changes for better reporting
                resource_changes = []
                if "resource_changes" in plan_data:
                    for change in plan_data["resource_changes"]:
                        resource_changes.append({
                            "address": change.get("address", ""),
                            "type": change.get("type", ""),
                            "actions": change.get("change", {}).get("actions", []),
                            "change_type": self._get_change_type(change.get("change", {}).get("actions", []))
                        })
                
                return {
                    "success": True,
                    "message": f"Terraform plan completed successfully",
                    "branch": self.branch,
                    "workspace": workspace or "default",
                    "summary": summary,
                    "resource_changes": resource_changes,
                    "changes_count": {
                        "add": summary.get("add", 0),
                        "change": summary.get("change", 0), 
                        "destroy": summary.get("destroy", 0)
                    },
                    "has_changes": (summary.get("add", 0) + summary.get("change", 0) + summary.get("destroy", 0)) > 0
                }
                
            finally:
                # Restore original function
                ProjectService.get_infrastructure_path = original_get_infra_path
                
        except Exception as e:
            logger.error(f"Error running terraform plan: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    @staticmethod
    def _get_change_type(actions: List[str]) -> str:
        """Helper method to determine the type of change from actions"""
        if "create" in actions:
            return "create"
        elif "update" in actions:
            return "update" 
        elif "delete" in actions:
            return "delete"
        elif "replace" in actions:
            return "replace"
        else:
            return "no-op"









    # Utility methods
    @staticmethod
    def _parse_block_header(block_content: str) -> Optional[Tuple[str, List[str]]]:
        """
        Parse the block type and labels from block content.
        
        Args:
            block_content: HCL content of a block
            
        Returns:
            Tuple of (block_type, block_labels) or None if parsing fails
        """
        # Regex pattern to match block type and labels
        pattern = r'^\s*(\w+)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*{'
        match = re.search(pattern, block_content, re.MULTILINE)
        
        if match:
            block_type = match.group(1)
            labels = [label for label in match.groups()[1:] if label is not None]
            return block_type, labels
        
        return None

    








    def _auto_commit(self, message: str) -> CommitResult:
        """
        Internal utility to automatically commit changes after modifying files.
        
        Args:
            message: The commit message
                
        Returns:
            Dictionary with commit information
        """
        try:
            # Use GitService to commit changes
            commit_result = GitService.commit_changes(
                project_id=self.project_id,
                branch=self.branch,
                message=message
            )
            
            return commit_result
            
        except Exception as e:
            logger.error(f"Error in auto commit: {str(e)}")
            return CommitResult(
                success=False,
                error=str(e)
            ) # type: ignore