"""
Enhanced FastAPI router for code operations with branch support
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
    Parse all Terraform files in the project for a specific branch and return structured configuration
    
    This endpoint reads all .tf files in the project for the specified branch,
    converts them to JSON format, and adds metadata (group path and file name) 
    to each configuration block. All configurations are then combined into a 
    single structured response.
    
    Args:
        project_id: The project identifier
        branch: The branch name (defaults to "main")
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
        
        return CodeResponse(
            success=True,
            message=f"Project code parsed successfully for branch '{branch}'",
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
    specified branch, organized by their group paths.
    
    Args:
        project_id: The project identifier
        branch: The branch name (defaults to "main")
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


@router.get("/compare", response_model=CodeResponse)
async def compare_configurations(
    project_id: str = PathParam(..., title="Project ID"),
    source_branch: str = Query(..., title="Source branch to compare"),
    target_branch: str = Query("main", title="Target branch to compare against")
):
    """
    Compare Terraform configurations between two branches
    
    This endpoint compares all Terraform configurations between a source branch
    and a target branch (defaults to main). It provides detailed information about:
    - Added blocks (exist only in source branch)
    - Deleted blocks (exist only in target branch)
    - Modified blocks (exist in both but with different configurations)
    - Unchanged blocks (identical in both branches)
    
    Args:
        project_id: The project identifier
        source_branch: The source branch to compare (e.g., feature branch)
        target_branch: The target branch to compare against (defaults to "main")
    """
    try:
        # Check if project exists (verify both branches)
        project_main = ProjectService.get_project(project_id, target_branch)
        project_branch = ProjectService.get_project(project_id, source_branch)
        
        if not project_main:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id} (target branch: {target_branch})")
        
        if not project_branch:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id} (source branch: {source_branch})")
        
        result = CodeService.compare_project_configurations(project_id, source_branch, target_branch)
        
        if not result.get("success", False):
            return CodeResponse(
                success=False,
                message="Failed to compare project configurations",
                data={"error": result.get("error", "Unknown error")}
            )
        
        return CodeResponse(
            success=True,
            message=f"Successfully compared configurations between '{source_branch}' and '{target_branch}'",
            data=result.get("data", {})
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing configurations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


