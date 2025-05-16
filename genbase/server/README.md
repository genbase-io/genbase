# Genbase API

This API provides a RESTful interface to manage OpenTofu (TF) projects, directories, and operations.

## API Overview

The API allows you to:

1. Manage projects
2. Create and manage groups (directories) within projects
3. Perform TF operations (plan, apply, destroy, state)

## Project Structure

```
server/
├── src/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── projects.py    # Project endpoints
│   │   ├── groups.py      # Group endpoints
│   │   └── operations.py  # TF operation endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   ├── project_service.py  # Project management
│   │   ├── group_service.py    # Group management
│   │   └── tf_service.py     # TF operations
│   ├── __init__.py
│   ├── config.py         # Application configuration
│   ├── database.py       # Database connection
│   ├── logger.py         # Logging setup
│   ├── main.py           # FastAPI application
│   ├── models.py         # Database models
│   └── schemas.py        # API schemas
```

## API Endpoints

### Projects

- `GET /api/projects` - List all projects
- `GET /api/projects/{project_id}` - Get project details

### Groups

- `GET /api/projects/{project_id}/groups` - List all groups in a project
- `GET /api/projects/{project_id}/groups/{group_path}` - Get group details
- `POST /api/projects/{project_id}/groups` - Create a new group

### TF Operations

- `POST /api/projects/{project_id}/groups/{group_path}/plan` - Run TF plan
- `POST /api/projects/{project_id}/groups/{group_path}/apply` - Apply TF plan
- `POST /api/projects/{project_id}/groups/{group_path}/destroy` - Destroy TF resources
- `GET /api/projects/{project_id}/groups/{group_path}/state` - Get TF state

## Working with Groups

Groups represent directories within the project's infrastructure folder. The API enforces a rule that groups can only be created one level at a time:

1. First, create a group directly in the infrastructure directory
2. Then, create subgroups within that group

For example:
```
# Create network group at the root level
POST /api/projects/my_project/groups
{
  "name": "network",
  "parent_path": ""
}

# Create vpc group within network
POST /api/projects/my_project/groups
{
  "name": "vpc",
  "parent_path": "network"
}
```

## TF Operations

All TF operations are executed in the context of a specific group. The API handles executing the TF CLI commands and returns the results in JSON format:

- **Plan**: Runs `tofu plan` and returns the plan output in JSON format
- **Apply**: Applies the latest plan file (`myplan.tfplan`)
- **Destroy**: Destroys resources in the specified group
- **State**: Returns the current state, with an option to refresh it

## Error Handling

All API endpoints return consistent error responses with appropriate HTTP status codes and detailed error messages.

## Security Considerations

- The API should be protected with appropriate authentication mechanisms
- Access to projects and operations should be controlled by authorization rules
- Implementation of authentication and authorization is left as an exercise