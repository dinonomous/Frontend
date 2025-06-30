import asyncio
import time
from typing import Annotated, Dict, Any, Optional, List
from typing_extensions import TypedDict  # type: ignore
from langgraph.graph import StateGraph, START  # type: ignore
from langgraph.graph.message import add_messages  # type: ignore
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage  # type: ignore
from langchain_core.output_parsers import JsonOutputParser  # type: ignore
from config import get_llm_dyn
from utils.logger import get_logger
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

logger = get_logger(__name__)

# Thread pool for CPU-intensive operations
_thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="completion")

class EnhancedCompletionState(TypedDict):
    messages: Annotated[list, add_messages]
    model: str
    system_prompt: Optional[str]
    format_type: Optional[str]
    format_schema: Optional[Dict[str, Any]]
    options: Optional[Dict[str, Any]]
    raw: bool
    context: Optional[List[int]]
    request_id: Optional[str]
    # Performance tracking
    start_time: float
    prompt_tokens: int
    completion_tokens: int

# Semaphore for controlling concurrent model operations
_model_semaphore = asyncio.Semaphore(10)  # Max 10 concurrent model calls

@lru_cache(maxsize=128)
def _get_cached_model_config(options_hash: str):
    """Cache model configurations to avoid repeated setup"""
    return {}

async def prepare_messages_node(state: EnhancedCompletionState) -> Dict[str, Any]:
    """Prepare messages for the completion"""
    messages = []
    
    # Add system message if provided
    if state.get("system_prompt"):
        messages.append(SystemMessage(content=state["system_prompt"]))
    
    # Process messages
    processed_messages = []
    for msg in state["messages"]:
        if isinstance(msg, dict):
            if msg["role"] == "user":
                processed_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                processed_messages.append(AIMessage(content=msg["content"]))
        else:
            processed_messages.append(msg)
    
    messages.extend(processed_messages)
    
    return {
        "messages": messages, 
        "start_time": time.time()
    }

async def async_completion_node(state: EnhancedCompletionState) -> Dict[str, Any]:
    """Enhanced async completion node"""
    start_time = time.time()
    request_id = state.get("request_id", "unknown")
    
    # Use semaphore to control concurrent model calls
    async with _model_semaphore:
        try:
            logger.debug(f"Starting completion for request {request_id}")

            model = get_llm_dyn(model_name=state.model)

            if state.get("options"):
                options = state["options"]
                
                model_kwargs = {}
                # Map common options to LangChain parameters
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
            
            # Async model invocation
            response = await _invoke_model_async(model, state)
            
            # Extract response content
            if hasattr(response, 'content'):
                content = response.content
            elif isinstance(response, dict) and 'content' in response:
                content = response['content']
            else:
                content = str(response)
            
            # Calculate timing and token counts
            end_time = time.time()
            total_duration = int((end_time - start_time) * 1000)
            
            # Token estimation
            prompt_tokens, completion_tokens = await _estimate_tokens_async(state, content)
            
            logger.info(f"Async completion for {request_id} completed in {total_duration}ms")
            
            return {
                "messages": [AIMessage(content=content)],
                "total_duration": total_duration,
                "prompt_eval_count": prompt_tokens,
                "eval_count": completion_tokens,
                "prompt_eval_duration": int(total_duration * 0.3),
                "eval_duration": int(total_duration * 0.7)
            }
            
        except asyncio.CancelledError:
            logger.info(f"Completion cancelled for request {request_id}")
            raise
        except Exception as e:
            logger.error(f"Async completion failed for {request_id}: {str(e)}", exc_info=True)
            raise e

async def _invoke_model_async(model, state: EnhancedCompletionState):
    """Async model invocation"""
    if state.get("raw"):
        prompt = state["messages"][-1].content if state["messages"] else ""
        if hasattr(model, 'ainvoke'):
            return await model.ainvoke(prompt)
        else:
            # Run in thread pool if model doesn't support async
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(_thread_pool, lambda: model.invoke(prompt))
    else:
        messages = state["messages"]
        
        if state.get("format_type") == "json":
            if state.get("format_schema"):
                parser = JsonOutputParser(pydantic_object=state["format_schema"])
                if hasattr(model, 'ainvoke'):
                    response = await model.ainvoke(messages)
                else:
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        _thread_pool, 
                        lambda: model.invoke(messages)
                    )
                
                # Parse response
                if hasattr(parser, 'aparse'):
                    return await parser.aparse(response.content if hasattr(response, 'content') else str(response))
                else:
                    loop = asyncio.get_event_loop()
                    return await loop.run_in_executor(
                        _thread_pool, 
                        parser.parse, 
                        response.content if hasattr(response, 'content') else str(response)
                    )
            else:
                # Simple JSON output
                json_prompt = "Respond with valid JSON only."
                if messages and isinstance(messages[-1], HumanMessage):
                    messages[-1].content += f"\n\n{json_prompt}"
                
                if hasattr(model, 'ainvoke'):
                    return await model.ainvoke(messages)
                else:
                    loop = asyncio.get_event_loop()
                    return await loop.run_in_executor(
                        _thread_pool, 
                        lambda: model.invoke(messages)
                    )
        else:
            # Standard text response
            if hasattr(model, 'ainvoke'):
                return await model.ainvoke(messages)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    _thread_pool, 
                    lambda: model.invoke(messages)
                )

async def _estimate_tokens_async(state: EnhancedCompletionState, content: str) -> tuple[int, int]:
    """Async token estimation using thread pool for CPU-intensive calculation"""
    def _estimate_tokens():
        prompt_text = ""
        if state.get("messages"):
            prompt_text = " ".join([
                msg.content if hasattr(msg, 'content') else str(msg) 
                for msg in state["messages"]
            ])
        
        prompt_tokens = int(len(prompt_text.split()) * 1.3)
        completion_tokens = int(len(content.split()) * 1.3)
        
        return prompt_tokens, completion_tokens
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, _estimate_tokens)

# Build the async enhanced graph
async_graph_builder = StateGraph(EnhancedCompletionState)

async_graph_builder.add_node("prepare", prepare_messages_node)
async_graph_builder.add_node("complete", async_completion_node)

async_graph_builder.add_edge(START, "prepare")
async_graph_builder.add_edge("prepare", "complete")

# Compile the graph
async_enhanced_completion_graph = async_graph_builder.compile()

# Cleanup function for graceful shutdown
async def cleanup_async_resources():
    """Clean up async resources on shutdown"""
    _thread_pool.shutdown(wait=True)
    logger.info("Async completion resources cleaned up")