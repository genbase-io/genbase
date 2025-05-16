"""
FastAPI router for chat operations
"""
from fastapi import APIRouter, HTTPException, Path as PathParam, Body, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from src.schemas.api import ChatSessionResponse, ChatSessionListResponse, ChatMessageResponse, ChatMessageListResponse
from ..logger import logger
from ..services.project_service import ProjectService
from ..services.chat_service import ChatService


# Request models
class CreateChatSessionRequest(BaseModel):
    """Create chat session request"""
    title: Optional[str] = None



class SendMessageRequest(BaseModel):
    """Send message request"""
    session_id: str
    content: str



router = APIRouter(
    prefix="/projects/{project_id}/chat",
    tags=["chat"]
)


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    request: CreateChatSessionRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """
    Create a new chat session
    
    Creates a new chat session with a corresponding Git branch.
    The branch name follows the pattern: user/default/{session_number}
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = ChatService.create_chat_session(project_id, request.title)
        
        if not result.get("success", False):
            return ChatSessionResponse(
                success=False,
                message="Failed to create chat session",
                data={"error": result.get("error", "Unknown error")}
            )
        
        return ChatSessionResponse(
            success=True,
            message=result.get("message", "Chat session created successfully"),
            data=result.get("session", {})
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions", response_model=ChatSessionListResponse)
async def list_chat_sessions(
    project_id: str = PathParam(..., title="Project ID")
):
    """
    List all chat sessions for a project
    
    Returns all chat sessions with metadata including message counts,
    last activity, and Git branch information.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        sessions = ChatService.list_chat_sessions(project_id)
        
        return ChatSessionListResponse(
            success=True,
            message=f"Found {len(sessions)} chat sessions",
            data=sessions
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing chat sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions", response_model=ChatSessionResponse)
async def delete_chat_session(
    project_id: str = PathParam(..., title="Project ID"),
    session_id: str = Query(..., title="Session ID to delete")
):
    """
    Delete a chat session
    
    Deletes the chat session, all its messages, and the corresponding Git branch.
    This action cannot be undone.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = ChatService.delete_chat_session(project_id, session_id)
        
        if not result.get("success", False):
            return ChatSessionResponse(
                success=False,
                message="Failed to delete chat session",
                data={"error": result.get("error", "Unknown error")}
            )
        
        return ChatSessionResponse(
            success=True,
            message=result.get("message", "Chat session deleted successfully"),
            data={"deleted_messages": result.get("deleted_messages", 0)}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages", response_model=ChatMessageResponse)
async def send_message(
    request: SendMessageRequest,
    project_id: str = PathParam(..., title="Project ID")
):
    """
    Send a user message to a chat session
    
    Adds a user message to the specified chat session.
    The session_id is provided in the request body to avoid URL encoding issues.
    This will handle any pending tool calls automatically.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        result = ChatService.add_user_message(project_id, request.session_id, request.content)
        
        if not result.get("success", False):
            return ChatMessageResponse(
                success=False,
                message="Failed to send message",
                data={"error": result.get("error", "Unknown error")}
            )
        
        return ChatMessageResponse(
            success=True,
            message=result.get("message", "Message sent successfully"),
            data=result.get("message_data", {})
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/messages", response_model=ChatMessageListResponse)
async def get_messages(
    project_id: str = PathParam(..., title="Project ID"),
    session_id: str = Query(..., title="Session ID")
):
    """
    Get all messages in a chat session
    
    Returns all messages in the chat session in LiteLLM format,
    ordered by creation time. The session_id is provided as a query parameter.
    """
    try:
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
        
        messages = ChatService.get_messages(project_id, session_id)
        
        return ChatMessageListResponse(
            success=True,
            message=f"Retrieved {len(messages)} messages",
            data=messages
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))