"""
SQLAlchemy models
"""
from typing import Any, Dict
import litellm
from sqlalchemy import JSON, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base

from litellm import Message



class ChatMessage(Base):
    """
    Chat message model storing messages in LiteLLM format
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    
    # Session identification
    project_id = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)  # Git branch name
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # LiteLLM format fields
    role = Column(String, nullable=False)  # "user", "assistant", "system", "tool"
    content = Column(Text, nullable=True)  # Main message content
    
    # Tool-related fields (JSON format)
    tool_calls = Column(JSON, nullable=True)  # For assistant messages with tool calls
    tool_call_id = Column(String, nullable=True)  # For tool response messages
    name = Column(String, nullable=True)  # Tool name for tool messages
    
    # Additional LiteLLM fields
    reasoning_content = Column(Text, nullable=True)  # For o1 models
    annotations = Column(JSON, nullable=True)  # Citations, etc.
    
    
    def to_litellm_format(self) -> Dict[str, Any]:
        """Convert to LiteLLM message format"""
        # Start with required fields
        message = {
            "role": self.role,
            "content": self.content
        }
        
        # Add optional fields if they exist
        if self.tool_calls is not None:
            message["tool_calls"] = self.tool_calls
            
        if self.tool_call_id is not None:
            message["tool_call_id"] = self.tool_call_id
            
        if self.name is not None:
            message["name"] = self.name
            
        if self.reasoning_content is not None:
            message["reasoning_content"] = self.reasoning_content
            
        if self.annotations is not None:
            message["annotations"] = self.annotations
            
        
        return message