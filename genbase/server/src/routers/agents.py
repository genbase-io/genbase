"""
FastAPI router for agent operations
Updated to include branch-specific tool configurations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Body, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import yaml

from src.services.git_service import GitService
from src.agents.prompts import render_main_branch_prompt, render_session_prompt
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
    
    # Tool result fields
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None


router = APIRouter(
    prefix="/projects/{project_id}/agent",
    tags=["agent"]
)

# Define tools for different branch types
MAIN_BRANCH_TOOLS = [
    # Read-only analysis tools for production safety
    "get_all_blocks_summary",
    "tf_read",
    "tf_validate", 
    "tf_plan",
    "render_form",
    
    # Registry tools for discovery and analysis
    "registry_search_modules",
    "registry_list_modules", 
    "registry_get_module_details",
    "registry_get_module_versions",
    "registry_get_module_downloads_summary",
    "registry_list_module_providers",
    "registry_get_module_download_info"
]

NON_MAIN_BRANCH_TOOLS = [
    # All infrastructure management tools
    "get_all_blocks_summary",
    "tf_read",
    "tf_write",
    "tf_modify", 
    "delete_file",
    "tf_validate",
    "tf_plan",
    "sync_with_main",
    "merge_changes",
    "create_tf_file",
    "create_folder",
    "render_form",
    
    # All registry tools for module discovery and implementation
    "registry_search_modules",
    "registry_list_modules",
    "registry_get_module_details", 
    "registry_get_module_versions",
    "registry_get_module_downloads_summary",
    "registry_list_module_providers",
    "registry_get_module_download_info"
]


@router.post("/messages", response_model=ChatMessageResponse)
async def send_agent_message(
    request: SendAgentMessageRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """
    Send a user message to the agent and get a response
    
    The session_id is provided in the request body to avoid URL encoding issues.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        # Check if this is a tool result
        if request.tool_call_id:
            # Add tool result to chat history
            tool_result, tool_result_message = ChatService.add_tool_result(
                project_id=project_id,
                session_id=request.session_id,
                tool_call_id=request.tool_call_id,
                name=request.tool_name or "unknown_tool",
                content=request.content
            )
            
            if not tool_result.get("success", False):
                return ChatMessageResponse(
                    success=False,
                    message="Failed to save tool result",
                    data={"error": tool_result.get("error", "Unknown error")}
                )
        else:
            # Add user message to the session
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
        
        # Configure agent based on branch type
        if request.session_id == config.MAIN_BRANCH:
            # MAIN BRANCH: Read-only analysis with registry discovery
            current_branch_summary = await AgentTools(project_id=project_id, branch=request.session_id).get_all_blocks_summary()
            system_prompt = render_main_branch_prompt(
                project_id=project_id,
                current_branch_summary=yaml.dump(current_branch_summary, sort_keys=False, default_flow_style=False)
            )

            agent_result = await AgentService(
                project_id=project_id, 
                session_id=request.session_id, 
                system_prompt=system_prompt,
                tools=MAIN_BRANCH_TOOLS
            ).process_message(
                model=request.model,
                temperature=request.temperature
            )

        else:
            # FEATURE BRANCH: Full modification capabilities
            current_branch_summary = await AgentTools(project_id=project_id, branch=request.session_id).get_all_blocks_summary()
            main_branch_summary = await AgentTools(project_id=project_id, branch=config.MAIN_BRANCH).get_all_blocks_summary()
            import asyncio
            sync_status_result = await asyncio.to_thread(
                GitService.check_branch_sync_status, 
                project_id, 
                request.session_id
            )
            sync_status: bool = sync_status_result['is_in_sync']
            agent_result = await AgentService(
                project_id=project_id, 
                session_id=request.session_id,
                tools=NON_MAIN_BRANCH_TOOLS,
                system_prompt=render_session_prompt(
                    project_id=project_id,
                    branch=request.session_id,
                    main_branch_summary=yaml.dump(main_branch_summary, sort_keys=False, default_flow_style=False),
                    current_branch_summary=yaml.dump(current_branch_summary, sort_keys=False, default_flow_style=False),
                    branch_sync_status="" if sync_status else "This branch or session is not in sync with the main branch. You may want to run `sync_with_main` tool to update it."
                )
            ).process_message(
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