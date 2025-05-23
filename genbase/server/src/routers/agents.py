"""
FastAPI router for agent operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Body, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

import yaml

from src.agents.prompts import MAIN_BRANCH_SYSTEM_PROMPT
from src.agents.tools import AgentTools
from src.schemas.api import ChatMessageResponse, ChatMessageListResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.chat_service import ChatService
from ..services.agent_service import AgentService

from  ..config import config



# Request models
class SendAgentMessageRequest(BaseModel):
    """Send message to agent request"""
    session_id: str
    content: str
    model: Optional[str] = None
    temperature: Optional[float] = None


router = APIRouter(
    prefix="/projects/{project_id}/agent",
    tags=["agent"]
)


@router.post("/messages", response_model=ChatMessageResponse)
async def send_agent_message(
    request: SendAgentMessageRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """
    Send a user message to the agent and get a response
    
    This endpoint:
    1. Adds the user message to the chat session
    2. Processes it with the agent
    3. The agent can use tools and add multiple messages to the session
    4. Returns the final agent message
    
    The session_id is provided in the request body to avoid URL encoding issues.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # First, add the user message to the session
        user_message_result = ChatService.add_user_message(
            project_id=project_id, 
            session_id=request.session_id, 
            content=request.content
        )
        
        if not user_message_result.get("success", False):
            return ChatMessageResponse(
                success=False,
                message="Failed to save user message",
                data={"error": user_message_result.get("error", "Unknown error")}
            )
        
        # Now, process the message with the agent
        if request.session_id  == config.MAIN_BRANCH:
            current_branch_summary = AgentTools(project_id=project_id, branch=request.session_id).get_all_blocks_summary()
            system_prompt = MAIN_BRANCH_SYSTEM_PROMPT.format(
                    project_id=project_id,
                    current_branch_summary=yaml.dump(current_branch_summary, sort_keys=False, default_flow_style=False) )

            agent_result = await AgentService(project_id=project_id, session_id=request.session_id, system_prompt=system_prompt).process_message(
                model=request.model,
                temperature=request.temperature
            )

        else:
            agent_result = await AgentService(project_id=project_id, session_id=request.session_id).process_message(
                model=request.model,
                temperature=request.temperature
            )
            
        if not agent_result.get("success", False):
            return ChatMessageResponse(
                success=False,
                message="Agent processing failed",
                data={"error": agent_result.get("error", "Unknown error")}
            )
        
        # Return the final message data
        return ChatMessageResponse(
            success=True,
            message="Message processed successfully",
            data=agent_result.get("final_message", {})
        )
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing agent message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))