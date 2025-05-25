"""
Agent service handling conversation and tool execution - ASYNC VERSION
"""
import json
import inspect
import litellm
import instructor
from typing import List, Dict, Any, Optional, Callable, Tuple
from pydantic import BaseModel, Field
from enum import Enum

from src.agents.prompts import render_session_prompt

from ..logger import logger
from .chat_service import ChatService
from .git_service import GitService
from ..agents.tools import AgentTools
from litellm import ChatCompletionMessageToolCall, Message
from typing import TypedDict, List, Dict, Any, Optional
from litellm import Message, ChatCompletionMessageToolCall
import yaml

# Initialize instructor with litellm
client = instructor.from_litellm(litellm.completion)

class LLMResponse(TypedDict):
    content: Optional[str]
    tool_calls: List[ChatCompletionMessageToolCall]

# Enum for agent tool choice
class ToolChoiceType(str, Enum):
    AUTO = "auto"
    REQUIRED = "required"
    NONE = "none"

# Model representing a tool call completion
class ToolCallComplete(BaseModel):
    """Signal that all tool interactions are complete and agent wants to respond to the user"""
    complete: bool = True
    reason: str = Field(description="Reason why the agent is completing the interaction")

# Service class for the agent
class AgentService:
    """
    Service for handling agent interactions, tool calls, and managing conversations - ASYNC VERSION
    """
    
    # Default agent settings
    DEFAULT_MODEL = "gpt-4o"
    DEFAULT_TEMPERATURE = 0.5
    MAX_ITERATIONS = 10

    AVAILABLE_TOOLS = [
        "get_all_blocks_summary",
        "tf_read",
        "tf_write",
        "tf_modify",
        "delete_file",
        "tf_validate",
        "merge_changes",
        "tf_plan",
        "sync_with_main"
    ]

    def __init__(
        self,
        project_id: str,
        session_id: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None,
        max_iterations: Optional[int] = None,
        persist_messages: Optional[bool] = True,
        load_chat_history: Optional[bool] = True,
        tools: Optional[List[str]] = None
    ):
        """
        Initialize the AgentService with configuration - ASYNC VERSION
        """
        # Core settings
        self.project_id = project_id
        self.session_id = session_id
        self.model = model or self.DEFAULT_MODEL
        self.temperature = temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        
        # System prompt - will be formatted when project_id and session_id are set
        self.system_prompt = system_prompt
        
        # Behavior settings
        self.max_iterations = max_iterations or self.MAX_ITERATIONS
        self.persist_messages = persist_messages
        self.load_chat_history = load_chat_history

        self.tools = tools or self.AVAILABLE_TOOLS
        
        # These will be initialized by other methods
        self.messages = []

    async def process_message(
        self,
        model: Optional[str] = None,
        temperature: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Process a message with the agent - ASYNC VERSION
        
        Args:
            model: Optional model override
            temperature: Optional temperature override
            
        Returns:
            Dictionary with processing result
        """
        try:
            # Get infrastructure path for this branch
            infra_path = GitService.get_infrastructure_path(self.project_id, self.session_id)
            
            if not infra_path or not infra_path.exists():
                return {
                    "success": False,
                    "error": f"Infrastructure path not found for project: {self.project_id}, branch: {self.session_id}"
                }
            
            # Get all messages in the conversation
            messages = ChatService.get_messages(self.project_id, self.session_id)

            logger.debug(f"get messages: {messages}")

            # convert messages to Message format
            messages = [litellm.Message(**message) for message in messages]

            tools_class = AgentTools(project_id=self.project_id, branch=self.session_id)

            logger.debug(f"tools class: {tools_class}")
            
            if not messages:
                return {
                    "success": False,
                    "error": "No messages found in the conversation"
                }
            
            # Get branch summaries asynchronously
            main_branch_summary = await AgentTools(
                project_id=self.project_id, 
                branch="main"
            ).get_all_blocks_summary()
            
            current_branch_summary = await AgentTools(
                project_id=self.project_id, 
                branch=self.session_id
            ).get_all_blocks_summary()

            # Check sync status in thread since GitService is sync
            import asyncio
            sync_status_result = await asyncio.to_thread(
                GitService.check_branch_sync_status, 
                self.project_id, 
                self.session_id
            )
            sync_status: bool = sync_status_result['is_in_sync']
            
            print(f"main branch summary: {yaml.dump(main_branch_summary, sort_keys=False, default_flow_style=False)}")
            
            # Prepare system message
            system_message = {
                "role": "system",
                "content": self.system_prompt or render_session_prompt(
                    project_id=self.project_id,
                    branch=self.session_id,
                    main_branch_summary=yaml.dump(main_branch_summary, sort_keys=False, default_flow_style=False),
                    current_branch_summary=yaml.dump(current_branch_summary, sort_keys=False, default_flow_style=False),
                    branch_sync_status="" if sync_status else "This branch or session is not in sync with the main branch. You may want to run `sync_with_main` tool to update it."
                )
            }
            logger.debug(f"system message: {system_message}")
            
            # Add system message at the beginning
            messages_for_llm = [Message(role='system', content=system_message["content"])] + messages # type: ignore[reportArgumentType]
            

            logger.debug(f"messages by llm: {messages_for_llm}")
            # Get available tools
            tools = await self._get_tools()

            logger.debug(f"get tools: {tools}")
            
            # Set model and temperature (with defaults)
            use_model = model or AgentService.DEFAULT_MODEL
            use_temperature = temperature if temperature is not None else AgentService.DEFAULT_TEMPERATURE
            
            # Initialize variables for the loop
            done = False
            final_message = None

            iteration_count = 0
            
            # Main agent loop - continue until the agent signals completion
            while not done:

                if iteration_count > self.max_iterations:
                    logger.error("Max iterations reached, stopping agent processing")
                    break
                iteration_count += 1
                
                # Call the LLM
                response: LLMResponse = await self._call_llm(
                    messages=messages_for_llm,
                    tools=tools,
                    model=use_model,
                    temperature=use_temperature
                )

                tool_calls: List[ChatCompletionMessageToolCall] = response.get("tool_calls")

                # serialize tool calls to JSON with model_dump
                tool_calls_json = [call.model_dump() for call in tool_calls] if tool_calls else None
                
                logger.debug(f"tool calls json: {tool_calls_json}")
                
                # Add the assistant message to the chat history
                assistant_message_result = ChatService.add_agent_message(
                    project_id=self.project_id,
                    session_id=self.session_id,
                    content=response.get("content"),
                    tool_calls=tool_calls_json
                )
                
                if not assistant_message_result.get("success", False):
                    return {
                        "success": False,
                        "error": f"Failed to save assistant message: {assistant_message_result.get('error', 'Unknown error')}"
                    }
                
                # Update messages for next iteration
                assistant_message = {
                    "role": "assistant",
                    "content": response.get("content", ""),
                    "tool_calls": response.get("tool_calls", [])
                }
                messages_for_llm.append(Message(**assistant_message))
                
                # If no tool calls, we're done
                if not response.get("tool_calls", []):
                    done = True
                    final_message = assistant_message_result.get("message_data", {})
                    break

                logger.debug(f"tool_calls: {tool_calls}")
                
                # Process each tool call ASYNCHRONOUSLY
                if tool_calls:
                    for tool_call in tool_calls:
                        tool_call_id = tool_call.id
                        function_name = tool_call.function.name or ""
                        function_args = json.loads(tool_call.function.arguments)
                        
                        # Check if it's the special "complete_interaction" function
                        if function_name == "complete_interaction":
                            done = True
                            break
                        
                        function_to_call = await self._get_function_by_name(
                            function_name, 
                            tools_class
                        )

                        if not function_to_call:
                            # Function not found, add an error message
                            tool_result = ChatService.add_tool_result(
                                project_id=self.project_id,
                                session_id=self.session_id,
                                tool_call_id=tool_call_id,
                                name=function_name,
                                content=json.dumps({"error": f"Function '{function_name}' not found"})
                            )
                        else:
                            # Execute the function ASYNCHRONOUSLY
                            try:
                                # Check if the function is async
                                if inspect.iscoroutinefunction(function_to_call):
                                    result = await function_to_call(**function_args)
                                else:
                                    # Run sync function in thread
                                    result = await asyncio.to_thread(function_to_call, **function_args)
                                
                                # Add tool result to chat history
                                tool_result = ChatService.add_tool_result(
                                    project_id=self.project_id,
                                    session_id=self.session_id,
                                    tool_call_id=tool_call_id,
                                    name=function_name, 
                                    content=json.dumps(result),
                                    commit_id=result.get("commit_id", None),
                                )
                                
                            except Exception as e:
                                logger.error(f"Error executing function {function_name}: {str(e)}")
                                # Add error message
                                tool_result = ChatService.add_tool_result(
                                    project_id=self.project_id,
                                    session_id=self.session_id,
                                    tool_call_id=tool_call_id,
                                    name=function_name,
                                    content=json.dumps({"error": str(e)})
                                )
                        
                        # Add the tool response to messages for the next LLM call
                        if tool_result.get("success", False):
                            messages_for_llm.append(Message(
                                role="tool", # type: ignore[reportArgumentType]
                                tool_call_id=tool_call_id,
                                name=function_name,
                                content=tool_result.get("message_data", {}).get("content", "")
                            ))
                    
                # If we're not done after processing tool calls, continue the loop
                if done and not final_message:
                    # Get the last assistant message as final message
                    all_messages = ChatService.get_messages(self.project_id, self.session_id)
                    assistant_messages = [m for m in all_messages if m.get("role") == "assistant"]
                    
                    if assistant_messages:
                        final_message = assistant_messages[-1]
            
            # Return the result
            return {
                "success": True,
                "final_message": final_message
            }
            
        except Exception as e:
            logger.error(f"Error processing agent message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _call_llm(
        self,
        messages: List[Message],
        tools: List[Dict[str, Any]],
        model: str,
        temperature: float
    ) -> LLMResponse:
        """
        Call the LLM with the given messages and tools - ASYNC
        """
        try:
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=temperature,
                max_tokens=4096
            )
            
            assistant_message: Message = response.choices[0].message # type: ignore[attr-defined]
            tool_calls: List[ChatCompletionMessageToolCall] = getattr(assistant_message, "tool_calls", [])
            
            return LLMResponse(
                content=getattr(assistant_message, "content", None),
                tool_calls=tool_calls
            )
            
        except Exception as e:
            logger.error(f"Error calling LLM: {str(e)}")
            raise

    async def _get_tools(self) -> List[Dict[str, Any]]:
        """
        Get the list of tools available to the agent - ASYNC VERSION
        
        Returns:
            List of tools in the format expected by the LLM
        """
        tools = []
        
        # Create a TerraformTools instance with the project context
        tf_tools = AgentTools(project_id=self.project_id, branch=self.session_id)
        
        # Get all methods from the TerraformTools class
        for method_name in dir(AgentTools):
            # Skip private methods, special methods, and the constructor
            if method_name.startswith('_') or method_name == "__init__":
                continue
            
            # Skip methods not in the valid_tools list
            if method_name not in self.tools:
                continue
            
            # Get the method from the instance (to get instance method signature)
            method = getattr(tf_tools, method_name)
            
            if callable(method):
                # Get function signature
                sig = inspect.signature(method)
                docstring = inspect.getdoc(method) or ""
                
                # Build parameters schema based on type annotations
                parameters = {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
                
                for param_name, param in sig.parameters.items():
                    # Skip 'self' parameter
                    if param_name == 'self':
                        continue
                        
                    # Add to required parameters if no default value
                    if param.default == inspect.Parameter.empty:
                        parameters["required"].append(param_name)
                    
                    # Basic type conversion
                    if param.annotation != inspect.Parameter.empty:
                        if param.annotation is str:
                            param_type = "string"
                        elif param.annotation in (int, float):
                            param_type = "number"
                        elif param.annotation is bool:
                            param_type = "boolean"
                        elif param.annotation == List[str]:
                            param_type = "array"
                            item_type = "string"
                        else:
                            param_type = "string"  # Default to string for complex types
                        
                        # Add parameter to properties
                        if param_type == "array":
                            parameters["properties"][param_name] = {
                                "type": param_type,
                                "items": {"type": item_type}
                            }
                        else:
                            parameters["properties"][param_name] = {"type": param_type}
                
                # Create tool object
                tool = {
                    "type": "function",
                    "function": {
                        "name": method_name,
                        "description": docstring,
                        "parameters": parameters
                    }
                }
                
                tools.append(tool)
        
        # Always add special tool for completing interaction
        tools.append({
            "type": "function",
            "function": {
                "name": "complete_interaction",
                "description": "Call this when you have completed the task and want to respond to the user. This signals that you are done with all tool calls.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Reason why you are completing the interaction"
                        }
                    },
                    "required": ["reason"]
                }
            }
        })
        
        return tools

    async def _get_function_by_name(self, function_name: str, tf_tools_instance: AgentTools) -> Optional[Callable]:
        """
        Get a function by name from the available tool classes - ASYNC VERSION
        
        Args:
            function_name: Name of the function to get
            tf_tools_instance: Instance of TerraformTools with project context
            
        Returns:
            Function if found, None otherwise
        """
        # Check if it's a TerraformTools method
        if hasattr(tf_tools_instance, function_name) and callable(getattr(tf_tools_instance, function_name)):
            # Return the method from the instance
            return getattr(tf_tools_instance, function_name)
        
        # Special case for complete_interaction
        if function_name == "complete_interaction":
            # Return a dummy function that just returns success
            async def complete_interaction_dummy(reason):
                return {"success": True, "message": f"Interaction completed: {reason}"}
            return complete_interaction_dummy
        
        return None