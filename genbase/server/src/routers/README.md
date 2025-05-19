# Genbase API Routers

## Router Overview

### `/projects` - Project Management
**File**: `projects.py`

Handles the core project lifecycle operations. Projects are the top-level containers for infrastructure configurations.

**Key Endpoints**:
- `GET /projects` - List all available projects
- `GET /projects/{project_id}` - Get detailed information about a specific project
- `POST /projects` - Create a new project with Git initialization

**Usage Examples**:
```python
# Create a new project
{
  "id": "my-web-app"
}

# Response includes project paths and statistics
{
  "success": true,
  "data": {
    "id": "my-web-app",
    "path": "/projects/my-web-app",
    "infrastructure_path": "/projects/my-web-app/infrastructure",
    "group_count": 0,
    "file_count": 2
  }
}
```

### `/projects/{project_id}/groups` - Organization Structure
**File**: `groups.py`

Manages organizational directories within projects. Groups help structure Terraform files logically (e.g., networking, compute, storage).

**Key Endpoints**:
- `GET /groups` - List all groups in a project
- `GET /groups/{group_path}` - Get details about a specific group
- `POST /groups` - Create a new organizational group

**Key Features**:
- Nested group structure support
- File counting per group
- Automatic path validation
- Reserved name protection

**Usage Example**:
```python
# Create a networking group
{
  "name": "networking",
  "parent_path": ""
}

# Create a subnet subgroup
{
  "name": "subnets", 
  "parent_path": "networking"
}
```

### `/projects/{project_id}/operations` - Infrastructure Operations
**File**: `operations.py`

Executes Terraform/OpenTofu operations at the project level. All operations work with the entire project's infrastructure configuration.

**Key Endpoints**:
- `POST /operations/plan` - Generate execution plan
- `POST /operations/apply` - Apply infrastructure changes
- `POST /operations/destroy` - Destroy infrastructure resources
- `GET /operations/state` - Get current infrastructure state

**Request Format**:
```python
{
  "workspace": "dev"  # Optional, defaults to "default"
}
```

**Features**:
- JSON plan output for frontend visualization
- Workspace-specific operations
- Automatic variable file inclusion
- Comprehensive error reporting

### `/projects/{project_id}/variables` - Configuration Management
**File**: `variables.py`

Manages Terraform variables using JSON files. Supports both regular and secret variables with workspace isolation.

**Key Endpoints**:
- `GET /variables` - List all variables for a workspace
- `GET /variables/{variable_name}` - Get specific variable details
- `POST /variables` - Create new variable
- `PUT /variables/{variable_name}` - Update existing variable
- `DELETE /variables/{variable_name}` - Remove variable

**Variable Types Supported**:
- `string`, `number`, `boolean`, `list`, `map`

**Storage Strategy**:
- Regular variables: `terraform.tfvars.json` or `{workspace}.terraform.tfvars.json`
- Secret variables: `secrets.auto.tfvars.json` or `{workspace}.secrets.auto.tfvars.json`

**Example**:
```python
# Create a secret database password
{
  "name": "db_password",
  "value": "super-secret-password",
  "is_secret": true,
  "type": "string",
  "workspace": "prod"
}
```

### `/projects/{project_id}/workspaces` - Environment Management
**File**: `workspaces.py`

Manages Terraform workspaces for environment isolation (dev, staging, prod, etc.).

**Key Endpoints**:
- `GET /workspaces` - List all workspaces in project
- `POST /workspaces` - Create new workspace
- `POST /workspaces/select` - Switch to specific workspace
- `DELETE /workspaces/{workspace_name}` - Delete workspace

**Special Behaviors**:
- Cannot delete the "default" workspace
- Creating a workspace automatically switches to it
- Workspace selection affects all subsequent operations

### `/projects/{project_id}/code` - Infrastructure Analysis
**File**: `code.py`

Provides deep analysis and parsing of Terraform configurations. Converts HCL to structured JSON for frontend consumption.

**Key Endpoints**:
- `GET /code/` - Parse all Terraform files in project
- `GET /code/files` - List all .tf files with organization
- `GET /code/compare` - Compare configurations between branches

**Parsing Features**:
- Converts HCL to structured JSON
- Adds metadata (file location, block types)
- Handles all Terraform block types (resource, module, data, etc.)
- Groups configurations by file and directory

**Comparison Capabilities**:
- Identifies added, deleted, and modified resources
- Detailed diff information
- Cross-branch configuration analysis

**Example Output**:
```python
{
  "resource": [
    {
      "type": "aws_instance",
      "name": "web_server",
      "address": "aws_instance.web_server",
      "config": {
        "ami": "ami-12345",
        "instance_type": "t3.micro"
      },
      "_metadata": {
        "group_path": "compute",
        "file_name": "main",
        "block_type": "resource"
      }
    }
  ]
}
```

### `/projects/{project_id}/chat` - AI Conversations
**File**: `chat.py`

Manages AI chat sessions with integrated infrastructure operations. Each session provides an isolated environment for infrastructure discussions.

**Key Endpoints**:
- `POST /chat/sessions` - Create new chat session
- `GET /chat/sessions` - List all chat sessions
- `DELETE /chat/sessions` - Delete session and cleanup
- `POST /chat/messages` - Send user message to session
- `GET /chat/messages` - Retrieve conversation history

**Session Management**:
- Each session creates an isolated working environment
- Sessions are identified by branch-style names
- Automatic cleanup of associated resources

**Message Format** (LiteLLM Compatible):
```python
{
  "role": "user|assistant|system|tool",
  "content": "message text",
  "tool_calls": [...],      # For assistant messages
  "tool_call_id": "...",    # For tool responses
  "reasoning_content": "..."  # For advanced models
}
```

**Integration Features**:
- Tool calling for infrastructure operations
- Persistent conversation history
- Session-specific infrastructure changes

## Common Patterns

### Error Handling
All routers follow consistent error handling:
- `400` - Validation errors (malformed input)
- `404` - Resource not found
- `409` - Conflict (e.g., duplicate names)
- `500` - Internal server errors

### Response Format
Standard response structure across all endpoints:
```python
{
  "success": true|false,
  "message": "Human readable message",
  "data": {...}  # Endpoint-specific data
}
```

