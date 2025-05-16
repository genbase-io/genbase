"""
Pydantic schemas for API validation
"""
from enum import Enum
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional


# Base response model
class ResponseBase(BaseModel):
    """Base response model"""
    success: bool = True
    message: Optional[str] = None


# Error response model
class ErrorResponse(ResponseBase):
    """Error response model"""
    success: bool = False
    error: Dict[str, Any] = Field(default_factory=dict)


class ResourceStatusResponse(ResponseBase):
    """Resource status response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class ProjectCodeResponse(ResponseBase):
    """Project code response"""
    data: Dict[str, Any] = Field(default_factory=dict)


# Project schemas
class ProjectListResponse(ResponseBase):
    """Project list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)


class ProjectResponse(ResponseBase):
    """Project response"""
    data: Dict[str, Any] = Field(default_factory=dict)

class CreateProjectRequest(BaseModel):
    """Create project request"""
    id: str
    
    @validator("id")
    def validate_id(cls, v):
        if not v or not v.strip():
            raise ValueError("Project ID cannot be empty")
        if len(v) > 64:
            raise ValueError("Project ID cannot exceed 64 characters")
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError("Project ID must contain only alphanumeric characters, hyphens, and underscores")
        return v.strip()

# Group schemas
class CreateGroupRequest(BaseModel):
    """Create group request"""
    name: str
    parent_path: str = ""
    
    @validator("name")
    def validate_name(cls, v):
        if not v or "/" in v or v in [".", ".."]:
            raise ValueError(f"Invalid group name: {v}")
        return v
    
    @validator("parent_path")
    def validate_parent_path(cls, v):
        if v:
            v = v.strip("/")
            # Ensure no directory traversal
            if ".." in v:
                raise ValueError("Directory traversal not allowed")
        return v


class GroupListResponse(ResponseBase):
    """Group list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)


class GroupResponse(ResponseBase):
    """Group response"""
    data: Dict[str, Any] = Field(default_factory=dict)


# TF operation schemas
class PlanResponse(ResponseBase):
    """Plan response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class ApplyResponse(ResponseBase):
    """Apply response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class DestroyResponse(ResponseBase):
    """Destroy response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class StateResponse(ResponseBase):
    """State response"""
    data: Dict[str, Any] = Field(default_factory=dict) 














# Variable schemas
class VariableType(str, Enum):
    """Variable type enum"""
    STRING = "string"
    NUMBER = "number"
    BOOL = "boolean"
    LIST = "list"
    MAP = "map"


class VariableRequest(BaseModel):
    """Create/update variable request"""
    name: str
    value: Any
    description: Optional[str] = None
    is_secret: bool = False
    type: VariableType = VariableType.STRING
    
    @validator("name")
    def validate_name(cls, v):
        if not v or not v.isidentifier():
            raise ValueError(f"Invalid variable name: {v}. Must be a valid Terraform identifier.")
        return v


class VariableListResponse(ResponseBase):
    """Variable list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)


class VariableResponse(ResponseBase):
    """Variable response"""
    data: Dict[str, Any] = Field(default_factory=dict)




# Workspace schemas
class WorkspaceListResponse(ResponseBase):
    """Workspace list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)


class WorkspaceResponse(ResponseBase):
    """Workspace response"""
    data: Dict[str, Any] = Field(default_factory=dict)



# Code response schemas (add these to the existing schemas/api.py file)

class CodeResponse(ResponseBase):
    """Code parsing response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class CodeStructureResponse(ResponseBase):
    """Code structure response"""
    data: Dict[str, Any] = Field(default_factory=dict)



class ChatSessionResponse(ResponseBase):
    """Chat session response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class ChatSessionListResponse(ResponseBase):
    """Chat session list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)


class ChatMessageResponse(ResponseBase):
    """Chat message response"""
    data: Dict[str, Any] = Field(default_factory=dict)


class ChatMessageListResponse(ResponseBase):
    """Chat message list response"""
    data: List[Dict[str, Any]] = Field(default_factory=list)