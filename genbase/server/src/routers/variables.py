"""
FastAPI router for variable operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Query, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from enum import Enum

from src.schemas.api import VariableListResponse, VariableResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.variable_service import VariableService
from ..services.workspace_service import WorkspaceService


# Variable type enum
class VariableType(str, Enum):
    """Variable type enum"""
    STRING = "string"
    NUMBER = "number"
    BOOL = "boolean"
    LIST = "list"
    MAP = "map"


# Variable request model
class VariableRequest(BaseModel):
    """Create/update variable request"""
    name: str
    value: Any
    description: Optional[str] = None
    is_secret: bool = False
    type: VariableType = VariableType.STRING
    workspace: Optional[str] = None
    
    @validator("name")
    def validate_name(cls, v):
        if not v or not v.isidentifier():
            raise ValueError(f"Invalid variable name: {v}. Must be a valid Terraform identifier.")
        return v


router = APIRouter(
    prefix="/projects/{project_id}/variables",
    tags=["variables"]
)


@router.get("", response_model=VariableListResponse)
async def list_variables(
    project_id: str = PathParam(..., title="Project ID"),
    workspace: Optional[str] = Query(None, title="Workspace name")
):
    """
    List all variables in a project for a specific workspace
    
    Variables are managed at the project level only.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Get variables from the project
        try:
            variables = VariableService.list_variables(project_id, workspace)
            
            return VariableListResponse(
                success=True,
                data=variables
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing variables: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{variable_name}", response_model=VariableResponse)
async def get_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: Optional[str] = Query(None, title="Workspace name")
):
    """Get variable details"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Get the variable
        try:
            variable = VariableService.get_variable(project_id, variable_name, workspace)
            if not variable:
                raise HTTPException(status_code=404, detail=f"Variable not found: {variable_name}")
            
            return VariableResponse(
                success=True,
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=VariableResponse)
async def create_variable(
    request: VariableRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Create a new variable at the project level"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Create the variable
        try:
            variable = VariableService.create_or_update_variable(
                project_id=project_id,
                name=request.name,
                value=request.value,
                is_secret=request.is_secret,
                description=request.description,
                workspace=request.workspace
            )
            
            workspace_info = f" in workspace '{request.workspace}'" if request.workspace else ""
            
            return VariableResponse(
                success=True,
                message=f"Variable '{request.name}' created successfully{workspace_info}",
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{variable_name}", response_model=VariableResponse)
async def update_variable(
    request: VariableRequest,
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID")
):
    """Update a variable at the project level"""
    try:
        # Check if variable name in path matches request body
        if variable_name != request.name:
            raise HTTPException(
                status_code=400, 
                detail=f"Variable name in path ({variable_name}) doesn't match request body ({request.name})"
            )
        
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Check if variable exists and update it
        try:
            existing_var = VariableService.get_variable(project_id, variable_name, request.workspace)
            if not existing_var:
                raise HTTPException(status_code=404, detail=f"Variable not found: {variable_name}")
            
            variable = VariableService.create_or_update_variable(
                project_id=project_id,
                name=request.name,
                value=request.value,
                is_secret=request.is_secret,
                description=request.description,
                workspace=request.workspace
            )
            
            workspace_info = f" in workspace '{request.workspace}'" if request.workspace else ""
            
            return VariableResponse(
                success=True,
                message=f"Variable '{request.name}' updated successfully{workspace_info}",
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{variable_name}", response_model=VariableResponse)
async def delete_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: Optional[str] = Query(None, title="Workspace name")
):
    """Delete a variable at the project level"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Check if variable exists and delete it
        try:
            existing_var = VariableService.get_variable(project_id, variable_name, workspace)
            if not existing_var:
                raise HTTPException(status_code=404, detail=f"Variable not found: {variable_name}")
            
            success = VariableService.delete_variable(project_id, variable_name, workspace)
            
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to delete variable: {variable_name}")
            
            workspace_info = f" from workspace '{workspace}'" if workspace else ""
            
            return VariableResponse(
                success=True,
                message=f"Variable '{variable_name}' deleted successfully{workspace_info}",
                data={}
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))