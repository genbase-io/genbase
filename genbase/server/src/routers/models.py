# genbase/server/src/routers/models.py

"""
FastAPI router for model operations
"""
from fastapi import APIRouter, Query
from typing import List
from pydantic import BaseModel

from ..services.model_service import ModelService
from ..logger import logger


class ModelsResponse(BaseModel):
    """Models list response"""
    success: bool
    message: str
    data: List[str]


router = APIRouter(
    prefix="/models",
    tags=["models"]
)


@router.get("", response_model=ModelsResponse)
async def get_available_models(
):
    """
    Get list of available LiteLLM models based on environment variables
    
    Args:
        check_provider_endpoint: If True, checks provider endpoints for available models
        
    Returns:
        List of available model names
    """
    try:
        models = ModelService.get_available_models()
        
        return ModelsResponse(
            success=True,
            message=f"Found {len(models)} available models",
            data=models
        )
        
    except Exception as e:
        logger.error(f"Error getting available models: {str(e)}")
        return ModelsResponse(
            success=False,
            message=f"Error getting models: {str(e)}",
            data=[]
        )