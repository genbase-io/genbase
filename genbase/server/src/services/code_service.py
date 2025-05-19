"""
Enhanced CodeService with dependency analysis
"""
import json
import os
import re
import hcl2
from glob import glob
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum

from ..logger import logger
from .project_service import ProjectService
from .group_service import GroupService


class ReferenceType(str, Enum):
   """Types of references between Terraform entities"""
   RESOURCE_TO_RESOURCE = "resource_to_resource"
   MODULE_TO_RESOURCE = "module_to_resource"
   DATA_TO_RESOURCE = "data_to_resource"
   OUTPUT_TO_RESOURCE = "output_to_resource"
   VARIABLE_REFERENCE = "variable_reference"
   LOCAL_REFERENCE = "local_reference"
   DATASOURCE_DEPENDENCY = "datasource_dependency"
   MODULE_DEPENDENCY = "module_dependency"


class CodeService:
   """
   Enhanced service for reading, parsing, and analyzing Terraform code files with dependency tracking
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
   def _build_block_address_set(parsed_content: Dict[str, Any]) -> Set[str]:
       """
       Build a set of all valid block addresses from parsed content
       """
       all_addresses = set()
       
       for block_type, blocks in parsed_content.items():
           if block_type.startswith('_'):  # Skip metadata fields
               continue
               
           for block in blocks:
               if isinstance(block, dict) and 'address' in block:
                   all_addresses.add(block['address'])
               elif isinstance(block, dict):
                   # Fallback address generation for blocks without explicit address
                   if block_type == "resource":
                       addr = f"{block.get('type', '')}.{block.get('name', '')}"
                       if addr != ".":
                           all_addresses.add(addr)
                   elif block_type == "module":
                       addr = f"module.{block.get('name', '')}"
                       if addr != "module.":
                           all_addresses.add(addr)
                   elif block_type == "data":
                       addr = f"data.{block.get('type', '')}.{block.get('name', '')}"
                       if addr != "data..":
                           all_addresses.add(addr)
                   elif block_type == "output":
                       addr = f"output.{block.get('name', '')}"
                       if addr != "output.":
                           all_addresses.add(addr)
                   elif block_type == "variable":
                       addr = f"var.{block.get('name', '')}"
                       if addr != "var.":
                           all_addresses.add(addr)
                   elif block_type == "locals":
                       # For locals, we need to inspect the config to get individual local names
                       config = block.get('config', {})
                       if isinstance(config, dict):
                           for local_name in config.keys():
                               all_addresses.add(f"local.{local_name}")
       
       return all_addresses
   
   @staticmethod
   def _extract_references(value: Any, current_address: str, valid_addresses: Set[str]) -> List[Dict[str, Any]]:
       """
       Extract Terraform references from a value, only including references that exist in valid_addresses
       """
       references = []
       
       if isinstance(value, str):
           # Find all Terraform references in the string
           patterns = [
               r'\bvar\.([a-zA-Z_][a-zA-Z0-9_]*)',  # Variables
               r'\bmodule\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)',  # Module outputs
               r'\bdata\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)',  # Data sources
               r'\blocal\.([a-zA-Z_][a-zA-Z0-9_]*)',  # Local values
               r'\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)',  # Resources
           ]
           
           for pattern in patterns:
               matches = re.finditer(pattern, value)
               for match in matches:
                   target_address = None
                   ref_type = None
                   additional_info = {}
                   
                   if pattern == patterns[0]:  # Variable reference
                       target_address = f"var.{match.group(1)}"
                       ref_type = ReferenceType.VARIABLE_REFERENCE
                   elif pattern == patterns[1]:  # Module reference
                       target_address = f"module.{match.group(1)}"
                       ref_type = ReferenceType.MODULE_DEPENDENCY
                       additional_info["target_output"] = match.group(2)
                   elif pattern == patterns[2]:  # Data source reference
                       target_address = f"data.{match.group(1)}.{match.group(2)}"
                       ref_type = ReferenceType.DATASOURCE_DEPENDENCY
                       additional_info["target_attribute"] = match.group(3)
                   elif pattern == patterns[3]:  # Local reference
                       target_address = f"local.{match.group(1)}"
                       ref_type = ReferenceType.LOCAL_REFERENCE
                   elif pattern == patterns[4]:  # Resource reference
                       # Check if it's not a provider reference and not the same as current address
                       potential_target = f"{match.group(1)}.{match.group(2)}"
                       if not value.startswith('provider.') and potential_target != current_address:
                           target_address = potential_target
                           ref_type = ReferenceType.RESOURCE_TO_RESOURCE
                           additional_info["target_attribute"] = match.group(3)
                   
                   # Only add if the target address exists in our valid addresses and we have a valid reference type
                   if target_address and target_address in valid_addresses and ref_type is not None:
                       ref_data = {
                           "from": current_address,
                           "to": target_address,
                           "type": ref_type.value,
                           **additional_info
                       }
                       references.append(ref_data)
                       
       elif isinstance(value, dict):
           # Recursively process dictionary values
           for key, val in value.items():
               references.extend(CodeService._extract_references(val, current_address, valid_addresses))
               
       elif isinstance(value, list):
           # Recursively process list items
           for item in value:
               references.extend(CodeService._extract_references(item, current_address, valid_addresses))
               
       return references
   
   @staticmethod
   def _analyze_dependencies(parsed_content: Dict[str, Any]) -> List[Dict[str, Any]]:
       """
       Analyze dependencies and references between Terraform entities
       Returns a list of connection objects
       """
       # First, build the set of all valid addresses
       valid_addresses = CodeService._build_block_address_set(parsed_content)
       
       all_references = []
       
       # Extract references from all blocks
       for block_type, blocks in parsed_content.items():
           if block_type.startswith('_'):  # Skip metadata fields
               continue
               
           for block in blocks:
               if not isinstance(block, dict):
                   continue
                   
               block_address = block.get('address')
               if not block_address:
                   # Generate address for blocks without explicit address
                   if block_type == "resource":
                       block_address = f"{block.get('type', '')}.{block.get('name', '')}"
                   elif block_type == "module":
                       block_address = f"module.{block.get('name', '')}"
                   elif block_type == "data":
                       block_address = f"data.{block.get('type', '')}.{block.get('name', '')}"
                   elif block_type == "output":
                       block_address = f"output.{block.get('name', '')}"
                   elif block_type == "variable":
                       block_address = f"var.{block.get('name', '')}"
                   elif block_type == "locals":
                       # For locals, we need to process each local value separately
                       config = block.get('config', {})
                       if isinstance(config, dict):
                           for local_name, local_value in config.items():
                               local_address = f"local.{local_name}"
                               local_refs = CodeService._extract_references(local_value, local_address, valid_addresses)
                               all_references.extend(local_refs)
                       continue
                   else:
                       continue
               
               if not block_address or block_address in ['.', 'module.', 'data..', 'output.', 'var.']:
                   continue
               
               block_config = block.get('config', {})
               
               # Extract references from this block
               block_references = CodeService._extract_references(block_config, block_address, valid_addresses)
               all_references.extend(block_references)
       
       # Remove duplicates while preserving order
       seen = set()
       unique_references = []
       for ref in all_references:
           ref_key = (ref['from'], ref['to'], ref['type'])
           if ref_key not in seen:
               seen.add(ref_key)
               unique_references.append(ref)
       
       return unique_references

   @staticmethod
   def parse_project_code(project_id: str, branch: str = "main") -> Dict[str, Any]:
       """
       Parse all Terraform files in a project for a specific branch and return combined configuration with dependencies
       
       Args:
           project_id: Project identifier
           branch: Branch name (defaults to "main")
           
       Returns:
           Dictionary with all parsed configurations combined and dependency analysis
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
                       "blocks": {},
                       "dependencies": []
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
           
           # Perform dependency analysis
           dependencies = CodeService._analyze_dependencies(combined_config)
           
           result = {
               "project_id": project_id,
               "branch": branch,
               "files_processed": files_processed,
               "total_files": len(tf_files),
               "blocks": combined_config,
               "dependencies": dependencies
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