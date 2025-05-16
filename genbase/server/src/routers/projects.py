"""
FastAPI router for project operations
"""
import shutil
import os
from fastapi import APIRouter, HTTPException, Path as PathParam, Body
from typing import List, Dict, Any
from pydantic import BaseModel, validator

from src.schemas.api import ProjectListResponse, ProjectResponse, CreateProjectRequest
from ..logger import logger
from ..services.project_service import ProjectService


router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)


@router.get("", response_model=ProjectListResponse)
async def list_projects():
    """List all projects"""
    try:
        projects = ProjectService.list_projects()
        return ProjectListResponse(
            success=True,
            data=projects
        )
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str = PathParam(..., title="Project ID")):
    """Get project details"""
    try:
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        return ProjectResponse(
            success=True,
            data=project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ProjectResponse)
async def create_project(request: CreateProjectRequest = Body(...)):
    """Create a new project"""
    try:
        # Validate project ID
        if not request.id.isalnum() and not all(c in (request.id + '-_') for c in request.id):
            raise HTTPException(
                status_code=400, 
                detail="Project ID must contain only alphanumeric characters, hyphens, and underscores"
            )
        
        # Check if project already exists
        existing_project = ProjectService.get_project(request.id)
        if existing_project:
            raise HTTPException(
                status_code=409,
                detail=f"Project with ID '{request.id}' already exists"
            )
        
        # Create the project
        project = ProjectService.create_project(request.id)
        
        return ProjectResponse(
            success=True,
            message=f"Project '{request.id}' created successfully",
            data=project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))