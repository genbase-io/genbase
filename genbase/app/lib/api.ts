// Updated API client to reflect the revised backend

import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface Project {
  id: string;
  path: string;
  infrastructure_path: string;
  group_count: number;
  file_count: number;
}

export interface Group {
  name: string;
  path: string;
  parent_path: string | null;
  is_root?: boolean;
  file_count: number;
  tf_file_count?: number;
  files?: string[];
}

export interface Workspace {
  name: string;
  is_current: boolean;
}

export interface Variable {
  name: string;
  value: any;
  type: string;
  is_secret: boolean;
  description?: string;
  workspace?: string;
  variable_type?: 'terraform' | 'environment';
}

export interface StateResult {
  success: boolean;
  message?: string;
  state: any;
  summary: {
    resource_count: number;
    resource_types: string[];
    outputs: Array<{ name: string; type: string }>;
  };
  workspace: string;
}

export interface PlanResult {
  success: boolean;
  message?: string;
  plan: any;
  summary: {
    add: number;
    change: number;
    destroy: number;
  };
  workspace: string;
}

export interface ApplyResult {
  success: boolean;
  message?: string;
  output: string;
  state_summary?: any;
  workspace: string;
}

export interface DestroyResult {
  success: boolean;
  message?: string;
  output: string;
  workspace: string;
}

export interface CodeBlock {
  type?: string;
  name: string;
  address: string;
  config: any;
  _metadata: {
    group_path: string;
    file_name: string;
    block_type: string;
  };
}

export interface Dependency {
  from: string;
  to: string;
  type: string;
  target_attribute?: string;
  target_output?: string;
}

export interface ParsedCode {
  project_id: string;
  branch: string;
  files_processed: number;
  total_files: number;
  blocks: {
    resource?: CodeBlock[];
    module?: CodeBlock[];
    data?: CodeBlock[];
    output?: CodeBlock[];
    variable?: CodeBlock[];
    locals?: CodeBlock[];
    provider?: CodeBlock[];
    terraform?: CodeBlock[];
  };
  dependencies: Dependency[];
  parse_errors?: any[];
}

// --- Updated Chat Interfaces ---
export interface ChatSession {
  session_id: string;         // e.g., "user/default/16"
  session_number: number;     // e.g., 16
  title: string;              // e.g., "Test Session" or "Chat Session 16"
  project_id: string;         // e.g., "default"
  message_count: number;      // Present in both create and list responses

  // Fields that might differ between create and list contexts
  created_at?: string;         // Present in create response, not in list example
  infrastructure_path?: string | null; // Present in create and list (can be null)
  worktree_path?: string;      // Present in create response, not in list example

  // Fields mainly from list response context
  last_message_at?: string;    // Present in list response
  last_commit_date?: string;   // Present in list response
  last_commit_message?: string;// Present in list response
  worktree_exists?: boolean;   // Present in list response
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  id: number; // API returns number for message ID e.g. "id": 3
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  created_at: string; // API returns "created_at", not "timestamp"
  
  // Tool-related fields
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string; // Tool name for tool messages
  
  // Optional fields
  reasoning_content?: string;
}

export interface Model {
  name: string;
}


// Form field types
export interface FormField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "boolean" | "password";
  description?: string;
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormData {
  title: string;
  description: string;
  fields: FormField[];
  submitLabel?: string;
}
// --- End of Updated Chat Interfaces ---

const apiClient = {
  // Project functions
  async listProjects(): Promise<Project[]> {
    const response = await axios.get(`${API_URL}/projects`);
    return response.data.data;
  },

  async getProject(projectId: string): Promise<Project> {
    const response = await axios.get(`${API_URL}/projects/${projectId}`);
    return response.data.data;
  },

  async createProject(id: string): Promise<Project> {
    const response = await axios.post(`${API_URL}/projects`, { id });
    return response.data.data;
  },

  // Group functions (file organization only)
  async listGroups(projectId: string): Promise<Group[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/groups`);
    return response.data.data;
  },

  async getGroup(projectId: string, groupPath: string): Promise<Group> {
    const encodedPath = encodeURIComponent(groupPath);
    const response = await axios.get(`${API_URL}/projects/${projectId}/groups/${encodedPath}`);
    return response.data.data;
  },

  async createGroup(projectId: string, name: string, parentPath: string = ""): Promise<Group> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/groups`, {
      name,
      parent_path: parentPath,
    });
    return response.data.data;
  },

  // Workspace functions
  async listWorkspaces(projectId: string): Promise<Workspace[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/workspaces`);
    return response.data.data;
  },

  async createWorkspace(projectId: string, name: string): Promise<Workspace> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/workspaces`, {
      name,
    });
    return response.data.data;
  },

    async getAvailableModels(): Promise<string[]> {
    const response = await axios.get<{ success: boolean; message: string; data: string[] }>(
      `${API_URL}/models`
    );
    return response.data.data;
  },


async listVariables(projectId: string, workspace: string): Promise<Variable[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables`, { 
      params: { workspace } 
    });
    return response.data.data;
  },
  
  

  async listEnvVariables(projectId: string, workspace: string): Promise<Variable[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables/env`, { 
      params: { workspace } 
    });
    return response.data.data;
  },

  async getVariable(projectId: string, name: string, workspace: string): Promise<Variable> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables/${name}`, { 
      params: { workspace } 
    });
    return response.data.data;
  },

  async getEnvVariable(projectId: string, name: string, workspace: string): Promise<Variable> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables/env/${name}`, { 
      params: { workspace } 
    });
    return response.data.data;
  },

  async createOrUpdateVariable(
    projectId: string,
    variable: {
      name: string;
      value: any;
      workspace: string;
      is_secret?: boolean;
      description?: string;
    }
  ): Promise<Variable> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/variables`, variable);
    return response.data.data;
  },

  async createOrUpdateEnvVariable(
    projectId: string,
    envVariable: {
      name: string;
      value: string;
      workspace: string;
    }
  ): Promise<Variable> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/variables/env`, envVariable);
    return response.data.data;
  },

  async deleteVariable(projectId: string, name: string, workspace: string): Promise<boolean> {
    const response = await axios.delete(`${API_URL}/projects/${projectId}/variables/${name}`, { 
      params: { workspace } 
    });
    return response.data.success;
  },

  async deleteEnvVariable(projectId: string, name: string, workspace: string): Promise<boolean> {
    const response = await axios.delete(`${API_URL}/projects/${projectId}/variables/env/${name}`, { 
      params: { workspace } 
    });
    return response.data.success;
  },


  // OpenTofu operations
  async getState(projectId: string, workspace?: string, refresh: boolean = false): Promise<StateResult> {
    const params = { 
      workspace: workspace || 'default',
      refresh
    };
    const response = await axios.get(`${API_URL}/projects/${projectId}/operations/state`, { params });
    return response.data.data; // Assuming API returns StateResult within response.data.data
  },

  async planInfrastructure(projectId: string, workspace?: string): Promise<PlanResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/plan`, {
      workspace: workspace || 'default'
    });
    return response.data.data; // Assuming API returns PlanResult within response.data.data
  },

  async applyInfrastructure(projectId: string, workspace?: string): Promise<ApplyResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/apply`, {
      workspace: workspace || 'default'
    });
    return response.data.data; // Assuming API returns ApplyResult within response.data.data
  },

  async destroyInfrastructure(projectId: string, workspace?: string): Promise<DestroyResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/destroy`, {
      workspace: workspace || 'default'
    });
    return response.data.data; // Assuming API returns DestroyResult within response.data.data
  },

  async parseProjectCode(projectId: string, branch: string = "main"): Promise<ParsedCode> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/code/?branch=${branch}`);
    return response.data.data;
  },

  async listTerraformFiles(projectId: string, branch: string = "main"): Promise<any> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/code/files?branch=${branch}`);
    return response.data.data;
  },

  // --- Updated Chat Functions ---
  async createChatSession(projectId: string, title?: string): Promise<ChatSession> {
    const payload: { title?: string } = {};
    if (title) {
      payload.title = title;
    }
    const response = await axios.post<{ success: boolean; message: string; data: ChatSession }>(
      `${API_URL}/projects/${projectId}/chat/sessions`,
      payload
    );
    return response.data.data;
  },

  async listChatSessions(projectId: string): Promise<ChatSession[]> {
    const response = await axios.get<{ success: boolean; message: string; data: ChatSession[] }>(
      `${API_URL}/projects/${projectId}/chat/sessions`
    );
    return response.data.data;
  },

  async deleteChatSession(projectId: string, sessionId: string): Promise<boolean> {
    // The API uses session_id as a query parameter.
    const response = await axios.delete<{ success: boolean; message: string; data: { deleted_messages: number } }>(
      `${API_URL}/projects/${projectId}/chat/sessions?session_id=${sessionId}`
    );
    return response.data.success; // Returns true if the operation was successful.
  },

  async sendChatMessage(projectId: string, sessionId: string, content: string): Promise<ChatMessage> {
    const response = await axios.post<{ success: boolean; message: string; data: ChatMessage }>(
      `${API_URL}/projects/${projectId}/chat/messages`,
      {
        session_id: sessionId, // Ensure this matches the API's expected field name
        content
      }
    );
    return response.data.data;
  },

  async getChatMessages(projectId: string, sessionId: string): Promise<ChatMessage[]> {
    // The API uses session_id as a query parameter.
    // Expects an array of ChatMessage objects.
    const response = await axios.get<{ success: boolean; message: string; data: ChatMessage[] }>(
      `${API_URL}/projects/${projectId}/chat/messages?session_id=${sessionId}`
    );
    return response.data.data;
  }

,
  // --- Agent API Functions ---
  async sendAgentMessage(
    projectId: string, 
    sessionId: string, 
    content: string, 
    model?: string,
    temperature?: number,
    toolCallId?: string,
    toolName?: string
  ): Promise<ChatMessage> {
    // The agent API handles both storing the user message and processing it
    const payload: any = {
      session_id: sessionId,
      content,
      model,
      temperature
    };
    
    // Add tool result fields if provided
    if (toolCallId) {
      payload.tool_call_id = toolCallId;
      payload.tool_name = toolName;
    }
    
    const response = await axios.post<{ success: boolean; message: string; data: ChatMessage }>(
      `${API_URL}/projects/${projectId}/agent/messages`,
      payload
    );
    return response.data.data;
  },



  
};

export default apiClient;