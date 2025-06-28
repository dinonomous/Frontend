import asyncio
import time
import json
from typing import Annotated, Dict, Any, Optional, List, AsyncGenerator
from typing_extensions import TypedDict
from enum import Enum
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.runnables import RunnableConfig
from config import get_llm_dyn
from utils.logger import get_logger
from concurrent.futures import ThreadPoolExecutor

logger = get_logger(__name__)

# Thread pool for CPU-intensive operations
_thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="streaming")

class StreamEventType(str, Enum):
    """Stream event types for SSE"""
    TOKEN = "token"
    METADATA = "metadata"
    ERROR = "error"
    DONE = "done"
    START = "start"
    PROGRESS = "progress"

class StreamEvent(TypedDict):
    """Schema for streaming events"""
    event: StreamEventType
    data: Dict[str, Any]
    id: Optional[str]
    retry: Optional[int]

class StreamingCompletionState(TypedDict):
    messages: Annotated[list, add_messages]
    model: str
    system_prompt: Optional[str]
    options: Optional[Dict[str, Any]]
    raw: bool
    context: Optional[List[int]]
    request_id: str
    # Streaming specific
    stream_queue: asyncio.Queue
    start_time: float
    token_count: int
    is_chat: bool
    temperature: Optional[float]

class StreamingCallbackHandler(AsyncCallbackHandler):
    """Enhanced callback handler for streaming with proper event schema"""
    
    def __init__(self, queue: asyncio.Queue, request_id: str):
        self.queue = queue
        self.request_id = request_id
        self.token_count = 0
        self.start_time = time.time()
    
    async def on_llm_start(self, *args, **kwargs):
        """Called when LLM starts"""
        event = StreamEvent(
            event=StreamEventType.START,
            data={
                "request_id": self.request_id,
                "timestamp": time.time(),
                "model": kwargs.get("invocation_params", {}).get("model", "unknown")
            },
            id=self.request_id
        )
        await self.queue.put(event)
    
    async def on_llm_new_token(self, token: str, **kwargs):
        """Called when a new token is generated"""
        self.token_count += 1
        
        event = StreamEvent(
            event=StreamEventType.TOKEN,
            data={
                "token": token,
                "token_count": self.token_count,
                "request_id": self.request_id,
                "timestamp": time.time()
            },
            id=f"{self.request_id}-{self.token_count}"
        )
        await self.queue.put(event)
        
        # Send progress updates every 10 tokens
        if self.token_count % 10 == 0:
            progress_event = StreamEvent(
                event=StreamEventType.PROGRESS,
                data={
                    "token_count": self.token_count,
                    "elapsed_time": time.time() - self.start_time,
                    "tokens_per_second": self.token_count / (time.time() - self.start_time),
                    "request_id": self.request_id
                },
                id=f"{self.request_id}-progress-{self.token_count}"
            )
            await self.queue.put(progress_event)
    
    async def on_llm_end(self, *args, **kwargs):
        """Called when LLM ends"""
        total_time = time.time() - self.start_time
        
        metadata_event = StreamEvent(
            event=StreamEventType.METADATA,
            data={
                "total_tokens": self.token_count,
                "total_duration": int(total_time * 1000),
                "tokens_per_second": self.token_count / total_time if total_time > 0 else 0,
                "request_id": self.request_id,
                "timestamp": time.time()
            },
            id=f"{self.request_id}-metadata"
        )
        await self.queue.put(metadata_event)
        
        done_event = StreamEvent(
            event=StreamEventType.DONE,
            data={
                "request_id": self.request_id,
                "timestamp": time.time()
            },
            id=f"{self.request_id}-done"
        )
        await self.queue.put(done_event)
    
    async def on_llm_error(self, error, **kwargs):
        """Called when LLM encounters an error"""
        error_event = StreamEvent(
            event=StreamEventType.ERROR,
            data={
                "error": str(error),
                "error_type": type(error).__name__,
                "request_id": self.request_id,
                "timestamp": time.time()
            },
            id=f"{self.request_id}-error"
        )
        await self.queue.put(error_event)

# Semaphore for controlling concurrent streaming operations
_streaming_semaphore = asyncio.Semaphore(5)  # Lower limit for streaming

async def prepare_streaming_messages_node(state: StreamingCompletionState) -> Dict[str, Any]:
    """Prepare messages for streaming completion"""
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
    
    # Initialize streaming queue if not present
    if "stream_queue" not in state:
        state["stream_queue"] = asyncio.Queue()
    
    return {
        "messages": messages,
        "start_time": time.time(),
        "token_count": 0
    }

