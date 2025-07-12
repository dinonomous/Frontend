import asyncio
import time
import json
from typing import Dict, Any, List, AsyncGenerator
from typing_extensions import TypedDict
from enum import Enum
from langgraph.graph import StateGraph, START
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.runnables import RunnableConfig
from config import get_llm_dyn
from utils.logger import get_logger
from models.prompts import QUERY_PROCESSOR_PROMPT, BASE_MARKDOWN_SYSTEM_PROMPT
from models.personas import RolePromptManager

logger = get_logger(__name__)

class StreamEventType(str, Enum):
    START = "start"
    TOKEN = "token"
    PROGRESS = "progress"
    METADATA = "metadata"
    ERROR = "error"
    DONE = "done"

class StreamingState(TypedDict):
    messages: List[Dict[str, Any]]
    model: str
    persona: int
    language: str
    chat: bool
    think: bool
    image: Any
    file: Any
    keepalive: Any
    request_id: str
    start_time: float
    stream_queue: asyncio.Queue
    token_count: int
    is_streaming: bool

class StreamingCallbackHandler(AsyncCallbackHandler):
    """Simplified streaming callback handler"""
    
    def __init__(self, queue: asyncio.Queue, request_id: str):
        self.queue = queue
        self.request_id = request_id
        self.token_count = 0
        self.start_time = time.time()
        self.full_content = ""

    async def on_llm_start(self, *args, **kwargs):
        logger.debug(f"on_llm_start called for request_id={self.request_id}")
        await self.queue.put({
            "event": StreamEventType.START,
            "data": {
                "request_id": self.request_id,
                "timestamp": time.time()
            }
        })

    async def on_llm_new_token(self, token: str, **kwargs):
        self.token_count += 1
        self.full_content += token
        
        # Send token event
        await self.queue.put({
            "event": StreamEventType.TOKEN,
            "data": {
                "token": token,
                "count": self.token_count,
                "request_id": self.request_id
            }
        })
        
        # Progress updates every 25 tokens
        if self.token_count % 25 == 0:
            await self.queue.put({
                "event": StreamEventType.PROGRESS,
                "data": {
                    "count": self.token_count,
                    "elapsed": time.time() - self.start_time,
                    "request_id": self.request_id
                }
            })

    async def on_llm_end(self, *args, **kwargs):
        logger.debug(f"on_llm_end called for request_id={self.request_id}, total tokens={self.token_count}")
        # Metadata
        await self.queue.put({
            "event": StreamEventType.METADATA,
            "data": {
                "tokens": self.token_count,
                "duration": int((time.time() - self.start_time) * 1000),
                "request_id": self.request_id
            }
        })
        
        # Done
        await self.queue.put({
            "event": StreamEventType.DONE,
            "data": {
                "request_id": self.request_id
            }
        })

    async def on_llm_error(self, error, **kwargs):
        logger.error(f"on_llm_error: {error} for request_id={self.request_id}")
        await self.queue.put({
            "event": StreamEventType.ERROR,
            "data": {
                "error": str(error),
                "request_id": self.request_id
            }
        })

async def prepare_streaming_messages_node(state: StreamingState) -> Dict[str, Any]:
    """Prepare messages for streaming completion"""
    
    messages = []
    
    # Add persona/system message if provided
    if state.get("persona"):
        logger.debug(f"prepare_streaming_messages_node: adding persona message for request_id={state.get('request_id')}")
        manager = RolePromptManager()
        persona = manager.get_prompt_by_id(state.get("persona"))
        messages.append(SystemMessage(content=persona.label))
    
    # Process user messages
    for msg in state["messages"]:
        if isinstance(msg, dict):
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        else:
            messages.append(msg)
    
    # Initialize streaming queue if not present
    if "stream_queue" not in state:
        state["stream_queue"] = asyncio.Queue()
    
    return {
        "prepared_messages": messages,
        "start_time": time.time(),
        "token_count": 0
    }

