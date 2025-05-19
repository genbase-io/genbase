"""
Enhanced FastAPI router for code operations with branch support and dependency analysis
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException, Path as PathParam, Query
from typing import Optional

from src.schemas.api import CodeResponse, CodeStructureResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.code_service import CodeService


router = APIRouter(
   prefix="/projects/{project_id}/code",
   tags=["code"]
)


@router.get("/", response_model=CodeResponse)
async def parse_project_code(
   project_id: str = PathParam(..., title="Project ID"),
   branch: str = Query("main", title="Branch name")
):
   """
   Parse all Terraform files in the project for a specific branch and return structured configuration with dependencies
   
   This endpoint reads all .tf files in the project for the specified branch,
   converts them to JSON format, adds metadata (group path and file name) 
   to each configuration block, and analyzes dependencies between blocks. 
   All configurations are then combined into a single structured response.
   
   The response includes:
   - Parsed Terraform blocks organized by type (resource, module, data, etc.)
   - Dependency analysis showing connections between blocks
   - Metadata for each block (file location, group path)
   - Parse error information if any files failed to parse
   
   Args:
       project_id: The project identifier
       branch: The branch name (defaults to "main")
       
   Returns:
       CodeResponse with:
       - blocks: Organized Terraform configuration blocks
       - dependencies: Array of connections between blocks
       - metadata: Parsing statistics and file information
   """
   try:
       # Check if project exists
       project = ProjectService.get_project(project_id, branch)
       if not project:
           raise HTTPException(status_code=404, detail=f"Project not found: {project_id} (branch: {branch})")
       
       result = CodeService.parse_project_code(project_id, branch)
       
       if not result.get("success", False):
           return CodeResponse(
               success=False,
               message="Failed to parse project code",
               data={"error": result.get("error", "Unknown error")}
           )
       
       dependencies_count = len(result.get('data', {}).get('dependencies', []))
       return CodeResponse(
           success=True,
           message=f"Project code parsed successfully for branch '{branch}' with {dependencies_count} dependencies found",
           data=result.get("data", {})
       )
   except ValueError as e:
       raise HTTPException(status_code=400, detail=str(e))
   except HTTPException:
       raise
   except Exception as e:
       logger.error(f"Error parsing project code: {str(e)}")
       raise HTTPException(status_code=500, detail=str(e))


@router.get("/files", response_model=CodeResponse)
async def list_terraform_files(
   project_id: str = PathParam(..., title="Project ID"),
   branch: str = Query("main", title="Branch name")
):
   """
   List all Terraform files in the project for a specific branch with their paths
   
   This endpoint returns a list of all .tf files found in the project for the
   specified branch, organized by their group paths. Useful for understanding
   project structure and file organization.
   
   Args:
       project_id: The project identifier
       branch: The branch name (defaults to "main")
       
   Returns:
       CodeResponse with:
       - total_files: Total number of .tf files found
       - files_by_group: Files organized by their group/directory path
       - project and branch information
   """
   try:
       # Check if project exists
       project = ProjectService.get_project(project_id, branch)
       if not project:
           raise HTTPException(status_code=404, detail=f"Project not found: {project_id} (branch: {branch})")
       
       try:
           tf_files = CodeService.get_all_tf_files(project_id, branch)
           infra_path = ProjectService.get_infrastructure_path(project_id, branch)
           
           # Organize files by group
           files_by_group = {}
           
           for tf_file in tf_files:
               rel_path = tf_file.relative_to(infra_path)
               group_path = str(rel_path.parent) if rel_path.parent != Path(".") else ""
               
               if group_path not in files_by_group:
                   files_by_group[group_path] = []
               
               files_by_group[group_path].append({
                   "file_name": tf_file.stem,
                   "full_path": str(rel_path)
               })
           
           return CodeResponse(
               success=True,
               message=f"Found {len(tf_files)} Terraform files in branch '{branch}'",
               data={
                   "project_id": project_id,
                   "branch": branch,
                   "total_files": len(tf_files),
                   "files_by_group": files_by_group
               }
           )
           
       except ValueError as e:
           raise HTTPException(status_code=400, detail=str(e))
           
   except HTTPException:
       raise
   except Exception as e:
       logger.error(f"Error listing Terraform files: {str(e)}")
       raise HTTPException(status_code=500, detail=str(e))