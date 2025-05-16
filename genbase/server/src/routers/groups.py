"""
FastAPI router for group operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam

from src.schemas.api import GroupListResponse, GroupResponse, CreateGroupRequest
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.group_service import GroupService


router = APIRouter(
    prefix="/projects/{project_id}/groups",
    tags=["groups"]
)


@router.get("", response_model=GroupListResponse)
async def list_groups(project_id: str = PathParam(..., title="Project ID")):
    """List all groups in a project"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        groups = GroupService.list_groups(project_id)
        return GroupListResponse(
            success=True,
            data=groups
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing groups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{group_path:path}", response_model=GroupResponse)
async def get_group(
    project_id: str = PathParam(..., title="Project ID"),
    group_path: str = PathParam(..., title="Group path")
):
    """Get group details"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        group = GroupService.get_group(project_id, group_path)
        if not group:
            raise HTTPException(status_code=404, detail=f"Group not found: {group_path}")
        
        return GroupResponse(
            success=True,
            data=group
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=GroupResponse)
async def create_group(
    request: CreateGroupRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Create a new group"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        group = GroupService.create_group(
            project_id=project_id,
            name=request.name,
            parent_path=request.parent_path
        )
        
        return GroupResponse(
            success=True,
            message=f"Group '{request.name}' created successfully",
            data=group
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))