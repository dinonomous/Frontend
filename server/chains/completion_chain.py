import time
from typing import Dict, Any, List
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from config import get_llm_dyn
from utils.logger import get_logger

logger = get_logger(__name__)

class CompletionState(TypedDict):
    messages: List[Dict[str, Any]]
    model: str
    persona: str
    language: str
    chat: bool
    think: bool
    image: Any
    file: Any
    keepalive: Any
    request_id: str
    start_time: float
    response: str

async def prepare_messages_node(state: CompletionState) -> Dict[str, Any]:
    """Prepare messages for completion"""
    messages = []
    
    # Add persona/system message if provided
    if state.get("persona"):
        messages.append(SystemMessage(content=state["persona"]))
    
    # Process user messages
    for msg in state["messages"]:
        if isinstance(msg, dict):
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        else:
            messages.append(msg)
    
    return {
        "prepared_messages": messages,
        "start_time": time.time()
    }

async def completion_node(state: CompletionState) -> Dict[str, Any]:
    """Generate completion using the LLM"""
    request_id = state["request_id"]
    
    try:
        logger.debug(f"Starting completion for request {request_id}")
        
        # Get the model
        model = get_llm_dyn(
            model_name=state["model"],
            chat=state.get("chat", True),
            require_stream=False
        )
        
        # Get prepared messages
        messages = state.get("prepared_messages", state["messages"])
        
        # Generate completion
        if state.get("chat", True):
            # Chat-based completion
            result = await model.ainvoke(messages)
            response_content = result.content if hasattr(result, 'content') else str(result)
        else:
            # Raw completion
            prompt = messages[-1].content if messages else state["messages"][-1]["content"]
            result = await model.ainvoke(prompt)
            response_content = result.content if hasattr(result, 'content') else str(result)
        
        logger.info(f"Completion successful for request {request_id}")
        
        return {
            "response": response_content,
            "messages": messages + [AIMessage(content=response_content)],
            "completed": True
        }
        
    except Exception as e:
        logger.error(f"Completion failed for request {request_id}: {str(e)}", exc_info=True)
        raise

# Build the completion graph
completion_graph_builder = StateGraph(CompletionState)

completion_graph_builder.add_node("prepare_messages", prepare_messages_node)
completion_graph_builder.add_node("complete", completion_node)

completion_graph_builder.add_edge(START, "prepare_messages")
completion_graph_builder.add_edge("prepare_messages", "complete")

# Compile the completion graph
async_completion_graph = completion_graph_builder.compile()