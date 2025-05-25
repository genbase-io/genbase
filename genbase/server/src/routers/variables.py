"""
FastAPI router for variable operations - Workspace-specific only, including Environment variables
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
    workspace: str  # Now required
    
    @validator("name")
    def validate_name(cls, v):
        if not v or not v.isidentifier():
            raise ValueError(f"Invalid variable name: {v}. Must be a valid Terraform identifier.")
        return v
    
    @validator("workspace")
    def validate_workspace(cls, v):
        if not v or not v.strip():
            raise ValueError("Workspace is required for variable operations.")
        return v.strip()


# Environment variable request model  
class EnvVariableRequest(BaseModel):
    """Create/update environment variable request"""
    name: str
    value: str
    workspace: str  # Required
    
    @validator("name")
    def validate_name(cls, v):
        if not v or not v.replace('_', '').isalnum():
            raise ValueError(f"Invalid environment variable name: {v}. Must contain only letters, numbers, and underscores.")
        return v
    
    @validator("workspace")
    def validate_workspace(cls, v):
        if not v or not v.strip():
            raise ValueError("Workspace is required for environment variable operations.")
        return v.strip()


router = APIRouter(
    prefix="/projects/{project_id}/variables",
    tags=["variables"]
)


@router.get("", response_model=VariableListResponse)
async def list_variables(
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """
    List all variables in a project for a specific workspace
    
    Variables are managed per workspace only.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is now required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
        # Get variables from the project workspace
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


@router.get("/env", response_model=VariableListResponse)
async def list_env_variables(
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """
    List all environment variables in a project for a specific workspace
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
        # Get environment variables from the project workspace
        try:
            env_variables = VariableService.list_env_variables(project_id, workspace)
            
            return VariableListResponse(
                success=True,
                data=env_variables
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing environment variables: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{variable_name}", response_model=VariableResponse)
async def get_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """Get variable details from a specific workspace"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is now required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
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


@router.get("/env/{variable_name}", response_model=VariableResponse)
async def get_env_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """Get environment variable details from a specific workspace"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
        # Get the environment variable
        try:
            variable = VariableService.get_env_variable(project_id, variable_name, workspace)
            if not variable:
                raise HTTPException(status_code=404, detail=f"Environment variable not found: {variable_name}")
            
            return VariableResponse(
                success=True,
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting environment variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=VariableResponse)
async def create_variable(
    request: VariableRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Create a new variable in a specific workspace"""
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
                workspace=request.workspace,
                is_secret=request.is_secret,
                description=request.description
            )
            
            return VariableResponse(
                success=True,
                message=f"Variable '{request.name}' created successfully in workspace '{request.workspace}'",
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/env", response_model=VariableResponse)
async def create_env_variable(
    request: EnvVariableRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Create a new environment variable in a specific workspace"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Create the environment variable
        try:
            env_variable = VariableService.create_or_update_env_variable(
                project_id=project_id,
                name=request.name,
                value=request.value,
                workspace=request.workspace
            )
            
            return VariableResponse(
                success=True,
                message=f"Environment variable '{request.name}' created successfully in workspace '{request.workspace}'",
                data=env_variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating environment variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{variable_name}", response_model=VariableResponse)
async def update_variable(
    request: VariableRequest,
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID")
):
    """Update a variable in a specific workspace"""
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
                workspace=request.workspace,
                is_secret=request.is_secret,
                description=request.description
            )
            
            return VariableResponse(
                success=True,
                message=f"Variable '{request.name}' updated successfully in workspace '{request.workspace}'",
                data=variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/env/{variable_name}", response_model=VariableResponse)
async def update_env_variable(
    request: EnvVariableRequest,
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID")
):
    """Update an environment variable in a specific workspace"""
    try:
        # Check if variable name in path matches request body
        if variable_name != request.name:
            raise HTTPException(
                status_code=400, 
                detail=f"Environment variable name in path ({variable_name}) doesn't match request body ({request.name})"
            )
        
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Check if environment variable exists and update it
        try:
            existing_var = VariableService.get_env_variable(project_id, variable_name, request.workspace)
            if not existing_var:
                raise HTTPException(status_code=404, detail=f"Environment variable not found: {variable_name}")
            
            env_variable = VariableService.create_or_update_env_variable(
                project_id=project_id,
                name=request.name,
                value=request.value,
                workspace=request.workspace
            )
            
            return VariableResponse(
                success=True,
                message=f"Environment variable '{request.name}' updated successfully in workspace '{request.workspace}'",
                data=env_variable
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating environment variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{variable_name}", response_model=VariableResponse)
async def delete_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """Delete a variable from a specific workspace"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is now required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
        # Check if variable exists and delete it
        try:
            existing_var = VariableService.get_variable(project_id, variable_name, workspace)
            if not existing_var:
                raise HTTPException(status_code=404, detail=f"Variable not found: {variable_name}")
            
            success = VariableService.delete_variable(project_id, variable_name, workspace)
            
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to delete variable: {variable_name}")
            
            return VariableResponse(
                success=True,
                message=f"Variable '{variable_name}' deleted successfully from workspace '{workspace}'",
                data={}
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/env/{variable_name}", response_model=VariableResponse)
async def delete_env_variable(
    variable_name: str,
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(..., title="Workspace name (required)")
):
    """Delete an environment variable from a specific workspace"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Workspace is required
        if not workspace:
            raise HTTPException(status_code=400, detail="Workspace parameter is required")
        
        # Check if environment variable exists and delete it
        try:
            existing_var = VariableService.get_env_variable(project_id, variable_name, workspace)
            if not existing_var:
                raise HTTPException(status_code=404, detail=f"Environment variable not found: {variable_name}")
            
            success = VariableService.delete_env_variable(project_id, variable_name, workspace)
            
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to delete environment variable: {variable_name}")
            
            return VariableResponse(
                success=True,
                message=f"Environment variable '{variable_name}' deleted successfully from workspace '{workspace}'",
                data={}
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting environment variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))