async def streaming_completion_node(state: StreamingState) -> Dict[str, Any]:
    """Streaming completion node"""
    request_id = state["request_id"]
    
    try:
        logger.debug(f"streaming_completion_node: Starting streaming completion for request {request_id}")
        
        # Get the streaming model
        model = get_llm_dyn(
            model_name=state["model"],
            chat=state.get("chat", True),
            require_stream=True
        )
        logger.debug(f"streaming_completion_node: Model loaded for request {request_id}")
        
        # Bind streaming
        model = model.bind(stream=True)
        logger.debug(f"streaming_completion_node: Model bound to stream for request {request_id}")
        
        # Create streaming callback handler
        callback_handler = StreamingCallbackHandler(
            queue=state["stream_queue"],
            request_id=request_id
        )
        logger.debug(f"streaming_completion_node: Callback handler created for request {request_id}")
        
        # Configure with callback
        config = RunnableConfig(callbacks=[callback_handler])
        
        # Get prepared messages
        messages = state.get("prepared_messages", state["messages"])
        logger.debug(f"streaming_completion_node: Using {len(messages)} messages for request {request_id}")

        if state.get("persona"):
            manager = RolePromptManager()
            personaPrompt = manager.get_prompt_by_id(state.get("persona"))
            prompt = QUERY_PROCESSOR_PROMPT.format(
                user_query=messages,
                context = personaPrompt,
                additional_instructions = ""
            )
        else : 
            prompt = QUERY_PROCESSOR_PROMPT.format(
                user_query=messages,
                context = "",
                additional_instructions = ""
            )

        prompt = f"{BASE_MARKDOWN_SYSTEM_PROMPT}\n\n---\n\n{prompt}"
        logger.debug(f"streaming_completion_node: Prompt prepared for request {request_id}")
        
        # Start the streaming task
        if state.get("chat", True):
            # Chat-based streaming
            logger.debug(f"streaming_completion_node: Starting chat-based streaming for request {request_id}")
            await model.ainvoke(prompt, config=config)
        else:
            # Raw streaming
            prompt = messages[-1].content if messages else state["messages"][-1]["content"]
            logger.debug(f"streaming_completion_node: Starting raw streaming for request {request_id}")
            await model.ainvoke(prompt, config=config)
        
        logger.info(f"Streaming completion for {request_id} completed successfully")
        
        return {
            "completed": True
        }
        
    except asyncio.CancelledError:
        logger.info(f"Streaming completion cancelled for request {request_id}")
        await state["stream_queue"].put({
            "event": StreamEventType.ERROR,
            "data": {
                "error": "Request cancelled",
                "error_type": "CancelledError",
                "request_id": request_id,
                "timestamp": time.time()
            }
        })
        raise
    except Exception as e:
        logger.error(f"Streaming completion failed for {request_id}: {str(e)}", exc_info=True)
        await state["stream_queue"].put({
            "event": StreamEventType.ERROR,
            "data": {
                "error": str(e),
                "error_type": type(e).__name__,
                "request_id": request_id,
                "timestamp": time.time()
            }
        })
        raise

# Build the streaming graph
streaming_graph_builder = StateGraph(StreamingState)

streaming_graph_builder.add_node("prepare_streaming", prepare_streaming_messages_node)
streaming_graph_builder.add_node("stream_complete", streaming_completion_node)

streaming_graph_builder.add_edge(START, "prepare_streaming")
streaming_graph_builder.add_edge("prepare_streaming", "stream_complete")

# Compile the streaming graph
async_streaming_completion_graph = streaming_graph_builder.compile()

async def create_streaming_generator(state: StreamingState) -> AsyncGenerator[str, None]:
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
                    timeout=60.0
                )

                yield {
                    "event": event["event"],
                    "data": json.dumps(event["data"])
                }

                if event["event"] in [StreamEventType.DONE, StreamEventType.ERROR]:
                    break
                    
            except asyncio.TimeoutError:
                timeout_event = {
                    "event": StreamEventType.ERROR,
                    "data": {
                        "error": "Streaming timeout",
                        "error_type": "TimeoutError",
                        "request_id": state["request_id"],
                        "timestamp": time.time()
                    }
                }
                yield timeout_event
                break
                
    except Exception as e:
        logger.error(f"Error in streaming generator: {str(e)}", exc_info=True)
        error_event = {
            "event": StreamEventType.ERROR,
            "data": {
                "error": str(e),
                "error_type": type(e).__name__,
                "request_id": state["request_id"],
                "timestamp": time.time()
            }
        }
        yield error_event
    finally:
        # Ensure streaming task is properly cleaned up
        if 'streaming_task' in locals() and not streaming_task.done():
            streaming_task.cancel()
            try:
                await streaming_task
            except asyncio.CancelledError:
                pass