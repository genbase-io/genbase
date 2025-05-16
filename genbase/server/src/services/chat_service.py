"""
Updated ChatService with native worktree integration
"""
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from ..database import get_db
from ..models import ChatMessage
from ..logger import logger
from .project_service import ProjectService
from .git_service import GitService


class ChatService:
    """
    Service for managing AI chat sessions with native worktree support
    
    Each chat session corresponds to a Git branch with its own worktree
    for isolated concurrent access.
    """
    
    DEFAULT_USER_ID = "default"
    
    @staticmethod
    def create_chat_session(project_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new chat session with corresponding Git branch and worktree
        
        Args:
            project_id: The project identifier
            title: Optional title for the chat session (not stored, just returned)
            
        Returns:
            Dictionary with session information
        """
        try:
            # Check if project exists
            project = ProjectService.get_project(project_id)
            if not project:
                return {
                    "success": False,
                    "error": f"Project not found: {project_id}"
                }
            
            # Get existing chat branches to determine next session number
            chat_branches = GitService.list_chat_branches(project_id)
            next_session_number = 1
            
            if chat_branches:
                # Get the highest session number and add 1
                max_session = max(branch["session_number"] for branch in chat_branches)
                next_session_number = max_session + 1
            
            # Create branch name
            user_id = ChatService.DEFAULT_USER_ID
            branch_name = f"user/{user_id}/{next_session_number}"
            
            # Initialize Git repository if not already initialized
            GitService.init_repository(project_id)
            
            # Create Git branch with worktree (this is the key change)
            git_result = GitService.create_branch_with_worktree(project_id, branch_name)
            if not git_result.get("success", False):
                return {
                    "success": False,
                    "error": f"Failed to create Git branch with worktree: {git_result.get('error', 'Unknown error')}"
                }
            
            # Get the infrastructure path for this session's worktree
            infra_path = GitService.get_infrastructure_path(project_id, branch_name)
            
            logger.info(f"Created chat session {branch_name} with worktree for project {project_id}")
            
            return {
                "success": True,
                "message": "Chat session created successfully",
                "session": {
                    "session_id": branch_name,
                    "session_number": next_session_number,
                    "title": title or f"Chat Session {next_session_number}",
                    "project_id": project_id,
                    "created_at": datetime.now().isoformat(),
                    "message_count": 0,
                    "infrastructure_path": str(infra_path),
                    "worktree_path": git_result.get("worktree_path")
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating chat session: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def delete_chat_session(project_id: str, session_id: str) -> Dict[str, Any]:
        """
        Delete a chat session, its Git branch, and worktree
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            
        Returns:
            Dictionary with success status
        """
        try:
            # Check if project exists
            project = ProjectService.get_project(project_id)
            if not project:
                return {
                    "success": False,
                    "error": f"Project not found: {project_id}"
                }
            
            # Get database session
            db: Session = next(get_db())
            
            try:
                # Delete all messages for this session
                deleted_count = db.query(ChatMessage)\
                    .filter(ChatMessage.project_id == project_id)\
                    .filter(ChatMessage.session_id == session_id)\
                    .delete()
                
                db.commit()
                
                # Delete Git branch with worktree (this is the key change)
                git_result = GitService.delete_branch_with_worktree(project_id, session_id)
                
                if not git_result.get("success", False):
                    # Rollback message deletion if Git delete failed
                    db.rollback()
                    return {
                        "success": False,
                        "error": f"Failed to delete Git branch with worktree: {git_result.get('error', 'Unknown error')}"
                    }
                
                logger.info(f"Deleted chat session {session_id} with {deleted_count} messages and worktree")
                
                return {
                    "success": True,
                    "message": f"Chat session deleted successfully",
                    "deleted_messages": deleted_count
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error deleting chat session: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def get_session_infrastructure_path(project_id: str, session_id: str) -> Optional[str]:
        """
        Get the infrastructure path for a specific chat session
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            
        Returns:
            Infrastructure path for the session or None if not found
        """
        try:
            # For main branch (shouldn't be used as session but handle gracefully)
            if session_id == "main":
                return str(ProjectService.get_infrastructure_path(project_id, "main"))
            
            # For chat session branches, get the worktree path
            infra_path = GitService.get_infrastructure_path(project_id, session_id)
            
            if infra_path and infra_path.exists():
                return str(infra_path)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting session infrastructure path: {str(e)}")
            return None
    
    # All other methods remain the same - no changes needed
    @staticmethod
    def list_chat_sessions(project_id: str) -> List[Dict[str, Any]]:
        """
        List all chat sessions for a project
        
        Args:
            project_id: The project identifier
            
        Returns:
            List of chat session information
        """
        try:
            # Check if project exists
            project = ProjectService.get_project(project_id)
            if not project:
                raise ValueError(f"Project not found: {project_id}")
            
            # Get chat branches from Git
            chat_branches = GitService.list_chat_branches(project_id)
            
            # Get database session
            db: Session = next(get_db())
            
            sessions = []
            
            for branch in chat_branches:
                branch_name = branch["branch_name"]
                
                # Get message count for this session
                message_count = db.query(ChatMessage)\
                    .filter(ChatMessage.project_id == project_id)\
                    .filter(ChatMessage.session_id == branch_name)\
                    .count()
                
                # Get last message timestamp
                last_message = db.query(ChatMessage)\
                    .filter(ChatMessage.project_id == project_id)\
                    .filter(ChatMessage.session_id == branch_name)\
                    .order_by(desc(ChatMessage.created_at))\
                    .first()
                
                last_message_at = None
                if last_message:
                    last_message_at = last_message.created_at.isoformat()
                elif branch["last_commit_date"]:
                    # Use Git commit date as fallback
                    last_message_at = branch["last_commit_date"]
                
                # Get infrastructure path for this session
                infrastructure_path = ChatService.get_session_infrastructure_path(project_id, branch_name)
                
                sessions.append({
                    "session_id": branch_name,
                    "session_number": branch["session_number"],
                    "title": f"Chat Session {branch['session_number']}",
                    "project_id": project_id,
                    "message_count": message_count,
                    "last_message_at": last_message_at,
                    "last_commit_date": branch["last_commit_date"],
                    "last_commit_message": branch["last_commit_message"],
                    "infrastructure_path": infrastructure_path,
                    "worktree_exists": branch.get("worktree_exists", False)
                })
            
            db.close()
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error listing chat sessions: {str(e)}")
            return []
    
    @staticmethod
    def add_user_message(project_id: str, session_id: str, content: str) -> Dict[str, Any]:
        """
        Add a user message to a chat session
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            content: Message content
            
        Returns:
            Dictionary with message information
        """
        try:
            return ChatService._add_message(
                project_id=project_id,
                session_id=session_id,
                role="user",
                content=content
            )
            
        except Exception as e:
            logger.error(f"Error adding user message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def add_agent_message(
        project_id: str, 
        session_id: str, 
        content: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        reasoning_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add an agent (assistant) message to a chat session
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            content: Message content
            tool_calls: Tool calls made by the agent
            reasoning_content: Reasoning content for o1 models
            
        Returns:
            Dictionary with message information
        """
        try:
            return ChatService._add_message(
                project_id=project_id,
                session_id=session_id,
                role="assistant",
                content=content,
                tool_calls=tool_calls,
                reasoning_content=reasoning_content
            )
            
        except Exception as e:
            logger.error(f"Error adding agent message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def add_tool_result(
        project_id: str, 
        session_id: str,
        tool_call_id: str,
        name: str,
        content: str
    ) -> Dict[str, Any]:
        """
        Add a tool result message to a chat session
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            tool_call_id: ID of the tool call this is responding to
            name: Name of the tool
            content: Tool execution result
            
        Returns:
            Dictionary with message information
        """
        try:
            return ChatService._add_message(
                project_id=project_id,
                session_id=session_id,
                role="tool",
                content=content,
                tool_call_id=tool_call_id,
                name=name
            )
            
        except Exception as e:
            logger.error(f"Error adding tool result: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _add_message(
        project_id: str,
        session_id: str,
        role: str,
        content: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        tool_call_id: Optional[str] = None,
        name: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        annotations: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Internal method to add a message to a chat session
        """
        # Check if project exists
        project = ProjectService.get_project(project_id)
        if not project:
            return {
                "success": False,
                "error": f"Project not found: {project_id}"
            }
        
        # Verify that the session exists by checking if branch exists
        chat_branches = GitService.list_chat_branches(project_id)
        branch_exists = any(branch["branch_name"] == session_id for branch in chat_branches)
        
        if not branch_exists:
            return {
                "success": False,
                "error": f"Chat session not found: {session_id}"
            }
        
        # Get database session
        db: Session = next(get_db())
        
        try:
            # Handle tool call validation
            if role != "tool":
                # Check for pending tool calls that need responses
                ChatService._handle_pending_tool_calls(db, project_id, session_id)
            
            # Create new message
            message = ChatMessage(
                project_id=project_id,
                session_id=session_id,
                role=role,
                content=content,
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
                name=name,
                reasoning_content=reasoning_content,
                annotations=annotations
            )
            
            db.add(message)
            db.commit()
            db.refresh(message)
            
            logger.info(f"Added {role} message to session {session_id}")
            
            return {
                "success": True,
                "message": "Message added successfully",
                "message_data": {
                    "id": message.id,
                    "role": message.role,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                    "litellm_format": message.to_litellm_format()
                }
            }
            
        finally:
            db.close()
    
    @staticmethod
    def _handle_pending_tool_calls(db: Session, project_id: str, session_id: str):
        """
        Handle pending tool calls by adding failed responses if missing
        """
        # Get the last assistant message with tool calls
        last_assistant_msg = db.query(ChatMessage)\
            .filter(ChatMessage.project_id == project_id)\
            .filter(ChatMessage.session_id == session_id)\
            .filter(ChatMessage.role == "assistant")\
            .filter(ChatMessage.tool_calls.isnot(None))\
            .order_by(desc(ChatMessage.created_at))\
            .first()
        
        if not last_assistant_msg or last_assistant_msg.tool_calls is None:
            return
        
        # Get all tool call IDs from the last assistant message
        tool_call_ids = [call["id"] for call in last_assistant_msg.tool_calls if "id" in call]
        
        if not tool_call_ids:
            return
        
        # Check which tool calls already have responses
        existing_responses = db.query(ChatMessage.tool_call_id)\
            .filter(ChatMessage.project_id == project_id)\
            .filter(ChatMessage.session_id == session_id)\
            .filter(ChatMessage.role == "tool")\
            .filter(ChatMessage.tool_call_id.in_(tool_call_ids))\
            .filter(ChatMessage.created_at > last_assistant_msg.created_at)\
            .all()
        
        existing_tool_call_ids = [response.tool_call_id for response in existing_responses]
        
        # Add failed responses for missing tool calls
        for tool_call in last_assistant_msg.tool_calls:
            if tool_call.get("id") not in existing_tool_call_ids:
                failed_message = ChatMessage(
                    project_id=project_id,
                    session_id=session_id,
                    role="tool",
                    content="Tool call failed",
                    tool_call_id=tool_call.get("id"),
                    name=tool_call.get("function", {}).get("name", "unknown")
                )
                db.add(failed_message)
        
        db.commit()
    
    @staticmethod
    def get_messages(project_id: str, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all messages in a chat session in LiteLLM format
        
        Args:
            project_id: The project identifier
            session_id: The session identifier (branch name)
            
        Returns:
            List of messages in LiteLLM format
        """
        try:
            # Check if project exists
            project = ProjectService.get_project(project_id)
            if not project:
                raise ValueError(f"Project not found: {project_id}")
            
            # Verify that the session exists
            chat_branches = GitService.list_chat_branches(project_id)
            branch_exists = any(branch["branch_name"] == session_id for branch in chat_branches)
            
            if not branch_exists:
                raise ValueError(f"Chat session not found: {session_id}")
            
            # Get database session
            db: Session = next(get_db())
            
            try:
                # Get all messages for this session, ordered by creation time
                messages = db.query(ChatMessage)\
                    .filter(ChatMessage.project_id == project_id)\
                    .filter(ChatMessage.session_id == session_id)\
                    .order_by(asc(ChatMessage.created_at))\
                    .all()
                
                # Convert to LiteLLM format
                litellm_messages = [message.to_litellm_format() for message in messages]
                
                return litellm_messages
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting messages: {str(e)}")
            return []