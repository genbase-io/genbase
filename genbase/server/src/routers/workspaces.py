"""
FastAPI router for workspace operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from src.schemas.api import WorkspaceListResponse, WorkspaceResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.workspace_service import WorkspaceService


# Workspace request model
class WorkspaceRequest(BaseModel):
    """Create workspace request"""
    name: str
    
    class Config:
        schema_extra = {
            "example": {
                "name": "dev"
            }
        }


router = APIRouter(
    prefix="/projects/{project_id}/workspaces",
    tags=["workspaces"]
)


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    project_id: str = PathParam(..., title="Project ID")
):
    """
    List all workspaces in a project
    
    Workspaces are managed at the project level.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        try:
            workspaces = WorkspaceService.list_workspaces(project_id)
            
            return WorkspaceListResponse(
                success=True,
                data=workspaces
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing workspaces: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=WorkspaceResponse)
async def create_workspace(
    request: WorkspaceRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Create a new workspace at the project level"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        try:
            result = WorkspaceService.create_workspace(project_id, request.name)
            
            # Check if the workspace already existed
            if not result.get("success", True):
                raise HTTPException(status_code=400, detail=result.get("error", "Failed to create workspace"))
                
            if result.get("already_exists", False):
                return WorkspaceResponse(
                    success=True,
                    message=f"Workspace '{request.name}' already exists",
                    data=result
                )
            
            return WorkspaceResponse(
                success=True,
                message=f"Workspace '{request.name}' created successfully",
                data=result
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workspace: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/{workspace_name}", response_model=WorkspaceResponse)
async def delete_workspace(
    workspace_name: str,
    project_id: str = PathParam(..., title="Project ID")
):
    """Delete a workspace at the project level"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        try:
            # Cannot delete default workspace
            if workspace_name == WorkspaceService.DEFAULT_WORKSPACE:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete the default workspace"
                )
                
            result = WorkspaceService.delete_workspace(project_id, workspace_name)
            
            # Check if there was an error
            if not result.get("success", True):
                raise HTTPException(status_code=400, detail=result.get("error", "Failed to delete workspace"))
                
            # Check if the workspace was already deleted
            if result.get("already_deleted", False):
                return WorkspaceResponse(
                    success=True,
                    message=f"Workspace '{workspace_name}' does not exist or is already deleted",
                    data=result
                )
            
            return WorkspaceResponse(
                success=True,
                message=f"Workspace '{workspace_name}' deleted successfully",
                data=result
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workspace: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))