"""
Enhanced CodeService with branch support and configuration comparison
"""
import json
import os
import hcl2
from glob import glob
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum

from ..logger import logger
from .project_service import ProjectService
from .group_service import GroupService


class ChangeType(str, Enum):
    """Types of changes between configurations"""
    ADDED = "added"
    DELETED = "deleted"
    MODIFIED = "modified"
    NO_CHANGE = "no_change"


class CodeService:
    """
    Enhanced service for reading, parsing, and comparing Terraform code files across branches
    """
    
    @staticmethod
    def _parse_tf_file(file_path: Path, infra_path: Path) -> Dict[str, Any]:
        """
        Parse a single .tf file and extract its configuration
        
        Args:
            file_path: Path to the .tf file
            infra_path: Base infrastructure path for calculating relative paths
            
        Returns:
            Dictionary containing parsed configuration with metadata
        """
        try:
            with open(file_path, 'r') as file:
                tf_content = hcl2.api.load(file)
            
            # Calculate group path and file name
            rel_path = file_path.relative_to(infra_path)
            group_path = str(rel_path.parent) if rel_path.parent != Path(".") else ""
            file_name = file_path.stem  # filename without extension
            
            # Add metadata to all top-level blocks
            processed_content = {}
            
            for block_type, blocks in tf_content.items():
                processed_content[block_type] = []
                
                # Handle different block types
                if block_type == "resource":
                    processed_content[block_type] = CodeService._process_resource_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "module":
                    processed_content[block_type] = CodeService._process_module_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "data":
                    processed_content[block_type] = CodeService._process_data_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "output":
                    processed_content[block_type] = CodeService._process_output_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "variable":
                    processed_content[block_type] = CodeService._process_variable_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "locals":
                    processed_content[block_type] = CodeService._process_locals_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "provider":
                    processed_content[block_type] = CodeService._process_provider_blocks(
                        blocks, group_path, file_name
                    )
                elif block_type == "terraform":
                    processed_content[block_type] = CodeService._process_terraform_blocks(
                        blocks, group_path, file_name
                    )
                else:
                    # For unknown block types, just add metadata
                    processed_content[block_type] = CodeService._add_metadata_to_blocks(
                        blocks, block_type, group_path, file_name
                    )
            
            return processed_content
            
        except Exception as e:
            logger.error(f"Error parsing Terraform file {file_path}: {str(e)}")
            return {
                "_error": {
                    "message": str(e),
                    "group_path": str(file_path.relative_to(infra_path).parent) if file_path.relative_to(infra_path).parent != Path(".") else "",
                    "file_name": file_path.stem
                }
            }
    
    @staticmethod
    def _process_resource_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process resource blocks with metadata"""
        result = []
        
        # Handle different HCL2 parser output formats
        if isinstance(blocks, list):
            for block_dict in blocks:
                for resource_type, resource_instances in block_dict.items():
                    if isinstance(resource_instances, dict):
                        for resource_name, resource_config in resource_instances.items():
                            result.append({
                                "type": resource_type,
                                "name": resource_name,
                                "address": f"{resource_type}.{resource_name}",
                                "config": resource_config,
                                "_metadata": {
                                    "group_path": group_path,
                                    "file_name": file_name,
                                    "block_type": "resource"
                                }
                            })
        elif isinstance(blocks, dict):
            for resource_type, resource_instances in blocks.items():
                if isinstance(resource_instances, dict):
                    for resource_name, resource_config in resource_instances.items():
                        result.append({
                            "type": resource_type,
                            "name": resource_name,
                            "address": f"{resource_type}.{resource_name}",
                            "config": resource_config,
                            "_metadata": {
                                "group_path": group_path,
                                "file_name": file_name,
                                "block_type": "resource"
                            }
                        })
        
        return result
    
    @staticmethod
    def _process_module_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process module blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for block_dict in blocks:
                for module_name, module_config in block_dict.items():
                    result.append({
                        "name": module_name,
                        "address": f"module.{module_name}",
                        "config": module_config,
                        "_metadata": {
                            "group_path": group_path,
                            "file_name": file_name,
                            "block_type": "module"
                        }
                    })
        elif isinstance(blocks, dict):
            for module_name, module_config in blocks.items():
                result.append({
                    "name": module_name,
                    "address": f"module.{module_name}",
                    "config": module_config,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "module"
                    }
                })
        
        return result
    
    @staticmethod
    def _process_data_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process data blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for block_dict in blocks:
                for data_type, data_instances in block_dict.items():
                    if isinstance(data_instances, dict):
                        for data_name, data_config in data_instances.items():
                            result.append({
                                "type": data_type,
                                "name": data_name,
                                "address": f"data.{data_type}.{data_name}",
                                "config": data_config,
                                "_metadata": {
                                    "group_path": group_path,
                                    "file_name": file_name,
                                    "block_type": "data"
                                }
                            })
        elif isinstance(blocks, dict):
            for data_type, data_instances in blocks.items():
                if isinstance(data_instances, dict):
                    for data_name, data_config in data_instances.items():
                        result.append({
                            "type": data_type,
                            "name": data_name,
                            "address": f"data.{data_type}.{data_name}",
                            "config": data_config,
                            "_metadata": {
                                "group_path": group_path,
                                "file_name": file_name,
                                "block_type": "data"
                            }
                        })
        
        return result
    
    @staticmethod
    def _process_output_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process output blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for block_dict in blocks:
                for output_name, output_config in block_dict.items():
                    result.append({
                        "name": output_name,
                        "address": f"output.{output_name}",
                        "config": output_config,
                        "_metadata": {
                            "group_path": group_path,
                            "file_name": file_name,
                            "block_type": "output"
                        }
                    })
        elif isinstance(blocks, dict):
            for output_name, output_config in blocks.items():
                result.append({
                    "name": output_name,
                    "address": f"output.{output_name}",
                    "config": output_config,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "output"
                    }
                })
        
        return result
    
    @staticmethod
    def _process_variable_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process variable blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for block_dict in blocks:
                for var_name, var_config in block_dict.items():
                    result.append({
                        "name": var_name,
                        "address": f"var.{var_name}",
                        "config": var_config,
                        "_metadata": {
                            "group_path": group_path,
                            "file_name": file_name,
                            "block_type": "variable"
                        }
                    })
        elif isinstance(blocks, dict):
            for var_name, var_config in blocks.items():
                result.append({
                    "name": var_name,
                    "address": f"var.{var_name}",
                    "config": var_config,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "variable"
                    }
                })
        
        return result
    
    @staticmethod
    def _process_locals_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process locals blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for locals_block in blocks:
                result.append({
                    "config": locals_block,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "locals"
                    }
                })
        elif isinstance(blocks, dict):
            result.append({
                "config": blocks,
                "_metadata": {
                    "group_path": group_path,
                    "file_name": file_name,
                    "block_type": "locals"
                }
            })
        
        return result
    
    @staticmethod
    def _process_provider_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process provider blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for block_dict in blocks:
                for provider_name, provider_config in block_dict.items():
                    result.append({
                        "name": provider_name,
                        "address": f"provider.{provider_name}",
                        "config": provider_config,
                        "_metadata": {
                            "group_path": group_path,
                            "file_name": file_name,
                            "block_type": "provider"
                        }
                    })
        elif isinstance(blocks, dict):
            for provider_name, provider_config in blocks.items():
                result.append({
                    "name": provider_name,
                    "address": f"provider.{provider_name}",
                    "config": provider_config,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "provider"
                    }
                })
        
        return result
    
    @staticmethod
    def _process_terraform_blocks(blocks: Any, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Process terraform blocks with metadata"""
        result = []
        
        if isinstance(blocks, list):
            for terraform_block in blocks:
                result.append({
                    "config": terraform_block,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": "terraform"
                    }
                })
        elif isinstance(blocks, dict):
            result.append({
                "config": blocks,
                "_metadata": {
                    "group_path": group_path,
                    "file_name": file_name,
                    "block_type": "terraform"
                }
            })
        
        return result
    
    @staticmethod
    def _add_metadata_to_blocks(blocks: Any, block_type: str, group_path: str, file_name: str) -> List[Dict[str, Any]]:
        """Add metadata to unknown block types"""
        result = []
        
        if isinstance(blocks, list):
            for block in blocks:
                result.append({
                    "config": block,
                    "_metadata": {
                        "group_path": group_path,
                        "file_name": file_name,
                        "block_type": block_type
                    }
                })
        else:
            result.append({
                "config": blocks,
                "_metadata": {
                    "group_path": group_path,
                    "file_name": file_name,
                    "block_type": block_type
                }
            })
        
        return result
    
    @staticmethod
    def get_all_tf_files(project_id: str, branch: str = "main") -> List[Path]:
        """
        Get all .tf files in the project for a specific branch, excluding ignored directories
        
        Args:
            project_id: Project identifier
            branch: Branch name (defaults to "main")
        """
        infra_path = ProjectService.get_infrastructure_path(project_id, branch)
        
        if not infra_path.exists() or not infra_path.is_dir():
            raise ValueError(f"Infrastructure directory not found for project: {project_id}, branch: {branch}")
        
        tf_files = []
        
        # Walk through the directory structure
        for root, dirs, files in os.walk(infra_path):
            # Remove ignored directories from dirs to prevent walking into them
            dirs[:] = [d for d in dirs if d not in GroupService.IGNORED_DIRECTORIES]
            
            # Add .tf files from current directory
            for file in files:
                if file.endswith('.tf'):
                    tf_files.append(Path(root) / file)
        
        return tf_files
    
    @staticmethod
    def parse_project_code(project_id: str, branch: str = "main") -> Dict[str, Any]:
        """
        Parse all Terraform files in a project for a specific branch and return combined configuration
        
        Args:
            project_id: Project identifier
            branch: Branch name (defaults to "main")
            
        Returns:
            Dictionary with all parsed configurations combined
        """
        try:
            # Get infrastructure path for the specific branch
            infra_path = ProjectService.get_infrastructure_path(project_id, branch)
            
            # Get all .tf files for this branch
            tf_files = CodeService.get_all_tf_files(project_id, branch)
            
            if not tf_files:
                logger.warning(f"No .tf files found in project: {project_id}, branch: {branch}")
                return {
                    "success": True,
                    "data": {
                        "project_id": project_id,
                        "branch": branch,
                        "files_processed": 0,
                        "blocks": {}
                    }
                }
            
            # Combined configuration
            combined_config = {
                "resource": [],
                "module": [],
                "data": [],
                "output": [],
                "variable": [],
                "locals": [],
                "provider": [],
                "terraform": []
            }
            
            files_processed = 0
            parse_errors = []
            
            # Process each file
            for tf_file in tf_files:
                try:
                    parsed_content = CodeService._parse_tf_file(tf_file, infra_path)
                    
                    # Add to combined configuration
                    for block_type, blocks in parsed_content.items():
                        if block_type == "_error":
                            parse_errors.append(blocks)
                            continue
                            
                        if block_type not in combined_config:
                            combined_config[block_type] = []
                        
                        combined_config[block_type].extend(blocks)
                    
                    files_processed += 1
                    
                except Exception as e:
                    logger.error(f"Error processing file {tf_file}: {str(e)}")
                    parse_errors.append({
                        "file": str(tf_file.relative_to(infra_path)),
                        "error": str(e)
                    })
            
            # Remove empty block types
            combined_config = {k: v for k, v in combined_config.items() if v}
            
            result = {
                "project_id": project_id,
                "branch": branch,
                "files_processed": files_processed,
                "total_files": len(tf_files),
                "blocks": combined_config
            }
            
            if parse_errors:
                result["parse_errors"] = parse_errors
            
            return {
                "success": True,
                "data": result
            }
            
        except Exception as e:
            logger.error(f"Error parsing project code: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _get_block_address(block: Dict[str, Any]) -> str:
        """Get unique address for a block"""
        if "address" in block:
            return block["address"]
        
        # Fallback for blocks without explicit address
        block_type = block.get("_metadata", {}).get("block_type", "unknown")
        if block_type == "resource":
            return f"{block.get('type', '')}.{block.get('name', '')}"
        elif block_type == "module":
            return f"module.{block.get('name', '')}"
        elif block_type == "data":
            return f"data.{block.get('type', '')}.{block.get('name', '')}"
        elif block_type == "output":
            return f"output.{block.get('name', '')}"
        elif block_type == "variable":
            return f"var.{block.get('name', '')}"
        elif block_type == "provider":
            return f"provider.{block.get('name', '')}"
        else:
            # For locals, terraform blocks, etc.
            return f"{block_type}.{block.get('_metadata', {}).get('file_name', 'unknown')}"
    
    @staticmethod
    def _compare_block_configs(main_block: Dict[str, Any], branch_block: Dict[str, Any]) -> Tuple[ChangeType, Optional[Dict[str, Any]]]:
        """
        Compare two blocks and determine change type with details
        
        Returns:
            Tuple of (ChangeType, diff_details)
        """
        main_config = main_block.get("config", {})
        branch_config = branch_block.get("config", {})
        
        # Quick check if configs are identical
        if main_config == branch_config:
            return ChangeType.NO_CHANGE, None
        
        # Calculate detailed differences
        diff_details = {
            "added_keys": [],
            "removed_keys": [],
            "modified_keys": []
        }
        
        main_keys = set(main_config.keys()) if isinstance(main_config, dict) else set()
        branch_keys = set(branch_config.keys()) if isinstance(branch_config, dict) else set()
        
        # Find added, removed, and modified keys
        diff_details["added_keys"] = list(branch_keys - main_keys)
        diff_details["removed_keys"] = list(main_keys - branch_keys)
        
        # Check for modified keys
        for key in main_keys & branch_keys:
            if main_config[key] != branch_config[key]:
                diff_details["modified_keys"].append({
                    "key": key,
                    "main_value": main_config[key],
                    "branch_value": branch_config[key]
                })
        
        return ChangeType.MODIFIED, diff_details
    
    @staticmethod
    def compare_project_configurations(project_id: str, source_branch: str, target_branch: str = "main") -> Dict[str, Any]:
        """
        Compare configurations between two branches and return detailed differences
        
        Args:
            project_id: Project identifier
            source_branch: Source branch to compare (e.g., feature branch)
            target_branch: Target branch to compare against (defaults to "main")
            
        Returns:
            Dictionary with detailed comparison results
        """
        try:
            # Parse configurations for both branches
            main_result = CodeService.parse_project_code(project_id, target_branch)
            branch_result = CodeService.parse_project_code(project_id, source_branch)
            
            if not main_result.get("success", False):
                return {
                    "success": False,
                    "error": f"Failed to parse {target_branch} branch: {main_result.get('error', 'Unknown error')}"
                }
            
            if not branch_result.get("success", False):
                return {
                    "success": False,
                    "error": f"Failed to parse {source_branch} branch: {branch_result.get('error', 'Unknown error')}"
                }
            
            main_blocks = main_result["data"]["blocks"]
            branch_blocks = branch_result["data"]["blocks"]
            
            # Create address-to-block mappings for efficient comparison
            main_block_map = {}
            for block_type, blocks in main_blocks.items():
                for block in blocks:
                    address = CodeService._get_block_address(block)
                    main_block_map[address] = block
            
            branch_block_map = {}
            for block_type, blocks in branch_blocks.items():
                for block in blocks:
                    address = CodeService._get_block_address(block)
                    branch_block_map[address] = block
            
            # Find all unique addresses
            all_addresses = set(main_block_map.keys()) | set(branch_block_map.keys())
            
            # Compare each block
            comparison_results = {}
            summary = {
                "added": 0,
                "deleted": 0,
                "modified": 0,
                "no_change": 0,
                "total": len(all_addresses)
            }
            
            for address in all_addresses:
                main_block = main_block_map.get(address)
                branch_block = branch_block_map.get(address)
                
                if main_block is None:
                    # Block only exists in branch (added)
                    change_type = ChangeType.ADDED
                    diff_details = None
                    block_info = branch_block
                elif branch_block is None:
                    # Block only exists in main (deleted)
                    change_type = ChangeType.DELETED
                    diff_details = None
                    block_info = main_block
                else:
                    # Block exists in both, compare configurations
                    change_type, diff_details = CodeService._compare_block_configs(main_block, branch_block)
                    block_info = branch_block
                
                # Update summary
                summary[change_type.value] += 1
                
                # Store comparison result
                comparison_results[address] = {
                    "address": address,
                    "change_type": change_type.value,
                    "block_type": block_info.get("_metadata", {}).get("block_type", "unknown") if block_info else "unknown",
                    "main_exists": main_block is not None,
                    "branch_exists": branch_block is not None,
                    "diff_details": diff_details,
                    "main_metadata": main_block.get("_metadata") if main_block else None,
                    "branch_metadata": branch_block.get("_metadata") if branch_block else None,
                    "main_config": main_block.get("config") if main_block else None,
                    "branch_config": branch_block.get("config") if branch_block else None
                }
            
            # Organize results by block type
            results_by_type = {}
            for address, result in comparison_results.items():
                block_type = result["block_type"]
                if block_type not in results_by_type:
                    results_by_type[block_type] = []
                results_by_type[block_type].append(result)
            
            return {
                "success": True,
                "data": {
                    "project_id": project_id,
                    "source_branch": source_branch,
                    "target_branch": target_branch,
                    "summary": summary,
                    "results_by_address": comparison_results,
                    "results_by_type": results_by_type,
                    "main_stats": main_result["data"],
                    "branch_stats": branch_result["data"]
                }
            }
            
        except Exception as e:
            logger.error(f"Error comparing project configurations: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }