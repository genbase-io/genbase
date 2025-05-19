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

// New interface for dependencies
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
  dependencies: Dependency[]; // New field for dependencies
  parse_errors?: any[];
}

// Chat interfaces
export interface ChatSession {
  id: string;
  title?: string;
  branch: string;
  created_at: string;
  last_activity?: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  tool_calls?: any[];
  tool_call_id?: string;
  reasoning_content?: string;
}

// API client with project management functions
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

  // Workspace functions - updated to exclude group path
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

  async selectWorkspace(projectId: string, name: string): Promise<Workspace> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/workspaces/select`, {
      name,
    });
    return response.data.data;
  },

  // Variable functions - updated to exclude group path
  async listVariables(projectId: string, workspace?: string): Promise<Variable[]> {
    const params = workspace ? { workspace } : {};
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables`, { params });
    return response.data.data;
  },

  async getVariable(projectId: string, name: string, workspace?: string): Promise<Variable> {
    const params = workspace ? { workspace } : {};
    const response = await axios.get(`${API_URL}/projects/${projectId}/variables/${name}`, { params });
    return response.data.data;
  },

  async createOrUpdateVariable(
    projectId: string,
    variable: {
      name: string;
      value: any;
      is_secret?: boolean;
      description?: string;
      workspace?: string;
    }
  ): Promise<Variable> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/variables`, variable);
    return response.data.data;
  },

  async deleteVariable(projectId: string, name: string, workspace?: string): Promise<boolean> {
    const params = workspace ? { workspace } : {};
    const response = await axios.delete(`${API_URL}/projects/${projectId}/variables/${name}`, { params });
    return response.data.success;
  },

  // OpenTofu operations - updated to exclude group path
  async getState(projectId: string, workspace?: string, refresh: boolean = false): Promise<StateResult> {
    const params = { 
      workspace: workspace || 'default',
      refresh
    };
    const response = await axios.get(`${API_URL}/projects/${projectId}/operations/state`, { params });
    return response.data.data;
  },

  async planInfrastructure(projectId: string, workspace?: string): Promise<PlanResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/plan`, {
      workspace: workspace || 'default'
    });
    return response.data.data;
  },

  async applyInfrastructure(projectId: string, workspace?: string): Promise<ApplyResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/apply`, {
      workspace: workspace || 'default'
    });
    return response.data.data;
  },

  async destroyInfrastructure(projectId: string, workspace?: string): Promise<DestroyResult> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/operations/destroy`, {
      workspace: workspace || 'default'
    });
    return response.data.data;
  },

  async parseProjectCode(projectId: string, branch: string = "main"): Promise<ParsedCode> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/code/?branch=${branch}`);
    return response.data.data;
  },

  async listTerraformFiles(projectId: string, branch: string = "main"): Promise<any> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/code/files?branch=${branch}`);
    return response.data.data;
  },

  // Remove the compare configurations function since we removed that endpoint
  // async compareConfigurations() {} // REMOVED

  // Chat functions
  async createChatSession(projectId: string, title?: string): Promise<ChatSession> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/chat/sessions`, {
      title
    });
    return response.data.data;
  },

  async listChatSessions(projectId: string): Promise<ChatSession[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/chat/sessions`);
    return response.data.data;
  },

  async deleteChatSession(projectId: string, sessionId: string): Promise<boolean> {
    const response = await axios.delete(`${API_URL}/projects/${projectId}/chat/sessions?session_id=${sessionId}`);
    return response.data.success;
  },

  async sendChatMessage(projectId: string, sessionId: string, content: string): Promise<ChatMessage> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/chat/messages`, {
      session_id: sessionId,
      content
    });
    return response.data.data;
  },

  async getChatMessages(projectId: string, sessionId: string): Promise<ChatMessage[]> {
    const response = await axios.get(
      `${API_URL}/projects/${projectId}/chat/messages?session_id=${sessionId}`
    );
    return response.data.data;
  }
};

export default apiClient;