async def streaming_completion_node(state: StreamingCompletionState) -> Dict[str, Any]:
    """Enhanced streaming completion node with proper event handling"""
    request_id = state["request_id"]
    
    # Use semaphore to control concurrent streaming operations
    async with _streaming_semaphore:
        try:
            logger.debug(f"Starting streaming completion for request {request_id}")
            
            # Get the streaming model
            model = get_llm_dyn(
                model_name=state["model"],
                chat=state.get("is_chat", False),
                require_stream=True,
                temp=state.get("temperature", 0.7)
            )
            
            # Apply options
            if state.get("options"):
                options = state["options"]
                model_kwargs = {"stream": True}  # Always enable streaming
                
                # Map options to model parameters
                if "temperature" in options:
                    model_kwargs["temperature"] = options["temperature"]
                if "top_p" in options:
                    model_kwargs["top_p"] = options["top_p"]
                if "top_k" in options:
                    model_kwargs["top_k"] = options["top_k"]
                if "num_predict" in options:
                    model_kwargs["max_tokens"] = options["num_predict"]
                
                model = model.bind(**model_kwargs)
            else:
                model = model.bind(stream=True)
            
            # Create streaming callback handler
            callback_handler = StreamingCallbackHandler(
                queue=state["stream_queue"],
                request_id=request_id
            )
            
            # Configure with callback
            config = RunnableConfig(callbacks=[callback_handler])
            
            # Start the streaming task
            if state.get("raw"):
                # Raw mode - use prompt directly
                prompt = state["messages"][-1].content if state["messages"] else ""
                streaming_task = asyncio.create_task(
                    model.ainvoke(prompt, config=config)
                )
            else:
                # Standard message format
                messages = state["messages"]
                streaming_task = asyncio.create_task(
                    model.ainvoke(messages, config=config)
                )
            
            # Wait for completion
            await streaming_task
            
            logger.info(f"Streaming completion for {request_id} completed successfully")
            
            return {
                "streaming_task": streaming_task,
                "completed": True
            }
            
        except asyncio.CancelledError:
            logger.info(f"Streaming completion cancelled for request {request_id}")
            # Send cancellation event
            cancel_event = StreamEvent(
                event=StreamEventType.ERROR,
                data={
                    "error": "Request cancelled",
                    "error_type": "CancelledError",
                    "request_id": request_id,
                    "timestamp": time.time()
                },
                id=f"{request_id}-cancelled"
            )
            await state["stream_queue"].put(cancel_event)
            raise
        except Exception as e:
            logger.error(f"Streaming completion failed for {request_id}: {str(e)}", exc_info=True)
            # Send error event
            error_event = StreamEvent(
                event=StreamEventType.ERROR,
                data={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "request_id": request_id,
                    "timestamp": time.time()
                },
                id=f"{request_id}-error"
            )
            await state["stream_queue"].put(error_event)
            raise

# Build the streaming graph
streaming_graph_builder = StateGraph(StreamingCompletionState)

streaming_graph_builder.add_node("prepare_streaming", prepare_streaming_messages_node)
streaming_graph_builder.add_node("stream_complete", streaming_completion_node)

streaming_graph_builder.add_edge(START, "prepare_streaming")
streaming_graph_builder.add_edge("prepare_streaming", "stream_complete")

# Compile the streaming graph
async_streaming_completion_graph = streaming_graph_builder.compile()

def format_sse_payload(event: StreamEvent) -> str:
    return json.dumps({
        "id":    event.get("id"),
        "event": event["event"],
        **event["data"],
    }, separators=(',', ':'))


async def create_streaming_generator(
    state: StreamingCompletionState
) -> AsyncGenerator[str, None]:
    """Create async generator for streaming events"""
    try:
        # Start the streaming graph
        streaming_task = asyncio.create_task(
            async_streaming_completion_graph.ainvoke(state)
        )
        
        # Process events from the queue
        while True:
            try:
                # Wait for next event with timeout
                event = await asyncio.wait_for(
                    state["stream_queue"].get(),
                    timeout=30.0  # 30 second timeout
                )
                
                # Format and yield the event
                sse_event = format_sse_payload(event)
                yield sse_event
                
                # Break on done event
                if event["event"] == StreamEventType.DONE:
                    break
                    
                # Break on error event
                if event["event"] == StreamEventType.ERROR:
                    break
                    
            except asyncio.TimeoutError:
                # Send timeout event
                timeout_event = StreamEvent(
                    event=StreamEventType.ERROR,
                    data={
                        "error": "Streaming timeout",
                        "error_type": "TimeoutError",
                        "request_id": state["request_id"],
                        "timestamp": time.time()
                    },
                    id=f"{state['request_id']}-timeout"
                )
                yield format_sse_payload(timeout_event)
                break
                
    except Exception as e:
        logger.error(f"Error in streaming generator: {str(e)}", exc_info=True)
        # Send final error event
        error_event = StreamEvent(
            event=StreamEventType.ERROR,
            data={
                "error": str(e),
                "error_type": type(e).__name__,
                "request_id": state["request_id"],
                "timestamp": time.time()
            },
            id=f"{state['request_id']}-generator-error"
        )
        yield format_sse_payload(error_event)
    finally:
        # Ensure streaming task is properly cleaned up
        if 'streaming_task' in locals() and not streaming_task.done():
            streaming_task.cancel()
            try:
                await streaming_task
            except asyncio.CancelledError:
                pass

# Cleanup function
async def cleanup_streaming_resources():
    """Clean up streaming resources on shutdown"""
    _thread_pool.shutdown(wait=True)
    logger.info("Streaming completion resources cleaned up")