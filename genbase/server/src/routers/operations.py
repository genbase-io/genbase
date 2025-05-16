"""
FastAPI router for TF operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Query, Body
from pydantic import BaseModel

from src.schemas.api import PlanResponse, ApplyResponse, DestroyResponse, StateResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.workspace_service import WorkspaceService
from ..services.tf_service import TofuService


# Define the request body model for operations
class OperationRequest(BaseModel):
    workspace: str = WorkspaceService.DEFAULT_WORKSPACE


router = APIRouter(
    prefix="/projects/{project_id}/operations",
    tags=["operations"]
)


@router.post("/plan", response_model=PlanResponse)
async def run_plan(
    request: OperationRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Run TF plan at the project root"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = TofuService.run_plan(project_id, request.workspace)
        
        if not result.get("success", False):
            return PlanResponse(
                success=False,
                message="Plan failed",
                data=result
            )
        
        return PlanResponse(
            success=True,
            message="Plan completed successfully",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply", response_model=ApplyResponse)
async def run_apply(
    request: OperationRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Apply TF plan at the project root"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = TofuService.run_apply(project_id, request.workspace)
        
        if not result.get("success", False):
            return ApplyResponse(
                success=False,
                message="Apply failed",
                data=result
            )
        
        return ApplyResponse(
            success=True,
            message="Apply completed successfully",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running apply: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/destroy", response_model=DestroyResponse)
async def run_destroy(
    request: OperationRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """Destroy TF resources at the project root"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = TofuService.run_destroy(project_id, request.workspace)
        
        if not result.get("success", False):
            return DestroyResponse(
                success=False,
                message="Destroy failed",
                data=result
            )
        
        return DestroyResponse(
            success=True,
            message="Destroy completed successfully",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running destroy: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state", response_model=StateResponse)
async def get_state(
    project_id: str = PathParam(..., title="Project ID"),
    workspace: str = Query(WorkspaceService.DEFAULT_WORKSPACE, title="Workspace name"),
    refresh: bool = Query(False, title="Refresh state")
):
    """Get TF state at the project root"""
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = TofuService.get_state(project_id, workspace=workspace, refresh=refresh)
        
        if not result.get("success", False):
            return StateResponse(
                success=False,
                message="Failed to get state",
                data=result
            )
        
        return StateResponse(
            success=True,
            message="State retrieved successfully",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting state: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))