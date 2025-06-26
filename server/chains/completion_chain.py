import time
from typing import Annotated, Dict, Any, Optional, List
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import JsonOutputParser
from config import completion_model
from utils.logger import get_logger

logger = get_logger(__name__)

class EnhancedCompletionState(TypedDict):
    messages: Annotated[list, add_messages]
    model: str
    system_prompt: Optional[str]
    format_type: Optional[str]
    format_schema: Optional[Dict[str, Any]]
    options: Optional[Dict[str, Any]]
    raw: bool
    context: Optional[List[int]]
    # Performance tracking
    start_time: float
    prompt_tokens: int
    completion_tokens: int

graph_builder = StateGraph(EnhancedCompletionState)

def prepare_messages_node(state: EnhancedCompletionState) -> Dict[str, Any]:
    """Prepare messages with system prompt and formatting"""
    messages = []
    
    # Add system message if provided
    if state.get("system_prompt"):
        messages.append(SystemMessage(content=state["system_prompt"]))
    
    # Add user messages
    for msg in state["messages"]:
        if isinstance(msg, dict):
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        else:
            messages.append(msg)
    
    return {"messages": messages, "start_time": time.time()}

def completion_node(state: EnhancedCompletionState) -> Dict[str, Any]:
    """Enhanced completion node with full feature support"""
    start_time = time.time()
    
    try:
        # Get the model (could be different models based on request)
        model = completion_model
        
        # Apply options if provided
        if state.get("options"):
            # LangChain model configuration
            model_kwargs = {}
            options = state["options"]
            
            # Map common Ollama options to LangChain parameters
            if "temperature" in options:
                model_kwargs["temperature"] = options["temperature"]
            if "top_p" in options:
                model_kwargs["top_p"] = options["top_p"]
            if "top_k" in options:
                model_kwargs["top_k"] = options["top_k"]
            if "num_predict" in options:
                model_kwargs["max_tokens"] = options["num_predict"]
            if "repeat_penalty" in options:
                model_kwargs["repeat_penalty"] = options["repeat_penalty"]
            
            # Update model with new parameters if any
            if model_kwargs:
                model = model.bind(**model_kwargs)
        
        # Handle different input formats
        if state.get("raw"):
            # Raw mode - use the prompt directly
            prompt = state["messages"][-1].content if state["messages"] else ""
            response = model.invoke(prompt)
        else:
            # Standard message format
            messages = state["messages"]
            
            # Handle JSON format output
            if state.get("format_type") == "json":
                if state.get("format_schema"):
                    # Use structured output with schema
                    parser = JsonOutputParser(pydantic_object=state["format_schema"])
                    chain = model | parser
                    response = chain.invoke(messages)
                else:
                    # Simple JSON output
                    json_prompt = "Respond with valid JSON only."
                    if messages and isinstance(messages[-1], HumanMessage):
                        messages[-1].content += f"\n\n{json_prompt}"
                    response = model.invoke(messages)
            else:
                # Standard text response
                response = model.invoke(messages)
        
        # Extract response content
        if hasattr(response, 'content'):
            content = response.content
        else:
            content = str(response)
        
        # Calculate timing and token counts (approximate)
        end_time = time.time()
        total_duration = int((end_time - start_time) * 1000)  # Convert to milliseconds
        
        # Estimate token counts (rough approximation)
        prompt_text = ""
        if state.get("messages"):
            prompt_text = " ".join([msg.content if hasattr(msg, 'content') else str(msg) 
                                  for msg in state["messages"]])
        
        prompt_tokens = len(prompt_text.split()) * 1.3  # Rough token estimation
        completion_tokens = len(content.split()) * 1.3
        
        logger.info(f"Completion generated in {total_duration}ms")
        
        return {
            "messages": [AIMessage(content=content)],
            "total_duration": total_duration,
            "prompt_eval_count": int(prompt_tokens),
            "eval_count": int(completion_tokens),
            "prompt_eval_duration": int(total_duration * 0.3),  # Rough estimate
            "eval_duration": int(total_duration * 0.7)
        }
        
    except Exception as e:
        logger.error(f"Completion failed: {str(e)}")
        raise e

# Build the graph
graph_builder.add_node("prepare", prepare_messages_node)
graph_builder.add_node("complete", completion_node)

graph_builder.add_edge(START, "prepare")
graph_builder.add_edge("prepare", "complete")

enhanced_completion_graph = graph_builder.compile()

# Keep the simple graph for backward compatibility
class CompletionState(TypedDict):
    messages: Annotated[list, add_messages]

simple_graph_builder = StateGraph(CompletionState)

def simple_completion_node(state: CompletionState) -> dict:
    prompt = state["messages"][-1].content
    logger.info("Simple completion requested with prompt: %s", prompt)
    response = completion_model.invoke(prompt)
    logger.debug("LLM response: %s", response)
    return {"messages": [{"role": "assistant", "content": response}]}

simple_graph_builder.add_node("complete", simple_completion_node)
simple_graph_builder.add_edge(START, "complete")

completion_graph = simple_graph_builder.compile()